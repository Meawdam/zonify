import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MarketModel, CategoryModel, StallModel, StallDayStateModel, ShopModel } from "../src/modules/catalog/catalog.schema.js";
import { seedCatalog } from "../src/scripts/seed-catalog.js";
import { floorPlan, bangkokDate } from "../src/modules/catalog/catalog.service.js";
let mongo: MongoMemoryServer, server: Server, base: string;
const date = "2026-10-11";
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("zonify_catalog_test");
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  process.env.APP_ORIGIN = "http://localhost:3000";
  const { default: app } = await import("../src/app.js");
  const { connectDatabase } = await import("../src/config/database.js");
  await connectDatabase();
  await seedCatalog(date);
  server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); if (mongo) await mongo.stop(); });
async function get(path: string) {
  const res = await fetch(base + path);
  return { status: res.status, data: await res.json(), cache: res.headers.get("cache-control") };
}
test("public markets/categories are database-backed, minimum prices derive from enabled stalls", async () => {
  const markets = await get("/markets"); assert.equal(markets.status, 200); assert.equal(markets.data.items.length, 3); assert.equal(markets.data.items[0].minPrice, 120); assert.equal(markets.cache, "no-store");
  assert.equal((await get("/categories")).data.items.length, 4);
  await StallModel.updateOne({ _id: "canal-A01" }, { $set: { pricePerDay: 99 } });
  assert.equal((await get("/markets")).data.items[0].minPrice, 99);
  await StallModel.updateOne({ _id: "canal-A01" }, { $set: { pricePerDay: 180 } });
});
test("floor plans use distinct market layouts and authoritative per-day status/counts", async () => {
  const result = await get("/markets/canal/floor-plan?date=" + date);
  assert.equal(result.status, 200); assert.equal(result.data.stalls.length, 24);
  assert.equal(result.data.stalls.find((s: { id: string }) => s.id === "canal-A03").status, "booked");
  assert.equal(result.data.stalls.find((s: { id: string }) => s.id === "canal-C06").status, "unavailable");
  assert.equal(Object.values(result.data.counts).reduce((sum: number, n) => sum + Number(n), 0), 24);
  const community = await get("/markets/community/floor-plan?date=" + date); assert.equal(community.data.stalls.length, 18);
  const anotherDay = await get("/markets/canal/floor-plan?date=2026-10-12"); assert.equal(anotherDay.data.counts.booked, 0);
  assert.equal(anotherDay.data.stalls.find((s: { id: string }) => s.id === "canal-A03").status, "available");
  assert.equal(anotherDay.data.counts.unavailable, 1);
});
test("holds expire by server time; disabled stalls stay unavailable", async () => {
  const beforeExpiry = await floorPlan("canal", date, new Date("2026-10-11T10:00:00Z"));
  assert.equal(beforeExpiry.stalls.find(s => s.id === "canal-B06")?.status, "held");
  const expired = await floorPlan("canal", date, new Date("2026-10-11T17:00:00Z"));
  assert.equal(expired.stalls.find(s => s.id === "canal-B06")?.status, "available");
  await StallDayStateModel.create({ stallId: "canal-C06", date, status: "held", expiresAt: new Date(0) });
  assert.equal((await floorPlan("canal", date)).stalls.find(s => s.id === "canal-C06")?.status, "unavailable");
});
test("invalid calendar dates, malformed filters and unknown markets are handled", async () => {
  for (const bad of ["2026-02-30", "not-a-date", "2026-1-1"]) assert.equal((await get("/markets/canal/floor-plan?date=" + bad)).status, 400);
  assert.equal((await get("/markets/unknown/floor-plan")).status, 404);
  for (const query of ["page=0", "page=1.5", "limit=49", "q=" + "a".repeat(101), "market[$ne]=x", "q=a&q=b"]) assert.equal((await get("/shops?" + query)).status, 400);
  assert.equal(bangkokDate(new Date("2026-10-10T18:00:00Z")), "2026-10-11");
});
test("Thai text search and combined market/category filters work", async () => {
  const found = await get("/shops?q=" + encodeURIComponent("กาแฟ")); assert.equal(found.data.total, 1); assert.equal(found.data.items[0].id, "canal-coffee");
  const description = await get("/shops?q=" + encodeURIComponent("เซรามิก")); assert.equal(description.data.items[0].id, "canal-clay");
  const filter = await get("/shops?market=canal&category=food"); assert.equal(filter.data.total, 2); assert(filter.data.items.every((s: { market: { id: string }; category: { id: string } }) => s.market.id === "canal" && s.category.id === "food"));
  assert.equal((await get("/shops?q=" + encodeURIComponent("ไม่มีร้านนี้"))).data.total, 0);
});
test("search treats regex syntax as literal text and supports case-insensitive names", async () => {
  assert.equal((await get("/shops?q=" + encodeURIComponent(".*"))).data.total, 0);
  await ShopModel.create({ _id: "literal-test", marketId: "canal", categoryId: "food", name: "Coffee (A+B)", description: "Sample" });
  assert.equal((await get("/shops?q=" + encodeURIComponent("(A+B)"))).data.items[0].id, "literal-test");
  assert.equal((await get("/shops?q=coffee")).data.items[0].id, "literal-test");
  await ShopModel.deleteOne({ _id: "literal-test" });
});
test("pagination has stable non-overlapping pages and accurate totals", async () => {
  const one = await get("/shops?page=1&limit=6"), two = await get("/shops?page=2&limit=6");
  assert.equal(one.data.total, 13); assert.equal(one.data.pages, 3); assert.equal(one.data.items.length, 6);
  const ids = new Set(one.data.items.map((s: { id: string }) => s.id));
  assert(two.data.items.every((s: { id: string }) => !ids.has(s.id)));
  assert.equal((await get("/shops?page=99&limit=6")).data.items.length, 0);
});
test("shop details expose verified location without internal fields", async () => {
  const shop = await get("/shops/canal-coffee"); assert.equal(shop.status, 200); assert.equal(shop.data.stall.id, "canal-A03");
  assert.deepEqual(Object.keys(shop.data).sort(), ["category", "description", "hours", "id", "market", "name", "stall"]);
  assert.equal((await get("/shops/missing-shop")).status, 404);
  await ShopModel.updateOne({ _id: "canal-coffee" }, { $set: { stallId: "community-A01" } });
  assert.equal((await get("/shops/canal-coffee")).data.stall, null);
  await ShopModel.updateOne({ _id: "canal-coffee" }, { $set: { stallId: "canal-A03" } });
});
test("inactive shops, markets and categories are excluded from list and details", async () => {
  await ShopModel.updateOne({ _id: "canal-coffee" }, { $set: { active: false } });
  assert.equal((await get("/shops/canal-coffee")).status, 404);
  await ShopModel.updateOne({ _id: "canal-coffee" }, { $set: { active: true } });
  await MarketModel.updateOne({ _id: "canal" }, { $set: { active: false } });
  assert.equal((await get("/markets")).data.items.length, 2); assert.equal((await get("/markets/canal/floor-plan")).status, 404);
  assert.equal((await get("/shops?market=canal")).data.total, 0); assert.equal((await get("/shops/canal-coffee")).status, 404);
  await MarketModel.updateOne({ _id: "canal" }, { $set: { active: true } });
  await CategoryModel.updateOne({ _id: "food" }, { $set: { active: false } });
  assert.equal((await get("/shops?category=food")).data.total, 0); assert.equal((await get("/shops/canal-coffee")).status, 404);
  await CategoryModel.updateOne({ _id: "food" }, { $set: { active: true } });
});
test("seed is idempotent and preserves edits and existing availability", async () => {
  await MarketModel.updateOne({ _id: "canal" }, { $set: { name: "Keep this market name" } });
  await StallDayStateModel.updateOne({ stallId: "canal-A03", date }, { $set: { status: "unavailable" } });
  await seedCatalog(date);
  assert.equal(await ShopModel.countDocuments(), 13); assert.equal(await StallModel.countDocuments(), 66);
  assert.equal((await MarketModel.findById("canal"))?.name, "Keep this market name");
  assert.equal((await floorPlan("canal", date)).stalls.find(s => s.id === "canal-A03")?.status, "unavailable");
});
