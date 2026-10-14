# Zonify — Design baseline

บันทึก baseline จาก source วันที่ 2026-10-12 และอัปเดตทุกหน้าวันที่ 2026-10-14 หลังตรวจ rendered UI

## Tokens ที่มีอยู่

| Token | ค่าที่ใช้ร่วมกันทุกหน้า | แหล่งใช้หลัก |
| --- | --- | --- |
| cream | `#f8f7f2` | พื้นหน้า header/footer และฟอร์มรอง |
| green | `#193c32` | ข้อความหลัก ปุ่มหลัก และ navigation ที่เลือก |
| orange | `#b64b2e` | accent ราคา การทำรายการ และ focus outline |
| sage | `#e9eee6` | พื้นผัง ตาราง readonly และภาพเปิดหน้าบัญชี |
| muted | `#656d64` | ข้อความรองและคำอธิบาย |
| line | `#d9ddd4` | ขอบ control/panel และเส้นแบ่ง |
| surface | `#ffffff` | ฟอร์ม panel และตาราง |
| available / available-ink | `#d6e5cf` / `#264833` | ล็อกว่างและสถานะสำเร็จ |
| booked / booked-ink | `#eadbd1` / `#674735` | ล็อกจองแล้ว |
| held / held-ink | `#f4dda1` / `#654a11` | พักล็อกและเวลาที่เหลือ |
| unavailable / unavailable-ink | `#e2e5e3` / `#4b5550` | ปิดใช้งาน disabled ยกเลิก/หมดอายุ |

แหล่งจริงเพียงที่เดียว: `frontend/app/globals.css` (`:root`) ทั้ง `.zonify-preview` และ `.zonify-secondary` สืบทอด palette นี้ ไม่ประกาศทับเป็นชุดสีแยก

- Font: `Noto_Sans_Thai` ผ่าน `next/font/google`, variable `--font-thai`; body ใช้ Tahoma/sans-serif fallback (`frontend/app/layout.tsx`, `globals.css`)
- Body: 16px, line-height 1.65; scoped landing container สูงสุด 1280px, desktop gutters รวม 96px (`globals.css`, `landing-preview.css`)
- Breakpoints ที่พบ: global 680/760/800/1000/1100px; landing 680/800/1100px; secondary 760/1000px
- มี reduced-motion และ focus styles ใน `globals.css`; ต้องตรวจการใช้งานด้วย keyboard ใน baseline
- ค่า spacing/radius/type จำนวนหนึ่งยังเป็น literals ใน CSS ไม่ได้ย้ายทั้งหมดเป็น tokens; การรวม tokens เป็นงานเหลืองแยกต่างหาก

## ข้อกำกับสำหรับการแก้หน้าตา

### หน้าแรก — editorial redesign 2026-10-14

- Scope: `.zonify-preview` ใน `frontend/app/components/landing-preview.css`; palette ในตารางด้านบนใช้ร่วมกับหน้ารอง ส่วน surface ใช้ panel/control และ status pairs ใช้สีพื้นกับตัวอักษรล็อกบนผัง
- หน้าเปิดพื้น ivory หัวเรื่องสี forest/orange ภาพตลาดไม่มี overlay, radius 12px; ปุ่ม 8px; font ไทยเดิม
- Gallery ตลาดและข่าวเป็นภาพกับข้อความแบบเปิด ไม่มีกรอบการ์ด; ราคาตลาดเน้นตัวเลขและมีเส้นระบุตลาดที่เลือก
- รายชื่อร้านเป็นสองคอลัมน์มีเส้นแบ่ง บนมือถือเหลือหนึ่งคอลัมน์; ใช้ข้อมูลร้านเดิม ไม่มีรูปสินค้าหรือ metadata ที่สร้างขึ้น
- ผังใช้ `frontend/public/images/plan-landscape.svg` เป็นพื้นตกแต่งเท่านั้น ตำแหน่งล็อก สถานะ ราคา และจำนวนทั้งหมดมาจาก API เดิม; ใช้ข้อความสถานะและ checkmark ควบคู่สี
- `frontend/public/images/zonify-editorial-hero.webp` เป็นภาพจำลองสร้างด้วย built-in Image Gen, brief: ตลาดริมคลองเชียงใหม่ยามเย็น ต้นไม้ อาคารล้านนา ภาพแนวนอน ไม่มีข้อความหรือ UI; optimize เป็น WebP 1600px
- ภาพร่างแยก hero/markets/floor/directory/news ใช้เป็น visual reference; รายละเอียดและ navigation ที่ภาพร่างสร้างเกินมาไม่นำเข้าระบบ
- ตรวจ IAB ที่ 375/768/1024/1440px และ landscape 812×375: ไม่มี page overflow, เลือกตลาด/ล็อก, ค้นหา, ล้างตัวกรอง, empty state และเมนูมือถือทำงานได้ ด้วย API seed ในฐานข้อมูลชั่วคราว

