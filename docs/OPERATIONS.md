# คู่มือติดตั้งและดูแล Zonify

## ข้อมูลปฏิทินและแจ้งเตือน

เวอร์ชันปฏิทิน/แจ้งเตือนเพิ่ม collection `marketschedules` และ `notifications` พร้อม index ที่สร้างเมื่อเริ่ม API ไม่ต้อง backfill ตลาดเดิม: หากยังไม่มีปฏิทินจะถือว่าเปิดทุกวัน ต้องใช้เครื่องมือ backup/restore เวอร์ชันที่รวมสอง collection นี้ การทดสอบ round-trip ตรวจข้อมูลใหม่ด้วย โดยยังไม่สำรอง session

worker เดิมตรวจทุก 15 วินาที ทั้งปล่อยรายการหมดอายุ สร้างคำเตือนชำระ และส่งเหตุการณ์ที่ค้างในเอกสารจองเข้ากล่องแจ้งเตือน หากหยุดแล้วเริ่มใหม่จะส่งต่อได้ การส่งสำเร็จแต่ยังไม่บันทึกรับทราบไม่สร้างข้อความซ้ำเพราะใช้ event ID เดิม ข้อผิดพลาดบันทึกเป็น `Booking expiry failed` และลองใหม่ในรอบถัดไป ไม่ต้องตั้งค่าผู้ให้บริการอีเมลหรือ LINE

สถานะภายใน `preparing` ใช้ประสานการพักล็อกกับการแก้ปฏิทินบน standalone MongoDB ไม่แสดงต่อผู้ใช้และไม่รวมยอดจอง หากกระบวนการหยุดกลางทางจะลบเฉพาะการเตรียมที่หมดอายุในรอบ cleanup ประวัติการจองจริงยังเก็บตามเดิม การอ่าน/เขียนจากระบบอื่นต้องผ่าน API เพื่อคงกติกาการจองและ revision ของปฏิทิน

ส่งมอบสำหรับเครื่องเดียว พอร์ตหลัก frontend 3000, backend 4000, MongoDB 27017 ใช้ `http://localhost:3000` ให้ตรง APP_ORIGIN ไม่สลับชื่อ host ข้อมูลถาวรของ native MongoDB กับ Docker อยู่คนละที่ เลือกวิธีใดวิธีหนึ่ง ไม่เปิดชนพอร์ตกัน

## เตรียมครั้งแรก

