import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { backupDatabase, restoreDatabase } from "../src/scripts/backup.js";
let mongo: MongoMemoryServer, client: mongoose.mongo.MongoClient, folder: string;
before(async () => {
  mongo = await MongoMemoryServer.create(); process.env.MONGO_URI = mongo.getUri("zonify_backup_test");
  // Refuse to silently omit the round-trip test if external tools are absent.
  process.env.BACKUP_API_URL = "http://127.0.0.1:49999/health";
  client = new mongoose.mongo.MongoClient(process.env.MONGO_URI); await client.connect();
  folder = await mkdtemp(join(tmpdir(), "zonify-backup-test-"));
  const db = client.db();
  await db.collection("users").insertOne({ _id: new mongoose.mongo.ObjectId(), name: "ทดสอบสำรอง", email: "backup@qa.test", password: "private-hash", role: "customer", createdAt: new Date("2026-10-10T23:59:59Z") });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("bookings").insertOne({ _id: "booking", stallId: "stall", date: "2026-10-11", status: "confirmed", price: 125.25, payment: { paidAt: new Date(), attempts: [{ slipId: "private-slip" }] } });
  await db.collection("bookings").createIndex({ stallId: 1, date: 1 }, { unique: true, partialFilterExpression: { status: { $in: ["held", "confirmed"] } } });
  await db.collection("paymentslips").insertOne({ _id: "private-slip", bookingId: "booking", data: new mongoose.mongo.Binary(Buffer.from([0, 255, 10, 0, 200])), contentType: "image/jpeg" });
  await db.collection("shopphotos").insertOne({ _id: "shop-photo", shopId: "shop", data: new mongoose.mongo.Binary(Buffer.from([255, 216, 255, 3, 2, 1])) });
  await db.collection("shops").insertOne({ _id: "shop", ownerId: "merchant", photoId: "shop-photo", phone: "0812345678" });
  await db.collection("sessions").insertOne({ _id: "must-not-restore", expiresAt: new Date(Date.now() + 3600000) });
});
after(async () => { await client?.close(); await mongo?.stop(); });
test("backup refuses missing maintenance acknowledgment and a live API", async () => {
  await assert.rejects(backupDatabase(join(folder, "no-maintenance"), false), /maintenance/);
  const api = createServer((_req, res) => res.end("ok")).listen(0, "127.0.0.1"); await once(api, "listening");
  const address = api.address(); assert(address && typeof address !== "string"); process.env.BACKUP_API_URL = `http://127.0.0.1:${address.port}/health`;
  try { await assert.rejects(backupDatabase(join(folder, "live"), true), /still reachable/); }
  finally { api.close(); await once(api, "close"); process.env.BACKUP_API_URL = "http://127.0.0.1:49999/health"; }
});
test("real mongodump/restore retains dates IDs hashes private bytes prices and unique/partial indexes; sessions excluded", async () => {
  const path = join(folder, "round-trip"); await backupDatabase(path, true);
  const result = await restoreDatabase(path, "zonify_restore_round_trip", true); assert.equal(result.sessionsRestored, 0);
  const restored = client.db(result.database), source = client.db();
  for (const name of ["users", "bookings", "paymentslips", "shops", "shopphotos"]) assert.deepEqual(await restored.collection(name).find().toArray(), await source.collection(name).find().toArray());
  assert.equal(await restored.collection("sessions").countDocuments(), 0);
  await assert.rejects(restored.collection("users").insertOne({ email: "backup@qa.test" }), (e: unknown) => (e as { code: number }).code === 11000);
  await assert.rejects(restored.collection("bookings").insertOne({ _id: "duplicate", stallId: "stall", date: "2026-10-11", status: "held" }), (e: unknown) => (e as { code: number }).code === 11000);
  await assert.rejects(backupDatabase(path, true), /EEXIST/);
  await assert.rejects(restoreDatabase(path, result.database, true), /not empty/);
  await assert.rejects(restoreDatabase(path, "zonify", true), /NEW/);
});
test("two simultaneous restores have one winner and tampered content metadata keeps the partial target offline", async () => {
  const path = join(folder, "race"); await backupDatabase(path, true);
  const results = await Promise.allSettled([restoreDatabase(path, "zonify_restore_race", true), restoreDatabase(path, "zonify_restore_race", true)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(await client.db("zonify_restore_race").collection("users").countDocuments(), 1);
  const manifestPath = join(path, "manifest.json"), manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.collections[0].sha256 = "0".repeat(64); await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(restoreDatabase(path, "zonify_restore_wrong_content", true), /content mismatch/);
  assert.equal(await client.db("zonify_restore_wrong_content").collection("_zonify_restore_guard").countDocuments(), 1);
  await assert.rejects(restoreDatabase(path, "zonify_restore_wrong_content", true), /not empty/);
});
test("corrupt archive, unknown collections and invalid manifests fail before restore writes", async () => {
  const path = join(folder, "corrupt"); await backupDatabase(path, true);
  const archive = join(path, "database.archive.gz"); const data = await readFile(archive); data[0] = (data[0] ?? 0) ^ 255; await writeFile(archive, data);
  await assert.rejects(restoreDatabase(path, "zonify_restore_corrupt", true), /checksum/);
  assert.equal((await client.db("zonify_restore_corrupt").listCollections().toArray()).length, 0);
  await writeFile(join(path, "manifest.json"), '{"sourceDatabase":"admin"}');
  await assert.rejects(restoreDatabase(path, "zonify_restore_invalid", true));
  await client.db().collection("unexpected_private_data").insertOne({ value: "not silently skipped" });
  await assert.rejects(backupDatabase(join(folder, "unknown"), true), /unsupported/);
});
