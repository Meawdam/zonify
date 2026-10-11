import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { Model } from "mongoose";
import { z } from "zod";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware.js";
import { HttpError } from "../../middlewares/http-error.js";
import { MarketModel, CategoryModel, ZoneModel, StallModel, ShopModel } from "../catalog/catalog.schema.js";
import { slug } from "../catalog/catalog.service.js";
import { adminListQuery, resourceFields, versionDto, type ResourceKind } from "./admin.dto.js";
import { AdvertisementModel } from "../advertisements/advertisement.schema.js";

const router = Router();
router.use(authMiddleware, requireRole("manager", "owner"));
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
const present = (doc: object) => {
  const { _id, __v, createdAt, updatedAt, ...data } = doc as Record<string, unknown>;
  return { id: String(_id), version: Number(__v ?? 0), ...data };
};
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
async function referenceCheck(kind: ResourceKind, value: Record<string, unknown>) {
  if (kind === "advertisements") {
    if (String(value.endsOn) < String(value.startsOn)) throw new HttpError(400, "INVALID_AD_PERIOD", "วันสิ้นสุดต้องไม่น้อยกว่าวันเริ่มแสดงโฆษณา");
    if (value.shopId && !await ShopModel.exists({ _id: String(value.shopId), marketId: String(value.marketId) })) throw new HttpError(400, "INVALID_SHOP", "ร้านที่โฆษณาต้องอยู่ในตลาดเดียวกัน");
  }
  if ("marketId" in value && !await MarketModel.exists({ _id: String(value.marketId) }))
    throw new HttpError(400, "INVALID_MARKET", "ไม่พบตลาดที่เลือก");
  if (kind === "stalls" && value.zoneId) {
    if (!await ZoneModel.exists({ _id: String(value.zoneId), marketId: String(value.marketId) }))
      throw new HttpError(400, "INVALID_ZONE", "โซนต้องอยู่ในตลาดเดียวกับล็อก");
  }
  if (kind === "shops") {
    if (!await CategoryModel.exists({ _id: String(value.categoryId) }))
      throw new HttpError(400, "INVALID_CATEGORY", "ไม่พบหมวดหมู่ที่เลือก");
    if (value.stallId && !await StallModel.exists({ _id: String(value.stallId), marketId: String(value.marketId) }))
      throw new HttpError(400, "INVALID_STALL", "ล็อกต้องอยู่ในตลาดเดียวกับร้านค้า");
  }
}
router.get("/references", async (_req, res) => {
  const [markets, categories, zones, stalls, shops] = await Promise.all([
    MarketModel.find().sort({ order: 1, _id: 1 }).lean(),
    CategoryModel.find().sort({ order: 1, _id: 1 }).lean(),
    ZoneModel.find().sort({ order: 1, _id: 1 }).lean(),
    StallModel.find().sort({ marketId: 1, rowOrder: 1, column: 1 }).lean(),
    ShopModel.find().sort({ name: 1, _id: 1 }).lean(),
  ]);
  res.json({ markets: markets.map(present), categories: categories.map(present), zones: zones.map(present), stalls: stalls.map(present), shops: shops.map(present) });
});
type ResourceRow = { _id: string; __v?: number; [key: string]: unknown };
function install<T extends { _id: string }>(kind: ResourceKind, source: Model<T>) {
  // The Zod resource schema validates the heterogeneous model boundary before every write.
  const model = source as unknown as Model<ResourceRow>;
  const fields = resourceFields[kind] as z.ZodObject<Record<string, z.ZodType>>;
  const createDto = fields.extend({ id: slug.optional() }).strict();
  // IDs and market membership are immutable: references cannot drift during concurrent edits.
  const patchFields = "marketId" in fields.shape ? fields.omit({ marketId: true }) : fields;
  const patchDto = patchFields.partial().extend({ version: z.number().int().min(0) }).strict()
    .refine(data => Object.keys(data).length > 1, "กรุณาระบุข้อมูลที่ต้องการแก้");
  router.get("/" + kind, async (req, res) => {
    const query = adminListQuery.parse(req.query);
    const filter = {
      ...(query.market && ["zones", "stalls", "shops", "advertisements"].includes(kind) ? { marketId: query.market } : {}),
      ...(query.q ? { $or: [{ name: { $regex: escape(query.q), $options: "i" } }, { code: { $regex: escape(query.q), $options: "i" } }] } : {}),
    };
    const [items, total] = await Promise.all([
      model.find(filter).sort({ _id: 1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      model.countDocuments(filter),
    ]);
    res.json({ items: items.map(present), total, page: query.page, pages: Math.ceil(total / query.limit) });
  });
  router.post("/" + kind, async (req, res) => {
    const { id, ...value } = createDto.parse(req.body);
    await referenceCheck(kind, value);
    const doc = await model.create({ ...value, _id: id === undefined ? randomUUID() : String(id) });
    res.status(201).json(present(doc.toObject()));
  });
  router.patch("/" + kind + "/:id", async (req, res) => {
    const id = slug.parse(req.params.id);
    const { version, ...value } = patchDto.parse(req.body);
    const current = await model.findById(id).lean();
    if (!current) throw new HttpError(404, "RESOURCE_NOT_FOUND", "ไม่พบข้อมูลนี้");
    await referenceCheck(kind, { ...current, ...value });
    const updated = await model.findOneAndUpdate(
      { _id: id, $or: [{ __v: version }, ...(version === 0 ? [{ __v: { $exists: false } }] : [])] },
      { $set: value, $inc: { __v: 1 } }, { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) throw new HttpError(409, "RESOURCE_CHANGED", "มีผู้อื่นแก้ข้อมูลนี้แล้ว กรุณาโหลดใหม่");
    res.json(present(updated));
  });
  router.delete("/" + kind + "/:id", async (req, res) => {
    const id = slug.parse(req.params.id);
    const { version } = versionDto.parse(req.body);
    const updated = await model.findOneAndUpdate(
      { _id: id, $or: [{ __v: version }, ...(version === 0 ? [{ __v: { $exists: false } }] : [])] },
      { $set: kind === "stalls" ? { enabled: false } : { active: false }, $inc: { __v: 1 } },
      { returnDocument: "after" },
    ).lean();
    if (!updated) {
      if (!await model.exists({ _id: id })) throw new HttpError(404, "RESOURCE_NOT_FOUND", "ไม่พบข้อมูลนี้");
      throw new HttpError(409, "RESOURCE_CHANGED", "มีผู้อื่นแก้ข้อมูลนี้แล้ว กรุณาโหลดใหม่");
    }
    res.json(present(updated));
  });
}
install("markets", MarketModel); install("categories", CategoryModel);
install("zones", ZoneModel); install("stalls", StallModel); install("shops", ShopModel);
install("advertisements", AdvertisementModel);
export default router;
