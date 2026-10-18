import mongoose, { Schema } from "mongoose";
const exception = new Schema({ date: { type: String, required: true }, open: { type: Boolean, required: true }, reason: { type: String, default: "" } }, { _id: false });
const closure = new Schema({ id: { type: String, required: true }, stallId: { type: String, required: true }, startsOn: { type: String, required: true }, endsOn: { type: String, required: true }, reason: { type: String, required: true }, version: { type: Number, default: 0 } }, { _id: false });
const schema = new Schema({
  _id: { type: String, required: true }, version: { type: Number, default: 0 }, revision: { type: Number, default: 0 },
  openWeekdays: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] }, exceptions: { type: [exception], default: [] }, closures: { type: [closure], default: [] },
}, { timestamps: true });
export const ScheduleModel = mongoose.model("MarketSchedule", schema);
export type Schedule = { openWeekdays: number[]; exceptions: { date: string; open: boolean; reason: string }[]; closures: { id: string; stallId: string; startsOn: string; endsOn: string; reason: string; version: number }[] };
