import Link from "next/link";
import { SecondaryShell } from "../../components/secondary-shell";
export default function ShopNotFound() {
  return <SecondaryShell title="ไม่พบร้านค้านี้" subtitle="ร้านค้าอาจปิดแสดงข้อมูลแล้ว"><div className="account-card"><Link className="text-link" href="/#shops">กลับไปรายชื่อร้านค้า</Link></div></SecondaryShell>;
}
