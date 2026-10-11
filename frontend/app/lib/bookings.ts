import { ApiError, type User } from "./auth";
export const bookingStatusLabels = { held: "พักล็อก", pending_payment: "รอชำระเงิน", payment_review: "รอตรวจสอบสลิป", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิกแล้ว", expired: "หมดอายุ" };
export type BookingStatus = keyof typeof bookingStatusLabels;
export type Booking = {
  id: string; date: string; status: BookingStatus; price: number; createdAt: string; updatedAt: string;
  expiresAt: string | null; cancelledAt: string | null; cancelReason: string;
  customer: User; stall: { id: string; marketId: string; code: string; width: number; depth: number; marketName: string; zoneName: string };
};
export type BookingResults = { items: Booking[]; total: number; page: number; pages: number };
export async function bookingRequest<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch("/api" + path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new ApiError(0, "NETWORK_ERROR", "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่"); }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fields: Record<string, string> = {};
    for (const issue of data?.errors ?? []) if (issue.path?.[0]) fields[String(issue.path[0])] = issue.message;
    throw new ApiError(response.status, data?.code ?? "SERVER_ERROR", data?.message ?? "ทำรายการไม่สำเร็จ", fields);
  }
  return data as T;
}
export const bookingDate = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeZone: "Asia/Bangkok" }).format(new Date(date + "T00:00:00+07:00"));
export const bookingTime = (date: string) => new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(date));
export function floorLink(booking: Booking) {
  return "/?" + new URLSearchParams({ market: booking.stall.marketId, stall: booking.stall.id, date: booking.date }) + "#floor-plan";
}
export function safeLoginNext(value: string | undefined) {
  if (!value) return "/profile";
  try {
    const url = new URL(value, "http://zonify.local");
    if (url.origin !== "http://zonify.local" || !(url.pathname === "/" || /^\/bookings(?:\/[a-zA-Z0-9-]+)?$/.test(url.pathname))) return "/profile";
    return url.pathname + url.search + url.hash;
  } catch { return "/profile"; }
}
