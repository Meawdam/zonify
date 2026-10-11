import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { UserModel, roles } from "../modules/users/schema/user.schema.js";

export async function prepareAuth() {
  const rows = await UserModel.collection.find({}, { projection: { email: 1, role: 1 } }).toArray();
  const normalized = new Map<string, string[]>();
  const problems: string[] = [];
  for (const row of rows) {
    if (typeof row.email !== "string" || !row.email.trim()) { problems.push(`Invalid email: ${row._id}`); continue; }
    const email = row.email.trim().toLowerCase();
    normalized.set(email, [...(normalized.get(email) ?? []), String(row._id)]);
    if (row.role !== undefined && !roles.includes(row.role)) problems.push(`Invalid role: ${row._id}`);
  }
  for (const [email, ids] of normalized) if (ids.length > 1) problems.push(`Duplicate email ${email}: ${ids.join(", ")}`);
  if (problems.length) throw new Error(problems.join("\n"));
  // Preflight above completes before any write. Run with the API stopped.
  for (const row of rows) {
    await UserModel.collection.updateOne({ _id: row._id }, { $set: { email: row.email.trim().toLowerCase(), ...(row.role === undefined ? { role: "customer" } : {}) } });
  }
  await UserModel.createIndexes();
  return rows.length;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`Prepared ${await prepareAuth()} users; unique email index ready.`);
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
