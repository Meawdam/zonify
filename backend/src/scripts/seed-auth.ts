import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { pathToFileURL } from "node:url";
import { UserModel, roles } from "../modules/users/schema/user.schema.js";
import { createUserDto } from "../modules/users/dto/user.dto.js";
import { prepareAuth } from "./prepare-auth.js";
export async function seedAuth() {
  const entries = roles.map(role => {
    const prefix = `SEED_${role.toUpperCase()}`;
    return { role, data: createUserDto.parse({
      name: `Zonify ${role}`,
      email: process.env[`${prefix}_EMAIL`] ?? `${role}@zonify.test`,
      password: process.env[`${prefix}_PASSWORD`],
    }) };
  });
  if (new Set(entries.map(entry => entry.data.email)).size !== entries.length) throw new Error("Seed accounts must have distinct emails");
  await prepareAuth();
  for (const { role, data } of entries) {
    if (await UserModel.exists({ email: data.email })) { console.log(`Skipped existing ${role} account`); continue; }
    await UserModel.create({ ...data, password: await bcrypt.hash(data.password, 12), role });
    console.log(`Created ${role} account`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
    await mongoose.connect(process.env.MONGO_URI);
    await seedAuth();
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
