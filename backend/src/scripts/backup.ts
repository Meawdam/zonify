import "dotenv/config";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { z } from "zod";

const names = ["users", "markets", "categories", "zones", "stalls", "stalldaystates", "shops", "shopphotos", "bookings", "paymentslips", "advertisements", "marketschedules", "notifications"] as const;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const dbName = z.string().regex(/^[a-zA-Z0-9_-]{1,63}$/);
const manifestSchema = z.object({
  format: z.literal("zonify-mongodump-v1"), sourceDatabase: dbName,
  createdAt: z.string().datetime(), sessionsExcluded: z.literal(true),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  collections: z.array(z.object({ name: z.enum(names), count: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/), indexes: z.array(z.record(z.string(), z.unknown())) }).strict()),
}).strict();
type Manifest = z.infer<typeof manifestSchema>;

async function checksum(path: string) {
  const hash = createHash("sha256");
  for await (const part of createReadStream(path)) hash.update(part);
  return hash.digest("hex");
}
async function tool(name: "mongodump" | "mongorestore") {
  const explicit = process.env[name === "mongodump" ? "MONGODUMP_PATH" : "MONGORESTORE_PATH"];
  if (explicit) return explicit;
  const tools = join(root, ".data/tools");
  for (const folder of await readdir(tools).catch(() => [])) {
    if (/^mongodb-database-tools-/.test(folder)) return join(tools, folder, "bin", name + (process.platform === "win32" ? ".exe" : ""));
  }
  return name;
}
async function runTool(name: "mongodump" | "mongorestore", args: string[]) {
  const binary = await tool(name);
  await new Promise<void>((done, reject) => {
    const child = spawn(binary, args, { stdio: "ignore", windowsHide: true });
    child.once("error", () => reject(new Error(`Cannot run ${name}; install MongoDB Database Tools or set its *_PATH environment variable`)));
    child.once("exit", code => code === 0 ? done() : reject(new Error(`${name} failed (exit ${code}); source data and partial restore were retained`)));
  });
}
async function maintenance(stopped: boolean) {
  if (!stopped) throw new Error("Stop every API/worker/writer and pass --maintenance before backup/restore");
  const url = new URL(process.env.BACKUP_API_URL ?? "http://127.0.0.1:4000/health");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.protocol !== "http:") throw new Error("BACKUP_API_URL must be a local HTTP health URL");
  try { await fetch(url, { signal: AbortSignal.timeout(2000), redirect: "error" }); }
  catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === "ECONNREFUSED") return;
    throw new Error("Cannot verify API is stopped; check BACKUP_API_URL and stop all writers");
  }
  throw new Error("API is still reachable; stop it before backup/restore");
}
async function connection() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is required");
  // Local delivery only; credentials are not passed on command lines or printed.
  const url = new URL(uri);
  if (url.protocol !== "mongodb:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password) throw new Error("Backup CLI supports a local MongoDB URI without credentials");
  const name = dbName.parse(url.pathname.slice(1));
  if (["admin", "local", "config"].includes(name)) throw new Error("System databases are not supported");
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  return { client, uri, name, db: client.db(name) };
}
function indexSnapshot(index: Record<string, unknown>) {
  return Object.fromEntries(["name", "key", "unique", "sparse", "expireAfterSeconds", "partialFilterExpression", "collation"].filter(k => index[k] !== undefined).map(k => [k, index[k]]));
}
async function snapshots(db: mongoose.mongo.Db) {
  const collections = await db.listCollections().toArray();
  const unexpected = collections.filter(c => ![...names, "sessions"].includes(c.name as typeof names[number]));
  if (unexpected.length) throw new Error("Database contains unsupported collections; review them before creating an application backup");
  const result: Manifest["collections"] = [];
  for (const entry of collections.filter(c => c.name !== "sessions").sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.type !== "collection") throw new Error("Views and special collections are not supported");
    const col = db.collection(entry.name);
    result.push({ name: entry.name as typeof names[number], count: await col.countDocuments(), sha256: await documentChecksum(col), indexes: (await col.listIndexes().toArray()).map(indexSnapshot).sort((a, b) => String(a.name).localeCompare(String(b.name))) });
  }
  if (!result.length) throw new Error("No application collections found");
  return result;
}
async function documentChecksum(col: mongoose.mongo.Collection) {
  const hash = createHash("sha256");
  for await (const doc of col.find({}, { promoteValues: false }).sort({ _id: 1 })) hash.update(mongoose.mongo.BSON.serialize(doc));
  return hash.digest("hex");
}
export async function backupDatabase(out: string, stopped: boolean) {
  await maintenance(stopped);
  const { client, uri, name, db } = await connection();
  try {
    const before = await snapshots(db), directory = resolve(out);
    // Exclusive directory creation prevents overwriting a prior backup.
    await mkdir(dirname(directory), { recursive: true }); await mkdir(directory);
    const archive = join(directory, "database.archive.gz");
    await runTool("mongodump", [`--uri=${uri}`, `--archive=${archive}`, "--gzip", "--excludeCollection=sessions"]);
    if (JSON.stringify(before) !== JSON.stringify(await snapshots(db))) throw new Error("Database changed during backup; this backup has no completion manifest");
    const manifest: Manifest = { format: "zonify-mongodump-v1", sourceDatabase: name, createdAt: new Date().toISOString(), sessionsExcluded: true, sha256: await checksum(archive), collections: before };
    await writeFile(join(directory, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
    return { directory, collections: before.length };
  } finally { await client.close(); }
}
export async function restoreDatabase(from: string, target: string, stopped: boolean) {
  await maintenance(stopped);
  if (!/^zonify_restore_[a-zA-Z0-9_-]{1,45}$/.test(target)) throw new Error("Restore target must be a NEW zonify_restore_* database");
  const directory = resolve(from), archive = join(directory, "database.archive.gz");
  const manifest = manifestSchema.parse(JSON.parse(await readFile(join(directory, "manifest.json"), "utf8")));
  if (!manifest.collections.length || new Set(manifest.collections.map(c => c.name)).size !== manifest.collections.length) throw new Error("Invalid collection manifest");
  if (await checksum(archive) !== manifest.sha256) throw new Error("Archive checksum mismatch; nothing restored");
  const { client, uri, name } = await connection();
  try {
    if (target === name || target === manifest.sourceDatabase) throw new Error("Restore cannot overwrite the source database");
    const db = client.db(target);
    if ((await db.listCollections().toArray()).length) throw new Error("Restore target is not empty; choose a new name");
    const args = [`--uri=${uri}`, `--archive=${archive}`, "--gzip", `--nsInclude=${manifest.sourceDatabase}.*`, `--nsExclude=${manifest.sourceDatabase}.sessions`, `--nsFrom=${manifest.sourceDatabase}.*`, `--nsTo=${target}.*`, "--stopOnError"];
    await runTool("mongorestore", [...args, "--dryRun"]);
    // A second simultaneous restore cannot acquire this namespace. Retain guard on failure.
    await db.collection<{ _id: string }>("_zonify_restore_guard").insertOne({ _id: "exclusive-restore" });
    await runTool("mongorestore", args);
    for (const entry of manifest.collections) {
      const col = db.collection(entry.name);
      if (await col.countDocuments() !== entry.count) throw new Error("Restored document count mismatch; keep target offline");
      if (await documentChecksum(col) !== entry.sha256) throw new Error("Restored content mismatch; keep target offline");
      const indexes = (await col.listIndexes().toArray()).map(indexSnapshot).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      if (JSON.stringify(indexes) !== JSON.stringify(entry.indexes)) throw new Error("Restored index mismatch; keep target offline");
    }
    const restored = await db.listCollections().toArray();
    if (restored.length !== manifest.collections.length + 1) throw new Error("Unexpected restored collections; keep target offline");
    await db.dropCollection("_zonify_restore_guard");
    return { database: target, collections: manifest.collections.length, sessionsRestored: 0 };
  } finally { await client.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, ...args] = process.argv.slice(2);
    const stopped = args.includes("--maintenance"), value = (flag: string) => { const at = args.indexOf(flag); if (at < 0 || !args[at + 1] || args[at + 1]!.startsWith("--")) throw new Error(`${flag} is required`); return args[at + 1]!; };
    if (command === "backup") console.log(await backupDatabase(value("--out"), stopped));
    else if (command === "restore") console.log(await restoreDatabase(value("--from"), value("--database"), stopped));
    else throw new Error("Usage: pnpm db:backup --out PATH --maintenance | pnpm db:restore --from PATH --database zonify_restore_NAME --maintenance");
  } catch (error) { console.error(error instanceof Error ? error.message : "Database operation failed"); process.exitCode = 1; }
}
