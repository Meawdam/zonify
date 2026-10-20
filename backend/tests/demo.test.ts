import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
let mongo: MongoMemoryServer, server: Server, base: string;
const origin = "http://127.0.0.1:3001";
const cookies: Record<string, string> = {};
async function post(path: string, role: string, body = {}) {
  return fetch(base + path, { method: "POST", headers: { Origin: origin, Cookie: cookies[role] ?? "", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function login(role: string) {
  const response = await post("/api/users/login", "", { email: role + "@demo.zonify.test", password: "ZonifyDemo2026!" });
  assert.equal(response.status, 200); cookies[role] = response.headers.get("set-cookie")!.split(";")[0];
}
before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { dbName: "zonify_demo" } });
  Object.assign(process.env, { ZONIFY_DEMO_MODE: "1", MONGO_URI: mongo.getUri("zonify_demo"), JWT_SECRET: "demo-test-only-secret-at-least-32-characters", APP_ORIGIN: origin, BACKEND_HOST: "127.0.0.1" });
  const { connectDatabase } = await import("../src/config/database.js"); await connectDatabase();
  const { seedDemo } = await import("../src/scripts/seed-demo.js"); await seedDemo();
  const { default: app } = await import("../src/app.js"); server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  base = "http://127.0.0.1:" + (server.address() as { port: number }).port;
  for (const role of ["customer", "manager", "owner"]) await login(role);
});
after(async () => { server?.closeAllConnections(); if (server) await new Promise<void>(resolve => server.close(() => resolve())); await mongoose.disconnect(); await mongo?.stop(); });
test("demo seeds all four booking states and uses a non-bank QR with real review rules", async () => {
  const { BookingModel } = await import("../src/modules/bookings/booking.schema.js");
  const bookings = await BookingModel.find().lean();
  assert.deepEqual(bookings.map(b => b.status).sort(), ["confirmed", "held", "payment_review", "pending_payment"].sort());
  const pending = bookings.find(b => b.status === "pending_payment")!;
  const qr = await (await post(`/api/bookings/${pending._id}/payment/qr`, "customer")).json();
  assert.equal(qr.simulated, true); assert.equal(qr.recipient.id, "DEMO-NO-PAYMENT"); assert(qr.payload.startsWith("ZONIFY-DEMO:")); assert(!qr.payload.startsWith("000201"));
  const uploaded = await post(`/api/bookings/${pending._id}/payment/demo-slip`, "customer"); assert.equal(uploaded.status, 201);
  const review = await uploaded.json(); assert.equal(review.status, "payment_review");
  const id = review.payment.attempts.at(-1).id;
  assert.equal((await post(`/api/admin/bookings/${pending._id}/payment/review`, "customer", { decision: "approve", attemptId: id, verifiedReference: "DEMO-CUSTOMER" })).status, 403);
  const rejected = await post(`/api/admin/bookings/${pending._id}/payment/review`, "manager", { decision: "reject", attemptId: id, reason: "ทดสอบส่งหลักฐานใหม่" });
  assert.equal(rejected.status, 200); assert.equal((await rejected.json()).status, "pending_payment");
  const next = await (await post(`/api/bookings/${pending._id}/payment/demo-slip`, "customer")).json();
  assert.notEqual(next.payment.attempts.at(-1).reference, review.payment.attempts.at(-1).reference);
  const approved = await post(`/api/admin/bookings/${pending._id}/payment/review`, "manager", { decision: "approve", attemptId: next.payment.attempts.at(-1).id, verifiedReference: "DEMO-APPROVED" });
  assert.equal(approved.status, 200); assert.equal((await approved.json()).status, "confirmed");
  assert.equal((await post(`/api/bookings/${pending._id}/payment/demo-slip`, "customer")).status, 409);
});
test("reset is owner-only, restores sample data, revokes sessions and touches no other database", async () => {
  const sentinel = mongoose.connection.useDb("zonify_demo_sentinel"); await sentinel.collection("preserved").insertOne({ marker: true });
  try {
    assert.equal((await post("/api/demo/reset", "customer")).status, 403);
    assert.equal((await post("/api/demo/reset", "manager")).status, 403);
    assert.equal((await post("/api/demo/reset", "owner")).status, 200);
    const { BookingModel } = await import("../src/modules/bookings/booking.schema.js"); assert.equal(await BookingModel.countDocuments(), 4);
    assert.equal(await sentinel.collection("preserved").countDocuments(), 1);
    const expiredSession = await fetch(base + "/api/users/me", { headers: { Cookie: cookies.owner! } }); assert.equal(expiredSession.status, 401);
    await login("owner");
    assert.equal((await post("/api/demo/reset", "owner")).status, 200);
    assert.equal(await BookingModel.countDocuments(), 4);
  } finally { await sentinel.dropDatabase(); }
});
test("reset drains an aborted write and rejects a simultaneous second reset", async () => {
  await login("owner");
  const { default: app } = await import("../src/app.js");
  const { ShopModel } = await import("../src/modules/catalog/catalog.schema.js");
  const { demoActivity } = await import("../src/modules/demo/demo-state.js");
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const work = new Promise<void>(resolve => { release = resolve; });
  app.post("/api/__test/delayed-write", async (_req, res) => {
    entered(); await work;
    await ShopModel.updateOne({ _id: "demo-merchant-shop" }, { $set: { name: "late write" } });
    res.json({ ok: true });
  });
  const controller = new AbortController();
  const delayed = fetch(base + "/api/__test/delayed-write", { method: "POST", headers: { Origin: origin }, signal: controller.signal }).catch(() => null);
  await started; controller.abort(); await delayed;
  const reset = post("/api/demo/reset", "owner");
  for (let i = 0; i < 100 && !demoActivity.resetting; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert(demoActivity.resetting);
  assert.equal(demoActivity.active, 2, "aborted write still counts until its handler completes");
  assert.equal((await post("/api/demo/reset", "owner")).status, 503);
  assert(demoActivity.resetting, "rejected reset cannot release another reset's lock");
  release(); assert.equal((await reset).status, 200);
  assert.equal((await ShopModel.findById("demo-merchant-shop").lean())!.name, "ร้านเดโมของฉัน");
});
