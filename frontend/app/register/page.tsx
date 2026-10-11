import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { AuthShell } from "../components/auth-shell";
import { AuthForm } from "../components/account-forms";
export const metadata = { title: "สมัครสมาชิก | Zonify" };
export default async function RegisterPage() {
  if (await currentUser()) redirect("/profile");
  return <AuthShell title="เริ่มต้นกับ Zonify" subtitle="สร้างบัญชีลูกค้าเพื่อเตรียมพื้นที่ขายของคุณ"><AuthForm mode="register"/></AuthShell>;
}
