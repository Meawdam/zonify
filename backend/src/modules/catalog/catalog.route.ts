import { Router } from "express";
import { z } from "zod";
import { bangkokDate, dateQuery, slug, shopQuery, listMarkets, listCategories, floorPlan, listShops, getShop } from "./catalog.service.js";
const router = Router();
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
router.get("/markets", async (_req, res) => { res.json(await listMarkets()); });
router.get("/categories", async (_req, res) => { res.json(await listCategories()); });
router.get("/markets/:id/floor-plan", async (req, res) => {
  const id = slug.parse(req.params.id);
  const query = z.object({ date: dateQuery.optional() }).strict().parse(req.query);
  res.json(await floorPlan(id, query.date ?? bangkokDate()));
});
router.get("/shops", async (req, res) => { res.json(await listShops(shopQuery.parse(req.query))); });
router.get("/shops/:id", async (req, res) => { res.json(await getShop(slug.parse(req.params.id))); });
export default router;
