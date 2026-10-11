import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { HttpError } from "./http-error.js";
export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) return res.status(400).json({ code: "VALIDATION_ERROR", message: "กรุณาตรวจสอบข้อมูล", errors: error.issues.map(i => ({ path: i.path, message: i.message })) });
  if (error instanceof HttpError) return res.status(error.status).json({ code: error.code, message: error.message });
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return res.status(409).json({ code: "EMAIL_EXISTS", message: "อีเมลนี้ถูกใช้แล้ว", errors: [{ path: ["email"], message: "อีเมลนี้ถูกใช้แล้ว" }] });
  if (error instanceof SyntaxError && "status" in error && error.status === 400) return res.status(400).json({ code: "INVALID_JSON", message: "รูปแบบข้อมูลไม่ถูกต้อง" });
  if (typeof error === "object" && error !== null && "type" in error && error.type === "entity.too.large") return res.status(413).json({ code: "BODY_TOO_LARGE", message: "ข้อมูลมีขนาดใหญ่เกินไป" });
  console.error("Request failed", error instanceof Error ? error.name : "Unknown error");
  return res.status(500).json({ code: "INTERNAL_ERROR", message: "ระบบขัดข้อง กรุณาลองอีกครั้ง" });
};
