import Link from "next/link";
export default function ShopNotFound() {
  return <main className="account-page"><div className="account-card"><h1>ไม่พบร้านค้านี้</h1><p>ร้านค้าอาจปิดแสดงข้อมูลแล้ว</p><Link className="text-link" href="/#shops">กลับไปรายชื่อร้านค้า</Link></div></main>;
}
