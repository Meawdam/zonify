import mongoose, { Schema } from "mongoose";
export const roles = ["customer", "manager", "owner"] as const;
export type Role = typeof roles[number];
const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, default: "" },
  role: { type: String, enum: roles, default: "customer", required: true },
  authVersion: { type: Number, default: 0, select: false },
}, { timestamps: true, autoIndex: false });
userSchema.index({ email: 1 }, { unique: true });
export const UserModel = mongoose.model("User", userSchema);
export function publicUser(user: { _id: unknown; name: string; email: string; phone?: string; role?: string }) {
  return { id: String(user._id), name: user.name, email: user.email, phone: user.phone ?? "", role: user.role ?? "customer" };
}
