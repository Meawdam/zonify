import { Router } from "express";
import type { AuthRequest } from "../../middlewares/auth.middleware.js";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware.js";
import { slug } from "../catalog/catalog.service.js";
import { holdDto, bookingQuery, holdQuery, cancelDto, emptyDto } from "./booking.dto.js";
import { createHold, confirmBooking, cancelBooking, listBookings, getBooking, releaseHold } from "./booking.service.js";
const router = Router();
router.use(authMiddleware);
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.post("/holds", async (req: AuthRequest, res) => {
  const body = holdDto.parse(req.body);
  res.status(201).json(await createHold(req.user!.id, body.stallId, body.date, body.shopId));
});
router.get("/me", async (req: AuthRequest, res) => res.json(await listBookings(bookingQuery.parse(req.query), req.user!.id)));
router.get("/:id", async (req: AuthRequest, res) => res.json(await getBooking(slug.parse(req.params.id), req.user!.id)));
router.post("/:id/confirm", async (req: AuthRequest, res) => {
  emptyDto.parse(req.body); res.json(await confirmBooking(slug.parse(req.params.id), req.user!.id));
});
router.post("/:id/cancel", async (req: AuthRequest, res) => {
  const body = cancelDto.parse(req.body); res.json(await cancelBooking(slug.parse(req.params.id), req.user!.id, body.reason));
});
export const managerBookingRouter = Router();
managerBookingRouter.use(authMiddleware, requireRole("manager", "owner"));
managerBookingRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
managerBookingRouter.get("/", async (req, res) => res.json(await listBookings(bookingQuery.parse(req.query))));
managerBookingRouter.post("/:id/cancel", async (req: AuthRequest, res) => {
  const body = cancelDto.parse(req.body); res.json(await cancelBooking(slug.parse(req.params.id), req.user!.id, body.reason, true));
});
export const managerHoldRouter = Router();
managerHoldRouter.use(authMiddleware, requireRole("manager", "owner"));
managerHoldRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
managerHoldRouter.get("/", async (req, res) => res.json(await listBookings(holdQuery.parse(req.query), undefined, true)));
managerHoldRouter.post("/:id/release", async (req: AuthRequest, res) => {
  const body = cancelDto.parse(req.body);
  res.json(await releaseHold(slug.parse(req.params.id), req.user!.id, body.reason));
});
export default router;
