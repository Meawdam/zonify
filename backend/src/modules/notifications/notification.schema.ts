import mongoose, { Schema } from "mongoose";
import { notificationTypes } from "./notification.event.js";
const schema = new Schema({
  _id: { type: String, required: true }, userId: { type: String, required: true },
  bookingId: { type: String, required: true }, type: { type: String, enum: notificationTypes, required: true },
  message: { type: String, required: true }, createdAt: { type: Date, required: true },
  readAt: { type: Date, default: null }, reminderDeadline: { type: Date, default: null },
});
schema.index({ userId: 1, createdAt: -1, _id: 1 });
schema.index({ userId: 1, readAt: 1 });
export const NotificationModel = mongoose.model("Notification", schema);
