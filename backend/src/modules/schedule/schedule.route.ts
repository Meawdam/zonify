import { Router } from "express";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware.js";
import { dateQuery, slug } from "../catalog/catalog.service.js";
import { BookingModel } from "../bookings/booking.schema.js";
import { expireBookings } from "../bookings/booking.service.js";
import { addClosure, ensureSchedule, presentSchedule, removeClosure, ScheduleConflict, updateSchedule } from "./schedule.service.js";
const router = Router();
router.use(authMiddleware, requireRole("manager", "owner"));
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
const version = z.number().int().min(0), reason = z.string().trim().max(500);
const scheduleDto = z.object({ version, openWeekdays: z.array(z.number().int().min(0).max(6)).max(7).refine(a => new Set(a).size === a.length), exceptions: z.array(z.object({ date: dateQuery, open: z.boolean(), reason }).strict()).max(366).refine(a => new Set(a.map(e => e.date)).size === a.length, "วันที่พิเศษซ้ำกัน") }).strict();
const closureDto = z.object({ version, stallId: slug, startsOn: dateQuery, endsOn: dateQuery, reason: reason.min(1) }).strict().refine(d => d.endsOn >= d.startsOn, "วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่ม");
router.get("/markets/:id/schedule", async (req, res) => res.json(presentSchedule(await ensureSchedule(slug.parse(req.params.id)))));
router.put("/markets/:id/schedule", async (req, res) => { const { version, ...fields } = scheduleDto.parse(req.body); res.json(await updateSchedule(slug.parse(req.params.id), version, fields)); });
router.post("/markets/:id/closures", async (req, res) => { const { version, ...input } = closureDto.parse(req.body); res.status(201).json(await addClosure(slug.parse(req.params.id), version, input)); });
router.delete("/markets/:id/closures/:closureId", async (req, res) => { const body = z.object({ version }).strict().parse(req.body); res.json(await removeClosure(slug.parse(req.params.id), body.version, slug.parse(req.params.closureId))); });
router.get("/work-queue", async (_req, res) => {
  await expireBookings();
  const [paymentReview, pendingPayment, pendingRefund] = await Promise.all([
    BookingModel.countDocuments({ status: "payment_review" }), BookingModel.countDocuments({ status: "pending_payment" }), BookingModel.countDocuments({ "refund.status": "pending" }),
  ]); res.json({ paymentReview, pendingPayment, pendingRefund });
});
router.use((error: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (error instanceof ScheduleConflict) { res.status(409).json({ code: error.code, message: error.message, conflicts: error.conflicts, total: error.total }); return; } next(error);
});
export default router;
