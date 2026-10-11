import { z } from "zod";
export const transactionReference = z.string().trim().min(4).max(80).regex(/^[a-zA-Z0-9-]+$/, "ใช้ตัวอักษรภาษาอังกฤษ ตัวเลข หรือขีดกลาง").transform(s => s.toUpperCase());
export const slipDto = z.object({
  amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, "ระบุยอดเงินไม่เกินสองตำแหน่งทศนิยม").transform(Number).pipe(z.number().positive().max(9999999.99)),
  transferredAt: z.iso.datetime({ offset: true }).refine(s => new Date(s).valueOf() <= Date.now() + 5 * 60_000, "เวลาโอนต้องไม่อยู่ในอนาคต"),
  reference: transactionReference,
}).strict();
export const reviewDto = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), attemptId: z.uuid(), verifiedReference: transactionReference }).strict(),
  z.object({ decision: z.literal("reject"), attemptId: z.uuid(), reason: z.string().trim().min(1).max(500) }).strict(),
]);
export const refundDto = z.object({ reference: transactionReference }).strict();
