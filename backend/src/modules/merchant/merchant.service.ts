import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ShopModel, MarketModel, CategoryModel } from "../catalog/catalog.schema.js";
import { HttpError } from "../../middlewares/http-error.js";
import type { createShopDto, updateShopDto } from "./merchant.dto.js";
import { BookingModel } from "../bookings/booking.schema.js";
import { bookingGroupFilter, expireBookings, presentBooking } from "../bookings/booking.service.js";

type ShopRow = NonNullable<Awaited<ReturnType<typeof ShopModel.findOne>>>;
function present(row: ShopRow) {
  return { id: row._id, version: row.__v ?? 0, name: row.name, marketId: row.marketId,
    categoryId: row.categoryId, description: row.description, hours: row.hours,
    phone: row.phone ?? "", contactUrl: row.contactUrl ?? "", active: row.active,
    photoUrl: row.photoId ? `/api/shops/${row._id}/photo?v=${row.photoId}` : null };
}
export async function ownedShop(id: string, ownerId: string) {
  const row = await ShopModel.findOne({ _id: id, ownerId });
  if (!row) throw new HttpError(404, "SHOP_NOT_FOUND", "ไม่พบร้านของคุณ");
  return row;
}
async function validateReferences(marketId: string, categoryId: string) {
  const [market, category] = await Promise.all([
    MarketModel.exists({ _id: marketId, active: true }), CategoryModel.exists({ _id: categoryId, active: true }),
  ]);
  if (!market) throw new HttpError(400, "INVALID_MARKET", "ตลาดนี้ไม่เปิดใช้งาน");
  if (!category) throw new HttpError(400, "INVALID_CATEGORY", "หมวดหมู่นี้ไม่เปิดใช้งาน");
}
export async function listOwnedShops(ownerId: string) {
  return { items: (await ShopModel.find({ ownerId }).sort({ name: 1, _id: 1 })).map(present) };
}
export async function merchantOverview(userId: string) {
  await expireBookings();
  const actionFilter = { userId, ...bookingGroupFilter("action") };
  const [shops, current, history, actionRequired, review, amount, actions] = await Promise.all([
    ShopModel.countDocuments({ ownerId: userId }), BookingModel.countDocuments({ userId, ...bookingGroupFilter("current") }),
    BookingModel.countDocuments({ userId, ...bookingGroupFilter("history") }), BookingModel.countDocuments(actionFilter),
    BookingModel.countDocuments({ userId, status: "payment_review" }),
    BookingModel.aggregate<{ total: number }>([{ $match: { userId, status: "pending_payment" } }, { $group: { _id: null, total: { $sum: "$price" } } }]),
    BookingModel.find(actionFilter).sort({ expiresAt: 1, _id: 1 }).limit(6).lean(),
  ]);
  return { counts: { shops, current, history, actionRequired, review }, amountDue: amount[0]?.total ?? 0, actions: actions.map(presentBooking) };
}
export async function getOwnedShop(id: string, ownerId: string) { return present(await ownedShop(id, ownerId)); }
export async function createShop(ownerId: string, data: z.infer<typeof createShopDto>) {
  await validateReferences(data.marketId, data.categoryId);
  return present(await ShopModel.create({ ...data, _id: randomUUID(), ownerId, stallId: null, active: true }));
}
export async function updateShop(id: string, ownerId: string, data: z.infer<typeof updateShopDto>) {
  const current = await ownedShop(id, ownerId);
  if (data.categoryId !== undefined && data.categoryId !== current.categoryId) {
    if (!await CategoryModel.exists({ _id: data.categoryId, active: true })) throw new HttpError(400, "INVALID_CATEGORY", "หมวดหมู่นี้ไม่เปิดใช้งาน");
  }
  const { version, ...fields } = data;
  const updated = await ShopModel.findOneAndUpdate({ _id: id, ownerId, __v: version },
    { $set: fields, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true });
  if (!updated) throw new HttpError(409, "RESOURCE_CHANGED", "ร้านถูกแก้ไขแล้ว กรุณาโหลดข้อมูลใหม่ก่อนบันทึก");
  return present(updated);
}
