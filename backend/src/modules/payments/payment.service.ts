import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import generatePayload from "promptpay-qr";
import QRCode from "qrcode";
import { env } from "../../config/env.js";
import { HttpError } from "../../middlewares/http-error.js";
import { BookingModel } from "../bookings/booking.schema.js";
import { expireBookings, presentBooking, PAYMENT_MS } from "../bookings/booking.service.js";
import { SlipModel } from "./payment.schema.js";
import type { z } from "zod";
import type { slipDto, reviewDto } from "./payment.dto.js";
export const MAX_SLIP_BYTES = 5 * 1024 * 1024;
export function promptPayConfig() {
  if (!env.PROMPTPAY_ID || !env.PROMPTPAY_NAME) throw new HttpError(503, "PAYMENT_NOT_CONFIGURED", "ยังไม่ได้กำหนดบัญชีรับชำระเงิน กรุณาติดต่อผู้จัดการ");
  if (!/^(0\d{9}|\d{13})$/.test(env.PROMPTPAY_ID) || env.PROMPTPAY_NAME.length > 150)
    throw new HttpError(503, "PAYMENT_CONFIG_INVALID", "บัญชีรับชำระเงินตั้งค่าไม่ถูกต้อง กรุณาติดต่อผู้จัดการ");
  return { id: env.PROMPTPAY_ID, name: env.PROMPTPAY_NAME };
}
export function paymentAmount(price: number) {
  if (!Number.isFinite(price) || price <= 0 || price > 9999999.99 || Math.abs(price * 100 - Math.round(price * 100)) > 0.000001)
    throw new HttpError(409, "INVALID_PAYMENT_AMOUNT", "รายการนี้ไม่มีราคาที่ชำระผ่าน QR ได้ กรุณาติดต่อผู้จัดการ");
  return price;
}
async function ownBooking(id: string, userId: string) {
  const row = await BookingModel.findOne({ _id: id, userId }).lean();
  if (!row) throw new HttpError(404, "BOOKING_NOT_FOUND", "ไม่พบรายการของคุณ");
  return row;
}
export async function paymentQR(id: string, userId: string, now = new Date()) {
  await expireBookings(now);
  let row = await ownBooking(id, userId);
  if (row.status !== "pending_payment" || !row.expiresAt || row.expiresAt <= now) throw new HttpError(409, "PAYMENT_NOT_PENDING", "รายการนี้ไม่อยู่ในเวลาชำระเงิน");
  const amount = paymentAmount(row.price);
  if (!row.paymentRecipient) {
    const recipient = promptPayConfig();
    const updated = await BookingModel.findOneAndUpdate({ _id: id, userId, status: "pending_payment", expiresAt: { $gt: now }, paymentRecipient: null },
      { $set: { paymentRecipient: recipient } }, { returnDocument: "after" }).lean();
    row = updated ?? await ownBooking(id, userId);
    if (!row.paymentRecipient || row.status !== "pending_payment") throw new HttpError(409, "BOOKING_CHANGED", "สถานะรายการเปลี่ยนแล้ว กรุณาโหลดใหม่");
  }
  const payload = generatePayload(row.paymentRecipient.id!, { amount });
  return { bookingId: id, amount, currency: "THB", recipient: row.paymentRecipient,
    expiresAt: row.expiresAt, payload, qrDataUrl: await QRCode.toDataURL(payload, { width: 320, margin: 4, errorCorrectionLevel: "M" }) };
}
async function prepareImage(file: Express.Multer.File) {
  if (!file.buffer.length || file.buffer.length > MAX_SLIP_BYTES) throw new HttpError(413, "SLIP_TOO_LARGE", "สลิปต้องมีขนาดไม่เกิน 5 MB");
  const png = file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = file.buffer[0] === 255 && file.buffer[1] === 216 && file.buffer[2] === 255;
  if (!(png && file.mimetype === "image/png") && !(jpeg && file.mimetype === "image/jpeg"))
    throw new HttpError(400, "INVALID_SLIP", "รับเฉพาะภาพสลิป PNG หรือ JPEG ที่ถูกต้อง");
  try {
    const image = sharp(file.buffer, { limitInputPixels: 20_000_000, failOn: "warning" });
    const meta = await image.metadata();
    if ((meta.pages ?? 1) !== 1) throw new Error("Animated image");
    return await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  } catch { throw new HttpError(400, "INVALID_SLIP", "ภาพสลิปเสียหาย ใหญ่เกินไป หรืออ่านไม่ได้"); }
}
export async function submitSlip(id: string, userId: string, file: Express.Multer.File, body: z.infer<typeof slipDto>, now = new Date()) {
  await expireBookings(now);
  const row = await ownBooking(id, userId);
  if (row.status !== "pending_payment" || !row.expiresAt || row.expiresAt <= now) throw new HttpError(409, "PAYMENT_NOT_PENDING", "รายการนี้ส่งสลิปไม่ได้หรือหมดเวลาชำระเงินแล้ว");
  if (!row.paymentRecipient) throw new HttpError(409, "PAYMENT_QR_REQUIRED", "กรุณาเปิด QR ของรายการนี้ก่อนส่งสลิป");
  if (row.paymentAttempts.length >= 10) throw new HttpError(409, "SLIP_ATTEMPT_LIMIT", "ส่งสลิปครบ 10 ครั้งแล้ว กรุณาติดต่อผู้จัดการ");
  const data = await prepareImage(file), slipId = randomUUID(), attemptId = randomUUID();
  const slipHash = createHash("sha256").update(data).digest("hex");
  await SlipModel.create({ _id: slipId, bookingId: id, userId, data, bytes: data.length });
  // Only one concurrent upload wins. Expiry/cancel cannot be overwritten by a late image decode.
  const updated = await BookingModel.findOneAndUpdate({ _id: id, userId, status: "pending_payment", expiresAt: { $gt: new Date() },
    "paymentAttempts.9": { $exists: false } }, { $set: { status: "payment_review", expiresAt: null },
    $push: { paymentAttempts: { id: attemptId, slipId, slipHash, amount: body.amount, transferredAt: new Date(body.transferredAt),
      submittedReference: body.reference, submittedAt: now, status: "review" } } }, { returnDocument: "after" }).lean();
  if (!updated) { await SlipModel.deleteOne({ _id: slipId }); throw new HttpError(409, "BOOKING_CHANGED", "รายการหมดเวลาหรือสถานะเปลี่ยนแล้ว กรุณาโหลดใหม่"); }
  return presentBooking(updated);
}
export async function getSlip(bookingId: string, slipId: string, userId: string, manager: boolean) {
  const row = await BookingModel.findOne({ _id: bookingId, ...(manager ? {} : { userId }), "paymentAttempts.slipId": slipId }).lean();
  if (!row) throw new HttpError(404, "SLIP_NOT_FOUND", "ไม่พบสลิปนี้");
  const slip = await SlipModel.findOne({ _id: slipId, bookingId }).select("+data");
  if (!slip) throw new HttpError(404, "SLIP_NOT_FOUND", "ไม่พบสลิปนี้");
  return slip;
}
export async function reviewPayment(id: string, actorId: string, body: z.infer<typeof reviewDto>, now = new Date()) {
  const row = await BookingModel.findById(id).lean();
  if (!row) throw new HttpError(404, "BOOKING_NOT_FOUND", "ไม่พบรายการนี้");
  const attempt = row.paymentAttempts.at(-1);
  if (!attempt || attempt.id !== body.attemptId || attempt.status !== "review" || row.status !== "payment_review")
    throw new HttpError(409, "PAYMENT_CHANGED", "สลิปนี้ตรวจสอบแล้วหรือมีสลิปใหม่ กรุณาโหลดใหม่");
  const approve = body.decision === "approve";
  if (approve && Math.round(attempt.amount! * 100) !== Math.round(row.price * 100))
    throw new HttpError(409, "PAYMENT_AMOUNT_MISMATCH", "ยอดสลิปไม่ตรงยอดจอง กรุณาปฏิเสธและให้ลูกค้าแก้ไข");
  const index = row.paymentAttempts.length - 1;
  const update: Record<string, unknown> = { status: approve ? "confirmed" : "pending_payment", expiresAt: approve ? null : new Date(now.valueOf() + PAYMENT_MS),
    [`paymentAttempts.${index}.status`]: approve ? "approved" : "rejected", [`paymentAttempts.${index}.reviewedAt`]: now,
    [`paymentAttempts.${index}.reviewedBy`]: actorId, [`paymentAttempts.${index}.reviewReason`]: approve ? "" : body.reason };
  if (approve) Object.assign(update, { approvedReference: body.verifiedReference, approvedSlipHash: attempt.slipHash, paidAt: now,
    [`paymentAttempts.${index}.verifiedReference`]: body.verifiedReference });
  try {
    const updated = await BookingModel.findOneAndUpdate({ _id: id, status: "payment_review",
      [`paymentAttempts.${index}.id`]: body.attemptId, [`paymentAttempts.${index}.status`]: "review" }, { $set: update }, { returnDocument: "after" }).lean();
    if (!updated) throw new HttpError(409, "PAYMENT_CHANGED", "สถานะสลิปเปลี่ยนแล้ว กรุณาโหลดใหม่");
    return presentBooking(updated);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000)
      throw new HttpError(409, "PAYMENT_ALREADY_USED", "เลขอ้างอิงหรือภาพสลิปนี้ถูกใช้ยืนยันรายการอื่นแล้ว");
    throw error;
  }
}
export async function recordRefund(id: string, actorId: string, reference: string, now = new Date()) {
  const row = await BookingModel.findById(id).lean();
  if (!row) throw new HttpError(404, "BOOKING_NOT_FOUND", "ไม่พบรายการนี้");
  if (row.refund?.status === "refunded" && row.refund.reference === reference) return presentBooking(row);
  const updated = await BookingModel.findOneAndUpdate({ _id: id, status: "cancelled", "refund.status": "pending" },
    { $set: { "refund.status": "refunded", "refund.completedAt": now, "refund.completedBy": actorId, "refund.reference": reference } }, { returnDocument: "after" }).lean();
  if (!updated) throw new HttpError(409, "REFUND_NOT_PENDING", "รายการนี้ไม่มีการคืนเงินที่รอบันทึก");
  return presentBooking(updated);
}
