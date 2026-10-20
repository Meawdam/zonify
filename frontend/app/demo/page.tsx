import { notFound } from "next/navigation";
import Link from "next/link";
import { SecondaryShell } from "../components/secondary-shell";
import { currentUser } from "../lib/server-auth";

export default async function DemoPage() {
  if (process.env.ZONIFY_DEMO_MODE !== "1") notFound();
  const user = await currentUser();
  return <SecondaryShell title="ทดลองใช้ Zonify" subtitle="Prototype สำหรับสาธิตการจอง ข้อมูลและหลักฐานทั้งหมดเป็นข้อมูลจำลอง" user={user}>
    <section className="account-card"><h2>บัญชีพร้อมทดลอง</h2>
      <p>รหัสผ่านทุกบัญชี: <strong>ZonifyDemo2026!</strong></p>
      <ul><li>ผู้เช่า: customer@demo.zonify.test</li><li>ผู้จัดการ: manager@demo.zonify.test</li><li>เจ้าของ: owner@demo.zonify.test</li></ul>
      <p>เข้าสู่ระบบแบบปกติเพื่อทดลองสิทธิ์ของแต่ละบทบาท ใช้หน้าต่างส่วนตัวอีกหน้าต่างสำหรับผู้จัดการ เพื่อสาธิตพร้อมกับผู้เช่า</p>
      <Link className="button button-green" href="/login">เข้าสู่ระบบทดลอง</Link>
    </section>
    <section className="account-card"><h2>สาธิตการจองให้ครบวงจร</h2>
      <ol><li>ผู้เช่าเปิดร้านของฉัน เพิ่มร้าน หรือใช้ “ร้านเดโมของฉัน”</li><li>เลือกตลาดริมคลองและวันขาย แล้วเลือกล็อกว่าง พักล็อก และดำเนินการชำระเงิน</li><li>เปิด QR จำลอง แล้วกดสร้างและส่งสลิปจำลอง โดยไม่ต้องโอนเงิน</li><li>ผู้จัดการเปิดงานที่ต้องดำเนินการ ตรวจสลิป และลองปฏิเสธพร้อมเหตุผล</li><li>ผู้เช่าส่งสลิปใหม่ จากนั้นผู้จัดการอนุมัติ แล้วตรวจสถานะยืนยันแล้ว</li></ol>
      <p>มีรายการตัวอย่างสำหรับวันพรุ่งนี้: พักล็อก รอชำระ รอตรวจสลิป และยืนยันแล้ว การพักล็อกและการรอชำระยังมีเวลาหมดอายุตามจริง</p>
      <Link className="text-link" href="/merchant">เปิดร้านของฉัน</Link> · <Link className="text-link" href="/admin">เปิดหลังบ้าน</Link>
    </section>
    <section className="account-card"><h2>เริ่มข้อมูลใหม่</h2><p>เปิด terminal อีกหน้าต่างในโฟลเดอร์โปรเจกต์ แล้วใช้ <code>node scripts/reset-demo.mjs</code> บัญชีทุกเครื่องจะออกจากระบบหลังรีเซ็ต ให้เข้าสู่ระบบใหม่อีกครั้ง</p><p>ข้อมูลเดโมเก็บแยกในฐานข้อมูลชั่วคราว การปิดและเปิดเดโมใหม่จะเริ่มข้อมูลใหม่เช่นกัน รายงานและยอดเงินในโหมดนี้เป็นข้อมูลจำลองทั้งหมด</p></section>
  </SecondaryShell>;
}
