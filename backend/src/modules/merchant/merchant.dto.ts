import { z } from "zod";
import { slug } from "../catalog/catalog.service.js";
const fields = {
  name: z.string().trim().min(1, "กรุณากรอกชื่อร้าน").max(100),
  categoryId: slug,
  description: z.string().trim().max(2000),
  hours: z.string().trim().max(100),
  phone: z.string().trim().max(30).regex(/^[0-9+()\s-]*$/, "หมายเลขโทรศัพท์ไม่ถูกต้อง"),
  contactUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(500)]),
};
export const createShopDto = z.object({ ...fields, marketId: slug, description: fields.description.default(""), hours: fields.hours.default(""), phone: fields.phone.default(""), contactUrl: fields.contactUrl.default("") }).strict();
export const updateShopDto = z.object(fields).partial().extend({ version: z.number().int().min(0) }).strict()
  .refine(value => Object.keys(value).length > 1, "กรุณาระบุข้อมูลที่ต้องการแก้ไข");
