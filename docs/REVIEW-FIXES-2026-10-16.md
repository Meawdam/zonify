# ผลแก้ Zonify จาก Code Review — 16 ตุลาคม 2026

ขอบเขตตาม `promt.mb` ที่ผู้ใช้ให้ดำเนินการ บน branch `frameeiei` จาก HEAD `f4c96ec` ไม่เปลี่ยน branch ไม่สร้าง commit ไม่ push/merge/deploy และไม่ทำธุรกรรมกับระบบจริง งาน README และไฟล์ untracked ที่มีอยู่ก่อนเริ่มยังคงไว้

## สิ่งที่แก้ตามลำดับ

| ข้อ | ก่อนแก้ที่ยืนยันได้ | หลังแก้และหลักฐาน |
| --- | --- | --- |
| P1: refresh และฟอร์ม | จำลอง 503 จาก polling แล้ว PaymentPanel ถูกถอด ไฟล์และค่าฟอร์มหาย | hook แยก loading/refreshing/initialError/refreshError เก็บข้อมูลเฉพาะ URL เดิม แสดงคำเตือนโดยคง subtree เดิม ทดสอบ file, เวลาและ reference อยู่หลัง failure/retry/recovery; 401/403 ล้างข้อมูล และ booking ID ใหม่ไม่แสดงรายการเก่า |
| P2: ขั้นตอนจอง | dialog บอกดูข้อมูลได้อย่างเดียว และ confirm ใช้คำว่ายืนยันการจอง ทั้งที่ backend เปลี่ยนเป็น pending_payment | เปลี่ยนปุ่มเป็น “ดำเนินการชำระเงิน” มีลำดับพักล็อก/ตรวจรายละเอียด → ชำระเงิน → รอตรวจสลิป → ยืนยันแล้ว พร้อมคำแนะนำตามสถานะ ไม่เปลี่ยน state machine/hold/deadline ฝั่ง server |
| P2: URL และ draft | section/filters อยู่ local state; ไม่มี return context ของร้าน; เปลี่ยน editor/Back อาจทิ้ง draft | ใช้ URL เป็นแหล่ง state ผ่าน History API ตามเอกสาร Next ที่ติดตั้ง รองรับ reload/Back/Forward, validate section/id/date/page≤10000; shop return URL มี allowlist; มี confirmation ตอนปิด/สลับ editor และก่อนออกจากส่วนจัดการ |
| P2: มือถือ | มีเพียง selection บนผัง รายละเอียดอยู่ด้านล่าง | สรุป code/ราคา/สถานะ/ลิงก์ทำต่อแบบ inline **เหนือผัง** ยืนยันว่าทั้งสรุปอยู่ใน viewport 390×844 หลังแตะเลือกจริง มีรายการล็อกร่วม selection และกรองสถานะ/โซน/ราคาสูงสุด; ผังเลื่อน/ซูมได้เหมือนเดิม ไม่มี overlay บังฟอร์ม |
| P2: accessibility | payment errors ไม่เชื่อมทุก field และ client validation ไม่พา focus | ใช้ fieldAccessibility ร่วม account/payment/catalog เชื่อม hint+error ด้วย ID; focus field แรกหลัง validation/API error หรือ alert เมื่อไม่มี field; ทดสอบชนิดไฟล์ผิด/เกิน 5 MB/API reference error และค่าถูกต้องยังอยู่ |
| P2: เวลาไทย | datetime-local ถูกตีความตาม timezone เครื่อง | thaiTransferISO ตรวจ calendar และแปลง UTC+07:00 ชัดเจน; UI ระบุเวลาไทย; ทดสอบ UTC/Bangkok/Los Angeles, leap day, invalid date/time และข้ามวัน |
| P2: ลำดับโหลด | production trace เป็น hydrate → markets → floor | server ส่ง initial markets/categories/floor; deep-link market เริ่มโหลดผังขนานกับ references/auth; default market ที่ไม่ระบุยังต้องรู้ตลาดแรกก่อนโหลดผัง แต่ทำบน server ก่อน hydration; reference cache 60 วินาที แยกจาก availability/account ซึ่ง no-store; client poll ต่อจากอายุ seed |
| P3: โครงสร้าง/ชนิด/CSS | admin ไฟล์เดียวรวม catalog/floor/users; AdminRow ใช้ arbitrary index signature; map/button rules ซ้ำสองหน้า | แยก admin-catalog/admin-floor/admin-users คง booking/payment/report feature เดิม; มี AdminResources map และ references/results แยกตาม resource ส่วน editor ใช้ draft shape ที่กำหนด keys/types; รวม field attributes, button base และ StallPlan status rules; ไม่มี dependency เพิ่ม |

ข้อมูลบัญชีไม่มี shared client cache; SecondaryShell remount ข้อมูลเมื่อ user ID/role เปลี่ยน และ session events/BroadcastChannel ล้าง subtree ในหน้าที่เปิดอยู่ การส่งรายการยังผ่าน backend ตรวจสิทธิ์ สถานะ ราคา concurrency และหมดอายุเหมือนเดิม

