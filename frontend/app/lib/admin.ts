import { ApiError } from "./auth";
export type AdminKind = "markets" | "categories" | "zones" | "stalls" | "shops";
export type AdminRow = { id: string; version: number; [key: string]: string | number | boolean | null };
export type AdminReferences = Record<"markets" | "categories" | "zones" | "stalls", AdminRow[]>;
export type AdminResults = { items: AdminRow[]; total: number; page: number; pages: number };
export const adminLabels: Record<AdminKind, string> = { markets: "ตลาด", categories: "หมวดหมู่", zones: "โซน", stalls: "ล็อก", shops: "ร้านค้า" };
export type Field = { key: string; label: string; type: "text" | "textarea" | "number" | "select" | "checkbox"; optional?: boolean; min?: number; max?: number; step?: number };
const name: Field = { key: "name", label: "ชื่อ", type: "text", max: 100 };
const description: Field = { key: "description", label: "คำอธิบาย", type: "textarea", optional: true, max: 2000 };
const market: Field = { key: "marketId", label: "ตลาด", type: "select" };
const active: Field = { key: "active", label: "เปิดแสดงข้อมูล", type: "checkbox" };
const order: Field = { key: "order", label: "ลำดับแสดง (เริ่มที่ 0)", type: "number", min: 0, max: 10000 };
export const adminFields: Record<AdminKind, Field[]> = {
  markets: [name, { key: "location", label: "ที่ตั้ง", type: "text", max: 100 }, description, { key: "photo", label: "ภาพตลาด", type: "select" }, { key: "landmark", label: "จุดสังเกตข้างผัง", type: "text", optional: true, max: 100 }, { key: "entrance", label: "ชื่อทางเข้า", type: "text", max: 100 }, order, active],
  categories: [name, order, active],
  zones: [market, name, description, order, active],
  stalls: [market, { key: "zoneId", label: "โซน", type: "select", optional: true }, { key: "code", label: "รหัสล็อก", type: "text", max: 100 }, { key: "row", label: "ชื่อแถว", type: "text", max: 20 }, { key: "rowOrder", label: "ตำแหน่งแถว (เริ่มที่ 0)", type: "number", min: 0, max: 100 }, { key: "column", label: "ตำแหน่งคอลัมน์ (เริ่มที่ 1)", type: "number", min: 1, max: 30 }, { key: "width", label: "ความกว้าง (เมตร)", type: "number", min: 0.1, max: 100, step: 0.1 }, { key: "depth", label: "ความลึก (เมตร)", type: "number", min: 0.1, max: 100, step: 0.1 }, { key: "pricePerDay", label: "ค่าเช่ารายวัน (บาท)", type: "number", min: 0, max: 1000000, step: 0.01 }, description, { key: "enabled", label: "เปิดใช้งานล็อก", type: "checkbox" }],
  shops: [market, name, { key: "categoryId", label: "หมวดหมู่", type: "select" }, { key: "stallId", label: "ล็อกของร้าน", type: "select", optional: true }, description, { key: "hours", label: "เวลาเปิดร้าน", type: "text", optional: true, max: 100 }, active],
};
export function defaults(kind: AdminKind, marketId: string) {
  const values: AdminRow = { id: "", version: 0 };
  for (const field of adminFields[kind]) values[field.key] = field.type === "checkbox" ? true : field.type === "number" ? (field.min ?? 0) : "";
  if ("marketId" in values) values.marketId = marketId;
  if (kind === "markets") { values.photo = "canal"; values.entrance = "ทางเข้า"; }
  if (kind === "stalls") { values.width = 2; values.depth = 2; }
  return values;
}
export async function adminRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/admin" + path, { method, credentials: "same-origin", cache: "no-store", ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fields: Record<string, string> = {};
    for (const issue of data?.errors ?? []) if (issue.path?.[0]) fields[String(issue.path[0])] = issue.message;
    throw new ApiError(response.status, data?.code ?? "SERVER_ERROR", data?.message ?? "บันทึกไม่สำเร็จ", fields);
  }
  return data as T;
}
