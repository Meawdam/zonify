import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { MongoMemoryServer } from "mongodb-memory-server";
import { UserModel } from "../src/modules/users/schema/user.schema.js";
import { MarketModel, CategoryModel, ShopModel, StallModel } from "../src/modules/catalog/catalog.schema.js";
import { bangkokDate } from "../src/modules/catalog/catalog.service.js";
import { BookingModel } from "../src/modules/bookings/booking.schema.js";

let mongo: MongoMemoryServer, server: Server, base: string;
const origin = "http://localhost:3000", cookies: string[] = [];
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("merchant_test"); process.env.JWT_SECRET = randomBytes(32).toString("hex"); process.env.APP_ORIGIN = origin;
  process.env.PROMPTPAY_ID = "0000000000"; process.env.PROMPTPAY_NAME = "QA ONLY - DO NOT TRANSFER";
  const { default: app } = await import("../src/app.js");
  const { connectDatabase } = await import("../src/config/database.js");
  await connectDatabase();
  await MarketModel.create({ _id: "market", name: "ตลาด", location: "กรุงเทพ" });
  await CategoryModel.create({ _id: "food", name: "อาหาร" });
  await StallModel.create({ _id: "stall", marketId: "market", code: "A01", row: "A", rowOrder: 0, column: 1, width: 2, depth: 2, pricePerDay: 100 });
  await ShopModel.create({ _id: "legacy", marketId: "market", categoryId: "food", name: "ร้านเดิม" });
  const password = await bcrypt.hash("merchant-test-123", 4);
  for (let i = 0; i < 2; i++) await UserModel.create({ name: `Merchant ${i}`, email: `merchant${i}@qa.test`, password, role: "customer" });
  await UserModel.create({ name: "Reviewer", email: "merchant2@qa.test", password, role: "manager" });
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}/api`;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(base + "/users/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: `merchant${i}@qa.test`, password: "merchant-test-123" }) });
    assert.equal(res.status, 200); cookies.push(res.headers.get("set-cookie")!.split(";")[0]!);
  }
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
async function request(path: string, method = "GET", body?: unknown, cookie = cookies[0]!, withOrigin = true) {
  const res = await fetch(base + path, { method, headers: { Cookie: cookie, ...(withOrigin ? { Origin: origin } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, cache: res.headers.get("cache-control"), data: await res.json().catch(() => null) };
}
const draft = { name: "ร้านทดสอบ", marketId: "market", categoryId: "food", description: "ขนมสด", hours: "09:00–17:00", phone: "0812345678", contactUrl: "https://example.com/shop" };

test("merchant shops require authentication and same-origin mutations", async () => {
  assert.equal((await request("/merchant/shops", "GET", undefined, "")).status, 401);
  assert.equal((await request("/merchant/shops", "POST", draft, cookies[0], false)).status, 403);
});
test("an account owns multiple shops but cannot see or edit another account or legacy shop", async () => {
  const first = await request("/merchant/shops", "POST", draft);
  assert.equal(first.status, 201); assert.equal(first.data.version, 0);
  const second = await request("/merchant/shops", "POST", { ...draft, name: "ร้านที่สอง" });
  assert.equal(second.status, 201); assert.notEqual(first.data.id, second.data.id);
  const own = await request("/merchant/shops"); assert.equal(own.data.items.length, 2); assert.match(own.cache!, /no-store/);
  assert.equal((await request("/merchant/shops", "GET", undefined, cookies[1])).data.items.length, 0);
  for (const id of [first.data.id, "legacy"]) {
    assert.equal((await request(`/merchant/shops/${id}`, "GET", undefined, cookies[1])).status, 404);
    assert.equal((await request(`/merchant/shops/${id}`, "PATCH", { name: "ยึดร้าน", version: 0 }, cookies[1])).status, 404);
  }
  assert.equal((await request(`/merchant/shops/${first.data.id}`, "PATCH", { name: "แก้ไขแล้ว", version: 0 })).status, 200);
  assert.equal((await request(`/merchant/shops/${first.data.id}`, "PATCH", { name: "ทับงาน", version: 0 })).status, 409);
  assert.equal((await request(`/shops/${first.data.id}`)).data.name, "แก้ไขแล้ว");
});
test("merchant cannot assign owner, location, moderation or invalid references", async () => {
  for (const extra of [{ ownerId: "someone" }, { stallId: "fake" }, { active: false }, { marketId: "missing" }, { categoryId: "missing" }, { contactUrl: "javascript:alert(1)" }]) {
    assert.equal((await request("/merchant/shops", "POST", { ...draft, ...extra })).status, 400);
  }
  const created = await request("/merchant/shops", "POST", draft); assert.equal(created.status, 201);
  for (const extra of [{ ownerId: "someone" }, { stallId: "fake" }, { active: true }, { marketId: "market" }]) {
    assert.equal((await request(`/merchant/shops/${created.data.id}`, "PATCH", { version: 0, ...extra })).status, 400);
  }
  await ShopModel.updateOne({ _id: created.data.id }, { $set: { active: false } });
  assert.equal((await request(`/merchant/shops/${created.data.id}`, "PATCH", { version: 0, name: "ร้านปิด" })).status, 200);
  assert.equal((await request(`/shops/${created.data.id}`)).status, 404);
  await CategoryModel.updateOne({ _id: "food" }, { $set: { active: false } });
  assert.equal((await request("/merchant/shops", "POST", draft)).status, 400);
  await CategoryModel.updateOne({ _id: "food" }, { $set: { active: true } });
});
test("shop photo upload checks ownership, image bytes and version; public image follows moderation", async () => {
  const created = await request("/merchant/shops", "POST", draft); assert.equal(created.status, 201);
  const id = created.data.id;
  const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "red" } }).png().toBuffer();
  async function upload(bytes: Uint8Array, type = "image/png", cookie = cookies[0]!, version = "0") {
    const body = new FormData(); body.set("photo", new Blob([new Uint8Array(bytes)], { type }), "shop.png"); body.set("version", version);
    return fetch(`${base}/merchant/shops/${id}/photo`, { method: "POST", headers: { Cookie: cookie, Origin: origin }, body });
  }
  assert.equal((await upload(png, "image/png", cookies[1])).status, 404);
  assert.equal((await upload(Buffer.from("not an image"))).status, 400);
  assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  const saved = await upload(png); assert.equal(saved.status, 200);
  const shop = await saved.json(); assert.equal(shop.version, 1); assert.equal(typeof shop.photoUrl, "string");
  const publicImage = await fetch(base.replace(/\/api$/, "") + shop.photoUrl);
  assert.equal(publicImage.status, 200); assert.equal(publicImage.headers.get("content-type"), "image/jpeg");
  assert.equal((await sharp(Buffer.from(await publicImage.arrayBuffer())).metadata()).format, "jpeg");
  assert.equal((await upload(png)).status, 409);
  await ShopModel.updateOne({ _id: id }, { $set: { active: false } });
  assert.equal((await fetch(base.replace(/\/api$/, "") + shop.photoUrl)).status, 404);
});
test("holds require an owned shop in the same market and retain shop snapshot on retry and rename", async () => {
  const first = await request("/merchant/shops", "POST", draft), second = await request("/merchant/shops", "POST", { ...draft, name: "ร้านสอง" });
  const body = { stallId: "stall", date: bangkokDate(), shopId: first.data.id };
  assert.equal((await request("/bookings/holds", "POST", { stallId: "stall", date: body.date })).status, 400);
  assert.equal((await request("/bookings/holds", "POST", body, cookies[1])).status, 404);
  const created = await request("/bookings/holds", "POST", body); assert.equal(created.status, 201);
  assert.equal(created.data.shop.id, first.data.id); assert.equal(created.data.shop.name, draft.name);
  assert.equal((await request("/bookings/holds", "POST", body)).data.id, created.data.id);
  assert.equal((await request("/bookings/holds", "POST", { ...body, shopId: second.data.id })).status, 409);
  await request(`/merchant/shops/${first.data.id}`, "PATCH", { version: 0, name: "เปลี่ยนชื่อ" });
  assert.equal((await request(`/bookings/${created.data.id}`)).data.shop.name, draft.name);
  assert.equal((await request(`/bookings/me?shop=${first.data.id}`)).data.total, 1);
  assert.equal((await request(`/bookings/me?shop=${second.data.id}`)).data.total, 0);
});
test("merchant overview counts all records, scopes accounts and separates past confirmed bookings", async () => {
  const list = await request("/bookings/me"); const sample = await BookingModel.findById(list.data.items[0].id).lean(); assert(sample);
  for (let n = 0; n < 14; n++) await BookingModel.create({ ...sample, _id: `history-${n}`, stallId: `old-${n}`, status: "confirmed", date: "2020-01-01", expiresAt: null });
  const overview = await request("/merchant/overview"); assert.equal(overview.status, 200);
  assert.equal(overview.data.counts.history, 14); assert.equal(overview.data.counts.actionRequired, 1);
  assert.equal((await request("/merchant/overview", "GET", undefined, cookies[1])).data.counts.history, 0);
  assert.equal((await request("/bookings/me?group=history")).data.total, 14);
  assert.equal((await request("/bookings/me?group=current")).data.total, 1);
});
test("public merchant shop exposes contacts and confirmed locations for the requested date only", async () => {
  const booking = (await request("/bookings/me?group=current")).data.items[0];
  const path = `/shops/${booking.shop.id}?date=${booking.date}`;
  const before = await request(path); assert.equal(before.data.phone, draft.phone); assert.equal(before.data.stall, null);
  await BookingModel.updateOne({ _id: booking.id }, { $set: { status: "confirmed", expiresAt: null } });
  const after = await request(path); assert.equal(after.data.locations[0].id, "stall"); assert.equal(after.data.locationDate, booking.date);
  assert.equal((await request(`/shops/${booking.shop.id}?date=2020-01-02`)).data.locations.length, 0);
  assert.equal("ownerId" in after.data, false);
});
test("owned shop journey completes hold, QR, rejection, resubmission and manager confirmation", async () => {
  const shop = (await request("/merchant/shops", "POST", draft)).data;
  const day = new Date(bangkokDate() + "T00:00:00Z"); day.setUTCDate(day.getUTCDate() + 1);
  const held = await request("/bookings/holds", "POST", { stallId: "stall", date: day.toISOString().slice(0, 10), shopId: shop.id }); assert.equal(held.status, 201);
  const id = held.data.id;
  assert.equal((await request(`/bookings/${id}/confirm`, "POST", {})).status, 200);
  assert.equal((await request(`/bookings/${id}/payment/qr`, "POST", {})).status, 200);
  const png = await sharp({ create: { width: 32, height: 40, channels: 3, background: "blue" } }).png().toBuffer();
  async function slip() { const body = new FormData(); body.set("amount", "100"); body.set("transferredAt", new Date().toISOString()); body.set("reference", "MERCHANT-QA-12345"); body.set("slip", new Blob([new Uint8Array(png)], { type: "image/png" }), "slip.png"); const response = await fetch(`${base}/bookings/${id}/payment/slip`, { method: "POST", headers: { Cookie: cookies[0]!, Origin: origin }, body }); assert.equal(response.status, 201); return response.json(); }
  const first = await slip();
  const rejected = await request(`/admin/bookings/${id}/payment/review`, "POST", { decision: "reject", attemptId: first.payment.attempts.at(-1).id, reason: "กรุณาส่งภาพชัดขึ้น" }, cookies[2]); assert.equal(rejected.status, 200); assert.equal(rejected.data.status, "pending_payment");
  assert.equal((await request(`/bookings/${id}/payment/qr`, "POST", {})).status, 200);
  const second = await slip();
  const approved = await request(`/admin/bookings/${id}/payment/review`, "POST", { decision: "approve", attemptId: second.payment.attempts.at(-1).id, verifiedReference: "MERCHANT-QA-12345" }, cookies[2]);
  assert.equal(approved.status, 200); assert.equal(approved.data.status, "confirmed"); assert.equal(approved.data.shop.id, shop.id);
  assert.equal((await request(`/bookings/${id}`, "GET", undefined, cookies[1])).status, 404);
  assert.equal((await request(`/shops/${shop.id}?date=${held.data.date}`)).data.stall.id, "stall");
});
test("wrong-market and moderated shops cannot reserve; same-account concurrent shops never share a hold", async () => {
  await MarketModel.create({ _id: "other", name: "ตลาดอื่น", location: "กรุงเทพ" });
  const wrong = (await request("/merchant/shops", "POST", { ...draft, marketId: "other" })).data;
  const shop = (await request("/merchant/shops", "POST", draft)).data;
  const day = new Date(bangkokDate() + "T00:00:00Z"); day.setUTCDate(day.getUTCDate() + 2);
  const body = { stallId: "stall", date: day.toISOString().slice(0, 10), shopId: wrong.id };
  assert.equal((await request("/bookings/holds", "POST", body)).status, 409);
  await ShopModel.updateOne({ _id: shop.id }, { $set: { active: false } });
  assert.equal((await request("/bookings/holds", "POST", { ...body, shopId: shop.id })).status, 409);
  await ShopModel.updateOne({ _id: shop.id }, { $set: { active: true } });
  const other = (await request("/merchant/shops", "POST", draft)).data;
  const results = await Promise.all([shop, other].map(s => request("/bookings/holds", "POST", { ...body, shopId: s.id })));
  assert.equal(results.filter(r => r.status === 201).length, 1); assert.equal(results.filter(r => r.status === 409).length, 1);
});
test("legacy bookings without a shop remain readable, payable and cancellable", async () => {
  const source = await BookingModel.findOne({ status: "held" }).lean(); assert(source);
  await BookingModel.create({ ...source, _id: "legacy-booking", stallId: "legacy-stall", shopId: null, shopSnapshot: null, status: "pending_payment", expiresAt: new Date(Date.now() + 60000) });
  const detail = await request("/bookings/legacy-booking"); assert.equal(detail.status, 200); assert.equal(detail.data.shop, null);
  assert.equal((await request("/bookings/legacy-booking/payment/qr", "POST", {})).status, 200);
  assert.equal((await request("/bookings/legacy-booking/cancel", "POST", { reason: "ทดสอบข้อมูลเดิม" })).status, 200);
});
