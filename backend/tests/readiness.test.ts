import { before, after, test } from "node:test";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import type { Server } from "node:http";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
let mongo: MongoMemoryServer, server: Server, base: string;
before(async () => {
  mongo = await MongoMemoryServer.create(); process.env.MONGO_URI = mongo.getUri("zonify_readiness_test"); process.env.JWT_SECRET = randomBytes(32).toString("hex");
  const { default: app } = await import("../src/app.js");
  server = app.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address(); assert(address && typeof address !== "string"); base = `http://127.0.0.1:${address.port}`;
});
after(async () => { if (server) { server.close(); await once(server, "close"); } await mongoose.disconnect(); await mongo?.stop(); });
test("health is unavailable before database connection, ready when connected and unavailable after disconnect", async () => {
  let res = await fetch(base + "/health"); assert.equal(res.status, 503); assert.deepEqual(await res.json(), { status: "unavailable" });
  await mongoose.connect(process.env.MONGO_URI!); res = await fetch(base + "/health"); assert.equal(res.status, 200); assert.deepEqual(await res.json(), { status: "ok" });
  await mongoose.disconnect(); res = await fetch(base + "/health"); assert.equal(res.status, 503); assert(!JSON.stringify(await res.json()).includes("MONGO_URI"));
});