สำหรับ dirty editor: Back/Forward ภายใน `/admin` ยังรักษาฟอร์มเดิมไว้จนบันทึก/ปิด; การเข้า `/admin` ผ่านเมนูใช้ document navigation เพื่อให้ native beforeunload ป้องกันการออกด้วย Back แม้เบราว์เซอร์ไม่มี Navigation API; มี Navigation API guard เพิ่มสำหรับ SPA traversal ที่ยกเลิกได้ ตรวจเส้นทาง document entry จริงแล้ว และตรวจ SPA traversal แยกในช่วงวินิจฉัยก่อนเพิ่ม fallback

## ไฟล์หลัก

- `frontend/app/lib/use-public-data.ts`, `components/data-warning.tsx`, `components/account-data-boundary.tsx`: lifecycle ของข้อมูลและขอบเขตบัญชี
- `components/booking-workspace.tsx`, `payment-panel.tsx`, `booking-action.tsx`, `info-dialog.tsx`, `lib/payment-time.ts`, `lib/form-fields.ts`: booking copy, persistence, เวลาไทย และ error accessibility
- `lib/url-state.ts`, `lib/use-url-state.ts`, `lib/use-unsaved-guard.ts`, `shop-directory.tsx`, `market-explorer.tsx`, `shops/[id]/page.tsx`, `account-menu.tsx`: URL/history/return links และการรักษา draft
- `app/page.tsx`, `lib/server-catalog.ts`, `landing-page.tsx`: initial server data และ cache policy
- `floor-browser.tsx`, `stall-plan.css`, `landing-preview.css`, `secondary-shell.css`, `globals.css`: mobile selection/list และ styles ร่วม
- `admin-workspace.tsx`, `admin-catalog.tsx`, `admin-floor.tsx`, `admin-users.tsx`, `lib/admin.ts`: แยก feature และชนิด resource
- `frontend/tests/review-helpers.test.mjs`, `scripts/review-{fixture,browser,navigation}.mjs`: regression fixtures/browser; `scripts/browser-qa.mjs` รองรับพอร์ตแยกและเพิ่ม CRUD จริงบนฐานข้อมูลชั่วคราว

## การตรวจจริง

| คำสั่ง/สถานการณ์ | ผล |
| --- | --- |
| `pnpm --dir frontend test` | 4/4 tests ผ่าน ครอบคลุม timezone/calendar/URL limits/return URL |
| `pnpm --dir frontend typecheck` | ผ่าน |
| `pnpm --dir frontend lint` | ผ่าน ไม่มี error/warning |
| `pnpm --dir frontend build --webpack` | ผ่าน รวม TypeScript; build ส่งมอบรอบสุดท้ายใช้ environment เดิมของโครงการ ไม่ตั้ง BACKEND_URL ไป fixture |
| `pnpm --dir backend build` | ผ่าน |
| `pnpm --dir backend test` | 71/71 ผ่าน 0 failed/skipped รวม auth/CRUD/concurrency/payment/expiry/reports/backup บน MongoDB ชั่วคราว |
| `node scripts/review-browser.mjs --before` | ยืนยันฟอร์มหายจริงบน production baseline; เก็บภาพและ waterfall |
| `node scripts/review-browser.mjs` | ผ่านบน production fixture: polling/retry/recovery, 401/403, initial error, booking ID change, wrong/oversize file, API field errors/focus/Thai instant, URL reload/Back/Forward/detail-return, map/list/filter/keyboard, session invalidation |
| viewport 360/390/768/1440 | ตรวจ overflow และเก็บภาพ; เพิ่ม 390×844 ตรวจตำแหน่งสรุปราคาหลัง tap ให้อยู่ใน viewport |
| ขยายข้อความ 200% | เพิ่ม computed font size ของทุก HTML element เป็นสองเท่าก่อนตรวจที่ 360px ไม่มี page overflow; เก็บภาพแยก |
| `node scripts/review-navigation.mjs` | ผ่าน: ยกเลิก browser Back แล้วยังมี draft เดิม; ยอมรับแล้วออกจาก route ได้ |
| `node scripts/browser-qa.mjs` | ผ่านจริงบน Next dev 3100/API 4101/MongoMemoryServer: สมัคร/login/profile/password/session expiry/revocation/logout, manager+owner เพิ่ม/แก้ตลาด, floor/users/dashboard/reports/CSV และ mobile; ไม่มี browser error/warning |
| `git diff --check` | ผ่าน |
| ผู้ตรวจอิสระ | พบ editor switching, page bound และ route Back; เพิ่ม reproduction/regression แล้วแก้ทั้งหมด รอบตรวจซ้ำไม่พบ material issue เพิ่ม |

Browser plugin ไม่พร้อมในเซสชันนี้ จึงใช้ bundled Playwright กับ Chrome ที่ติดตั้ง โดยไม่เพิ่ม package ในแอป Browser checks ยืนยัน title/เนื้อหาหน้า ไม่พบ framework error overlay และตรวจ console/runtime errors (network errors ที่จำลองโดยตั้งใจแยกจาก app errors)

