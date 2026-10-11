import type { Request, Response, NextFunction } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";
export function requireOrigin(req: Request, _res: Response, next: NextFunction) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin") !== env.APP_ORIGIN) {
    return next(new HttpError(403, "INVALID_ORIGIN", "แหล่งที่มาของคำขอไม่ถูกต้อง"));
  }
  next();
}
// Local deployment: the Next proxy shares one IP budget. Never trust client-supplied forwarded headers.
export const loginLimit = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false }, message: { code: "RATE_LIMITED", message: "ทำรายการบ่อยเกินไป กรุณาลองใหม่ใน 15 นาที" } });
export const registerLimit = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, validate: { xForwardedForHeader: false }, message: { code: "RATE_LIMITED", message: "สมัครบ่อยเกินไป กรุณาลองใหม่ใน 1 ชั่วโมง" } });
