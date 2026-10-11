import { Router } from "express";
import { z } from "zod";
import { AdvertisementModel } from "./advertisement.schema.js";
import { MarketModel, ShopModel, CategoryModel } from "../catalog/catalog.schema.js";
import { bangkokDate } from "../catalog/catalog.service.js";
export async function publicAdvertisements(now = new Date()) {
  const date = bangkokDate(now);
  const rows = await AdvertisementModel.find({ active: true, startsOn: { $lte: date }, endsOn: { $gte: date } }).sort({ order: 1, _id: 1 }).lean();
  const [markets, shops, categories] = await Promise.all([
    MarketModel.find({ active: true, _id: { $in: rows.map(a => a.marketId) } }).lean(),
    ShopModel.find({ active: true, _id: { $in: rows.map(a => a.shopId).filter((id): id is string => typeof id === "string") } }).lean(),
    CategoryModel.find({ active: true }).select("_id").lean(),
  ]);
  const marketIds = new Map(markets.map(m => [m._id, m])), categoryIds = new Set(categories.map(c => c._id));
  const shopIds = new Map(shops.filter(s => categoryIds.has(s.categoryId)).map(s => [s._id, s]));
  return { items: rows.filter(a => marketIds.has(a.marketId) && (!a.shopId || shopIds.get(a.shopId)?.marketId === a.marketId)).map(a => ({
    id: a._id, name: a.name, description: a.description, photo: a.photo, startsOn: a.startsOn, endsOn: a.endsOn,
    market: { id: a.marketId, name: marketIds.get(a.marketId)!.name },
    href: a.shopId ? "/shops/" + a.shopId : "/?market=" + encodeURIComponent(a.marketId) + "#floor-plan",
  })) };
}
const router = Router();
router.get("/advertisements", async (req, res) => { z.object({}).strict().parse(req.query); res.set("Cache-Control", "no-store"); res.json(await publicAdvertisements()); });
export default router;
