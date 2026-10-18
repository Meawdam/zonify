import { z } from "zod";
import { BookingModel } from "../bookings/booking.schema.js";
import { expireBookings } from "../bookings/booking.service.js";
import { MarketModel } from "../catalog/catalog.schema.js";
import { bangkokDate, dateQuery, slug, floorPlan, listShops } from "../catalog/catalog.service.js";
export const dashboardQuery = z.object({ date: dateQuery.default(() => bangkokDate()), market: slug.optional() }).strict();
export const reportQuery = z.object({ from: dateQuery.default(() => bangkokDate().slice(0, 8) + "01"), to: dateQuery.default(() => bangkokDate()),
  market: slug.optional(), group: z.enum(["day", "month"]).default("day"),
}).strict().refine(q => {
  const distance = new Date(q.to + "T00:00:00Z").valueOf() - new Date(q.from + "T00:00:00Z").valueOf();
  return distance >= 0 && distance < 366 * 86400_000;
}, { path: ["to"], message: "เลือกช่วงวันเรียงตามลำดับ ไม่เกิน 366 วัน" });
export type ReportQuery = z.infer<typeof reportQuery>;
const cents = { $round: [{ $multiply: ["$price", 100] }, 0] };
type BookingSummary = { _id: { period: string; market: string; status: string }; marketName: string; count: number; cents: number };
export async function bookingReport(q: ReportQuery) {
  await expireBookings();
  const rows = await BookingModel.aggregate<BookingSummary>([
    { $match: { status: { $ne: "preparing" }, date: { $gte: q.from, $lte: q.to }, ...(q.market ? { marketId: q.market } : {}) } },
    { $group: { _id: { period: q.group === "month" ? { $substrBytes: ["$date", 0, 7] } : "$date", market: "$marketId", status: "$status" },
      marketName: { $last: "$stallSnapshot.marketName" }, count: { $sum: 1 }, cents: { $sum: cents } } },
    { $sort: { "_id.period": 1, "_id.market": 1, "_id.status": 1 } },
  ]);
  return { from: q.from, to: q.to, group: q.group, basis: "booking_date", total: rows.reduce((n, r) => n + r.count, 0),
    rows: rows.map(r => ({ period: r._id.period, marketId: r._id.market, marketName: r.marketName, status: r._id.status, count: r.count, bookingAmount: r.cents / 100 })) };
}
type MoneyRow = { _id: { period: string; market: string }; marketName: string; received: number; refunded: number; receivedCount: number; refundedCount: number };
export async function revenueReport(q: ReportQuery) {
  const start = new Date(q.from + "T00:00:00+07:00"), end = new Date(new Date(q.to + "T00:00:00+07:00").valueOf() + 86400_000);
  const paid = { $and: [{ $gte: ["$paidAt", start] }, { $lt: ["$paidAt", end] }] };
  const refunded = { $and: [{ $eq: ["$refund.status", "refunded"] }, { $gte: ["$refund.completedAt", start] }, { $lt: ["$refund.completedAt", end] }] };
  const [rows, pending] = await Promise.all([
    BookingModel.aggregate<MoneyRow>([
      { $match: { ...(q.market ? { marketId: q.market } : {}), $or: [{ paidAt: { $gte: start, $lt: end } }, { "refund.completedAt": { $gte: start, $lt: end } }] } },
      { $project: { marketId: 1, marketName: "$stallSnapshot.marketName", events: { $concatArrays: [
        { $cond: [paid, [{ at: "$paidAt", received: cents, refunded: 0, receivedCount: 1, refundedCount: 0 }], []] },
        { $cond: [refunded, [{ at: "$refund.completedAt", received: 0, refunded: { $round: [{ $multiply: ["$refund.amount", 100] }, 0] }, receivedCount: 0, refundedCount: 1 }], []] },
      ] } } },
      { $unwind: "$events" },
      { $group: { _id: { period: { $dateToString: { date: "$events.at", format: q.group === "month" ? "%Y-%m" : "%Y-%m-%d", timezone: "Asia/Bangkok" } }, market: "$marketId" }, marketName: { $last: "$marketName" },
        received: { $sum: "$events.received" }, refunded: { $sum: "$events.refunded" }, receivedCount: { $sum: "$events.receivedCount" }, refundedCount: { $sum: "$events.refundedCount" } } },
      { $sort: { "_id.period": 1, "_id.market": 1 } },
    ]),
    BookingModel.aggregate<{ count: number; amount: number }>([
      { $match: { ...(q.market ? { marketId: q.market } : {}), "refund.status": "pending" } },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: { $round: [{ $multiply: ["$refund.amount", 100] }, 0] } } } },
    ]),
  ]);
  const received = rows.reduce((n, r) => n + r.received, 0), returned = rows.reduce((n, r) => n + r.refunded, 0);
  return { from: q.from, to: q.to, group: q.group, basis: "manager_recorded_payment_and_refund_time", timezone: "Asia/Bangkok",
    totals: { received: received / 100, refunded: returned / 100, net: (received - returned) / 100 },
    pendingRefunds: { count: pending[0]?.count ?? 0, amount: (pending[0]?.amount ?? 0) / 100, basis: "all_current_outstanding_for_selected_market" },
    rows: rows.map(r => ({ period: r._id.period, marketId: r._id.market, marketName: r.marketName, received: r.received / 100, refunded: r.refunded / 100,
      net: (r.received - r.refunded) / 100, receivedCount: r.receivedCount, refundedCount: r.refundedCount })) };
}
export async function dashboard(q: z.infer<typeof dashboardQuery>) {
  await expireBookings();
  const [markets, shops, states, money] = await Promise.all([
    MarketModel.find({ active: true, ...(q.market ? { _id: q.market } : {}) }).sort({ order: 1, _id: 1 }).lean(),
    listShops({ q: "", page: 1, limit: 1, ...(q.market ? { market: q.market } : {}) }),
    BookingModel.aggregate<{ _id: string; count: number }>([{ $match: { status: { $ne: "preparing" }, date: q.date, ...(q.market ? { marketId: q.market } : {}) } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    revenueReport({ from: q.date, to: q.date, group: "day", ...(q.market ? { market: q.market } : {}) }),
  ]);
  const floors = await Promise.all(markets.map(m => floorPlan(m._id, q.date)));
  const availability = floors.reduce((counts, f) => { for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] += f.counts[key]; return counts; }, { available: 0, booked: 0, held: 0, unavailable: 0 });
  return { date: q.date, updatedAt: new Date(), markets: markets.length, shops: shops.total, availability,
    bookings: Object.fromEntries(states.map(s => [s._id, s.count])), payments: money.totals, pendingRefunds: money.pendingRefunds,
    perMarket: floors.map(f => ({ id: f.market.id, name: f.market.name, ...f.counts })) };
}
export function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+\-@\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
export function reportCSV(headers: string[], rows: unknown[][]) { return "\uFEFF" + [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n"; }
