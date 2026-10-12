"use client";
import Link from "next/link";
import { SecondaryShell } from "./components/secondary-shell";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return <SecondaryShell title="เชื่อมต่อระบบไม่ได้" subtitle="กรุณาตรวจสอบว่า backend กำลังทำงาน แล้วลองอีกครั้ง"><div className="account-card secondary-state-actions"><button className="button button-green" onClick={retry}>ลองอีกครั้ง</button><Link href="/login" className="text-link">ไปหน้าเข้าสู่ระบบ</Link></div></SecondaryShell>;
}
