import mongoose, { Schema } from "mongoose";
// Private images are separate from booking records to stay below Mongo's document limit.
// No public static directory or TTL deletion; referenced evidence survives review/cancellation.
export const SlipModel = mongoose.model("PaymentSlip", new Schema({
  _id: { type: String, required: true }, bookingId: { type: String, required: true, index: true },
  userId: { type: String, required: true }, data: { type: Buffer, required: true, select: false },
  contentType: { type: String, default: "image/jpeg" }, bytes: Number,
}, { timestamps: true }));
