import "server-only";
import { cookies } from "next/headers";
import type { User } from "./auth";
export async function currentUser(): Promise<User | null> {
  const session = (await cookies()).get("zonify_session");
  if (!session) return null;
  const response = await fetch(`${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/users/me`, {
    headers: { Cookie: `zonify_session=${session.value}` }, cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error("ไม่สามารถโหลดบัญชีผู้ใช้ได้ กรุณาลองใหม่");
  return response.json();
}
