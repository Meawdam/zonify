import { z } from "zod";
import { MarketModel, CategoryModel, ZoneModel, StallModel, StallDayStateModel, ShopModel } from "./catalog.schema.js";
import { HttpError } from "../../middlewares/http-error.js";
import { BookingModel, activeBookingStatuses } from "../bookings/booking.schema.js";
import { ScheduleModel } from "../schedule/schedule.schema.js";
import { opening, unavailableReason } from "../schedule/schedule.service.js";
export function bangkokDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export const dateQuery = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}, "วันที่ไม่ถูกต้อง");
export const slug = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/);
export const shopQuery = z.object({
  date: dateQuery.optional(),
  q: z.string().trim().max(100).default(""),
  market: slug.optional(), category: slug.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
}).strict();
const marketPublic = (m: { _id: string; name: string; location: string; description: string; photo: string; landmark: string; entrance: string }) =>
  ({ id: m._id, name: m.name, location: m.location, description: m.description, photo: m.photo, landmark: m.landmark, entrance: m.entrance });
export async function listMarkets() {
  const [markets, prices] = await Promise.all([
    MarketModel.find({ active: true }).sort({ order: 1, _id: 1 }).lean(),
    StallModel.aggregate<{ _id: string; price: number }>([
      { $match: { enabled: true } },
      { $lookup: { from: ZoneModel.collection.name, localField: "zoneId", foreignField: "_id", as: "zone" } },
      { $match: { $or: [{ zoneId: null }, { "zone.active": true }] } },
      { $group: { _id: "$marketId", price: { $min: "$pricePerDay" } } },
    ]),
  ]);
  const byId = new Map(prices.map(p => [p._id, p.price]));
  return { items: markets.map(m => ({ ...marketPublic(m), minPrice: byId.get(m._id) ?? null })) };
}
export async function listCategories() {
  return { items: (await CategoryModel.find({ active: true }).sort({ order: 1, _id: 1 }).lean()).map(c => ({ id: c._id, name: c.name })) };
}
export async function floorPlan(marketId: string, date: string, now = new Date()) {
  const market = await MarketModel.findOne({ _id: marketId, active: true }).lean();
  if (!market) throw new HttpError(404, "MARKET_NOT_FOUND", "ไม่พบตลาดนี้");
  const [stalls, zones, schedule] = await Promise.all([
    StallModel.find({ marketId }).sort({ rowOrder: 1, column: 1, code: 1 }).lean(),
    ZoneModel.find({ marketId }).sort({ order: 1, _id: 1 }).lean(),
    ScheduleModel.findById(marketId).lean(),
  ]);
  const zonesById = new Map(zones.map(z => [z._id, z]));
  const [states, bookings] = await Promise.all([
    StallDayStateModel.find({ stallId: { $in: stalls.map(s => s._id) }, date }).lean(),
    BookingModel.find({ stallId: { $in: stalls.map(s => s._id) }, date, status: { $in: [...activeBookingStatuses] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).lean(),
  ]);
  const byId = new Map(states.map(s => [s.stallId, s]));
  const bookingById = new Map(bookings.map(b => [b.stallId, b]));
  const counts = { available: 0, booked: 0, held: 0, unavailable: 0 };
  const items = stalls.map(s => {
    const state = byId.get(s._id);
    const booking = bookingById.get(s._id);
    const reason = !s.enabled ? "ล็อกปิดใช้งาน" : s.zoneId && zonesById.get(s.zoneId)?.active !== true ? "โซนปิดใช้งาน" : unavailableReason(schedule, date, s._id);
    const enabled = !reason;
    let status: keyof typeof counts = enabled ? "available" : "unavailable";
    if (enabled && state) {
      // An invalid hold without an expiry fails closed. Expired holds are never shown as active.
      status = state.status === "held" && state.expiresAt && state.expiresAt <= now ? "available" : state.status;
    }
    if (enabled && booking) status = booking.status === "held" ? "held" : "booked";
    counts[status]++;
    return { id: s._id, code: s.code, row: s.row, rowOrder: s.rowOrder, column: s.column,
      width: s.width, depth: s.depth, pricePerDay: s.pricePerDay, description: s.description,
      zoneId: s.zoneId ?? null, zoneName: s.zoneId ? zonesById.get(s.zoneId)?.name ?? null : null,
      status, unavailableReason: reason, holdExpiresAt: status === "held" ? (booking?.expiresAt ?? state?.expiresAt)?.toISOString() ?? null : null };
  });
  const day = opening(schedule, date);
  return { market: marketPublic(market), date, marketOpen: day.open, closedReason: day.reason, updatedAt: now.toISOString(), counts, stalls: items };
}
const escaped = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function directoryRefs() {
  const [markets, categories] = await Promise.all([
    MarketModel.find({ active: true }).lean(), CategoryModel.find({ active: true }).lean(),
  ]);
  return { markets: new Map(markets.map(m => [m._id, m])), categories: new Map(categories.map(c => [c._id, c])) };
}
type ShopRow = { _id: string; marketId: string; categoryId: string; stallId?: string | null; ownerId?: string | null; photoId?: string | null; phone?: string; contactUrl?: string; name: string; description: string; hours: string };
async function presentShops(shops: ShopRow[], refs: Awaited<ReturnType<typeof directoryRefs>>, date = bangkokDate()) {
  const reservations = await BookingModel.find({ shopId: { $in: shops.filter(s => s.ownerId).map(s => s._id) }, date, status: "confirmed" }).sort({ stallId: 1 }).lean();
  const stalls = await StallModel.find({ _id: { $in: shops.flatMap(s => s.stallId ? [s.stallId] : []) } }).lean();
  const byId = new Map(stalls.map(s => [s._id, s]));
  return shops.map(s => {
    const market = refs.markets.get(s.marketId)!;
    const category = refs.categories.get(s.categoryId)!;
    const position = s.stallId ? byId.get(s.stallId) : null;
    const stall = position?.marketId === s.marketId ? { id: position._id, code: position.code } : null;
    const locations = s.ownerId ? reservations.filter(b => b.shopId === s._id && b.marketId === s.marketId).map(b => ({ id: b.stallId, code: b.stallSnapshot?.code ?? "" })) : stall ? [stall] : [];
    return { id: s._id, name: s.name, description: s.description, hours: s.hours,
      phone: s.phone ?? "", contactUrl: s.contactUrl ?? "", photoUrl: s.photoId ? `/api/shops/${s._id}/photo?v=${s.photoId}` : null,
      locations, locationDate: date, locationSource: s.ownerId ? "reservation" : "catalog",
      market: { id: market._id, name: market.name, location: market.location },
      category: { id: category._id, name: category.name }, stall: locations[0] ?? null };
  });
}
export async function listShops(query: z.infer<typeof shopQuery>) {
  const refs = await directoryRefs();
  const filter = {
    active: true,
    marketId: { $in: [...refs.markets.keys()].filter(id => !query.market || id === query.market) },
    categoryId: { $in: [...refs.categories.keys()].filter(id => !query.category || id === query.category) },
    ...(query.q ? { $or: [{ name: { $regex: escaped(query.q), $options: "i" } }, { description: { $regex: escaped(query.q), $options: "i" } }] } : {}),
  };
  const [shops, total] = await Promise.all([
    ShopModel.find(filter).sort({ name: 1, _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    ShopModel.countDocuments(filter),
  ]);
  return { items: await presentShops(shops, refs, query.date), total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) };
}
export async function getShop(id: string, date = bangkokDate()) {
  const [shop, refs] = await Promise.all([ShopModel.findOne({ _id: id, active: true }).lean(), directoryRefs()]);
  if (!shop || !refs.markets.has(shop.marketId) || !refs.categories.has(shop.categoryId)) throw new HttpError(404, "SHOP_NOT_FOUND", "ไม่พบร้านค้านี้");
  return (await presentShops([shop], refs, date))[0]!;
}
