export type Market = { id: string; name: string; location: string; description: string; photo: "canal" | "community" | "sunday"; landmark: string; entrance: string; minPrice: number | null };
export type Category = { id: string; name: string };
export type StallStatus = "available" | "booked" | "held" | "unavailable";
export const statusLabels: Record<StallStatus, string> = { available: "ว่าง", booked: "จองแล้ว", held: "พักล็อก", unavailable: "ปิดใช้งาน" };
export type Stall = { id: string; code: string; row: string; rowOrder: number; column: number; width: number; depth: number; pricePerDay: number; description: string; zoneId: string | null; zoneName: string | null; status: StallStatus; unavailableReason?: string | null; holdExpiresAt: string | null };
export type FloorPlan = { market: Omit<Market, "minPrice">; date: string; marketOpen?: boolean; closedReason?: string | null; updatedAt: string; counts: Record<StallStatus, number>; stalls: Stall[] };
export type Shop = { id: string; name: string; description: string; hours: string; phone?: string; contactUrl?: string; photoUrl?: string | null; locations?: { id: string; code: string }[]; locationDate?: string; locationSource?: string; market: { id: string; name: string; location: string }; category: Category; stall: { id: string; code: string } | null };
export type ShopResults = { items: Shop[]; total: number; page: number; limit: number; pages: number };
export const baht = (amount: number) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(amount);
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
