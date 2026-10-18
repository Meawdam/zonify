import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MarketModel, CategoryModel, ShopModel, StallModel } from "../src/modules/catalog/catalog.schema.js";
import { UserModel } from "../src/modules/users/schema/user.schema.js";
import { BookingModel } from "../src/modules/bookings/booking.schema.js";
import { bangkokDate } from "../src/modules/catalog/catalog.service.js";
let mongo: MongoMemoryServer, server: Server, base: string;
const cookies: string[] = [], origin = "http://localhost:3000";
const date = (days: number) => { const d = new Date(bangkokDate() + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
before(async () => {
  mongo = await MongoMemoryServer.create(); process.env.MONGO_URI = mongo.getUri("schedule_test");
  process.env.JWT_SECRET = randomBytes(32).toString("hex"); process.env.APP_ORIGIN = origin;
  const { default: app } = await import("../src/app.js"); const { connectDatabase } = await import("../src/config/database.js"); await connectDatabase();
  await MarketModel.create({ _id: "market", name: "ตลาด", location: "กรุงเทพ" });
  await CategoryModel.create({ _id: "food", name: "อาหาร" });
  await StallModel.create({ _id: "stall", marketId: "market", code: "A01", row: "A", rowOrder: 0, column: 1, width: 2, depth: 2, pricePerDay: 100 });
  const password = await bcrypt.hash("schedule-test-123", 4);
  for (const role of ["customer", "manager"]) {
    const user = await UserModel.create({ name: role, email: role + "@schedule.test", password, role });
    if (role === "customer") await ShopModel.create({ _id: "shop", marketId: "market", categoryId: "food", name: "ร้าน", ownerId: String(user._id) });
  }
  server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}/api`;
  for (const role of ["customer", "manager"]) { const r = await fetch(base + "/users/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: role + "@schedule.test", password: "schedule-test-123" }) }); cookies.push(r.headers.get("set-cookie")!.split(";")[0]!); }
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
async function req(path: string, method = "GET", body?: unknown, cookie = cookies[1]!) {
  const r = await fetch(base + path, { method, headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, data: await r.json().catch(() => null) };
}
const schedule = "/admin/markets/market/schedule";
const allDays = [0, 1, 2, 3, 4, 5, 6];
test("calendar defaults, role security, exceptions and closed-day booking agree", async () => {
  assert.equal((await req(schedule, "GET", undefined, cookies[0])).status, 403);
  const initial = await req(schedule); assert.equal(initial.status, 200); assert.deepEqual(initial.data.openWeekdays, allDays);
  const updated = await req(schedule, "PUT", { version: initial.data.version, openWeekdays: [], exceptions: [{ date: date(1), open: true, reason: "วันพิเศษ" }] }); assert.equal(updated.status, 200);
  const floor = await req(`/markets/market/floor-plan?date=${date(2)}`); assert.equal(floor.data.marketOpen, false); assert.equal(floor.data.stalls[0].status, "unavailable");
  assert.equal((await req("/bookings/holds", "POST", { stallId: "stall", shopId: "shop", date: date(2) }, cookies[0])).status, 409);
  assert.equal((await req(`/markets/market/floor-plan?date=${date(1)}`)).data.marketOpen, true);
  assert.equal((await req(schedule, "PUT", { version: initial.data.version, openWeekdays: allDays, exceptions: [] })).status, 409);
  assert.equal((await req(schedule, "PUT", { version: updated.data.version, openWeekdays: allDays, exceptions: [] })).status, 200);
});
test("inclusive closures, validation and versioned reopen", async () => {
  const current = (await req(schedule)).data;
  assert.equal((await req("/admin/markets/market/closures", "POST", { version: current.version, stallId: "missing", startsOn: date(3), endsOn: date(4), reason: "ซ่อม" })).status, 400);
  const saved = await req("/admin/markets/market/closures", "POST", { version: current.version, stallId: "stall", startsOn: date(3), endsOn: date(4), reason: "ซ่อม" }); assert.equal(saved.status, 201);
  for (const day of [3, 4]) { const floor = (await req(`/markets/market/floor-plan?date=${date(day)}`)).data; assert.equal(floor.stalls[0].status, "unavailable"); assert.equal(floor.stalls[0].unavailableReason, "ซ่อม"); }
  assert.equal((await req(`/markets/market/floor-plan?date=${date(5)}`)).data.stalls[0].status, "available");
  const path = "/admin/markets/market/closures/" + saved.data.closures[0].id;
  assert.equal((await req(path, "DELETE", { version: current.version })).status, 409);
  assert.equal((await req(path, "DELETE", { version: saved.data.version })).status, 200);
});
test("every live booking blocks closure, expired holds do not; queue counts match refunds", async () => {
  for (const [i, status] of ["held", "pending_payment", "payment_review", "confirmed"].entries()) {
    const day = date(10 + i); const hold = await req("/bookings/holds", "POST", { stallId: "stall", shopId: "shop", date: day }, cookies[0]); assert.equal(hold.status, 201);
    await BookingModel.updateOne({ _id: hold.data.id }, { $set: { status, expiresAt: ["held", "pending_payment"].includes(status) ? new Date(Date.now() + 600000) : null } });
    const current = (await req(schedule)).data;
    const denied = await req("/admin/markets/market/closures", "POST", { version: current.version, stallId: "stall", startsOn: day, endsOn: day, reason: "ปิด" });
    assert.equal(denied.status, 409); assert.equal(denied.data.conflicts[0].id, hold.data.id);
    assert.equal((await req(schedule, "PUT", { version: current.version, openWeekdays: [], exceptions: [] })).status, 409);
    await BookingModel.updateOne({ _id: hold.data.id }, { $set: { status: "cancelled", expiresAt: null, refund: status === "confirmed" ? { status: "pending", amount: 100 } : null } });
  }
  assert.equal((await req("/admin/work-queue")).data.pendingRefund, 1);
  const refunds = await req("/admin/bookings?refund=pending"); assert.equal(refunds.data.total, 1);
});
test("simultaneous closure and hold cannot both succeed; internal preparing records stay private", async () => {
  for (let i = 0; i < 12; i++) {
    const day = date(30 + i), current = (await req(schedule)).data;
    const [hold, close] = await Promise.all([
      req("/bookings/holds", "POST", { stallId: "stall", shopId: "shop", date: day }, cookies[0]),
      req("/admin/markets/market/closures", "POST", { version: current.version, stallId: "stall", startsOn: day, endsOn: day, reason: "ปิด" }),
    ]);
    assert([201, 409].includes(hold.status), JSON.stringify(hold)); assert([201, 409].includes(close.status), JSON.stringify(close)); assert(!(hold.status === 201 && close.status === 201));
  }
  assert.equal(await BookingModel.countDocuments({ status: "preparing" }), 0);
});
test("a delayed confirmation cannot resurrect a hold past the database clock deadline", async () => {
  const { confirmBooking } = await import("../src/modules/bookings/booking.service.js");
  const hold = await req("/bookings/holds", "POST", { stallId: "stall", shopId: "shop", date: date(60) }, cookies[0]); assert.equal(hold.status, 201);
  const row = (await BookingModel.findById(hold.data.id))!;
  const captured = new Date(Date.now() - 5000);
  await BookingModel.updateOne({ _id: row._id }, { $set: { expiresAt: new Date(Date.now() - 100) } });
  await assert.rejects(confirmBooking(row._id, row.userId, captured), { status: 409 });
});
test("preparing records remain hidden from counts and administrator cancellation emits one durable event", async () => {
  const { processNotifications, listNotifications } = await import("../src/modules/notifications/notification.service.js");
  const user = (await UserModel.findOne({ email: "customer@schedule.test" }))!;
  const before = (await req("/merchant/overview", "GET", undefined, cookies[0])).data.counts.current;
  await BookingModel.create({ _id: "hidden-preparation", userId: String(user._id), marketId: "market", stallId: "stall", date: date(80), price: 100, status: "preparing", expiresAt: new Date(Date.now() + 600000) });
  assert.equal((await req("/merchant/overview", "GET", undefined, cookies[0])).data.counts.current, before);
  assert.equal((await req("/bookings/hidden-preparation", "GET", undefined, cookies[0])).status, 404);
  await BookingModel.deleteOne({ _id: "hidden-preparation" });
  const hold = await req("/bookings/holds", "POST", { stallId: "stall", shopId: "shop", date: date(81) }, cookies[0]); assert.equal(hold.status, 201);
  assert.equal((await req(`/admin/bookings/${hold.data.id}/cancel`, "POST", { reason: "ซ่อมพื้นที่" })).status, 200);
  assert.equal((await req(`/admin/bookings/${hold.data.id}/cancel`, "POST", { reason: "ซ่อมพื้นที่" })).status, 200);
  await Promise.all([processNotifications(), processNotifications()]);
  const notifications = await listNotifications(String(user._id));
  assert.equal(notifications.items.filter(n => n.bookingId === hold.data.id && n.type === "booking_cancelled").length, 1);
});
test("past confirmed history does not block future weekly opening changes", async () => {
  await BookingModel.updateMany({ marketId: "market" }, { $set: { status: "cancelled" } });
  await BookingModel.create({ _id: "past", userId: "history", marketId: "market", stallId: "stall", date: date(-7), price: 100, status: "confirmed" });
  const current = (await req(schedule)).data;
  const result = await req(schedule, "PUT", { version: current.version, openWeekdays: [], exceptions: [] });
  assert.equal(result.status, 200);
});
