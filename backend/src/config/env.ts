const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not defined`);
  return value;
};
const appOrigin = new URL(process.env.APP_ORIGIN ?? "http://localhost:3000").origin;
const secret = required("JWT_SECRET");
if (secret.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters");
export const env = {
  PORT: Number(process.env.BACKEND_PORT ?? 4000),
  MONGO_URI: required("MONGO_URI"), JWT_SECRET: secret,
  APP_ORIGIN: appOrigin, COOKIE_SECURE: appOrigin.startsWith("https://"),
};
