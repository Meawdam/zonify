import mongoose from "mongoose";
import { env } from "./env.js";
import { UserModel } from "../modules/users/schema/user.schema.js";
import { SessionModel } from "../modules/users/schema/session.schema.js";
import { ensureCatalogIndexes } from "../modules/catalog/catalog.schema.js";
export const connectDatabase = async () => {
  await mongoose.connect(env.MONGO_URI);
  // Never normalize or merge existing records implicitly during startup.
  const invalid = await UserModel.collection.findOne({ $or: [
    { role: { $exists: false } },
    { $expr: { $ne: ["$email", { $toLower: { $trim: { input: "$email" } } }] } },
  ] });
  if (invalid) throw new Error("Run pnpm migrate:auth before starting the API");
  await UserModel.createIndexes();
  await SessionModel.createIndexes();
  await ensureCatalogIndexes();
  console.log("MongoDB connected");
};
