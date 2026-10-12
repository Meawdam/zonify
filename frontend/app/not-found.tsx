import Link from "next/link";
import { SecondaryShell } from "./components/secondary-shell";

export default function NotFound() {
  return <SecondaryShell title="ไม่พบหน้านี้" subtitle="กรุณาตรวจสอบที่อยู่ของหน้าแล้วลองอีกครั้ง"><div className="account-card"><Link className="button button-green" href="/">กลับหน้าแรก</Link></div></SecondaryShell>;
}
