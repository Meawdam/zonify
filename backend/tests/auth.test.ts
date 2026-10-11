import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { UserModel, roles } from "../src/modules/users/schema/user.schema.js";
import { SessionModel } from "../src/modules/users/schema/session.schema.js";
import { prepareAuth } from "../src/scripts/prepare-auth.js";
import { seedAuth } from "../src/scripts/seed-auth.js";
import { passwordDto } from "../src/modules/users/dto/user.dto.js";
let mongo: MongoMemoryServer;
let server: Server;
let base: string;
let hash: string;
let resetLimits: () => void;
const password = "Original pass 123";
const origin = "http://localhost:3000";
const secret = randomBytes(32).toString("hex");
before(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("zonify_auth_test");
  process.env.JWT_SECRET = secret;
  process.env.APP_ORIGIN = origin;
  const { default: app } = await import("../src/app.js");
  const { connectDatabase } = await import("../src/config/database.js");
  const { loginLimit, registerLimit } = await import("../src/middlewares/request-security.js");
  resetLimits = () => { loginLimit.resetKey("127.0.0.1"); registerLimit.resetKey("127.0.0.1"); };
  await connectDatabase();
  hash = await bcrypt.hash(password, 12);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api/users`;
});
beforeEach(async () => { resetLimits(); await Promise.all([UserModel.deleteMany({}), SessionModel.deleteMany({})]); });
after(async () => {
  if (server) { server.close(); await once(server, "close"); }
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
async function request(path = "", method = "GET", body?: object, cookie?: string, requestOrigin: string | null = origin) {
  const response = await fetch(base + path, {
    method, headers: {
      ...(requestOrigin === null ? {} : { Origin: requestOrigin }),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = response.status === 204 ? null : await response.json();
  return { status: response.status, data, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", headers: response.headers };
}
async function fixture(role: typeof roles[number] = "customer", email = `${role}@example.test`) {
  return UserModel.create({ name: role, email, password: hash, role });
}
async function login(email = "customer@example.test", pass = password) {
  return request("/login", "POST", { email, password: pass });
}
function assertPublic(user: Record<string, unknown>) {
  assert.deepEqual(Object.keys(user).sort(), ["email", "id", "name", "phone", "role"]);
}
test("registration normalizes email, hashes password, and responds with only public fields", async () => {
  const result = await request("", "POST", { name: " Test ", email: " Test@Example.com ", password: "  secret123  " });
  assert.equal(result.status, 201); assert.equal(result.data.email, "test@example.com"); assert.equal(result.data.name, "Test"); assert.equal(result.data.role, "customer"); assertPublic(result.data);
  const saved = await UserModel.findById(result.data.id).select("+password");
  assert(saved); assert.notEqual(saved.password, "  secret123  "); assert(await bcrypt.compare("  secret123  ", saved.password));
  assert.equal((await login("test@example.com", "secret123")).status, 401);
  assert.equal((await login("test@example.com", "  secret123  ")).status, 200);
});
test("duplicate email including concurrent requests returns 409", async () => {
  const body = { name: "Test", email: "same@example.com", password };
  const responses = await Promise.all([request("", "POST", body), request("", "POST", { ...body, email: " SAME@example.com " })]);
  assert.deepEqual(responses.map(r => r.status).sort(), [201, 409]); assert.equal(await UserModel.countDocuments(), 1);
});
test("invalid fields and role injection are rejected without creating users", async () => {
  for (const body of [
    { name: " ", email: "a@example.com", password },
    { name: "Test", email: "invalid", password },
    { name: "Test", email: "a@example.com", password: "short" },
    { name: "Test", email: "a@example.com", password: "ก".repeat(25) },
    { name: "Test", email: "a@example.com", password, role: "owner" },
  ]) assert.equal((await request("", "POST", body)).status, 400);
  assert.equal(await UserModel.countDocuments(), 0);
  assert(passwordDto.safeParse("a".repeat(8)).success);
  assert(passwordDto.safeParse("a".repeat(72)).success);
  assert(passwordDto.safeParse("ก".repeat(24)).success);
  assert(!passwordDto.safeParse("a".repeat(73)).success);
});
test("origin missing or mismatched blocks mutations, read-only health remains available", async () => {
  const body = { email: "a@example.com", password };
  assert.equal((await request("/login", "POST", body, undefined, null)).status, 403);
  assert.equal((await request("/login", "POST", body, undefined, "https://attacker.test")).status, 403);
  assert.equal((await request("/logout", "POST", undefined, undefined, "null")).status, 403);
});
test("login uses an HttpOnly one-hour Lax cookie, never returns tokens, and rejects wrong credentials", async () => {
  await fixture();
  assert.equal((await login("customer@example.test", "wrong")).status, 401);
  assert.equal((await login("missing@example.test")).status, 401);
  const auth = await login();
  assert.equal(auth.status, 200); assertPublic(auth.data);
  assert.match(auth.headers.get("set-cookie")!, /HttpOnly/); assert.match(auth.headers.get("set-cookie")!, /SameSite=Lax/);
  assert.match(auth.headers.get("set-cookie")!, /Max-Age=3600/);
  assert.equal((await request("/me", "GET", undefined, auth.cookie)).status, 200);
  assert.equal(auth.headers.get("cache-control"), "no-store");
});
test("anonymous and forged cookies cannot access profile; bearer tokens are not accepted", async () => {
  assert.equal((await request("/me")).status, 401);
  assert.equal((await request("/me", "GET", undefined, "zonify_session=invalid")).status, 401);
  await fixture(); const auth = await login();
  const response = await fetch(base + "/me", { headers: { Authorization: "Bearer " + auth.cookie.split("=")[1] } });
  assert.equal(response.status, 401);
});
test("logout revokes only current session and replay fails, repeated logout succeeds", async () => {
  await fixture(); const first = await login(); const second = await login();
  assert.equal((await request("/logout", "POST", undefined, first.cookie)).status, 204);
  assert.equal((await request("/me", "GET", undefined, first.cookie)).status, 401);
  assert.equal((await request("/me", "GET", undefined, second.cookie)).status, 200);
  assert.equal((await request("/logout", "POST", undefined, first.cookie)).status, 204);
});
test("session expiry is enforced before MongoDB TTL cleanup and JWT expiry is enforced", async () => {
  const user = await fixture(); const auth = await login();
  await SessionModel.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await request("/me", "GET", undefined, auth.cookie)).status, 401);
  const id = "expired-jwt";
  await SessionModel.create({ _id: id, userId: user._id, authVersion: 0, expiresAt: new Date(Date.now() + 60_000) });
  const token = jwt.sign({}, secret, { subject: String(user._id), jwtid: id, issuer: "zonify", audience: "zonify-web", expiresIn: -1 });
  assert.equal((await request("/me", "GET", undefined, "zonify_session=" + token)).status, 401);
});
test("profile updates persist but email/role mutation and invalid phones are rejected", async () => {
  await fixture(); const auth = await login();
  const update = await request("/me", "PATCH", { name: "ชื่อใหม่", phone: "081-234-5678" }, auth.cookie);
  assert.equal(update.status, 200); assert.equal(update.data.name, "ชื่อใหม่"); assertPublic(update.data);
  assert.equal((await request("/me", "GET", undefined, auth.cookie)).data.phone, "081-234-5678");
  for (const body of [{ name: "test", phone: "", role: "owner" }, { name: "test", phone: "", email: "new@example.com" }, { name: "test", phone: "abc" }]) {
    assert.equal((await request("/me", "PATCH", body, auth.cookie)).status, 400);
  }
});
test("password change checks current password, revokes every session and rejects old login", async () => {
  const user = await fixture(); const first = await login(); const second = await login();
  assert.equal((await request("/me/password", "PATCH", { currentPassword: "wrong", password: "New password 123" }, first.cookie)).status, 400);
  const changed = await request("/me/password", "PATCH", { currentPassword: password, password: "New password 123" }, first.cookie);
  assert.equal(changed.status, 204); assert.match(changed.headers.get("set-cookie")!, /Expires=Thu, 01 Jan 1970/);
  for (const cookie of [first.cookie, second.cookie]) assert.equal((await request("/me", "GET", undefined, cookie)).status, 401);
  assert.equal(await SessionModel.countDocuments({ userId: user._id }), 0);
  assert.equal((await login()).status, 401); assert.equal((await login("customer@example.test", "New password 123")).status, 200);
});
test("authVersion invalidates a session issued concurrently using old credentials", async () => {
  const user = await fixture(); const auth = await login();
  await UserModel.updateOne({ _id: user._id }, { $inc: { authVersion: 1 } });
  assert.equal((await request("/me", "GET", undefined, auth.cookie)).status, 401);
});
test("role matrix is checked from database, not stale login claims", async () => {
  const customer = await fixture(); const manager = await fixture("manager"); const owner = await fixture("owner");
  const a = await login(); const b = await login(manager.email); const c = await login(owner.email);
  assert.equal((await request()).status, 401);
  assert.equal((await request("", "GET", undefined, a.cookie)).status, 403);
  assert.equal((await request("/" + manager.id, "GET", undefined, a.cookie)).status, 403);
  for (const cookie of [b.cookie, c.cookie]) {
    const list = await request("", "GET", undefined, cookie); assert.equal(list.status, 200); list.data.forEach(assertPublic);
    assert.equal((await request("/" + customer.id, "GET", undefined, cookie)).status, 200);
  }
  assert.equal((await request("/" + customer.id, "DELETE", undefined, b.cookie)).status, 403);
  assert.equal((await request("/" + owner.id, "DELETE", undefined, c.cookie)).status, 403);
  await UserModel.updateOne({ _id: manager._id }, { $set: { role: "customer" } });
  assert.equal((await request("", "GET", undefined, b.cookie)).status, 403);
  assert.equal((await request("/" + customer.id, "DELETE", undefined, c.cookie)).status, 204);
  assert.equal((await request("/me", "GET", undefined, a.cookie)).status, 401);
});
test("invalid and missing user IDs return 400/404", async () => {
  await fixture("owner"); const auth = await login("owner@example.test");
  assert.equal((await request("/invalid", "GET", undefined, auth.cookie)).status, 400);
  assert.equal((await request("/" + new mongoose.Types.ObjectId(), "GET", undefined, auth.cookie)).status, 404);
});
test("registration and login enforce rate limits", async () => {
  for (let i = 0; i < 10; i++) assert.equal((await request("", "POST", {})).status, 400);
  assert.equal((await request("", "POST", {})).status, 429);
  for (let i = 0; i < 20; i++) assert.equal((await request("/login", "POST", {})).status, 400);
  const limited = await request("/login", "POST", {});
  assert.equal(limited.status, 429); assert(limited.headers.has("retry-after"));
});
test("migration preflights duplicates without modifying records, then normalizes safely", async () => {
  await UserModel.collection.insertMany([
    { name: "legacy", email: " DUP@example.com ", password: hash },
    { name: "legacy2", email: "dup@example.com", password: hash },
  ]);
  await assert.rejects(prepareAuth(), /Duplicate email/);
  const unchanged = await UserModel.collection.findOne({ email: " DUP@example.com " });
  assert(unchanged); assert.equal(unchanged.role, undefined);
  await UserModel.collection.deleteOne({ email: "dup@example.com" });
  assert.equal(await prepareAuth(), 1);
  const normalized = await UserModel.collection.findOne({ email: "dup@example.com" });
  assert(normalized); assert.equal(normalized.role, "customer");
  await prepareAuth(); // idempotent
});
test("seed creates all roles and never overwrites existing accounts", async () => {
  for (const role of roles) {
    process.env[`SEED_${role.toUpperCase()}_PASSWORD`] = password;
    process.env[`SEED_${role.toUpperCase()}_EMAIL`] = `${role}@zonify.test`;
  }
  await seedAuth();
  assert.equal(await UserModel.countDocuments(), 3);
  await UserModel.updateOne({ email: "owner@zonify.test" }, { $set: { name: "Preserve this" } });
  await seedAuth();
  assert.equal(await UserModel.countDocuments(), 3);
  const owner = await UserModel.findOne({ email: "owner@zonify.test" }); assert.equal(owner?.name, "Preserve this"); assert.equal(owner?.role, "owner");
});
