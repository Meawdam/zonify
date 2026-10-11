import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { authMiddleware, requireRole, type AuthRequest } from "../../middlewares/auth.middleware.js";
import { HttpError } from "../../middlewares/http-error.js";
import { slug } from "../catalog/catalog.service.js";
import { emptyDto } from "../bookings/booking.dto.js";
import { slipDto, reviewDto, refundDto } from "./payment.dto.js";
import { paymentQR, submitSlip, getSlip, reviewPayment, recordRefund, MAX_SLIP_BYTES } from "./payment.service.js";
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_SLIP_BYTES, files: 1, fields: 3, parts: 4, fieldSize: 200 } }).single("slip");
const uploadLimit = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
  validate: { xForwardedForHeader: false }, message: { code: "RATE_LIMITED", message: "ส่งสลิปบ่อยเกินไป กรุณาลองใหม่ใน 15 นาที" } });
export const paymentRouter = Router();
paymentRouter.use(authMiddleware);
paymentRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
paymentRouter.post("/:id/payment/qr", async (req: AuthRequest, res) => {
  emptyDto.parse(req.body); res.json(await paymentQR(slug.parse(req.params.id), req.user!.id));
});
paymentRouter.post("/:id/payment/slip", uploadLimit, (req, res, next) => upload(req, res, error => {
  if (error instanceof multer.MulterError) return next(new HttpError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
    "INVALID_SLIP_UPLOAD", error.code === "LIMIT_FILE_SIZE" ? "สลิปต้องมีขนาดไม่เกิน 5 MB" : "ส่งภาพสลิปหนึ่งภาพ พร้อมยอด เวลาโอน และเลขอ้างอิงเท่านั้น"));
  next(error ? new HttpError(400, "INVALID_SLIP_UPLOAD", "รูปแบบการส่งสลิปไม่ถูกต้อง") : undefined);
}), async (req: AuthRequest, res) => {
  if (!req.file) throw new HttpError(400, "SLIP_REQUIRED", "กรุณาเลือกภาพสลิป");
  const body = slipDto.parse(req.body);
  res.status(201).json(await submitSlip(slug.parse(req.params.id), req.user!.id, req.file, body));
});
paymentRouter.get("/:id/payment/slips/:slipId", async (req: AuthRequest, res) => {
  const slip = await getSlip(slug.parse(req.params.id), slug.parse(req.params.slipId), req.user!.id, req.user!.role !== "customer");
  res.set({ "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Content-Disposition": 'inline; filename="payment-slip.jpg"',
    "Content-Security-Policy": "default-src 'none'; sandbox" });
  res.send(slip.data);
});
export const paymentAdminRouter = Router();
paymentAdminRouter.use(authMiddleware, requireRole("manager", "owner"));
paymentAdminRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
paymentAdminRouter.post("/:id/payment/review", async (req: AuthRequest, res) => {
  res.json(await reviewPayment(slug.parse(req.params.id), req.user!.id, reviewDto.parse(req.body)));
});
paymentAdminRouter.post("/:id/payment/refund", async (req: AuthRequest, res) => {
  res.json(await recordRefund(slug.parse(req.params.id), req.user!.id, refundDto.parse(req.body).reference));
});
