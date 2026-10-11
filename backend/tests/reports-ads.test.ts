import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { MongoMemoryServer } from "mongodb-memory-server";
import { UserModel } from "../src/modules/users/schema/user.schema.js";
import { MarketModel, CategoryModel, StallModel, ShopModel } from "../src/modules/catalog/catalog.schema.js";
import { BookingModel } from "../src/modules/bookings/booking.schema.js";
import { AdvertisementModel } from "../src/modules/advertisements/advertisement.schema.js";
import { publicAdvertisements } from "../src/modules/advertisements/advertisement.route.js";
import { csvCell } from "../src/modules/reports/report.service.js";
import { bangkokDate } from "../src/modules/catalog/catalog.service.js";
import { seedAdvertisements } from "../src/scripts/seed-ads.js";
let mongo: MongoMemoryServer, server: Server, base: string, buyer: string, ownerId: string;
const cookies: string[] = [], origin = "http://localhost:3000", today = bangkokDate();
const tomorrow = new Date(new Date(today + "T00:00:00Z").valueOf() + 86400_000).toISOString().slice(0, 10);
before(async () => {
  mongo = await MongoMemoryServer.create(); process.env.MONGO_URI = mongo.getUri("zonify_reports_ads_test"); process.env.JWT_SECRET = randomBytes(32).toString("hex"); process.env.APP_ORIGIN = origin;
  const { default: app } = await import("../src/app.js"); await (await import("../src/config/database.js")).connectDatabase();
  await MarketModel.create([{ _id: "report-market", name: "ตลาดรายงาน", location: "เชียงใหม่" }, { _id: "other-market", name: "ตลาดอีกแห่ง", location: "เชียงใหม่" }]);
  await CategoryModel.create({ _id: "report-category", name: "อาหาร" });
  await ShopModel.create([{ _id: "report-shop", name: "ร้านโฆษณา", marketId: "report-market", categoryId: "report-category" }, { _id: "other-shop", name: "ร้านอื่น", marketId: "other-market", categoryId: "report-category" }]);
  for (let n = 1; n <= 7; n++) await StallModel.create({ _id: "report-stall-" + n, marketId: n === 4 ? "other-market" : "report-market", code: "R" + n, row: "R", rowOrder: 0, column: n, width: 2, depth: 2, pricePerDay: 100 });
  const password = await bcrypt.hash("report-test-123", 4);
  for (const [n, role] of ["customer", "manager", "owner"].entries()) { const user = await UserModel.create({ name: role, email: "report" + n + "@qa.test", password, role }); if (n === 0) buyer = String(user._id); if (n === 2) ownerId = String(user._id); }
  server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = "http://127.0.0.1:" + address.port + "/api";
  for (let n = 0; n < 3; n++) { const res = await fetch(base + "/users/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "report" + n + "@qa.test", password: "report-test-123" }) }); assert.equal(res.status, 200); cookies.push(res.headers.get("set-cookie")!.split(";")[0]!); }
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => { await AdvertisementModel.deleteMany({}); await BookingModel.deleteMany({}); await MarketModel.updateMany({}, { $set: { active: true } }); await CategoryModel.updateMany({}, { $set: { active: true } }); await ShopModel.updateMany({}, { $set: { active: true } }); await UserModel.updateOne({ _id: ownerId }, { $set: { role: "owner" } }); });
async function request(path: string, method = "GET", body?: unknown, who = 1, sendOrigin = true) {
  const res = await fetch(base + path, { method, headers: { Cookie: cookies[who] ?? "", ...(sendOrigin ? { Origin: origin } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: res.status, data: await res.json() };
}
const ad = () => ({ name: "ชวนแวะตลาด", marketId: "report-market", shopId: "report-shop", description: "ข่าวทดสอบ", startsOn: today, endsOn: today, photo: "canal", order: 0, active: true });
async function finances() {
  const baseRow = { userId: buyer, userSnapshot: { id: buyer, name: "Buyer", email: "buyer@qa.test", phone: "", role: "customer" }, date: "2026-10-20", marketId: "report-market", stallSnapshot: { code: "R", width: 2, depth: 2, marketName: '=HYPERLINK("bad")', zoneName: "" } };
  const rows = [
    { status: "confirmed", price: 125.25, paidAt: new Date("2026-10-11T00:00:00+07:00") },
    { status: "cancelled", price: 30.10, paidAt: new Date("2026-10-11T23:59:59+07:00"), refund: { status: "pending", amount: 30.10, requestedAt: new Date("2026-10-12T12:00:00+07:00") } },
    { status: "cancelled", price: 40.05, paidAt: new Date("2026-10-10T23:59:59+07:00"), refund: { status: "refunded", amount: 40.05, requestedAt: new Date("2026-10-11T00:00:00+07:00"), completedAt: new Date("2026-10-11T00:00:00+07:00"), reference: "REFUND-3" } },
    { marketId: "other-market", status: "confirmed", price: 10, paidAt: new Date("2026-10-12T00:00:00+07:00") },
    { status: "pending_payment", price: 999, expiresAt: new Date("2099-01-01T00:00:00Z") },
    { status: "held", price: 7.01, expiresAt: new Date(0) },
    { status: "cancelled", price: 20.20, paidAt: new Date("2026-10-09T12:00:00+07:00"), refund: { status: "refunded", amount: 20.20, requestedAt: new Date("2026-10-12T12:00:00+07:00"), completedAt: new Date("2026-10-12T12:00:00+07:00"), reference: "REFUND-7" } },
  ];
  for (const [n, row] of rows.entries()) await BookingModel.create({ ...baseRow, ...row, _id: "report-booking-" + (n + 1), stallId: "report-stall-" + (n + 1) });
}
test("ads CRUD requires manager/owner, Origin, strict fields, valid dates and matching shop/market", async () => {
  assert.equal((await request("/admin/advertisements", "POST", ad(), 99)).status, 401); assert.equal((await request("/admin/advertisements", "POST", ad(), 0)).status, 403); assert.equal((await request("/admin/advertisements", "POST", ad(), 1, false)).status, 403);
  for (const patch of [{ startsOn: "2026-02-30" }, { endsOn: "2020-01-01" }, { marketId: "missing" }, { shopId: "other-shop" }, { href: "https://evil.test" }]) assert.equal((await request("/admin/advertisements", "POST", { ...ad(), ...patch })).status, 400);
  assert.equal((await request("/admin/advertisements", "POST", ad(), 2)).status, 201);
});
test("public ads obey inclusive Bangkok calendar boundaries and hide future, disabled or inactive targets", async () => {
  const created = await request("/admin/advertisements", "POST", ad()); assert.equal(created.status, 201);
  await request("/admin/advertisements", "POST", { ...ad(), startsOn: tomorrow, endsOn: tomorrow }); await request("/admin/advertisements", "POST", { ...ad(), active: false });
  const first = await publicAdvertisements(new Date(today + "T00:00:00+07:00")); assert.equal(first.items.length, 1); assert.equal(first.items[0]!.href, "/shops/report-shop"); assert(!JSON.stringify(first).includes("version"));
  assert.equal((await publicAdvertisements(new Date(today + "T23:59:59+07:00"))).items.length, 1);
  assert.equal((await publicAdvertisements(new Date(tomorrow + "T00:00:00+07:00"))).items.length, 1); // next scheduled ad replaces today's.
  await ShopModel.updateOne({ _id: "report-shop" }, { $set: { active: false } }); assert.equal((await publicAdvertisements()).items.length, 0);
  await ShopModel.updateOne({ _id: "report-shop" }, { $set: { active: true } }); await CategoryModel.updateOne({ _id: "report-category" }, { $set: { active: false } }); assert.equal((await publicAdvertisements()).items.length, 0);
  await CategoryModel.updateOne({ _id: "report-category" }, { $set: { active: true } }); await MarketModel.updateOne({ _id: "report-market" }, { $set: { active: false } }); assert.equal((await publicAdvertisements()).items.length, 0);
});
test("ad updates preserve market membership, concurrent edits reject stale version, soft disable preserves history", async () => {
  const created = (await request("/admin/advertisements", "POST", { ...ad(), shopId: null })).data;
  assert.equal((await request("/admin/advertisements/" + created.id, "PATCH", { version: 0, marketId: "other-market" })).status, 400);
  const edits = await Promise.all([request("/admin/advertisements/" + created.id, "PATCH", { version: 0, name: "New one" }), request("/admin/advertisements/" + created.id, "PATCH", { version: 0, name: "New two" })]); assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
  assert.equal((await request("/admin/advertisements/" + created.id, "DELETE", { version: 1 })).status, 200); assert.equal(await AdvertisementModel.countDocuments(), 1); assert.equal((await publicAdvertisements()).items.length, 0);
  const refs = (await request("/admin/references")).data; assert.equal(refs.shops.length, 2);
});
test("advertisement seed is idempotent and never overwrites edited, rescheduled or disabled ads", async () => {
  await seedAdvertisements(today); const rows = await AdvertisementModel.find().lean(); assert.equal(rows.length, 2);
  const id = rows[0]!._id; await AdvertisementModel.updateOne({ _id: id }, { $set: { name: "ข้อความผู้จัดการ", active: false, endsOn: "2030-01-01" } });
  await seedAdvertisements(tomorrow); assert.equal(await AdvertisementModel.countDocuments(), 2); const kept = await AdvertisementModel.findById(id).lean(); assert.equal(kept!.name, "ข้อความผู้จัดการ"); assert.equal(kept!.active, false); assert.equal(kept!.endsOn, "2030-01-01");
});
test("dashboards/reports require fresh database roles and owner revenue/export reject manager and customer", async () => {
  for (const path of ["/admin/dashboard", "/admin/reports/bookings", "/admin/reports/bookings/export", "/owner/reports/revenue", "/owner/reports/revenue/export"]) {
    const res = await fetch(base + path); assert.equal(res.status, 401); assert.equal((await fetch(base + path, { headers: { Cookie: cookies[0]! } })).status, 403);
  }
  assert.equal((await request("/owner/reports/revenue")).status, 403); assert.equal((await request("/owner/reports/revenue", "GET", undefined, 2)).status, 200);
  await UserModel.updateOne({ _id: ownerId }, { $set: { role: "customer" } }); assert.equal((await request("/owner/reports/revenue", "GET", undefined, 2)).status, 403);
});
test("booking reports use booking date/status snapshots, expire stale holds, filter markets and group months", async () => {
  await finances(); const q = "?from=2026-10-20&to=2026-10-20";
  const result = await request("/admin/reports/bookings" + q); assert.equal(result.status, 200); assert.equal(result.data.total, 7); assert.equal(result.data.basis, "booking_date");
  assert.equal(result.data.rows.find((r: { status: string }) => r.status === "expired").count, 1);
  assert.equal((await request("/admin/reports/bookings" + q + "&market=other-market&group=month")).data.rows[0].period, "2026-10");
  const text = JSON.stringify(result.data); assert(!text.includes("buyer@")); assert(!text.includes("password")); assert(!text.includes("slip"));
});
test("revenue totals use exact cents and payment/refund event dates with inclusive Thai midnight boundaries", async () => {
  await finances(); const result = await request("/owner/reports/revenue?from=2026-10-11&to=2026-10-11", "GET", undefined, 2); assert.equal(result.status, 200);
  assert.deepEqual(result.data.totals, { received: 155.35, refunded: 40.05, net: 115.3 }); assert.equal(result.data.rows.length, 1); assert.equal(result.data.rows[0].period, "2026-10-11");
  assert.equal(result.data.pendingRefunds.amount, 30.1); assert.equal(result.data.pendingRefunds.count, 1);
  const next = await request("/owner/reports/revenue?from=2026-10-12&to=2026-10-12", "GET", undefined, 2); assert.deepEqual(next.data.totals, { received: 10, refunded: 20.2, net: -10.2 });
  const other = await request("/owner/reports/revenue?from=2026-10-11&to=2026-10-12&market=other-market&group=month", "GET", undefined, 2); assert.deepEqual(other.data.totals, { received: 10, refunded: 0, net: 10 }); assert.equal(other.data.rows[0].period, "2026-10"); assert.equal(other.data.pendingRefunds.count, 0);
});
test("dashboard reads public authoritative floor availability and separates unpaid bookings from received cash", async () => {
  await finances(); const result = await request("/admin/dashboard?date=2026-10-20&market=report-market"); assert.equal(result.status, 200); assert.equal(result.data.markets, 1); assert.equal(result.data.shops, 1);
  assert.equal(result.data.availability.booked, 2); assert.equal(result.data.bookings.expired, 1); assert.equal(result.data.bookings.pending_payment, 1); assert.deepEqual(result.data.payments, { received: 0, refunded: 0, net: 0 });
  await CategoryModel.updateOne({ _id: "report-category" }, { $set: { active: false } }); assert.equal((await request("/admin/dashboard")).data.shops, 0);
});
test("report date windows/unknown fields fail precisely, empty reports remain zero and CSV prevents formula injection", async () => {
  for (const suffix of ["?from=2026-10-20&to=2026-10-01", "?from=2025-01-01&to=2026-10-01", "?from=2026-02-30", "?group=year", "?role=owner"]) assert.equal((await request("/admin/reports/bookings" + suffix)).status, 400);
  assert.deepEqual((await request("/owner/reports/revenue", "GET", undefined, 2)).data.totals, { received: 0, refunded: 0, net: 0 });
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"'); assert.equal(csvCell(-10.2), '"-10.2"'); assert.equal(csvCell("a,b\nline"), '"a,b\nline"'); assert.equal(csvCell(" +calc"), '"\' +calc"');
  await finances(); const res = await fetch(base + "/owner/reports/revenue/export?from=2026-10-12&to=2026-10-12", { headers: { Cookie: cookies[2]! } }); assert.equal(res.status, 200); assert.match(res.headers.get("content-type")!, /text\/csv/); assert.match(res.headers.get("cache-control")!, /no-store/); const text = await res.text(); assert(text.includes("'=HYPERLINK")); assert(text.includes('"-20.2"')); assert(!text.includes("buyer@"));
});
