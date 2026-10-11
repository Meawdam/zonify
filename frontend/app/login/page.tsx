import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { AuthShell } from "../components/auth-shell";
import { AuthForm } from "../components/account-forms";
import { safeLoginNext } from "../lib/bookings";
export const metadata = { title: "เข้าสู่ระบบ | Zonify" };
const notices: Record<string, string> = {
  registered: "สมัครสมาชิกสำเร็จ เข้าสู่ระบบเพื่อเริ่มใช้งาน",
  "password-changed": "เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง",
  expired: "เซสชันสิ้นสุดแล้ว กรุณาเข้าสู่ระบบใหม่",
};
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ notice?: string; next?: string }> }) {
  const { notice, next } = await searchParams;
  const nextPath = safeLoginNext(typeof next === "string" ? next : undefined);
  if (await currentUser()) redirect(nextPath);
  return <AuthShell title="ยินดีต้อนรับกลับ" subtitle="เข้าสู่ระบบเพื่อดูแลบัญชีของคุณ"><AuthForm mode="login" notice={notices[notice ?? ""] ?? ""} nextPath={nextPath}/></AuthShell>;
}
