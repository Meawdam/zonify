import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { AuthShell } from "../components/auth-shell";
import { AuthForm } from "../components/account-forms";
import { safeLoginNext } from "../lib/bookings";
export const metadata = { title: "สมัครสมาชิก | Zonify" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = safeLoginNext(typeof next === "string" ? next : undefined);
  if (await currentUser()) redirect(nextPath);
  return <AuthShell auth title="เริ่มต้นกับ Zonify" subtitle="สร้างบัญชีลูกค้าเพื่อเตรียมพื้นที่ขายของคุณ"><AuthForm mode="register" nextPath={nextPath}/></AuthShell>;
}
