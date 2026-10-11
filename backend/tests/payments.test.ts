import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import sharp from "sharp";
import { MongoMemoryServer } from "mongodb-memory-server";
import { UserModel } from "../src/modules/users/schema/user.schema.js";
import { MarketModel, StallModel } from "../src/modules/catalog/catalog.schema.js";
import { BookingModel } from "../src/modules/bookings/booking.schema.js";
import { SlipModel } from "../src/modules/payments/payment.schema.js";
import { createHold, confirmBooking, expireBookings, cancelBooking } from "../src/modules/bookings/booking.service.js";
import { bangkokDate, floorPlan } from "../src/modules/catalog/catalog.service.js";
let mongo: MongoMemoryServer, server: Server, base: string, buyer: string, managerId: string;
let config: typeof import("../src/config/env.js").env;
const cookies: string[] = [], origin = "http://localhost:3000";
const day = new Date(bangkokDate() + "T00:00:00Z"); day.setUTCDate(day.getUTCDate() + 1); const date = day.toISOString().slice(0, 10);
let image: Buffer;
before(async () => {
  mongo = await MongoMemoryServer.create(); process.env.MONGO_URI = mongo.getUri("zonify_payment_test");
  process.env.JWT_SECRET = randomBytes(32).toString("hex"); process.env.APP_ORIGIN = origin;
  // Synthetic account only; no real bank transfer occurs in automated tests.
  process.env.PROMPTPAY_ID = "0000000000"; process.env.PROMPTPAY_NAME = "QA ONLY - DO NOT TRANSFER";
  const { default: app } = await import("../src/app.js");
  config = (await import("../src/config/env.js")).env;
  await (await import("../src/config/database.js")).connectDatabase();
  await MarketModel.create({ _id: "pay-market", name: "ตลาดทดสอบ", location: "เชียงใหม่" });
  for (let n = 1; n <= 3; n++) await StallModel.create({ _id: "pay-stall-" + n, marketId: "pay-market", code: "P0" + n, row: "P", rowOrder: 0, column: n, width: 2, depth: 2, pricePerDay: 125.25 });
  const password = await bcrypt.hash("payment-test-123", 4);
  for (const [n, role] of ["customer", "customer", "manager", "owner"].entries()) {
    const user = await UserModel.create({ name: "Payment " + n, email: "pay" + n + "@qa.test", password, role });
    if (n === 0) buyer = String(user._id); if (n === 2) managerId = String(user._id);
  }
  server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = "http://127.0.0.1:" + address.port + "/api";
  for (let n = 0; n < 4; n++) {
    const res = await fetch(base + "/users/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: "pay" + n + "@qa.test", password: "payment-test-123" }) }); assert.equal(res.status, 200); cookies.push(res.headers.get("set-cookie")!.split(";")[0]!);
  }
  image = await sharp({ create: { width: 64, height: 96, channels: 3, background: "white" } }).png().toBuffer();
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => { await BookingModel.deleteMany({}); await SlipModel.deleteMany({}); config.PROMPTPAY_ID = "0000000000"; config.PROMPTPAY_NAME = "QA ONLY - DO NOT TRANSFER"; });
async function request(path: string, body?: unknown, who = 0, sendOrigin = true) {
  const res = await fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { Cookie: cookies[who] ?? "", ...(sendOrigin ? { Origin: origin } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, data: await res.json() };
}
async function pending(stall = 1) { const hold = await createHold(buyer, "pay-stall-" + stall, date); const booking = await confirmBooking(hold.id as string, buyer); return booking.id as string; }
async function qr(id: string) { return request("/bookings/" + id + "/payment/qr", {}); }
async function upload(id: string, opts: { who?: number; amount?: string; reference?: string; data?: Buffer; type?: string; extra?: boolean; origin?: boolean } = {}) {
  const form = new FormData(); form.set("amount", opts.amount ?? "125.25"); form.set("transferredAt", new Date().toISOString()); form.set("reference", opts.reference ?? "TRANSFER-1234");
  form.set("slip", new Blob([new Uint8Array(opts.data ?? image)], { type: opts.type ?? "image/png" }), "../../unsafe-name.png");
  if (opts.extra) form.set("role", "owner");
  const res = await fetch(base + "/bookings/" + id + "/payment/slip", { method: "POST", headers: { Cookie: cookies[opts.who ?? 0]!, ...(opts.origin === false ? {} : { Origin: origin }) }, body: form });
  return { status: res.status, data: await res.json() };
}
function crc16(s: string) { let crc = 65535; for (const n of Buffer.from(s)) { crc ^= n << 8; for (let i = 0; i < 8; i++) crc = ((crc << 1) ^ (crc & 32768 ? 0x1021 : 0)) & 65535; } return crc.toString(16).toUpperCase().padStart(4, "0"); }
function tags(s: string) { const result: Record<string, string> = {}; for (let i = 0; i < s.length;) { const tag = s.slice(i, i + 2), len = Number(s.slice(i + 2, i + 4)); result[tag] = s.slice(i + 4, i + 4 + len); i += 4 + len; } return result; }

test("QR uses owned pending booking price, correct Thai tags/CRC, fixed recipient and no deadline extension", async () => {
  const id = await pending(), before = await BookingModel.findById(id).lean();
  const result = await qr(id); assert.equal(result.status, 200); assert.equal(result.data.amount, 125.25); assert.match(result.data.qrDataUrl, /^data:image\/png;base64,/);
  const payload = result.data.payload as string, parsed = tags(payload); assert.equal(parsed["01"], "12"); assert.equal(parsed["53"], "764"); assert.equal(parsed["58"], "TH"); assert.equal(parsed["54"], "125.25");
  assert.equal(tags(parsed["29"]!)["00"], "A000000677010111"); assert.equal(tags(parsed["29"]!)["01"], "0066000000000"); assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
  config.PROMPTPAY_ID = "0123456789"; config.PROMPTPAY_NAME = "Changed";
  assert.equal((await qr(id)).data.payload, payload); assert.equal((await BookingModel.findById(id).lean())!.expiresAt!.valueOf(), before!.expiresAt!.valueOf());
  assert.equal((await request("/bookings/" + id + "/payment/qr", {}, 1)).status, 404); assert.equal((await request("/bookings/" + id + "/payment/qr", {}, 0, false)).status, 403);
  assert.equal((await request("/bookings/" + id + "/payment/qr", { amount: 1 })).status, 400);
});
test("QR configuration is explicit; missing or malformed receiver fails safely, expired booking cannot pay", async () => {
  const id = await pending(); config.PROMPTPAY_ID = ""; assert.equal((await qr(id)).status, 503); config.PROMPTPAY_ID = "wrong"; assert.equal((await qr(id)).status, 503);
  config.PROMPTPAY_ID = "0000000000"; await BookingModel.updateOne({ _id: id }, { $set: { expiresAt: new Date(0) } }); assert.equal((await qr(id)).status, 409); assert.equal((await upload(id)).status, 409);
  assert.equal(await SlipModel.countDocuments(), 0);
});
test("valid slip is private, sanitized JPEG, creates review without claiming payment, and never expires during review", async () => {
  const id = await pending(); await qr(id); const result = await upload(id); assert.equal(result.status, 201); assert.equal(result.data.status, "payment_review"); assert.equal(result.data.payment.paidAt, null); assert.equal(result.data.expiresAt, null);
  const text = JSON.stringify(result.data); assert(!text.includes("slipHash")); assert(!text.includes("password")); assert(!text.includes("buffer"));
  const url = result.data.payment.attempts[0].slipUrl;
  for (const who of [0, 2, 3]) { const res = await fetch(new URL(url, base), { headers: { Cookie: cookies[who]! } }); assert.equal(res.status, 200); assert.equal(res.headers.get("content-type"), "image/jpeg"); assert.match(res.headers.get("cache-control")!, /no-store/); assert.equal(res.headers.get("x-content-type-options"), "nosniff"); assert.equal((await res.arrayBuffer()).byteLength > 0, true); }
  assert.equal((await fetch(new URL(url, base), { headers: { Cookie: cookies[1]! } })).status, 404); assert.equal((await fetch(new URL(url, base))).status, 401);
  await expireBookings(new Date(Date.now() + 48 * 3600_000)); assert.equal((await BookingModel.findById(id).lean())!.status, "payment_review");
  assert.equal((await request("/bookings/" + id + "/cancel", { reason: "cancel" })).status, 409); assert.equal((await request("/admin/bookings/" + id + "/cancel", { reason: "cancel" }, 2)).status, 409);
  assert.equal((await floorPlan("pay-market", date)).stalls.find(s => s.id === "pay-stall-1")!.status, "booked");
});
test("slip checks Origin, ownership, QR issuance, MIME/magic/decode, size and strict multipart fields", async () => {
  const id = await pending(); assert.equal((await upload(id)).status, 409); await qr(id);
  assert.equal((await upload(id, { who: 1 })).status, 404); assert.equal((await upload(id, { origin: false })).status, 403);
  assert.equal((await upload(id, { data: Buffer.from('<svg onload="alert(1)"/>'), type: "image/png" })).status, 400);
  assert.equal((await upload(id, { type: "image/jpeg" })).status, 400);
  assert.equal((await upload(id, { data: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) })).status, 400);
  assert.equal((await upload(id, { data: Buffer.alloc(5 * 1024 * 1024 + 1) })).status, 413);
  assert.equal((await upload(id, { amount: "125.255" })).status, 400); assert.equal((await upload(id, { reference: "<script>" })).status, 400); assert.equal((await upload(id, { extra: true })).status, 400);
  const malformed = await fetch(base + "/bookings/" + id + "/payment/slip", { method: "POST", headers: { Cookie: cookies[0]!, Origin: origin, "Content-Type": "multipart/form-data; boundary=broken" }, body: "--broken\r\ninvalid" });
  assert.equal(malformed.status, 400);
  assert.equal(await SlipModel.countDocuments(), 0); assert.equal((await BookingModel.findById(id).lean())!.status, "pending_payment");
});
test("concurrent approvals cannot consume the same bank transaction for different bookings", async () => {
  const ids = [await pending(1), await pending(2)]; const attempts: string[] = [];
  for (const [index, id] of ids.entries()) {
    await qr(id); const data = await sharp({ create: { width: 48, height: 72, channels: 3, background: index ? "blue" : "green" } }).png().toBuffer();
    attempts.push((await upload(id, { data })).data.payment.attempts[0].id);
  }
  const results = await Promise.all(ids.map((id, index) => request("/admin/bookings/" + id + "/payment/review", { decision: "approve", attemptId: attempts[index], verifiedReference: "BANK-SHARED-1" }, index + 2)));
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]); assert.equal(await BookingModel.countDocuments({ status: "confirmed" }), 1); assert.equal(await BookingModel.countDocuments({ status: "payment_review" }), 1);
});
test("concurrent uploads accept exactly one, retain one image, and later uploads cannot overwrite review", async () => {
  const id = await pending(); await qr(id);
  const results = await Promise.all(Array.from({ length: 4 }, () => upload(id)));
  assert.equal(results.filter(r => r.status === 201).length, 1); assert.equal(results.filter(r => r.status === 409).length, 3);
  assert.equal(await SlipModel.countDocuments(), 1); assert.equal((await BookingModel.findById(id).lean())!.paymentAttempts.length, 1);
});
test("manager rejects with reason; customer retries; stale review cannot approve newer slip; owner verifies payment", async () => {
  const id = await pending(); await qr(id); const first = (await upload(id)).data.payment.attempts[0].id;
  assert.equal((await request("/admin/bookings/" + id + "/payment/review", { decision: "approve", attemptId: first, verifiedReference: "BANK-REF-1" })).status, 403);
  const rejected = await request("/admin/bookings/" + id + "/payment/review", { decision: "reject", attemptId: first, reason: "รูปไม่ชัด" }, 2); assert.equal(rejected.status, 200); assert.equal(rejected.data.status, "pending_payment"); assert.equal(rejected.data.payment.attempts[0].reviewReason, "รูปไม่ชัด");
  const second = (await upload(id)).data.payment.attempts[1].id;
  assert.equal((await request("/admin/bookings/" + id + "/payment/review", { decision: "approve", attemptId: first, verifiedReference: "BANK-REF-1" }, 2)).status, 409);
  const approved = await request("/admin/bookings/" + id + "/payment/review", { decision: "approve", attemptId: second, verifiedReference: " bank-ref-1 " }, 3); assert.equal(approved.status, 200); assert.equal(approved.data.status, "confirmed"); assert.equal(approved.data.payment.approvedReference, "BANK-REF-1"); assert(approved.data.payment.paidAt);
  assert.equal(approved.data.payment.attempts.length, 2); assert.equal(await SlipModel.countDocuments(), 2);
  assert.equal((await request("/admin/bookings/" + id + "/payment/review", { decision: "reject", attemptId: second, reason: "stale" }, 2)).status, 409);
});
test("mismatched amount cannot approve and simultaneous approve/reject has one winning transition", async () => {
  const id = await pending(); await qr(id); let attempt = (await upload(id, { amount: "1" })).data.payment.attempts[0].id;
  assert.equal((await request("/admin/bookings/" + id + "/payment/review", { decision: "approve", attemptId: attempt, verifiedReference: "REF-LOW" }, 2)).status, 409);
  await request("/admin/bookings/" + id + "/payment/review", { decision: "reject", attemptId: attempt, reason: "ยอดไม่ตรง" }, 2);
  attempt = (await upload(id)).data.payment.attempts[1].id;
  const results = await Promise.all([request("/admin/bookings/" + id + "/payment/review", { decision: "approve", attemptId: attempt, verifiedReference: "REF-OK" }, 2), request("/admin/bookings/" + id + "/payment/review", { decision: "reject", attemptId: attempt, reason: "ตรวจซ้ำ" }, 3)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
});
test("reference/image reuse is blocked even after paid cancellation; cancellation records pending refund and manual completion", async () => {
  const first = await pending(1); await qr(first); const firstAttempt = (await upload(first)).data.payment.attempts[0].id;
  await request("/admin/bookings/" + first + "/payment/review", { decision: "approve", attemptId: firstAttempt, verifiedReference: "REF-UNIQUE" }, 2);
  assert.equal((await request("/bookings/" + first + "/cancel", { reason: "customer" })).status, 409);
  const cancelled = await cancelBooking(first, managerId, "คืนพื้นที่", true); assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.payment.refund!.status, "pending"); assert.equal(cancelled.payment.refund!.amount, 125.25);
  const second = await pending(2); await qr(second); const secondAttempt = (await upload(second)).data.payment.attempts[0].id;
  assert.equal((await request("/admin/bookings/" + second + "/payment/review", { decision: "approve", attemptId: secondAttempt, verifiedReference: "DIFFERENT-REF" }, 2)).data.code, "PAYMENT_ALREADY_USED");
  const third = await pending(3); await qr(third); const otherImage = await sharp({ create: { width: 48, height: 72, channels: 3, background: "red" } }).png().toBuffer();
  const thirdAttempt = (await upload(third, { data: otherImage })).data.payment.attempts[0].id;
  assert.equal((await request("/admin/bookings/" + third + "/payment/review", { decision: "approve", attemptId: thirdAttempt, verifiedReference: "ref-unique" }, 3)).data.code, "PAYMENT_ALREADY_USED");
  assert.equal((await request("/admin/bookings/" + first + "/payment/refund", { reference: "REFUND-1" })).status, 403);
  const refund = await request("/admin/bookings/" + first + "/payment/refund", { reference: "REFUND-1" }, 2); assert.equal(refund.status, 200); assert.equal(refund.data.payment.refund.status, "refunded"); assert(refund.data.payment.refund.completedAt);
  assert.equal((await request("/admin/bookings/" + first + "/payment/refund", { reference: "REFUND-1" }, 2)).status, 200);
  assert.equal((await request("/admin/bookings/" + first + "/payment/refund", { reference: "REFUND-2" }, 2)).status, 409);
});
