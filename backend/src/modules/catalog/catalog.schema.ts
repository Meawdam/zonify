import mongoose, { Schema } from "mongoose";
const id = { type: String, required: true };
const text = { type: String, required: true, trim: true };
const marketSchema = new Schema({
  _id: id, name: text, location: text, description: { type: String, trim: true, default: "" },
  photo: { type: String, enum: ["canal", "community", "sunday"], default: "canal" },
  landmark: { type: String, default: "" },
  entrance: { type: String, default: "ทางเข้า" },
  active: { type: Boolean, default: true }, order: { type: Number, default: 0 },
}, { timestamps: true });
const categorySchema = new Schema({ _id: id, name: text, order: { type: Number, default: 0 }, active: { type: Boolean, default: true } }, { timestamps: true });
const zoneSchema = new Schema({
  _id: id, marketId: { ...text, index: true }, name: text,
  description: { type: String, default: "" }, order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });
const stallSchema = new Schema({
  _id: id, marketId: { ...text, index: true }, code: text, row: text,
  zoneId: { type: String, default: null, index: true },
  rowOrder: { type: Number, required: true, min: 0 }, column: { type: Number, required: true, min: 1, max: 30 },
  width: { type: Number, required: true, min: 0.1 }, depth: { type: Number, required: true, min: 0.1 },
  pricePerDay: { type: Number, required: true, min: 0 }, description: { type: String, default: "" },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });
stallSchema.index({ marketId: 1, code: 1 }, { unique: true });
stallSchema.index({ marketId: 1, rowOrder: 1, column: 1 }, { unique: true });
// Read-side daily availability. Booking/hold commands will be added in rs005/rs006.
const stateSchema = new Schema({
  stallId: text, date: text,
  status: { type: String, enum: ["booked", "held", "unavailable"], required: true },
  expiresAt: { type: Date },
}, { timestamps: true });
stateSchema.index({ stallId: 1, date: 1 }, { unique: true });
const shopSchema = new Schema({
  _id: id, marketId: { ...text, index: true }, categoryId: { ...text, index: true },
  stallId: { type: String, default: null },
  name: text, description: { type: String, trim: true, default: "" }, hours: { type: String, default: "" },
  active: { type: Boolean, default: true },
}, { timestamps: true });
shopSchema.index({ active: 1, marketId: 1, categoryId: 1, name: 1, _id: 1 });
export const MarketModel = mongoose.model("Market", marketSchema);
export const CategoryModel = mongoose.model("Category", categorySchema);
export const ZoneModel = mongoose.model("Zone", zoneSchema);
export const StallModel = mongoose.model("Stall", stallSchema);
export const StallDayStateModel = mongoose.model("StallDayState", stateSchema);
export const ShopModel = mongoose.model("Shop", shopSchema);
export async function ensureCatalogIndexes() {
  await Promise.all([MarketModel, CategoryModel, ZoneModel, StallModel, StallDayStateModel, ShopModel].map(model => model.createIndexes()));
}