### ทุกหน้ารอง — account / reservations / manager

- Scope: `frontend/app/components/secondary-shell.css` และ `SecondaryShell`; ครอบคลุม login, register, profile, bookings, booking detail/payment, shop detail, admin, 404, missing shop และ error shell
- Header/footer, font ไทย, control 52px, focus สี orange และ radius 8/12px ใช้ร่วมกัน; ฟอร์มคง inline errors, labels, hints, disabled/loading states เดิม
- Login/register ใช้ภาพตลาดเดิมจากหน้าแรกกับส่วนต้อนรับพื้น sage และฟอร์มพื้นขาว; บนมือถือเรียงเป็นหนึ่งคอลัมน์
- Profile แยกข้อมูลส่วนตัวกับรหัสผ่าน; booking เน้นราคาและเวลาที่เหลือ; รายละเอียดร้านมี storefront icon และ definition rows
- Admin desktop รวมกลุ่มเมนูบนแถบเดียวเท่าที่พื้นที่พอ; mobile ≤760px ใช้ select “ส่วนจัดการ” ควบคุม state เดียวกับเมนู desktop โดยไม่เพิ่มสิทธิ์หรือเปลี่ยน API
- Mobile selector เป็น implementation judgment เพื่อแก้ปัญหาเมนูหลายแถว; คำค้น UX ไม่ได้ให้ match เฉพาะสำหรับ selector นี้ จึงไม่ได้อ้างว่าเป็นข้อแนะนำจากฐานข้อมูลสกิล
- ตารางและผังเลื่อนภายใน region เดิม ไม่มี page overflow; mobile form/report/booking ใช้หนึ่งหรือสองคอลัมน์ตามข้อมูล
- ตรวจ production preview ด้วย IAB และฐานข้อมูล memory แยกที่ 3001/4001: ทุก route, customer access-denied, booking filter, login field errors, resource form open/close, admin 13 sections บน desktop และ mobile, 404 และ missing shop
- ทุกหน้ารองตรวจ 375px และ 1440px; admin ตรวจ 768/1024px เพิ่มด้วย ไม่มี horizontal page overflow และไม่มี console/runtime errors ใน flow ที่ตรวจ
- ขอบเขตการทดสอบ payment คือหน้าแสดงรายละเอียดและสถานะ ยังไม่ได้โอนเงินจริงหรือส่งสลิปในรอบ UI นี้; เปลี่ยนเฉพาะสไตล์ ไม่เปลี่ยน payment/booking/auth logic
- Build ตรวจผ่านรวม TypeScript และ lint ของ component ที่แก้; final build ใช้ BACKEND_URL จาก config เดิม ไม่เก็บ routing ของ preview ชั่วคราว

### รอบก่อนหน้า — visual polish (แทนที่ด้วย redesign ด้านบน)

- ปรับเฉพาะ `frontend/app/components/landing-preview.css` ใช้ palette และ font เดิม ไม่มี token ใหม่
- Header พื้นขาว ตัวอักษรเขียวเข้ม ปุ่มเข้าสู่ระบบพื้นเขียว; hero คงพื้นเขียวและ CTA สี lime
- Hero เพิ่มพื้นที่ว่าง ลดน้ำหนักและขนาดหัวเรื่อง ภาพใช้มุมโค้งไม่สมมาตร; ขั้นตอนใช้เลขขนาดเล็กและเส้นแบ่ง
- การ์ดตลาดและร้านใช้มุมโค้ง 20px ราคาอยู่ใต้ชื่อ แยกตำแหน่งกับลิงก์ดูผังด้วยเส้นบาง
- Controls ใช้มุมโค้ง 12px และลิงก์สำคัญสูงอย่างน้อย 44px; ปิด transition และ hover transform เมื่อ reduced motion
- ตรวจ rendered UI ที่ 375/768/1024/1440px ด้วยข้อมูล seed ในฐานข้อมูลชั่วคราว: ไม่มี horizontal overflow, เลือกตลาดและเมนูมือถือทำงานได้

รักษาภาษาไทย, ลำดับข้อมูลตลาด/ผัง/ร้าน, ความชัดเจนของราคาและสถานะ หลีกเลี่ยงการใส่ gradient, glass panels, เงาหนัก หรือเปลี่ยนทุก section เป็น cards โดยไม่มีโจทย์รองรับ ห้ามเปลี่ยน links เป็นปุ่มที่ไม่มีปลายทาง หรือตัด loading/error/empty states เพื่อให้ภาพสะอาด

ก่อนเพิ่ม token ใหม่ให้บันทึกชื่อ ค่า scope และแหล่งใช้ที่นี่พร้อมแก้ CSS ใน diff เดียวกัน เอกสารนี้ยังไม่ใช่ inventory ของ literal ทุกค่า ห้ามอ้างว่า CSS ซ้ำ/ตายจากการค้นหาชื่อเพียงอย่างเดียว
