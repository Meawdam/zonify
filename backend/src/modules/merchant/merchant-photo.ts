import { randomUUID } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import sharp from "sharp";
import { Router } from "express";
import multer from "multer";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import type { AuthRequest } from "../../middlewares/auth.middleware.js";
import { HttpError } from "../../middlewares/http-error.js";
import { ShopModel, MarketModel, CategoryModel } from "../catalog/catalog.schema.js";
import { slug } from "../catalog/catalog.service.js";
import { ownedShop, getOwnedShop } from "./merchant.service.js";

export const ShopPhotoModel = mongoose.model("ShopPhoto", new Schema({
  _id: { type: String, required: true }, shopId: { type: String, required: true, index: true },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true }));
const MAX_BYTES = 5 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1, fields: 1, parts: 2, fieldSize: 20 } }).single("photo");
export const shopPhotoUploadRouter = Router();
shopPhotoUploadRouter.post("/shops/:id/photo", rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
  validate: { xForwardedForHeader: false }, message: { code: "RATE_LIMITED", message: "อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง" } }),
async (req: AuthRequest, _res, next) => { await ownedShop(slug.parse(req.params.id), req.user!.id); next(); },
(req, res, next) => upload(req, res, error => next(error ? new HttpError(error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
  "INVALID_PHOTO", "ส่งภาพ JPEG หรือ PNG หนึ่งภาพ ขนาดไม่เกิน 5 MB") : undefined)),
async (req: AuthRequest, res) => {
  const id = slug.parse(req.params.id), { version } = z.object({ version: z.coerce.number().int().min(0) }).strict().parse(req.body);
  const file = req.file;
  if (!file?.buffer.length) throw new HttpError(400, "PHOTO_REQUIRED", "กรุณาเลือกภาพร้าน");
  let data: Buffer;
  try {
    const image = sharp(file.buffer, { limitInputPixels: 20_000_000, failOn: "warning" });
    const meta = await image.metadata();
    if (!((meta.format === "png" && file.mimetype === "image/png") || (meta.format === "jpeg" && file.mimetype === "image/jpeg")) || (meta.pages ?? 1) !== 1) throw new Error("Unsupported image");
    data = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  } catch { throw new HttpError(400, "INVALID_PHOTO", "ภาพเสียหายหรือไม่ใช่ JPEG/PNG ที่รองรับ"); }
  const photoId = randomUUID();
  await ShopPhotoModel.create({ _id: photoId, shopId: id, data });
  let previous;
  try {
    previous = await ShopModel.findOneAndUpdate({ _id: id, ownerId: req.user!.id, __v: version }, { $set: { photoId }, $inc: { __v: 1 } });
  } catch (error) { await ShopPhotoModel.deleteOne({ _id: photoId }); throw error; }
  if (!previous) { await ShopPhotoModel.deleteOne({ _id: photoId }); throw new HttpError(409, "RESOURCE_CHANGED", "ร้านถูกแก้ไขแล้ว กรุณาโหลดใหม่ก่อนบันทึก"); }
  if (previous.photoId) await ShopPhotoModel.deleteOne({ _id: previous.photoId });
  res.json(await getOwnedShop(id, req.user!.id));
});
export const publicShopPhotoRouter = Router();
publicShopPhotoRouter.get("/shops/:id/photo", async (req, res) => {
  const shop = await ShopModel.findOne({ _id: slug.parse(req.params.id), active: true }).lean();
  if (!shop?.photoId || !await MarketModel.exists({ _id: shop.marketId, active: true }) || !await CategoryModel.exists({ _id: shop.categoryId, active: true }))
    throw new HttpError(404, "PHOTO_NOT_FOUND", "ไม่พบภาพร้าน");
  const photo = await ShopPhotoModel.findOne({ _id: shop.photoId, shopId: shop._id }).select("+data");
  if (!photo) throw new HttpError(404, "PHOTO_NOT_FOUND", "ไม่พบภาพร้าน");
  res.set({ "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; sandbox" }).send(photo.data);
});
