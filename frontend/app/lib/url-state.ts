export const adminSections = ["markets", "categories", "zones", "stalls", "shops", "advertisements", "floor", "users", "bookings", "holds", "payments", "dashboard", "reports", "schedule", "queue"] as const;
export type AdminSection = typeof adminSections[number];
export const adminSection = (value: string | null) => adminSections.find(section => section === value) ?? "markets";
export const resourceId = (value: string | null | undefined) => value && /^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(value) ? value : "";
export const pageNumber = (value: string | null) => value && /^[1-9]\d{0,4}$/.test(value) && Number(value) <= 10000 ? Number(value) : 1;
export function shopFilters(params: Pick<URLSearchParams, "get">) {
  return { q: (params.get("q") ?? "").trim().slice(0, 100), market: resourceId(params.get("shopMarket")), category: resourceId(params.get("category")), page: pageNumber(params.get("page")) };
}
export function shopReturnHref(value: string | undefined) {
  if (!value?.startsWith("/?") || value.startsWith("//")) return "/#shops";
  try {
    const url = new URL(value, "http://zonify.local");
    const allowed = ["market", "stall", "date", "shopMarket", "q", "category", "page"];
    if (url.pathname !== "/" || url.origin !== "http://zonify.local" || [...url.searchParams.keys()].some(key => !allowed.includes(key))) return "/#shops";
    return "/" + url.search + "#shops";
  } catch { return "/#shops"; }
}
export const bookingRefundFilter = (value: string | null, manager: boolean, holdsOnly: boolean) => manager && !holdsOnly && value === "pending" ? "pending" : "";