ใช้ Node.js 22, pnpm 11.21.0, Chrome และ MongoDB 8 สำหรับการทดสอบ backup ติดตั้ง [MongoDB Database Tools](https://www.mongodb.com/try/download/database-tools) เพิ่มด้วย ไม่ใช่แค่ mongod.exe

```powershell
cd D:\zonify
pnpm --dir backend install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

setup-local สร้างไฟล์ที่ยังไม่มีเท่านั้น เก็บ JWT/รหัสผ่าน seed แบบสุ่มใน backend/.env ไม่แสดงรหัสผ่านบนหน้าจอ อ่านอีเมล/รหัสผ่านแต่ละบทบาทในไฟล์นี้ การตั้งค่าเพิ่มเติมและคู่มือ migration อยู่ใน README ห้ามใส่ environment จริงหรือ backup ใน Git

## Native MongoDB และ production build

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/mongodb.ps1 start
pnpm --dir backend migrate:auth
pnpm --dir backend seed:auth
pnpm --dir backend seed:catalog
pnpm --dir backend seed:ads
pnpm --dir backend build
pnpm --dir frontend lint
pnpm --dir frontend build
pnpm --dir backend start
```

เปิดอีก terminal รัน `pnpm --dir frontend start --hostname localhost` เปิด [เว็บ](http://localhost:3000), [API health](http://localhost:4000/health) และ [Swagger](http://localhost:4000/api-docs) seed เป็นตัวเลือกและไม่เขียนทับข้อมูลที่มีอยู่ ภาพ/ข่าว/สถานะรายวันที่ seed เป็นข้อมูลสมมติ

หยุด Node server ด้วย Ctrl+C ก่อนหยุด MongoDB ด้วย `scripts/mongodb.ps1 stop` ข้อมูลอยู่ .data/mongodb ไม่ถูกลบ เมื่อเปิดใหม่ข้อมูลเดิมยังอยู่ `/health` ตอบ 200 เมื่อเชื่อมต่อ MongoDB และ 503 เมื่อยังไม่พร้อม Native backend ใช้ BACKEND_HOST=127.0.0.1 เป็นค่าเริ่มต้น Docker override เป็น 0.0.0.0 ภายใน container และ publish เฉพาะ loopback ของ host

## Docker ทั้งระบบ

เปิด Docker Desktop ก่อน รันจาก root ของโปรเจกต์ ใช้ compose.yml นี้แทน backend/docker-compose.yml ซึ่งเป็นทางเลือกเก่าสำหรับ API/DB เท่านั้น ไม่มีการ publish ออกภายนอกเครื่อง และ Next.js proxy ใช้ชื่อบริการ backend ภายใน Docker

```powershell
cd D:\zonify
docker compose build
docker compose up -d --wait mongodb
docker compose run --rm --no-deps backend node dist/scripts/prepare-auth.js
docker compose run --rm --no-deps backend node dist/scripts/seed-auth.js
docker compose run --rm --no-deps backend node dist/scripts/seed-catalog.js
docker compose run --rm --no-deps backend node dist/scripts/seed-ads.js
docker compose up -d --wait
docker compose ps
```

backend/.env ต้องมี JWT_SECRET ก่อน build/start การเริ่มระบบไม่แก้บัญชีเดิมหรือ migrate ให้อัตโนมัติ Frontend/API รันเป็นผู้ใช้ node และ frontend ใช้ standalone build ใน container เท่านั้น Native frontend ยังใช้ pnpm start ตามปกติ

ข้อมูล MongoDB อยู่ named volume `zonify_mongodb_data` ใช้ `docker compose stop` / `docker compose start --wait` สำหรับหยุด/เปิด หรือ `docker compose down` เพื่อหยุดและถอด container/network โดยเก็บ volume **อย่าใช้ down -v หากต้องการเก็บข้อมูล** ตรวจ logs ด้วย `docker compose logs --tail 100 backend frontend`

ทดสอบพอร์ตแยกได้ด้วย environment FRONTEND_PORT=3300, BACKEND_PORT=4400, MONGO_PORT=27717, APP_ORIGIN=http://localhost:3300 และ `docker compose -p zonify-qa ...` ค่า default ยังคง 3000/4000/27017 อย่าใช้ project QA กับข้อมูลจริง

## HTTPS ในเครื่อง

เป็นทางเลือกสำหรับ production frontend ที่พอร์ต 3000 ใช้ certificate สำหรับ localhost ของตนเอง ไม่ต้อง deploy และไม่เพิ่ม certificate ลงระบบ trust อัตโนมัติ Certificate/key ให้เก็บใน .data/tls หรือที่เก็บส่วนตัว

ตัวอย่างสร้าง certificate ทดสอบด้วย OpenSSL:

```powershell
New-Item -ItemType Directory -Path .data/tls -Force | Out-Null
openssl req -x509 -newkey rsa:2048 -nodes -keyout .data/tls/localhost-key.pem -out .data/tls/localhost-cert.pem -days 30 -subj '/CN=localhost' -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1'
```

ตั้ง APP_ORIGIN=https://localhost:3443 ใน backend/.env แล้ว restart backend ตั้งค่าต่อไปนี้ใน terminal สำหรับ proxy:

```powershell
$env:TLS_CERT='D:/zonify/.data/tls/localhost-cert.pem'
$env:TLS_KEY='D:/zonify/.data/tls/localhost-key.pem'
node scripts/local-https.mjs
```

เปิด https://localhost:3443 เบราว์เซอร์จะเตือน certificate ที่ลงนามเองตามปกติ ตรวจว่ากำลังเปิด localhost ของตนเอง Cookie เป็น Secure เมื่อ APP_ORIGIN เป็น HTTPS และคำขอเปลี่ยนข้อมูลต้องมาจาก origin นี้ เมื่อกลับ HTTP ให้คืน APP_ORIGIN=http://localhost:3000 restart backend และล็อกอินใหม่ proxy นี้รองรับ production preview ไม่ใช่บริการ hosting สาธารณะหรือ dev HMR

## สำรองและกู้คืน

CLI ใช้ mongodump/mongorestore archive gzip มาตรฐาน พร้อม manifest ของเอกสารและ index อ้างอิง [เอกสาร mongodump](https://www.mongodb.com/docs/database-tools/mongodump/) และ [mongorestore](https://www.mongodb.com/docs/database-tools/mongorestore/) ติดตั้ง Database Tools ใน PATH หรือกำหนด MONGODUMP_PATH/MONGORESTORE_PATH ใน backend/.env ไฟล์ที่แตกไว้ใน .data/tools/mongodb-database-tools-*/bin ถูกค้นหาอัตโนมัติ

1. หยุด **ทุก API/worker/seed และโปรแกรมอื่นที่เขียน DB** ก่อนสำรอง/กู้คืน โดย MongoDB ยังเปิดอยู่ สำหรับ Docker ใช้ `docker compose stop frontend backend` สำหรับ native ใช้ Ctrl+C ที่ Node servers ข้อมูล standalone ไม่มี snapshot ข้าม collection ระหว่างรับงาน จึงต้องมีช่วงหยุดบริการ
2. รันจาก backend ตั้ง MONGO_URI เป็น local DB ที่ต้องการสำรอง สำหรับ Docker host ใช้ mongodb://127.0.0.1:27017/zonify ตามพอร์ตที่ publish หากใช้พอร์ต API อื่น ตั้ง BACKUP_API_URL ให้ตรงด้วย CLI ไม่ยอมทำงานเมื่อ health URL ยังตอบกลับ หรือไม่ได้ส่ง --maintenance การยืนยันนี้ไม่แทนการหยุดโปรแกรมเขียน DB อื่น

```powershell
cd D:\zonify\backend
pnpm db:backup --out ../.data/backups/backup-20261012-01 --maintenance
pnpm db:restore --from ../.data/backups/backup-20261012-01 --database zonify_restore_20261012_01 --maintenance
```

3. Backup ต้องใช้โฟลเดอร์ใหม่เท่านั้น ประกอบด้วย database.archive.gz และ manifest.json ตรวจ archive checksum และข้อมูล/index ก่อน/หลังสำรอง หากผิดพลาดจะไม่สร้าง completion manifest ให้ใช้ backup ที่สำเร็จเท่านั้น
4. Restore ต้องเป็นฐานข้อมูลชื่อใหม่ `zonify_restore_*` ที่ไม่มี collection อยู่ ปฏิเสธฐานข้อมูลต้นฉบับและไม่ใช้ --drop ตรวจ checksum ก่อนเขียน หลัง restore ตรวจจำนวนเอกสาร hash ของ BSON และ index หากล้มเหลวเก็บฐานข้อมูลที่คืนได้บางส่วนไว้สำหรับตรวจ ไม่ใช้ฐานนั้นเปิดบริการ และใช้ชื่อใหม่เมื่อทดลองอีกครั้ง
5. Session ถูกเว้นจาก backup/restore ทุกบัญชีต้องล็อกอินใหม่ ข้อมูลบัญชี/password hash ตลาด ร้าน ข่าว การจอง การรับ/คืนเงิน และภาพสลิปส่วนตัวถูกเก็บครบ ไฟล์ backup ไม่เข้ารหัสและมีข้อมูลส่วนบุคคล ให้เก็บในพื้นที่ที่จำกัดสิทธิ์และสำรองนอกดิสก์เครื่องนี้ตามนโยบายของผู้ดูแล
6. ตรวจฐานที่ restore ในช่วงหยุดบริการก่อนเปลี่ยน MONGO_URI ไปชื่อใหม่ แล้วรัน migrate:auth และเริ่ม API/frontend ล็อกอิน ตรวจผัง รายการและภาพสลิป โดยเก็บฐานเดิมไว้สำหรับย้อนกลับ สำหรับ root Docker compose แก้ค่า MONGO_URI ใน environment ของบริการ backend ให้ใช้ชื่อใหม่ภายใน mongodb หลังตรวจแล้ว

CLI นี้รองรับ MongoDB ในเครื่องแบบไม่มี credentials ตามขอบเขตส่งมอบ ไม่รองรับ Atlas/sharding/online point-in-time restore โดยอัตโนมัติ

## รันทดสอบซ้ำ

```powershell
pnpm --dir backend build
pnpm --dir backend test
pnpm --dir frontend lint
pnpm --dir frontend build
```

API tests ใช้ MongoMemoryServer แยกจาก zonify และ backup tests ต้องมี Database Tools ชุดทดสอบไม่ใช้ข้อมูลจริง Test binary MongoDB ดาวน์โหลดครั้งแรกหรือใช้ cache ได้

Browser plugin ไม่มีในสภาพแวดล้อมส่งมอบ จึงใช้ Playwright/Chrome มี runner `scripts/browser-qa.mjs` เก็บภาพ/CSV ใน .data/browser-qa โดยเริ่ม DB ทดสอบเอง หยุด backend จริงที่ :4000 ก่อน แต่เปิด frontend production ที่ :3000 ไว้ ติดตั้ง Playwright ไว้ในพื้นที่ที่ Git ignore:

```powershell
cd D:\zonify
npm install --prefix .data/browser-tools playwright
$env:QA_PLAYWRIGHT_MODULE='D:/zonify/.data/browser-tools/node_modules/playwright/index.mjs'
$env:QA_CHROME_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/browser-qa.mjs
```

ทดสอบ HTTPS เพิ่ม `$env:QA_TLS='1'`, TLS_CERT และ TLS_KEY ตามตัวอย่างด้านบน runner เปิด/หยุด proxy ของตัวเอง ไม่ต้องเปิด proxy แยก และไม่แก้ .env ถาวร เมื่อจบล้าง environment QA_TLS ใน terminal ด้วย `Remove-Item Env:QA_TLS` ก่อนรัน HTTP ใหม่ แล้วเปิด backend จริงกลับ ผลที่ทำจริงดู docs/TESTING.md

## การดูแลประจำวัน

- ตรวจสลิปที่รอตรวจ ไม่อนุมัติจากภาพอย่างเดียว ตรวจบัญชีธนาคารจริงก่อน
- ตรวจรายการรอคืนเงิน บันทึกเมื่อโอนคืนจริงแล้ว ไม่ลบประวัติการเงิน
- ข่าวที่หมดช่วงแสดงหายจากหน้าแรกเอง แต่เอกสารยังอยู่
- สำรองก่อน migration/อัปเดต และทดสอบ restore เป็นฐานใหม่เป็นระยะ
- ไม่เปิดสิทธิ์ manager/owner ผ่านหน้าสมัครสมาชิก หรือแก้บทบาทผ่าน API ใช้ seed สำหรับบัญชีตัวอย่าง ส่วนบัญชีเดิมให้ผู้ดูแลจัดการตามกระบวนการที่อนุมัติ
- จำกัดความถี่ผ่าน Next proxy ใช้งบ IP ร่วมในเครื่องนี้ หากถึงขีดจำกัดให้รอ ไม่ลด limiter เพื่อแก้ปัญหาล็อกอิน

ระบบไม่มี email verification, ลืมรหัสผ่าน, social login, ตรวจธนาคาร/คืนเงินอัตโนมัติ หรือบริการ deploy ภายนอก
