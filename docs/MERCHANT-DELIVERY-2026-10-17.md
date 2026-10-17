# ระบบเจ้าของร้านผู้เช่า — ผลส่งมอบ 17 ตุลาคม 2026

## ผลลัพธ์

เพิ่ม `/merchant` สำหรับบัญชีผู้เช่า รองรับหลายร้านต่อบัญชี จัดการชื่อ ประเภทสินค้า รายละเอียด เวลาเปิด เบอร์โทร URL และรูปภาพ มีภาพรวมจำนวนร้าน รายการปัจจุบัน ประวัติ ยอดรอชำระ และรายการที่ต้องดำเนินการ โดยนับจากฐานข้อมูลทั้งหมด ไม่ใช่จำนวนรายการในหน้าแรก

การพักล็อกใหม่ต้องเลือกร้านที่เป็นของบัญชีและอยู่ในตลาดเดียวกัน ทั้ง route และ service ตรวจข้อกำหนดนี้ การจองเก็บชื่อ/ข้อมูลร้าน ณ เวลาจองเพื่อรักษาประวัติ ใช้กระบวนการชำระเงินเดิม: held → pending_payment → payment_review → confirmed พร้อมการปฏิเสธ/ส่งใหม่และการหมดอายุ

หน้ารวมร้านและรายละเอียดแสดงรูป/ข้อมูลติดต่อ ตำแหน่งร้านผู้เช่ามาจากรายการยืนยันในวันที่เลือก รองรับหลายล็อก ร้านเก่าที่ผู้ดูแลสร้างยังแสดงตำแหน่งแค็ตตาล็อกโดยระบุแหล่งที่มา ไม่มีการยกสิทธิ์ร้านเก่าให้บัญชีใดเอง

## หลักฐานตรวจรับ

| ข้อกำหนด | หลักฐาน |
| --- | --- |
| หลายร้านและแยกเจ้าของ | `backend/tests/merchant.test.ts`: สร้างหลายร้าน, อีกบัญชีอ่าน/แก้ไม่ได้, ร้านเดิมไม่ถูกอ้างสิทธิ์ |
| ฟอร์มและการแก้พร้อมกัน | strict DTO, optimistic version; เทสต์จับและแก้ partial update ที่เคยล้างช่องไม่ส่งมา; browser conflict recovery รักษา draft และแสดงข้อมูลล่าสุด |
| รูปภาพ | ตรวจ JPEG/PNG, ขนาด 5 MB, decode/re-encode, รูปเสีย/ขนาดเกิน/เจ้าของผิด, การซ่อนเมื่อปิดร้าน; browser อัปโหลดและเปิดรูปจริง |
| จองให้ร้านและประวัติ | snapshot ไม่เปลี่ยนตามชื่อร้าน, ร้านผิดตลาด/ปิดใช้งานถูกปฏิเสธ, retry ร้านเดิม, concurrent ต่างร้านมีผู้ชนะรายเดียว, shop/group URL filters |
| ชำระเงินครบวงจร | merchant integration: สร้างร้าน → พักล็อก → QR → ส่งสลิป → ปฏิเสธ → ส่งใหม่ → ผู้จัดการยืนยัน → ตำแหน่งสาธารณะ |
| ข้อมูลเดิม | legacy booking ไม่มีร้านยังเปิดดู สร้าง QR และยกเลิกได้; ร้านเก่ายังอยู่ภายใต้ admin |
| หมดอายุ/ยกเลิก/การแย่งแผง | booking suite ครอบคลุม expiry worker, pending expiry, cancellation, 20 concurrent buyers และ stale operations |
| เครือข่าย/งานค้าง | browser abort PATCH แล้ว draft ยังอยู่, logout ยกเลิกได้ก่อน session ถูกเพิกถอน, conflict reload ไม่ล้าง draft |
| มือถือ/คีย์บอร์ด/URL | browser 360/390/768/1440 ไม่มี overflow; Enter ส่งแบบฟอร์ม; reload และ Back คืน shop/group; directory ส่งวันที่ไป API และ detail |
| สำรองรูป | backup test ใช้ mongodump/restore จริง ตรวจ bytes ใน shopphotos และ ownership/photo references ใน shops ตรงกับต้นฉบับ |

ผลล่าสุด: backend build ผ่าน; backend **81/81** tests ผ่าน ไม่มี skip; frontend typecheck/lint ผ่าน; helper tests **4/4** ผ่าน; production build `pnpm build --webpack` ผ่าน; `scripts/merchant-browser.mjs` ผ่านกับ final production frontend/backend และไม่มี page runtime error

ใช้ skill frontend-testing-debugging โดย Browser plugin ไม่มีในรายการ จึงใช้ Playwright/Chrome ที่ติดตั้งอยู่ ภาพหลักฐานอยู่ใน `.data/merchant-qa/` และ `result.json` ผู้ตรวจอิสระตรวจรอบแรกพบ 3 เรื่อง (conflict recovery, logout guard, directory date) แก้แล้วและตรวจซ้ำไม่พบประเด็นสำคัญค้าง

## การเปิดทดลองและข้อจำกัด

- เปิด `http://localhost:3000/merchant` ผ่าน production build และ API จริงกับ MongoDB ชั่วคราว ไม่มี mock API
- บัญชีผู้เช่า `customer@preview.zonify.test`, ผู้ดูแล `manager@preview.zonify.test`, เจ้าของตลาด `owner@preview.zonify.test`; รหัสผ่านทุกบัญชี `ZonifyDemo2026!` เป็นบัญชีพรีวิวเท่านั้น
- Preview ปิดการสร้าง QR เพราะยังไม่มีบัญชีรับเงินจริง การทดสอบชำระเงินใช้บัญชีสังเคราะห์ใน isolated integration test ไม่ได้โอนเงินจริง
- ไม่ได้ทดสอบ Firefox/Safari หรือโปรแกรมอ่านหน้าจอจริง และยังไม่ได้ทำ UAT กับผู้ใช้จริง
- ไม่ deploy, commit หรือ push รอบนี้ และไม่แก้ README/ไฟล์วิจัยเดิมที่ค้างอยู่
- เอกสาร API อยู่ที่ `/api-docs`; อัปเดต frontend/backend พร้อมกันเพราะ new hold ต้องมี shopId; ไม่ต้อง backfill ข้อมูลเดิม ใช้ backup tool รุ่นที่รองรับ shopphotos
