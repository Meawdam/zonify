import { randomUUID } from "node:crypto";
import { HttpError } from "../../middlewares/http-error.js";
import { MarketModel, StallModel } from "../catalog/catalog.schema.js";
import { BookingModel, activeBookingStatuses } from "../bookings/booking.schema.js";
import { ScheduleModel, type Schedule } from "./schedule.schema.js";
import { bangkokDate } from "../catalog/catalog.service.js";

export function opening(schedule: Schedule | null, date: string) {
  const exception = schedule?.exceptions.find(e => e.date === date);
  const open = exception ? exception.open : !schedule || schedule.openWeekdays.includes(new Date(date + "T00:00:00Z").getUTCDay());
  return { open, reason: open ? null : exception?.reason || "ตลาดปิดในวันที่เลือก" };
}
export function unavailableReason(schedule: Schedule | null, date: string, stallId: string) {
  const day = opening(schedule, date);
  if (!day.open) return day.reason;
  return schedule?.closures.find(c => c.stallId === stallId && c.startsOn <= date && c.endsOn >= date)?.reason ?? null;
}
export async function ensureSchedule(marketId: string) {
  if (!await MarketModel.exists({ _id: marketId })) throw new HttpError(404, "MARKET_NOT_FOUND", "ไม่พบตลาดนี้");
  try { return (await ScheduleModel.findOneAndUpdate({ _id: marketId }, { $setOnInsert: { _id: marketId } }, { upsert: true, returnDocument: "after" }).lean())!; }
  catch (error) { if (typeof error === "object" && error && "code" in error && error.code === 11000) return (await ScheduleModel.findById(marketId).lean())!; throw error; }
}
export function presentSchedule(row: Schedule & { _id: string; version: number }) {
  return { marketId: row._id, version: row.version, openWeekdays: row.openWeekdays, exceptions: row.exceptions, closures: row.closures };
}
// Register only after the preparing booking exists. A schedule editor either sees that
// booking, or its revision CAS fails. No expiring mutex can let a paused writer through.
export async function registerHold(marketId: string, stallId: string, date: string) {
  for (let retry = 0; retry < 30; retry++) {
    const schedule = await ensureSchedule(marketId);
    const reason = unavailableReason(schedule, date, stallId);
    if (reason) throw new HttpError(409, "STALL_UNAVAILABLE", reason);
    const result = await ScheduleModel.updateOne({ _id: marketId, revision: schedule.revision }, { $inc: { revision: 1 } });
    if (result.modifiedCount) return;
  }
  throw new HttpError(409, "SCHEDULE_BUSY", "มีการปรับตารางพร้อมกัน กรุณาลองอีกครั้ง");
}
export async function assertDayAvailable(marketId: string, stallId: string, date: string) {
  const reason = unavailableReason(await ScheduleModel.findById(marketId).lean(), date, stallId);
  if (reason) throw new HttpError(409, "STALL_UNAVAILABLE", reason);
}
export class ScheduleConflict extends HttpError {
  constructor(public conflicts: { id: string; date: string; status: string; stallId: string; stallCode: string; shopName: string }[], public total: number) { super(409, "SCHEDULE_BOOKING_CONFLICT", "มีรายการจองในวันที่จะปิด กรุณาจัดการรายการเหล่านี้ก่อน"); }
}
async function save(marketId: string, version: number, transform: (current: Schedule) => Schedule) {
  for (let retry = 0; retry < 30; retry++) {
    const current = await ensureSchedule(marketId);
    if (current.version !== version) throw new HttpError(409, "SCHEDULE_CHANGED", "มีผู้อื่นแก้ตารางแล้ว กรุณาโหลดข้อมูลล่าสุด");
    const next = transform(current);
    const now = new Date();
    const bookings = await BookingModel.find({ marketId, date: { $gte: bangkokDate(now) }, status: { $in: [...activeBookingStatuses, "preparing"] }, $or: [{ status: { $in: ["confirmed", "payment_review"] } }, { $expr: { $gt: ["$expiresAt", "$$NOW"] } }] }).select("_id date status stallId stallSnapshot.code shopSnapshot.name").lean();
    const conflicts = bookings.filter(b => unavailableReason(next, b.date, b.stallId));
    if (conflicts.length) throw new ScheduleConflict(conflicts.slice(0, 100).map(b => ({ id: b._id, date: b.date, status: b.status === "preparing" ? "held" : b.status, stallId: b.stallId, stallCode: b.stallSnapshot?.code ?? "", shopName: b.shopSnapshot?.name ?? "" })), conflicts.length);
    const updated = await ScheduleModel.findOneAndUpdate({ _id: marketId, version, revision: current.revision }, { $set: next, $inc: { version: 1, revision: 1 } }, { returnDocument: "after" }).lean();
    if (updated) return presentSchedule(updated);
  }
  throw new HttpError(409, "SCHEDULE_BUSY", "มีการจองพร้อมกัน กรุณาลองบันทึกอีกครั้ง");
}
export async function updateSchedule(marketId: string, version: number, fields: Pick<Schedule, "openWeekdays" | "exceptions">) {
  return save(marketId, version, current => ({ ...fields, closures: current.closures }));
}
export async function addClosure(marketId: string, version: number, input: Omit<Schedule["closures"][number], "id" | "version">) {
  if (!await StallModel.exists({ _id: input.stallId, marketId })) throw new HttpError(400, "INVALID_STALL", "ล็อกต้องอยู่ในตลาดเดียวกัน");
  const closure = { ...input, id: randomUUID(), version: 0 };
  return save(marketId, version, current => {
    if (current.closures.length >= 500) throw new HttpError(400, "CLOSURE_LIMIT", "ตารางเต็ม กรุณาลบช่วงปิดที่ไม่ใช้แล้ว");
    if (current.closures.some(c => c.stallId === input.stallId && c.startsOn <= input.endsOn && c.endsOn >= input.startsOn)) throw new HttpError(409, "CLOSURE_OVERLAP", "ช่วงวันที่ปิดล็อกซ้ำกับรายการเดิม");
    return { openWeekdays: current.openWeekdays, exceptions: current.exceptions, closures: [...current.closures, closure] };
  });
}
export async function removeClosure(marketId: string, version: number, closureId: string) {
  return save(marketId, version, current => {
    if (!current.closures.some(c => c.id === closureId)) throw new HttpError(404, "CLOSURE_NOT_FOUND", "ไม่พบช่วงปิดนี้");
    return { openWeekdays: current.openWeekdays, exceptions: current.exceptions, closures: current.closures.filter(c => c.id !== closureId) };
  });
}
