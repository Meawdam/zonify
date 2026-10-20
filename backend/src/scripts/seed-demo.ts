import mongoose from "mongoose";
import { env } from "../config/env.js";
import { assertDemoEnvironment } from "../config/demo.js";
import { seedAuth } from "./seed-auth.js";
import { seedCatalog } from "./seed-catalog.js";
import { seedAdvertisements } from "./seed-ads.js";
import { UserModel } from "../modules/users/schema/user.schema.js";
import { ShopModel, StallModel, StallDayStateModel, CategoryModel } from "../modules/catalog/catalog.schema.js";
import { createHold, confirmBooking } from "../modules/bookings/booking.service.js";
import { paymentQR, submitDemoSlip, reviewPayment } from "../modules/payments/payment.service.js";
import { bangkokDate } from "../modules/catalog/catalog.service.js";

export const DEMO_PASSWORD = "ZonifyDemo2026!";
export async function seedDemo(reset = false) {
  if (!env.DEMO_MODE) throw new Error("Demo reset is disabled outside demo mode");
  assertDemoEnvironment(env.MONGO_URI, env.APP_ORIGIN, env.HOST);
  if (mongoose.connection.name !== "zonify_demo") throw new Error("Refusing to reset another database");
  if (reset) for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
  for (const role of ["customer", "manager", "owner"]) {
    process.env[`SEED_${role.toUpperCase()}_EMAIL`] = `${role}@demo.zonify.test`;
    process.env[`SEED_${role.toUpperCase()}_PASSWORD`] = DEMO_PASSWORD;
  }
  await seedAuth();
  await seedCatalog(bangkokDate());
  await seedAdvertisements();
  const buyer = (await UserModel.findOne({ email: "customer@demo.zonify.test" }).lean())!;
  const manager = (await UserModel.findOne({ email: "manager@demo.zonify.test" }).lean())!;
  const category = (await CategoryModel.findOne({ active: true }).lean())!;
  const shop = await ShopModel.create({ _id: "demo-merchant-shop", ownerId: String(buyer._id), marketId: "canal", categoryId: String(category._id), name: "ร้านเดโมของฉัน", description: "ร้านตัวอย่างสำหรับทดลองจอง", hours: "16:00–22:00" });
  const date = bangkokDate(new Date(Date.now() + 86400000));
  const stalls = await StallModel.find({ marketId: "canal", enabled: true }).sort({ _id: 1 }).limit(4).lean();
  await StallDayStateModel.deleteMany({ date, stallId: { $in: stalls.map(s => s._id) } });
  for (const [i, stall] of stalls.entries()) {
    const held = await createHold(String(buyer._id), stall._id, date, shop._id);
    if (i === 0) continue;
    await confirmBooking(held.id as string, String(buyer._id));
    if (i === 1) continue;
    await paymentQR(held.id as string, String(buyer._id));
    const review = await submitDemoSlip(held.id as string, String(buyer._id));
    if (i === 3) await reviewPayment(held.id as string, String(manager._id), { decision: "approve", attemptId: review.payment.attempts.at(-1)!.id as string, verifiedReference: "DEMO-SEEDED-CONFIRMED" });
  }
  console.log("Demo data ready: customer/manager/owner@demo.zonify.test, password " + DEMO_PASSWORD);
}
