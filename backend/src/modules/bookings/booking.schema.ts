import mongoose, { Schema } from "mongoose";
export const activeBookingStatuses = ["held", "pending_payment", "payment_review", "confirmed"] as const;
export const bookingStatuses = [...activeBookingStatuses, "cancelled", "expired"] as const;
const bookingSchema = new Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  userSnapshot: { id: String, name: String, email: String, phone: String, role: String },
  marketId: { type: String, required: true, index: true },
  stallId: { type: String, required: true },
  stallSnapshot: { code: String, width: Number, depth: Number, marketName: String, zoneName: String },
  date: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 },
  status: { type: String, enum: bookingStatuses, required: true },
  expiresAt: { type: Date, default: null },
  cancelledAt: { type: Date, default: null },
  cancelReason: { type: String, default: "" },
  cancelledBy: { type: String, default: null },
  paymentRecipient: { type: new Schema({ id: String, name: String }, { _id: false }), default: null },
  paymentAttempts: { type: [new Schema({
    id: { type: String, required: true }, amount: Number, transferredAt: Date,
    submittedReference: String, slipId: String, slipHash: String, submittedAt: Date,
    status: { type: String, enum: ["review", "approved", "rejected"] },
    reviewedAt: { type: Date, default: null }, reviewedBy: { type: String, default: null },
    reviewReason: { type: String, default: "" }, verifiedReference: { type: String, default: "" },
  }, { _id: false })], default: [] },
  // Retained even after cancellation: a transaction/image cannot pay for another booking.
  approvedReference: { type: String }, approvedSlipHash: { type: String }, paidAt: { type: Date, default: null },
  refund: { type: new Schema({ status: { type: String, enum: ["pending", "refunded"] },
    amount: Number, requestedAt: Date, completedAt: { type: Date, default: null },
    completedBy: { type: String, default: null }, reference: { type: String, default: "" },
  }, { _id: false }), default: null },
}, { timestamps: true });
// Each reservation is one document. This index is the exclusive slot/day claim,
// so holds, confirmations and cancellations remain atomic on standalone MongoDB.
bookingSchema.index({ stallId: 1, date: 1 }, { unique: true, partialFilterExpression: { status: { $in: [...activeBookingStatuses] } } });
bookingSchema.index({ status: 1, expiresAt: 1 });
bookingSchema.index({ userId: 1, createdAt: -1, _id: 1 });
bookingSchema.index({ approvedReference: 1 }, { unique: true, partialFilterExpression: { approvedReference: { $type: "string" } } });
bookingSchema.index({ approvedSlipHash: 1 }, { unique: true, partialFilterExpression: { approvedSlipHash: { $type: "string" } } });
export const BookingModel = mongoose.model("Booking", bookingSchema);
export type BookingRecord = NonNullable<Awaited<ReturnType<typeof BookingModel.findOne>>>;
// History is retained. No TTL deletion of booking records.