Baseline/final fixture ใช้ `BACKEND_URL=http://127.0.0.1:4100`, production preview `http://localhost:3101`; ตั้ง `QA_BASE` ตามนั้นและ `QA_PLAYWRIGHT_MODULE` เป็น absolute path ของ Playwright `index.mjs` ที่มีอยู่ ส่วน integration ใช้ `QA_BASE=http://localhost:3100`, `QA_API_PORT=4101`, และ frontend proxy ไป 4101 ห้ามชี้ integration ไปฐานข้อมูลจริง สคริปต์เป็นผู้สร้าง/ทำลาย MongoMemoryServer เอง

## ผลวัด performance

Chrome headless, production Webpack build, viewport 390×844, reduced motion, fixture 24 stalls, API delay 100 ms, URL `/?market=qa-market&date=2026-10-16` เหมือนกันก่อน/หลัง วัด `performance.now()` หลัง Playwright คลิกล็อกแรกสำเร็จ จึงรวมเวลารอ action/scroll ของเครื่องมือด้วย

| เงื่อนไข | ก่อนแก้ | หลังแก้รอบสุดท้าย |
| --- | ---: | ---: |
| browser context ใหม่/cache ใหม่ | 511.6 ms | 368.7 ms |
| browser context เดิม/cache เดิม | 519.7 ms | 207.6 ms |

คำว่า cold/warm ในไฟล์ metrics หมายถึง **browser cache** เท่านั้น Server/process และ compiler ถูก warm ก่อนเริ่มวัด ทั้งสองด้านมีอย่างละหนึ่งตัวอย่างต่อเงื่อนไข ไม่ใช่ค่าเฉลี่ยทางสถิติหรือผลเครือข่ายจริง Before waterfall เริ่ม markets ราว 173/163 ms แล้วจึงเริ่ม floor ราว 308/290 ms หลังแก้ข้อมูลผังมากับ server payload และในช่วงวัดจนคลิกสำเร็จไม่มี client markets/floor request ซ้ำ (resource timing list ว่าง ไม่ได้แปลว่าหน้านี้ไม่ใช้ network)

ตรวจ bundle จริงก่อนพิจารณา lazy loading: admin route chunk ก่อน 38,107 bytes หลัง 41,487 bytes (raw JS ไม่ gzip และไม่ใช่ขนาดทั้ง route) รอบนี้ **ไม่ได้ลด bundle** และไม่ได้ใส่ lazy-loading โดยไม่มีหลักฐานประโยชน์

## หลักฐานและขอบเขตที่ยังไม่ยืนยัน

หลักฐาน local อยู่ `.data/brownfield/review-fixes/` (ถูก Git ignore):

- `before/metrics.json`, `after/metrics.json`: timing/waterfall และ runtime errors
- `before/poll-error.png`, `after/poll-error.png`: ฟอร์มหายก่อนแก้/ฟอร์มยังอยู่หลังแก้
- `after/floor-section-390.png`: สรุปราคาเหนือผังและทางไปปุ่มทำรายการ
- `after/floor-{360,390,768,1440}.png`, `after/floor-text-200.png`: responsive/text QA
- `before/chunks.json`, `after/chunks.json`: raw chunk inventory
- `integration/`: ภาพ profile/report/public และ manager/owner CSV จากฐานข้อมูลชั่วคราว

ข้อจำกัด:

- `pnpm --dir frontend build` แบบ Turbopack เคยติดการดาวน์โหลด Google Fonts ใน sandbox และเมื่อขอสิทธิ์เพิ่มติด CSS worker connection ของ runtime จึงตรวจ production build ด้วย Webpack ที่ Next รองรับ ไม่แก้ font/config ของผู้ใช้เพื่อหลบปัญหา
- ไม่ได้วัด Lighthouse, ไม่ได้ตรวจ Firefox/Safari, ไม่มีการรับรองด้วย screen reader จริง; ตรวจ keyboard/focus/ARIA associations ด้วย browser automation
- ไม่ได้โอนเงิน ส่งสลิปไปบริการจริง หรือรับรอง UAT; payment rules ตรวจด้วย backend tests และ UI fixture
- Public references ใช้ revalidate 60 วินาที จึงอาจแสดงข้อมูลอ้างอิงก่อน refresh ชั่วคราว ส่วน availability/private data ไม่ใช้ shared cache และทุก mutation ยังตรวจข้อมูลล่าสุดที่ server
- ไม่มี migration/schema change หรือเปลี่ยน business rule ที่ต้องให้ผู้ใช้ตัดสินใจเพิ่มในขอบเขตนี้

หยุด preview/fixture/integration services ที่เปิดเพื่อทดสอบแล้ว คง source edits และไฟล์หลักฐานไว้ให้ตรวจ diff ได้ ไม่มีการลบงานหรือไฟล์ของผู้ใช้

## การส่งขึ้น GitHub ภายหลัง

หลังตรวจงานและเปิดพรีวิว ผู้ใช้อนุญาตให้ commit และ push งานที่เสร็จขึ้น `origin/frameeiei` โดยแยก README และไฟล์งานค้างที่มีอยู่ก่อนเริ่มออกจากชุดส่งมอบ ไม่รวม environment, ฐานข้อมูล, บัญชีพรีวิว หรือหลักฐาน local ใน commit
