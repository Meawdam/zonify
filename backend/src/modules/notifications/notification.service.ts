import type { PipelineStage } from "mongoose";
import { HttpError } from "../../middlewares/http-error.js";
import { BookingModel } from "../bookings/booking.schema.js";
import { notificationEvent } from "./notification.event.js";
import { NotificationModel } from "./notification.schema.js";

export async function processNotifications(now = new Date()) {
  const eligible = { status: "pending_payment", expiresAt: { $gt: now, $lte: new Date(now.valueOf() + 300_000) }, "paymentAttempts.0": { $exists: false } };
  for await (const booking of BookingModel.find(eligible).select("_id expiresAt").lean().cursor()) {
    const id = `${booking._id}:payment-expiring:${booking.expiresAt!.toISOString()}`;
    // The eligibility predicate is rechecked in the same atomic write as the event.
    await BookingModel.updateOne({ ...eligible, _id: booking._id, expiresAt: booking.expiresAt!, "notificationEvents.id": { $ne: id } },
      { $push: { notificationEvents: { ...notificationEvent(id, "payment_expiring", "เหลือเวลาชำระเงินไม่เกิน 5 นาที กรุณาชำระเงินและส่งสลิป", now), reminderDeadline: booking.expiresAt } } });
  }
  for await (const booking of BookingModel.find({ notificationEvents: { $elemMatch: { deliveredAt: null } } }).select("userId notificationEvents").lean().cursor()) {
    for (const event of booking.notificationEvents) {
      if (event.deliveredAt) continue;
      try {
        await NotificationModel.updateOne({ _id: event.id }, { $setOnInsert: {
          userId: booking.userId, bookingId: booking._id, type: event.type, message: event.message,
          createdAt: event.createdAt, readAt: null, reminderDeadline: event.reminderDeadline,
        } }, { upsert: true });
      } catch (error) {
        // Another worker may win the unique event id upsert; any other failure must retry later.
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
      }
      await BookingModel.updateOne({ _id: booking._id, notificationEvents: { $elemMatch: { id: event.id, deliveredAt: null } } },
        { $set: { "notificationEvents.$.deliveredAt": now } });
    }
  }
}

export async function listNotifications(userId: string, page = 1, limit = 20, now = new Date()) {
  const pipeline: PipelineStage[] = [
    { $match: { userId } },
    { $lookup: { from: BookingModel.collection.name, localField: "bookingId", foreignField: "_id", as: "booking" } },
    { $match: { $or: [{ type: { $ne: "payment_expiring" } }, { $and: [
      { "booking.0.status": "pending_payment", "booking.0.paymentAttempts.0": { $exists: false }, reminderDeadline: { $gt: now } },
      { $expr: { $eq: ["$reminderDeadline", { $arrayElemAt: ["$booking.expiresAt", 0] }] } },
    ] }] } },
    { $facet: {
      items: [{ $sort: { createdAt: -1, _id: 1 } }, { $skip: (page - 1) * limit }, { $limit: limit },
        { $project: { _id: 0, id: "$_id", bookingId: 1, type: 1, message: 1, createdAt: 1, readAt: 1 } }],
      total: [{ $count: "count" }], unread: [{ $match: { readAt: null } }, { $count: "count" }],
    } },
  ];
  const [result] = await NotificationModel.aggregate(pipeline);
  const total: number = result.total[0]?.count ?? 0;
  return { items: result.items as { id: string; bookingId: string; type: string; message: string; createdAt: Date; readAt: Date | null }[], total, page, pages: Math.ceil(total / limit), unreadCount: result.unread[0]?.count ?? 0 };
}
export async function markNotificationRead(id: string, userId: string, now = new Date()) {
  const result = await NotificationModel.updateOne({ _id: id, userId }, [{ $set: { readAt: { $ifNull: ["$readAt", now] } } }], { updatePipeline: true });
  if (!result.matchedCount) throw new HttpError(404, "NOTIFICATION_NOT_FOUND", "ไม่พบการแจ้งเตือนนี้");
  return { ok: true };
}
export async function markAllNotificationsRead(userId: string, now = new Date()) {
  await NotificationModel.updateMany({ userId, readAt: null }, { $set: { readAt: now } });
  return { ok: true };
}
