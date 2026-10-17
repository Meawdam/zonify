import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { MongoMemoryServer } from "mongodb-memory-server";
import { UserModel } from "../src/modules/users/schema/user.schema.js";
import { MarketModel, ZoneModel, StallModel, StallDayStateModel, ShopModel, CategoryModel } from "../src/modules/catalog/catalog.schema.js";
import { BookingModel } from "../src/modules/bookings/booking.schema.js";
import { createHold, confirmBooking, cancelBooking, expireBookings, HOLD_MS, PAYMENT_MS } from "../src/modules/bookings/booking.service.js";
import { bangkokDate, floorPlan } from "../src/modules/catalog/catalog.service.js";
import { startBookingExpiry } from "../src/modules/bookings/booking.worker.js";
let mongo: MongoMemoryServer, server: Server, base: string;
const origin = "http://localhost:3000", userIds: string[] = [], cookies: string[] = [];
let manager = "", owner = "";
const tomorrow = new Date(bangkokDate() + "T00:00:00Z"); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const date = tomorrow.toISOString().slice(0, 10);
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("zonify_booking_test"); process.env.JWT_SECRET = randomBytes(32).toString("hex"); process.env.APP_ORIGIN = origin;
  const { default: app } = await import("../src/app.js"); const { connectDatabase } = await import("../src/config/database.js");
  await connectDatabase();
  await MarketModel.create({ _id: "book-market", name: "ตลาดจอง", location: "เชียงใหม่", description: "" });
  await ZoneModel.create({ _id: "book-zone", marketId: "book-market", name: "โซนจอง" });
  for (let n = 1; n <= 2; n++) await StallModel.create({ _id: "book-stall-" + n, marketId: "book-market", zoneId: "book-zone", code: "T0" + n, row: "T", rowOrder: 0, column: n, width: 2, depth: 2, pricePerDay: 125.25 });
  const password = await bcrypt.hash("booking-test-123", 4);
  for (let n = 0; n < 20; n++) {
    const user = await UserModel.create({ name: "Buyer " + n, email: "buyer" + n + "@qa.test", password, role: "customer" }); userIds.push(String(user._id));
  }
  for (const role of ["manager", "owner"]) await UserModel.create({ name: role, email: role + "@qa.test", password, role });
  await CategoryModel.create({ _id: "book-food", name: "อาหาร" });
  await ShopModel.create({ _id: "book-shop", ownerId: userIds[0], marketId: "book-market", categoryId: "book-food", name: "ร้านทดสอบ" });
  for (const ownerId of userIds) await ShopModel.create({ _id: "shop-" + ownerId, ownerId, marketId: "book-market", categoryId: "book-food", name: "ร้านแข่งขัน" });
  server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = "http://127.0.0.1:" + address.port + "/api";
  async function login(email: string) {
    const res = await fetch(base + "/users/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "booking-test-123" }) }); assert.equal(res.status, 200); return res.headers.get("set-cookie")!.split(";")[0]!;
  }
  cookies.push(await login("buyer0@qa.test"), await login("buyer1@qa.test")); manager = await login("manager@qa.test"); owner = await login("owner@qa.test");
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await BookingModel.deleteMany({}); await StallDayStateModel.deleteMany({});
  await MarketModel.updateOne({ _id: "book-market" }, { $set: { active: true } });
  await ZoneModel.updateOne({ _id: "book-zone" }, { $set: { active: true } });
  await StallModel.updateMany({ marketId: "book-market" }, { $set: { enabled: true, pricePerDay: 125.25 } });
});
async function request(path: string, method = "GET", body?: unknown, cookie = cookies[0]!, originHeader = true) {
  const response = await fetch(base + path, { method, headers: { Cookie: cookie, ...(originHeader ? { Origin: origin } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
const hold = () => request("/bookings/holds", "POST", { stallId: "book-stall-1", date, shopId: "book-shop" });

test("booking endpoints require session, correct Origin and a single valid future stall/date", async () => {
  assert.equal((await request("/bookings/me", "GET", undefined, "")).status, 401);
  assert.equal((await request("/bookings/holds", "POST", { stallId: "book-stall-1", date }, cookies[0], false)).status, 403);
  for (const body of [{ stallId: ["book-stall-1", "book-stall-2"], date }, { stallId: "book-stall-1", date: "2020-01-01" }, { stallId: "book-stall-1", date: "2026-02-30" }, { stallId: "book-stall-1", date, price: 1 }, { stallId: "book-stall-1", date: "9999-01-01" }]) assert.equal((await request("/bookings/holds", "POST", body)).status, 400);
  assert.equal((await request("/bookings/holds", "POST", { stallId: "missing", date, shopId: "book-shop" })).status, 404);
});
test("twenty distinct concurrent buyers produce exactly one slot/day claim", async () => {
  const results = await Promise.allSettled(userIds.map(id => createHold(id, "book-stall-1", date, "shop-" + id)));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert(results.filter(r => r.status === "rejected").every(r => r.status === "rejected" && r.reason.status === 409));
  assert.equal(await BookingModel.countDocuments({ status: "held" }), 1);
});
test("same-owner retries return the same hold without extending its expiry or repricing", async () => {
  const first = await hold(); assert.equal(first.status, 201);
  await StallModel.updateOne({ _id: "book-stall-1" }, { $set: { pricePerDay: 999 } });
  const retry = await hold(); assert.equal(retry.data.id, first.data.id); assert.equal(retry.data.expiresAt, first.data.expiresAt); assert.equal(retry.data.price, 125.25);
  const result = await request("/bookings/" + first.data.id + "/confirm", "POST", {}); assert.equal(result.status, 200); assert.equal(result.data.status, "pending_payment"); assert.equal(result.data.price, 125.25);
  assert.equal((await floorPlan("book-market", date)).stalls[0]!.status, "booked");
});
test("public status changes on hold/confirmation/cancellation and a different day remains free", async () => {
  const created = await hold();
  assert.equal((await floorPlan("book-market", date)).stalls[0]!.status, "held");
  assert.equal((await floorPlan("book-market", "2030-01-01")).stalls[0]!.status, "available");
  const result = await request("/bookings/" + created.data.id + "/cancel", "POST", { reason: "เปลี่ยนวัน" }); assert.equal(result.status, 200);
  assert.equal(result.data.cancelReason, "เปลี่ยนวัน"); assert.equal(result.data.status, "cancelled");
  assert.equal((await floorPlan("book-market", date)).stalls[0]!.status, "available");
  assert.equal((await request("/bookings/me?status=cancelled")).data.total, 1);
  assert(await BookingModel.exists({ _id: created.data.id }));
});
test("expired claims can be acquired by another buyer; stale operations cannot affect the successor", async () => {
  const now = new Date(), first = await createHold(userIds[0]!, "book-stall-1", date, "shop-" + userIds[0], now);
  const later = new Date(now.valueOf() + HOLD_MS + 1);
  assert.equal((await floorPlan("book-market", date, later)).stalls[0]!.status, "available");
  const successor = await createHold(userIds[1]!, "book-stall-1", date, "shop-" + userIds[1], later); assert.notEqual(successor.id, first.id);
  await assert.rejects(confirmBooking(String(first.id), userIds[0]!, later), (e: unknown) => !!e && typeof e === "object" && "status" in e && e.status === 409);
  await assert.rejects(cancelBooking(String(first.id), userIds[0]!, "ยกเลิก", false, later));
  assert.equal((await BookingModel.findById(String(first.id)).lean())!.status, "expired");
  assert.equal((await BookingModel.findById(String(successor.id)).lean())!.status, "held");
});
test("pending-payment deadline expires, preserves history and releases the unique claim", async () => {
  const now = new Date(), first = await createHold(userIds[0]!, "book-stall-1", date, "shop-" + userIds[0], now);
  const confirmed = await confirmBooking(String(first.id), userIds[0]!, now); assert.equal(confirmed.status, "pending_payment");
  const later = new Date(now.valueOf() + PAYMENT_MS + 1); await expireBookings(later);
  assert.equal((await BookingModel.findById(String(first.id)).lean())!.status, "expired");
  assert.equal((await createHold(userIds[1]!, "book-stall-1", date, "shop-" + userIds[1], later)).status, "held");
});
test("expiry worker updates overdue records automatically without deleting booking history", async () => {
  const first = await hold();
  await BookingModel.updateOne({ _id: first.data.id }, { $set: { expiresAt: new Date(0) } });
  const stop = startBookingExpiry();
  try {
    for (let attempt = 0; attempt < 20; attempt++) {
      if ((await BookingModel.findById(first.data.id).lean())?.status === "expired") break;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal((await BookingModel.findById(first.data.id).lean())!.status, "expired");
    assert.equal(await BookingModel.countDocuments(), 1);
  } finally { stop(); }
});
test("other customers cannot read, confirm or cancel an account's booking", async () => {
  const created = await hold();
  assert.equal((await request("/bookings/" + created.data.id, "GET", undefined, cookies[1])).status, 404);
  assert.equal((await request("/bookings/" + created.data.id + "/confirm", "POST", {}, cookies[1])).status, 404);
  assert.equal((await request("/bookings/" + created.data.id + "/cancel", "POST", { reason: "test" }, cookies[1])).status, 404);
  assert.equal((await request("/bookings/me", "GET", undefined, cookies[1])).data.total, 0);
  assert.equal((await request("/admin/bookings", "GET", undefined, cookies[0])).status, 403);
  const own = await request("/bookings/" + created.data.id); assert.equal(own.status, 200);
  assert.equal(own.data.customer.id, userIds[0]); assert(!JSON.stringify(own.data).includes("password")); assert(!JSON.stringify(own.data).includes("token"));
});
test("manager/owner can list and release holds, but release cannot cancel a confirmed transition", async () => {
  let created = await hold();
  assert.equal((await request("/admin/holds", "GET", undefined, manager)).data.total, 1);
  assert.equal((await request("/admin/bookings", "GET", undefined, owner)).data.total, 1);
  const released = await request("/admin/holds/" + created.data.id + "/release", "POST", { reason: "ผู้จัดการคืนล็อก" }, manager); assert.equal(released.status, 200);
  assert.equal(released.data.status, "cancelled");
  created = await hold(); await request("/bookings/" + created.data.id + "/confirm", "POST", {});
  assert.equal((await request("/admin/holds/" + created.data.id + "/release", "POST", { reason: "สายเกินไป" }, owner)).status, 409);
  assert.equal((await BookingModel.findById(created.data.id).lean())!.status, "pending_payment");
  assert.equal((await request("/admin/bookings/" + created.data.id + "/cancel", "POST", { reason: "จัดการยกเลิก" }, manager)).status, 200);
});
test("closed market/zone/stall and sample booked/held states block acquisition", async () => {
  await ZoneModel.updateOne({ _id: "book-zone" }, { $set: { active: false } }); assert.equal((await hold()).status, 409);
  await ZoneModel.updateOne({ _id: "book-zone" }, { $set: { active: true } });
  await MarketModel.updateOne({ _id: "book-market" }, { $set: { active: false } }); assert.equal((await hold()).status, 409);
  await MarketModel.updateOne({ _id: "book-market" }, { $set: { active: true } });
  await StallModel.updateOne({ _id: "book-stall-1" }, { $set: { enabled: false } }); assert.equal((await hold()).status, 409);
  await StallModel.updateOne({ _id: "book-stall-1" }, { $set: { enabled: true } });
  await StallDayStateModel.create({ stallId: "book-stall-1", date, status: "booked" }); assert.equal((await hold()).status, 409);
  await StallDayStateModel.updateOne({ stallId: "book-stall-1", date }, { $set: { status: "held", expiresAt: new Date(0) } }); assert.equal((await hold()).status, 201);
});
test("manager queries and customer history support date/market/status filtering and pagination", async () => {
  await hold(); await request("/bookings/holds", "POST", { stallId: "book-stall-2", date, shopId: "book-shop" });
  const one = await request("/bookings/me?limit=1&page=1"), two = await request("/bookings/me?limit=1&page=2");
  assert.equal(one.data.total, 2); assert.equal(one.data.pages, 2); assert.notEqual(one.data.items[0].id, two.data.items[0].id);
  assert.equal((await request("/admin/bookings?date=" + date + "&market=book-market&status=held", "GET", undefined, manager)).data.total, 2);
  assert.equal((await request("/bookings/me?limit=101")).status, 400);
});
