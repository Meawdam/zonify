import { randomUUID } from "node:crypto";
import { HttpError } from "../../middlewares/http-error.js";
import { UserModel, publicUser } from "../users/schema/user.schema.js";
import { MarketModel, ZoneModel, StallModel, StallDayStateModel, ShopModel, CategoryModel } from "../catalog/catalog.schema.js";
import { BookingModel, activeBookingStatuses } from "./booking.schema.js";
import type { z } from "zod";
import type { bookingQuery } from "./booking.dto.js";
import { bangkokDate } from "../catalog/catalog.service.js";
import { registerHold, assertDayAvailable } from "../schedule/schedule.service.js";
import { notificationEvent } from "../notifications/notification.event.js";
export const HOLD_MS = 10 * 60_000;
export const PAYMENT_MS = 30 * 60_000;
export async function expireBookings(now = new Date(), slot?: { stallId: string; date: string }) {
  await BookingModel.deleteMany({ status: "preparing", expiresAt: { $lte: now }, ...slot });
  return BookingModel.updateMany({ status: { $in: ["held", "pending_payment"] }, expiresAt: { $lte: now }, ...slot }, { $set: { status: "expired" } });
}
export function presentBooking(doc: object) {
  const row = doc as Record<string, unknown>;
  const user = row.userSnapshot as Record<string, unknown> | undefined;
  const stall = row.stallSnapshot as Record<string, unknown> | undefined;
  const attempts = (row.paymentAttempts ?? []) as Record<string, unknown>[];
  return { id: row._id, date: row.date, status: row.status, price: row.price,
    shop: row.shopSnapshot ?? null,
    createdAt: row.createdAt, updatedAt: row.updatedAt, expiresAt: row.expiresAt ?? null,
    cancelledAt: row.cancelledAt ?? null, cancelReason: row.cancelReason ?? "",
    payment: { recipient: row.paymentRecipient ?? null, paidAt: row.paidAt ?? null,
      approvedReference: row.approvedReference ?? null, refund: row.refund ?? null,
      attempts: attempts.map(a => ({ id: a.id, amount: a.amount, transferredAt: a.transferredAt,
        reference: a.submittedReference, submittedAt: a.submittedAt, status: a.status,
        reviewedAt: a.reviewedAt ?? null, reviewReason: a.reviewReason ?? "", verifiedReference: a.verifiedReference ?? "",
        slipUrl: `/api/bookings/${row._id}/payment/slips/${a.slipId}` })), },
    customer: { id: row.userId, name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", role: user?.role ?? "customer" },
    stall: { id: row.stallId, marketId: row.marketId, code: stall?.code ?? "", width: stall?.width ?? 0, depth: stall?.depth ?? 0, marketName: stall?.marketName ?? "", zoneName: stall?.zoneName ?? "" },
  };
}
async function usableStall(id: string) {
  const stall = await StallModel.findById(id).lean();
  if (!stall) throw new HttpError(404, "STALL_NOT_FOUND", "ไม่พบล็อกนี้");
  const [market, zone] = await Promise.all([
    MarketModel.findOne({ _id: stall.marketId, active: true }).lean(),
    stall.zoneId ? ZoneModel.findOne({ _id: stall.zoneId, marketId: stall.marketId, active: true }).lean() : Promise.resolve(null),
  ]);
  if (!market || !stall.enabled || (stall.zoneId && !zone)) throw new HttpError(409, "STALL_UNAVAILABLE", "ตลาด โซน หรือล็อกนี้ปิดใช้งาน");
  return { stall, market, zone };
}
export async function createHold(userId: string, stallId: string, date: string, shopId: string, now = new Date()) {
  await expireBookings(now, { stallId, date });
  const { stall, market, zone } = await usableStall(stallId);
  const shop = shopId ? await ShopModel.findOne({ _id: shopId, ownerId: userId }).lean() : null;
  if (!shop) throw new HttpError(404, "SHOP_NOT_FOUND", "ไม่พบร้านของคุณ");
  if (shop.marketId !== market._id || !shop.active || !await CategoryModel.exists({ _id: shop.categoryId, active: true }))
    throw new HttpError(409, "SHOP_UNAVAILABLE", "กรุณาเลือกร้านที่เปิดใช้งานในตลาดเดียวกับล็อก");
  const [user, sample] = await Promise.all([
    UserModel.findById(userId).lean(), StallDayStateModel.findOne({ stallId, date }).lean(),
  ]);
  if (!user) throw new HttpError(401, "UNAUTHENTICATED", "กรุณาเข้าสู่ระบบใหม่");
  if (sample && !(sample.status === "held" && sample.expiresAt && sample.expiresAt <= now))
    throw new HttpError(409, "STALL_TAKEN", "ล็อกนี้ไม่ว่างในวันที่เลือก");
  const existing = await BookingModel.findOne({ stallId, date, status: { $in: [...activeBookingStatuses] } }).lean();
  if (existing) {
    if (existing.userId === userId && (existing.shopId ?? null) === (shopId ?? null) && existing.status === "held" && existing.expiresAt && existing.expiresAt > now) return presentBooking(existing);
    throw new HttpError(409, "STALL_TAKEN", "มีผู้พักล็อกหรือจองล็อกนี้แล้ว");
  }
  try {
    const doc = await BookingModel.create({ _id: randomUUID(), userId, userSnapshot: publicUser(user), marketId: market._id, stallId, date,
      shopId: shop._id, shopSnapshot: { id: shop._id, name: shop.name, categoryId: shop.categoryId, phone: shop.phone, contactUrl: shop.contactUrl },
      stallSnapshot: { code: stall.code, width: stall.width, depth: stall.depth, marketName: market.name, zoneName: zone?.name ?? "" },
      price: stall.pricePerDay, status: "preparing", expiresAt: new Date(now.valueOf() + HOLD_MS) });
    try {
      await registerHold(market._id, stallId, date);
      const held = await BookingModel.findOneAndUpdate({ _id: doc._id, status: "preparing", $expr: { $gt: ["$expiresAt", "$$NOW"] } }, { $set: { status: "held" } }, { returnDocument: "after" }).lean();
      if (!held) throw new HttpError(409, "HOLD_EXPIRED", "การพักล็อกหมดเวลา กรุณาลองใหม่");
      return presentBooking(held);
    } finally { await BookingModel.deleteOne({ _id: doc._id, status: "preparing" }); }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      const winner = await BookingModel.findOne({ stallId, date, userId, status: "held", expiresAt: { $gt: now } }).lean();
      if (winner && (winner.shopId ?? null) === (shopId ?? null)) return presentBooking(winner);
      throw new HttpError(409, "STALL_TAKEN", "มีผู้พักล็อกหรือจองล็อกนี้แล้ว");
    }
    throw error;
  }
}
async function owned(id: string, userId: string) {
  const row = await BookingModel.findOne({ _id: id, userId, status: { $ne: "preparing" } }).lean();
  if (!row) throw new HttpError(404, "BOOKING_NOT_FOUND", "ไม่พบรายการของคุณ");
  return row;
}
export async function confirmBooking(id: string, userId: string, now = new Date()) {
  await expireBookings(now);
  const row = await owned(id, userId);
  if (row.status === "pending_payment" && row.expiresAt && row.expiresAt > now) return presentBooking(row);
  if (row.status !== "held" || !row.expiresAt || row.expiresAt <= now) throw new HttpError(409, "HOLD_EXPIRED", "รายการพักล็อกหมดอายุหรือใช้ไม่ได้แล้ว");
  await usableStall(row.stallId);
  await assertDayAvailable(row.marketId, row.stallId, row.date);
  const updated = await BookingModel.findOneAndUpdate({ _id: id, userId, status: "held", expiresAt: { $gt: now }, $expr: { $gt: ["$expiresAt", "$$NOW"] } },
    { $set: { status: "pending_payment", expiresAt: new Date(now.valueOf() + PAYMENT_MS) } }, { returnDocument: "after" }).lean();
  if (!updated) throw new HttpError(409, "BOOKING_CHANGED", "สถานะรายการเปลี่ยนแล้ว กรุณาโหลดใหม่");
  return presentBooking(updated);
}
export async function cancelBooking(id: string, actorId: string, reason: string, manager = false, now = new Date()) {
  await expireBookings(now);
  const row = manager ? await BookingModel.findById(id).lean() : await owned(id, actorId);
  if (!row) throw new HttpError(404, "BOOKING_NOT_FOUND", "ไม่พบรายการนี้");
  if (row.status === "cancelled") return presentBooking(row);
  if (row.status === "payment_review") throw new HttpError(409, "PAYMENT_REVIEW_REQUIRED", "กรุณาตรวจสลิปให้เสร็จก่อนยกเลิกรายการ");
  const permitted: readonly string[] = manager ? ["held", "pending_payment", "confirmed"] : ["held", "pending_payment"];
  if (!permitted.includes(row.status)) throw new HttpError(409, "BOOKING_CHANGED", "รายการนี้ยกเลิกไม่ได้หรือสถานะเปลี่ยนแล้ว");
  const cancellation: Record<string, unknown> = { status: "cancelled", cancelledAt: now, cancelReason: reason, cancelledBy: actorId, expiresAt: null,
    ...(row.status === "confirmed" ? { refund: { status: "pending", amount: row.price, requestedAt: now } } : {}) };
  const updated = await BookingModel.findOneAndUpdate({ _id: id, status: row.status, ...(manager ? {} : { userId: actorId }) },
    { $set: cancellation, ...(manager ? { $push: { notificationEvents: notificationEvent(`${id}:cancelled`, "booking_cancelled", `ผู้ดูแลยกเลิกรายการ: ${reason}`, now) } } : {}) },
    { returnDocument: "after" }).lean();
  if (!updated) throw new HttpError(409, "BOOKING_CHANGED", "รายการนี้ยกเลิกไม่ได้หรือสถานะเปลี่ยนแล้ว");
  return presentBooking(updated);
}
export async function listBookings(query: z.infer<typeof bookingQuery>, userId?: string, holdsOnly = false) {
  await expireBookings();
  const filter = { ...bookingGroupFilter(query.group), ...(userId ? { userId } : {}), ...(query.shop ? { shopId: query.shop } : {}), ...(holdsOnly ? { status: "held" as const } : query.status ? { status: query.status } : { status: { $ne: "preparing" } }), ...(query.refund ? { "refund.status": query.refund } : {}), ...(query.date ? { date: query.date } : {}), ...(query.market ? { marketId: query.market } : {}) };
  const [items, total] = await Promise.all([
    BookingModel.find(filter).sort({ createdAt: -1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    BookingModel.countDocuments(filter),
  ]);
  return { items: items.map(presentBooking), total, page: query.page, pages: Math.ceil(total / query.limit) };
}
export function bookingGroupFilter(group?: "current" | "history" | "action"): Record<string, unknown> {
  const history = { $or: [{ status: { $in: ["cancelled", "expired"] } }, { status: "confirmed", date: { $lt: bangkokDate() } }] };
  if (group === "history") return { $and: [history] };
  if (group === "current") return { $nor: history.$or, status: { $ne: "preparing" } };
  if (group === "action") return { $and: [{ status: { $in: ["held", "pending_payment"] } }] };
  return {};
}
export async function getBooking(id: string, userId: string) {
  await expireBookings(); return presentBooking(await owned(id, userId));
}
export async function releaseHold(id: string, managerId: string, reason: string, now = new Date()) {
  await expireBookings(now);
  const updated = await BookingModel.findOneAndUpdate({ _id: id, status: "held", expiresAt: { $gt: now } },
    { $set: { status: "cancelled", cancelledAt: now, cancelReason: reason, cancelledBy: managerId, expiresAt: null }, $push: { notificationEvents: notificationEvent(`${id}:cancelled`, "booking_cancelled", `ผู้ดูแลคืนพื้นที่พักล็อก: ${reason}`, now) } }, { returnDocument: "after" }).lean();
  if (!updated) {
    if (!await BookingModel.exists({ _id: id })) throw new HttpError(404, "BOOKING_NOT_FOUND", "ไม่พบรายการนี้");
    throw new HttpError(409, "HOLD_CHANGED", "รายการนี้ไม่ใช่การพักล็อกแล้ว กรุณาโหลดใหม่");
  }
  return presentBooking(updated);
}
