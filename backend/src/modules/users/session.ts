import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { SessionModel } from "./schema/session.schema.js";
export const COOKIE_NAME = "zonify_session";
export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: env.COOKIE_SECURE, path: "/" };
export function cookieToken(req: Request) {
  return req.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
}
export function verifyToken(token: string) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"], issuer: "zonify", audience: "zonify-web" });
    if (typeof payload !== "object" || typeof payload.sub !== "string" || typeof payload.jti !== "string") return null;
    return { userId: payload.sub, sessionId: payload.jti };
  } catch { return null; }
}
export async function issueSession(res: Response, userId: string, authVersion: number) {
  const sessionId = randomUUID();
  await SessionModel.create({ _id: sessionId, userId, authVersion, expiresAt: new Date(Date.now() + 3_600_000) });
  const token = jwt.sign({}, env.JWT_SECRET, { algorithm: "HS256", subject: userId, jwtid: sessionId, issuer: "zonify", audience: "zonify-web", expiresIn: "1h" });
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 3_600_000 });
}
export function clearSessionCookie(res: Response) { res.clearCookie(COOKIE_NAME, cookieOptions); }
