import { z } from "zod";
import { bangkokDate, dateQuery, slug } from "../catalog/catalog.service.js";
import { bookingStatuses } from "./booking.schema.js";
export const holdDto = z.object({ stallId: slug, shopId: slug, date: dateQuery.refine(value => {
  const today = bangkokDate();
  const limit = new Date(today + "T00:00:00Z"); limit.setUTCDate(limit.getUTCDate() + 365);
  return value >= today && value <= limit.toISOString().slice(0, 10);
}, "เลือกวันที่ตั้งแต่วันนี้ถึงอีก 365 วัน") }).strict();
export const bookingQuery = z.object({
  status: z.enum(bookingStatuses).optional(),
  date: dateQuery.optional(), market: slug.optional(),
  shop: slug.optional(),
  group: z.enum(["current", "history", "action"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
}).strict();
export const cancelDto = z.object({ reason: z.string().trim().min(1, "กรุณาระบุเหตุผล").max(500) }).strict();
export const holdQuery = bookingQuery.omit({ status: true });
export const emptyDto = z.object({}).strict();
