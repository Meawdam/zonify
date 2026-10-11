import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { AccountMenu } from "../components/account-menu";
import { AdminWorkspace } from "../components/admin-workspace";
export const metadata = { title: "จัดการตลาด | Zonify" };
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role === "customer") return <main className="account-page"><h1>คุณไม่มีสิทธิ์เข้าหน้าจัดการ</h1><p>หน้านี้สำหรับผู้จัดการและเจ้าของ</p><Link className="text-link" href="/">กลับหน้าแรก</Link></main>;
  return <>
    <header className="site-header"><div className="container header-inner"><Link href="/" className="brand"><span>Zonify</span></Link><AccountMenu user={user}/></div></header>
    <main className="admin-page"><div className="account-heading"><Link href="/" className="text-link">กลับหน้าแรก</Link><h1>จัดการตลาด</h1><p>ข้อมูลหลัก ผังล็อก และร้านค้า • บันทึกแล้วแสดงบนเว็บไซต์ทันที</p></div><AdminWorkspace user={user}/></main>
  </>;
}
