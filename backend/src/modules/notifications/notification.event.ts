import { Schema } from "mongoose";
export const notificationTypes = ["booking_approved", "slip_rejected", "booking_cancelled", "refund_completed", "payment_expiring"] as const;
export function notificationEvent(id: string, type: typeof notificationTypes[number], message: string, now = new Date()) {
  return { id, type, message, createdAt: now, deliveredAt: null };
}
export const notificationEventSchema = new Schema({
  id: { type: String, required: true }, type: { type: String, enum: notificationTypes, required: true },
  message: { type: String, required: true }, createdAt: { type: Date, required: true },
  deliveredAt: { type: Date, default: null }, reminderDeadline: { type: Date, default: null },
}, { _id: false });
