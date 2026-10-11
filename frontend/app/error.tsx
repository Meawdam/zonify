"use client";
import Link from "next/link";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main className="account-page"><div className="account-card"><h1>เชื่อมต่อระบบไม่ได้</h1><p>กรุณาตรวจสอบว่า backend กำลังทำงาน แล้วลองอีกครั้ง</p><button className="button button-green" onClick={retry}>ลองอีกครั้ง</button><Link href="/login" className="text-link">ไปหน้าเข้าสู่ระบบ</Link></div></main>;
}
