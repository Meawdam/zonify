export type User = { id: string; name: string; email: string; phone: string; role: "customer" | "manager" | "owner" };
export const roleLabels = { customer: "ลูกค้า", manager: "ผู้จัดการ", owner: "เจ้าของ" };
export type FieldErrors = Record<string, string>;
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: FieldErrors = {}) { super(message); }
}
export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/users${path}`, {
      method: options.method ?? "GET", credentials: "same-origin", cache: "no-store",
      ...(options.body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }),
    });
  } catch { throw new ApiError(0, "NETWORK_ERROR", "เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่"); }
  if (response.ok && ["/login", "/logout", "/me/password"].includes(path) && options.method && options.method !== "GET" && typeof window !== "undefined") {
    window.dispatchEvent(new Event("zonify-session"));
    if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("zonify-session"); channel.postMessage("changed"); channel.close(); }
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const fields: FieldErrors = {};
    for (const issue of data?.errors ?? []) if (issue.path?.[0]) fields[String(issue.path[0])] = issue.message;
    if (data?.code === "WRONG_PASSWORD") fields.currentPassword = data.message;
    throw new ApiError(response.status, data?.code ?? "SERVER_ERROR", data?.message ?? "ระบบขัดข้อง กรุณาลองอีกครั้ง", fields);
  }
  return data as T;
}
export function passwordError(value: string) {
  const bytes = new TextEncoder().encode(value).length;
  return bytes < 8 || bytes > 72 ? "รหัสผ่านต้องมีความยาว 8–72 ไบต์" : "";
}
