import mongoose, { Schema } from "mongoose";
const schema = new Schema({
  _id: { type: String, required: true }, name: { type: String, required: true }, description: { type: String, default: "" },
  marketId: { type: String, required: true }, shopId: { type: String, default: null },
  startsOn: { type: String, required: true }, endsOn: { type: String, required: true },
  photo: { type: String, enum: ["canal", "community", "sunday"], default: "canal" },
  order: { type: Number, default: 0 }, active: { type: Boolean, default: true },
}, { timestamps: true });
schema.index({ active: 1, startsOn: 1, endsOn: 1, order: 1 });
export const AdvertisementModel = mongoose.model("Advertisement", schema);
