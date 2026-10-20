import { assertDemoEnvironment } from "./demo.js";
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not defined`);
  return value;
};
const appOrigin = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin;
const secret = required("JWT_SECRET");
if (secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
export const env = {
  DEMO_MODE: process.env.ZONIFY_DEMO_MODE === "1",
  PORT: Number(process.env.BACKEND_PORT ?? 4000),
  HOST: process.env.BACKEND_HOST ?? "127.0.0.1",
  MONGO_URI: required("MONGO_URI"), JWT_SECRET: secret,
  APP_ORIGIN: appOrigin, COOKIE_SECURE: appOrigin.startsWith("https://"),
  PROMPTPAY_ID: (process.env.PROMPTPAY_ID ?? "").trim(),
  PROMPTPAY_NAME: (process.env.PROMPTPAY_NAME ?? "").trim(),
};
if (env.DEMO_MODE) assertDemoEnvironment(env.MONGO_URI, env.APP_ORIGIN, env.HOST);
