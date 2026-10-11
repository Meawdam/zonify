import { z } from "zod";
import { slug, dateQuery } from "../catalog/catalog.service.js";
const name = z.string().trim().min(1, "กรุณากรอกชื่อ").max(100);
const description = z.string().trim().max(2000);
const order = z.number().int().min(0).max(10000);
const active = z.boolean();
export const resourceFields = {
  markets: z.object({ name, location: name, description, photo: z.enum(["canal", "community", "sunday"]), landmark: z.string().trim().max(100), entrance: name, active, order }),
  categories: z.object({ name, active, order }),
  zones: z.object({ name, marketId: slug, description, active, order }),
  stalls: z.object({ marketId: slug, zoneId: slug.nullable(), code: name, row: z.string().trim().min(1).max(20), rowOrder: z.number().int().min(0).max(100), column: z.number().int().min(1).max(30), width: z.number().min(0.1).max(100), depth: z.number().min(0.1).max(100), pricePerDay: z.number().min(0).max(1000000).multipleOf(0.01), description, enabled: active }),
  shops: z.object({ name, marketId: slug, categoryId: slug, stallId: slug.nullable(), description, hours: z.string().trim().max(100), active }),
  advertisements: z.object({ name, marketId: slug, shopId: slug.nullable(), description, startsOn: dateQuery, endsOn: dateQuery, photo: z.enum(["canal", "community", "sunday"]), order, active }),
};
export type ResourceKind = keyof typeof resourceFields;
export const adminListQuery = z.object({
  q: z.string().trim().max(100).default(""), market: slug.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
}).strict();
export const versionDto = z.object({ version: z.number().int().min(0) }).strict();
