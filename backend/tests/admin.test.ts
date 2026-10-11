import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { MongoMemoryServer } from "mongodb-memory-server";
import { UserModel } from "../src/modules/users/schema/user.schema.js";
import { MarketModel, CategoryModel, ZoneModel, StallModel, ShopModel } from "../src/modules/catalog/catalog.schema.js";
import { seedCatalog } from "../src/scripts/seed-catalog.js";
let mongo: MongoMemoryServer, server: Server, base: string;
let manager: string, owner: string, customer: string;
const origin = "http://localhost:3000";
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("zonify_admin_test");
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.APP_ORIGIN = origin;
  const { default: app } = await import("../src/app.js");
  const { connectDatabase } = await import("../src/config/database.js");
  await connectDatabase(); await seedCatalog("2026-10-11");
  const password = await bcrypt.hash("admin-tests-123", 4);
  for (const role of ["manager", "owner", "customer"]) await UserModel.create({ name: role, email: role + "@example.test", password, role });
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  base = "http://127.0.0.1:" + address.port + "/api";
  async function login(role: string) {
    const response = await fetch(base + "/users/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email: role + "@example.test", password: "admin-tests-123" }) });
    assert.equal(response.status, 200);
    return response.headers.get("set-cookie")!.split(";")[0]!;
  }
  manager = await login("manager"); owner = await login("owner"); customer = await login("customer");
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
async function request(path: string, method = "GET", body?: unknown, cookie = manager, sendOrigin = true) {
  const response = await fetch(base + "/admin" + path, { method, headers: { Cookie: cookie, ...(sendOrigin ? { Origin: origin } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
const market = { id: "admin-market", name: "ตลาดทดสอบ", location: "เชียงใหม่", description: "ตลาดใหม่", photo: "canal", landmark: "", entrance: "ทางเข้า", active: true, order: 5 };
const category = { id: "admin-category", name: "ของเล่น", active: true, order: 5 };
const zone = { id: "admin-zone", marketId: "admin-market", name: "โซนใหม่", description: "", active: true, order: 0 };
const stall = { id: "admin-stall", marketId: "admin-market", zoneId: "admin-zone", code: "E01", row: "E", rowOrder: 4, column: 1, width: 2, depth: 2, pricePerDay: 150.25, description: "ล็อกใหม่", enabled: true };
const shop = { id: "admin-shop", marketId: "admin-market", categoryId: "admin-category", stallId: "admin-stall", name: "ร้านของเล่น", description: "รายละเอียด", hours: "09:00–18:00", active: true };

test("admin APIs require authentication, reject customer and mutations without correct Origin", async () => {
  assert.equal((await request("/markets", "GET", undefined, "")).status, 401);
  assert.equal((await request("/references", "GET", undefined, customer)).status, 403);
  for (const kind of ["markets", "categories", "zones", "stalls", "shops"]) {
    assert.equal((await request("/" + kind, "POST", {}, customer)).status, 403);
    assert.equal((await request("/" + kind, "GET", undefined, owner)).status, 200);
  }
  assert.equal((await request("/markets", "POST", market, manager, false)).status, 403);
});
test("manager creates all resource types with normalized text, private fields never leak", async () => {
  for (const [kind, body] of [["markets", market], ["categories", category], ["zones", zone], ["stalls", stall], ["shops", shop]] as const) {
    const result = await request("/" + kind, "POST", body);
    assert.equal(result.status, 201); assert.equal(result.data.id, body.id); assert.equal(result.data.version, 0);
    assert(!("_id" in result.data)); assert(!("__v" in result.data)); assert(!("password" in result.data));
  }
  const result = await request("/shops?q=" + encodeURIComponent("ของเล่น"));
  assert.equal(result.data.items[0].id, shop.id);
  const detail = await fetch(base + "/shops/" + shop.id).then(r => r.json());
  assert.equal(detail.stall.id, stall.id);
});
test("foreign keys and immutable market membership are validated", async () => {
  assert.equal((await request("/zones", "POST", { ...zone, id: "invalid-zone", marketId: "missing" })).status, 400);
  assert.equal((await request("/stalls", "POST", { ...stall, id: "wrong-zone", zoneId: "canal-zone-A" })).status, 400);
  assert.equal((await request("/shops", "POST", { ...shop, id: "wrong-stall", stallId: "canal-A01" })).status, 400);
  assert.equal((await request("/shops", "POST", { ...shop, id: "wrong-category", categoryId: "missing" })).status, 400);
  assert.equal((await request("/stalls/" + stall.id, "PATCH", { version: 0, marketId: "canal" })).status, 400);
  assert.equal((await request("/stalls/" + stall.id, "PATCH", { version: 0, zoneId: "canal-zone-A" })).status, 400);
});
test("UI defaults permit blank optional descriptions and generate immutable IDs", async () => {
  const { id: _marketId, ...body } = market;
  const created = await request("/markets", "POST", { ...body, name: "ตลาดไม่มีคำอธิบาย", description: "" });
  assert.equal(created.status, 201); assert.match(created.data.id, /^[a-zA-Z0-9-]+$/);
  assert.equal(created.data.description, "");
  const { id: _shopId, ...shopBody } = shop;
  assert.equal((await request("/shops", "POST", { ...shopBody, description: "" })).status, 201);
});
test("duplicate IDs, codes and grid positions fail with a resource conflict", async () => {
  assert.equal((await request("/markets", "POST", market)).status, 409);
  for (const body of [{ ...stall, id: "duplicate-code", column: 2 }, { ...stall, id: "duplicate-position", code: "E02" }]) {
    const result = await request("/stalls", "POST", body); assert.equal(result.status, 409); assert.equal(result.data.code, "DUPLICATE_RESOURCE");
  }
});
test("manager edits every resource and public responses reflect saved names, prices and positions", async () => {
  const entries = [
    ["markets", { ...market, id: "edit-market" }, { name: "  ตลาดแก้ไข  ", entrance: "ทางเข้าด้านเหนือ" }],
    ["categories", { ...category, id: "edit-category" }, { name: "หมวดแก้ไข" }],
    ["zones", { ...zone, id: "edit-zone", marketId: "edit-market" }, { name: "โซนแก้ไข" }],
    ["stalls", { ...stall, id: "edit-stall", marketId: "edit-market", zoneId: "edit-zone" }, { rowOrder: 3, column: 4, width: 3, pricePerDay: 321.25 }],
    ["shops", { ...shop, id: "edit-shop", marketId: "edit-market", categoryId: "edit-category", stallId: "edit-stall" }, { name: "ร้านแก้ไข", hours: "10:00–20:00" }],
  ] as const;
  for (const [kind, data, patch] of entries) {
    assert.equal((await request("/" + kind, "POST", data)).status, 201);
    const edited = await request("/" + kind + "/" + data.id, "PATCH", { version: 0, ...patch });
    assert.equal(edited.status, 200); assert.equal(edited.data.version, 1);
  }
  const plan = await fetch(base + "/markets/edit-market/floor-plan").then(r => r.json());
  assert.equal(plan.market.name, "ตลาดแก้ไข"); assert.equal(plan.market.entrance, "ทางเข้าด้านเหนือ");
  assert.equal(plan.stalls[0].zoneName, "โซนแก้ไข"); assert.equal(plan.stalls[0].column, 4); assert.equal(plan.stalls[0].rowOrder, 3); assert.equal(plan.stalls[0].pricePerDay, 321.25);
  const detail = await fetch(base + "/shops/edit-shop").then(r => r.json());
  assert.equal(detail.name, "ร้านแก้ไข"); assert.equal(detail.category.name, "หมวดแก้ไข"); assert.equal(detail.hours, "10:00–20:00");
});
test("concurrent edits use versions so one succeeds and the stale one gets 409", async () => {
  const result = await Promise.all([
    request("/stalls/" + stall.id, "PATCH", { version: 0, column: 2, pricePerDay: 200 }),
    request("/stalls/" + stall.id, "PATCH", { version: 0, column: 3, pricePerDay: 300 }),
  ]);
  assert.deepEqual(result.map(r => r.status).sort(), [200, 409]);
  const doc = await StallModel.findById(stall.id).lean(); assert.equal(doc?.__v, 1);
  assert([2, 3].includes(doc!.column));
  assert.equal((await request("/stalls/" + stall.id, "PATCH", { version: 0, width: 3 })).status, 409);
});
test("zone deactivation preserves references, closes its stalls and supports reactivation", async () => {
  const disabled = await request("/zones/" + zone.id, "DELETE", { version: 0 }); assert.equal(disabled.status, 200);
  assert(await ZoneModel.exists({ _id: zone.id }));
  let plan = await fetch(base + "/markets/" + market.id + "/floor-plan").then(r => r.json());
  assert.equal(plan.stalls[0].status, "unavailable"); assert.equal(plan.stalls[0].zoneName, zone.name);
  assert.equal((await request("/zones/" + zone.id, "PATCH", { version: 1, active: true })).status, 200);
  plan = await fetch(base + "/markets/" + market.id + "/floor-plan").then(r => r.json()); assert.equal(plan.stalls[0].status, "available");
});
test("market/category/shop/stall deactivation keeps records and changes public reads", async () => {
  assert.equal((await request("/shops/" + shop.id, "DELETE", { version: 0 })).status, 200);
  assert(await ShopModel.exists({ _id: shop.id }));
  assert.equal((await fetch(base + "/shops/" + shop.id)).status, 404);
  assert.equal((await request("/stalls/" + stall.id, "DELETE", { version: 1 })).status, 200);
  assert(await StallModel.exists({ _id: stall.id }));
  assert.equal((await request("/categories/" + category.id, "DELETE", { version: 0 })).status, 200);
  assert(await CategoryModel.exists({ _id: category.id }));
  assert.equal((await request("/markets/" + market.id, "DELETE", { version: 0 })).status, 200);
  assert(await MarketModel.exists({ _id: market.id }));
  assert.equal((await fetch(base + "/markets/" + market.id + "/floor-plan")).status, 404);
});
test("invalid values, fields, filters and missing resources return precise statuses", async () => {
  for (const body of [{ ...stall, id: "bad-width", width: -1 }, { ...stall, id: "bad-column", column: 1.5 }, { ...stall, id: "bad-money", pricePerDay: 1.001 }, { ...stall, id: "bad-extra", role: "owner" }]) assert.equal((await request("/stalls", "POST", body)).status, 400);
  assert.equal((await request("/markets?limit=101")).status, 400);
  assert.equal((await request("/markets/missing", "PATCH", { version: 0, name: "test" })).status, 404);
  assert.equal((await request("/markets/missing", "DELETE", { version: 0 })).status, 404);
  assert.equal((await request("/markets/" + market.id, "PATCH", { version: 1 })).status, 400);
  assert.equal((await request("/markets/" + market.id, "PATCH", { version: 1, id: "change" })).status, 400);
});
test("admin search escapes regex and pagination keeps stable pages and inactive records", async () => {
  const empty = await request("/markets?q=" + encodeURIComponent(".*")); assert.equal(empty.data.total, 0);
  const one = await request("/stalls?market=canal&page=1&limit=12"), two = await request("/stalls?market=canal&page=2&limit=12");
  assert.equal(one.data.total, 24); assert.equal(one.data.items.length, 12);
  assert(two.data.items.every((row: { id: string }) => !one.data.items.some((first: { id: string }) => first.id === row.id)));
  assert.equal((await request("/references")).data.markets.find((r: { id: string }) => r.id === market.id).active, false);
});
