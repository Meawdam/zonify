import mongoose, { Schema } from "mongoose";
const sessionSchema = new Schema({
  _id: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  authVersion: { type: Number, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});
export const SessionModel = mongoose.model("Session", sessionSchema);
