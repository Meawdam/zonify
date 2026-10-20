import { requestJSON, RequestTimeoutError } from "./request";
import { ApiError } from "./auth";
export type MerchantShop = { id: string; version: number; name: string; marketId: string; categoryId: string; description: string; hours: string; phone: string; contactUrl: string; active: boolean; photoUrl: string | null };
export type MerchantShops = { items: MerchantShop[] };
export async function merchantRequest<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  let result: Awaited<ReturnType<typeof requestJSON>>;
  try { result = await requestJSON("/api/merchant" + path, { method, credentials: "same-origin", cache: "no-store", ...(body instanceof FormData ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) }); }
  catch (error) { if (error instanceof RequestTimeoutError) throw new ApiError(0, "REQUEST_TIMEOUT", error.message); throw new ApiError(0, "NETWORK_ERROR", "เชื่อมต่อไม่ได้ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง"); }

  const { response, data } = result;
  if (!response.ok) {
    const fields: Record<string, string> = {};
    for (const issue of data?.errors ?? []) if (issue.path?.[0]) fields[String(issue.path[0])] = issue.message;
    throw new ApiError(response.status, data?.code ?? "SERVER_ERROR", data?.message ?? "บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง", fields);
  }
  return data;
}
export function merchantReturn(value: string | null) {
  if (!value) return "/#floor-plan";
  try { const url = new URL(value, "http://zonify.local"); return url.origin === "http://zonify.local" && url.pathname === "/" ? url.pathname + url.search + "#floor-plan" : "/#floor-plan"; }
  catch { return "/#floor-plan"; }
}
