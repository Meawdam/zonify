import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Set all profile settings before importing application modules or dotenv.
const mongo = await MongoMemoryServer.create({ instance: { dbName: "zonify_demo", ip: "127.0.0.1" } });
Object.assign(process.env, {
  ZONIFY_DEMO_MODE: "1", MONGO_URI: mongo.getUri("zonify_demo"),
  BACKEND_PORT: "4001", BACKEND_HOST: "127.0.0.1", APP_ORIGIN: "http://127.0.0.1:3001",
  JWT_SECRET: randomBytes(32).toString("hex"), PROMPTPAY_ID: "", PROMPTPAY_NAME: "",
});
let server: import("node:http").Server | undefined;
let stopWorker: (() => void) | undefined;
async function stop() {
  stopWorker?.(); server?.close(); await mongoose.disconnect(); await mongo.stop(); process.exit();
}
process.once("SIGINT", () => void stop()); process.once("SIGTERM", () => void stop());
try {
  const { connectDatabase } = await import("../config/database.js");
  await connectDatabase();
  const { seedDemo } = await import("./seed-demo.js"); await seedDemo();
  const { default: app } = await import("../app.js");
  const { startBookingExpiry } = await import("../modules/bookings/booking.worker.js");
  server = app.listen(4001, "127.0.0.1");
  await new Promise<void>((resolve, reject) => { server!.once("listening", resolve); server!.once("error", reject); });
  stopWorker = startBookingExpiry();
  console.log("DEMO_READY http://127.0.0.1:4001 — isolated temporary database");
} catch (error) { console.error(error); process.exitCode = 1; await mongoose.disconnect(); await mongo.stop(); }
