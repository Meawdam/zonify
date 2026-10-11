import "dotenv/config";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { MarketModel, ShopModel } from "../modules/catalog/catalog.schema.js";
import { AdvertisementModel } from "../modules/advertisements/advertisement.schema.js";
import { bangkokDate, dateQuery } from "../modules/catalog/catalog.service.js";
export async function seedAdvertisements(date = bangkokDate()) {
  dateQuery.parse(date);
  const markets = await MarketModel.find({ active: true }).sort({ order: 1, _id: 1 }).limit(3).lean();
  if (!markets.length) throw new Error("Run seed:catalog or create a market before seed:ads");
  await AdvertisementModel.createIndexes();
  for (const [index, market] of markets.entries()) {
    const shop = await ShopModel.findOne({ marketId: market._id, active: true }).sort({ _id: 1 }).lean();
    const id = "sample-ad-" + createHash("sha256").update(market._id).digest("hex").slice(0, 12);
    await AdvertisementModel.updateOne({ _id: id }, { $setOnInsert: { _id: id, name: "ตัวอย่างข่าวจาก " + market.name,
      description: "ข่าวประชาสัมพันธ์สมมติสำหรับทดลอง ผู้จัดการแก้ไขหรือปิดแสดงได้ในเมนูโฆษณา", marketId: market._id, shopId: shop?._id ?? null,
      startsOn: date, endsOn: new Date(new Date(date + "T00:00:00Z").valueOf() + 7 * 86400_000).toISOString().slice(0, 10), photo: market.photo, order: index, active: true,
    } }, { upsert: true });
  }
  console.log("Sample advertisements ready; existing records preserved.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required"); await mongoose.connect(process.env.MONGO_URI); await seedAdvertisements(process.env.SEED_DATE ?? bangkokDate()); }
  catch (error) { console.error(error instanceof Error ? error.message : "Advertisement seed failed"); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
}
