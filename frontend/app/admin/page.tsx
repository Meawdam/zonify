import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { SecondaryShell } from "../components/secondary-shell";
import { AdminWorkspace } from "../components/admin-workspace";
export const metadata = { title: "จัดการตลาด | Zonify" };
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "customer") return <SecondaryShell title="คุณไม่มีสิทธิ์เข้าหน้าจัดการ" subtitle="หน้านี้สำหรับผู้จัดการและเจ้าของ" user={user}><div className="account-card"><Link className="text-link" href="/">กลับหน้าแรก</Link></div></SecondaryShell>;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <SecondaryShell title="จัดการตลาด" subtitle="ข้อมูลหลัก ผังล็อก และร้านค้า • บันทึกแล้วแสดงบนเว็บไซต์ทันที" user={user} wide><AdminWorkspace user={user} today={today}/></SecondaryShell>;
}
