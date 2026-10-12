# Zonify — จองล็อกตลาดนัด เห็นผังจริงก่อนเลือก

เว็บสำหรับสำรวจตลาดนัด ค้นหาร้านค้า และจองพื้นที่ขายรายวัน ดูตำแหน่ง ขนาด ราคา และสถานะล็อกบนผังก่อนจอง พร้อมระบบจัดการตลาด การจอง และหลักฐานชำระเงินสำหรับผู้ดูแล

## ฟีเจอร์และบทบาทผู้ใช้

- **สำรวจตลาดและร้านค้า:** เลือกตลาด/วันที่ ดูผัง ซูมและเลื่อน ค้นหาร้านตามชื่อ สินค้า หรือหมวดหมู่
- **จองพื้นที่รายวัน:** พักล็อก 10 นาที ยืนยันการจอง และชำระภายใน 30 นาที
- **ชำระเงิน:** แสดง PromptPay QR ส่งสลิป และติดตามผลตรวจหรือสถานะคืนเงิน
- **จัดการตลาด:** ดูแลตลาด โซน ล็อก ร้านค้า ข่าว ผู้ใช้ และรายการจอง พร้อม Dashboard และส่งออก CSV

| บทบาท | การใช้งาน |
| --- | --- |
| ลูกค้า (`customer`) | จองพื้นที่ ชำระเงิน และดูรายการจองของตนเอง |
| ผู้จัดการ (`manager`) | เข้า `/admin` จัดการข้อมูลตลาด การจอง และตรวจชำระเงิน |
| เจ้าของ (`owner`) | ใช้งานส่วนจัดการ รวมถึงรายงานรายรับและการลบบัญชีผู้ใช้อื่น |

## เทคโนโลยีและโครงสร้าง

**Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Express 5 · MongoDB 8 / Mongoose**

หน้าเว็บส่งคำขอ `/api/*` ผ่าน Next.js proxy ไปยัง Express ซึ่งตรวจ session และสิทธิ์ก่อนเข้าถึงข้อมูลใน MongoDB

```text
frontend/     หน้าเว็บ Components และตัวเรียก API
backend/      API, Models, Migration, Seed และ Tests
docs/         คู่มือใช้งาน ติดตั้ง ผลทดสอบ และ UAT
scripts/      เครื่องมือ MongoDB, HTTPS และ Browser QA
.archify/     แผนภาพระบบแบบโต้ตอบ
compose.yml   Docker ทั้งระบบ: Frontend, Backend และ MongoDB
```

ดู [แผนภาพระบบแบบโต้ตอบ](.archify/architecture-zonify-20261012-110745/zonify-overview.html) (บน GitHub ให้ดาวน์โหลด HTML แล้วเปิดในเบราว์เซอร์)

## เริ่มใช้งานในเครื่อง

เตรียม **Node.js 22 ขึ้นไป, pnpm 11.21.0 และ Docker Desktop** แล้วเปิด Docker Desktop ก่อนเริ่ม ขั้นตอนนี้ใช้ dev server สำหรับ frontend/backend และ Docker เฉพาะ MongoDB 8

คำสั่งทั้งหมดด้านล่างใช้ **PowerShell จากโฟลเดอร์หลักของโปรเจกต์** หากใช้ MongoDB 8 ที่ติดตั้งเอง ให้ข้ามคำสั่ง Docker และตรวจ `MONGO_URI` ให้ตรงกับฐานข้อมูล

### 1. ติดตั้งและคัดลอกไฟล์ตั้งค่า

```powershell
pnpm --dir backend install --frozen-lockfile
pnpm --dir frontend install --frozen-lockfile
if (!(Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
if (!(Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

คำสั่งคัดลอกจะไม่เขียนทับไฟล์ตั้งค่าที่มีอยู่

### 2. ตั้งค่า environment

ตรวจค่าใน `backend/.env`:

| ตัวแปร | ค่าสำหรับรันในเครื่อง |
| --- | --- |
| `BACKEND_PORT` | `4000` |
| `BACKEND_HOST` | `127.0.0.1` |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/zonify` |
| `APP_ORIGIN` | `http://localhost:3000` |
| `JWT_SECRET` | ค่าสุ่มอย่างน้อย 32 ตัวอักษร ต้องตั้งก่อนเปิด API |

สร้าง `JWT_SECRET` ด้วยคำสั่งนี้ แล้วนำผลลัพธ์ไปใส่ในไฟล์:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

ใน `frontend/.env.local` ใช้ `BACKEND_URL=http://localhost:4000` หากเปลี่ยนค่าให้ restart dev server หรือ build frontend ใหม่ เก็บไฟล์ environment ที่มีรหัสลับไว้ในเครื่อง ไม่เพิ่มลง Git

### 3. เปิดฐานข้อมูลและเตรียมบัญชี

**หากมีข้อมูลเดิม:** หยุด backend และสำรองฐานข้อมูลก่อนรัน migration ดู [วิธีสำรองและกู้คืน](docs/OPERATIONS.md#สำรองและกู้คืน)

```powershell
docker compose -f backend/docker-compose.yml up -d --wait mongodb
pnpm --dir backend migrate:auth
```

Migration ปรับอีเมลเป็นตัวพิมพ์เล็กและตัดช่องว่าง เติมบทบาท `customer` ให้บัญชีที่ไม่มี role และสร้าง unique email index รันซ้ำได้โดยไม่เปลี่ยนรหัสผ่าน หากพบอีเมลซ้ำหรือข้อมูลบัญชีไม่ถูกต้อง จะหยุดก่อนแก้ข้อมูล ให้แก้รายการที่รายงานแล้วรันใหม่ API จะไม่เริ่มหากข้อมูลบัญชียังต้อง migrate

### 4. เพิ่มข้อมูลตัวอย่าง (ทางเลือก)

หากต้องการทดลองครบทุกบทบาท ให้ตั้งรหัสผ่านใน `backend/.env` ก่อนรัน seed โดยแต่ละรหัสผ่านต้องยาว **8–72 UTF-8 ไบต์**:

| บัญชีเริ่มต้น | ตัวแปรรหัสผ่าน |
| --- | --- |
| `customer@zonify.test` | `SEED_CUSTOMER_PASSWORD` |
| `manager@zonify.test` | `SEED_MANAGER_PASSWORD` |
| `owner@zonify.test` | `SEED_OWNER_PASSWORD` |

เปลี่ยนอีเมลได้ด้วย `SEED_CUSTOMER_EMAIL`, `SEED_MANAGER_EMAIL` และ `SEED_OWNER_EMAIL` โดยทั้งสามบัญชีต้องใช้อีเมลต่างกัน

```powershell
pnpm --dir backend seed:auth
pnpm --dir backend seed:catalog
pnpm --dir backend seed:ads
```

รัน seed ก่อนเปิด API ข้อมูลตลาด ร้านค้า และข่าวเป็นข้อมูลสมมติสำหรับทดลอง คำสั่ง seed ข้ามข้อมูลที่มีอยู่ ไม่เขียนทับบัญชีเดิม หากข้ามขั้นตอนนี้สามารถสมัครบัญชีลูกค้าผ่านเว็บได้ แต่ฐานข้อมูลใหม่จะยังไม่มีข้อมูลตลาดหรือบัญชีผู้จัดการ/เจ้าของ

### 5. เปิด Backend และ Frontend

Terminal แรก:

```powershell
pnpm --dir backend dev
```

เปิด terminal อีกหน้าต่างที่โฟลเดอร์หลักของโปรเจกต์:

```powershell
pnpm --dir frontend dev
```

- [หน้าเว็บ](http://localhost:3000)
- [ตรวจความพร้อม API](http://localhost:4000/health)
- [เอกสาร API / Swagger](http://localhost:4000/api-docs)

เปิดเว็บด้วย `localhost` ให้ตรงกับ `APP_ORIGIN` ไม่สลับเป็น `127.0.0.1` คำขอที่เปลี่ยนข้อมูลต้องส่ง `Origin` ให้ตรงกัน รวมถึงการเรียกผ่าน Postman/curl

### ตั้งค่า PromptPay (ทางเลือก)

กำหนด `PROMPTPAY_ID` และ `PROMPTPAY_NAME` ใน `backend/.env` แล้ว restart backend ใช้หมายเลขมือถือไทย 10 หลักขึ้นต้นด้วย 0 หรือเลขประชาชน/ภาษี 13 หลักที่ผูกพร้อมเพย์ และชื่อบัญชีผู้รับจริง หากเว้นว่างระบบจะไม่สร้าง QR

ผู้ดูแลต้องตรวจบัญชีและ QR กับแอปธนาคารก่อนรับเงินจริง ระบบรับภาพสลิปเพื่อให้ผู้จัดการตรวจเงินเข้าและอนุมัติเอง การคืนเงินต้องโอนจริงก่อนบันทึกผลในระบบ ไม่มีการตรวจธนาคารหรือโอนคืนอัตโนมัติ ดู [คู่มือผู้จัดการ/เจ้าของ](docs/ADMIN-GUIDE.md)

## ทดสอบและ Build

รันจากโฟลเดอร์หลักของโปรเจกต์:

```powershell
pnpm --dir backend test
pnpm --dir backend build
pnpm --dir frontend lint
pnpm --dir frontend build
```

API tests ใช้ MongoDB ชั่วคราวแยกจากฐานข้อมูลของผู้ใช้ ไม่ต้องเปิด Docker และอาจดาวน์โหลด MongoDB binary เมื่อรันครั้งแรก ส่วนการทดสอบ backup ต้องมี MongoDB Database Tools (`mongodump` และ `mongorestore`) ดู [การเตรียมและรันทดสอบ](docs/OPERATIONS.md#รันทดสอบซ้ำ) และ [บันทึกผลทดสอบ](docs/TESTING.md)

## คู่มือเพิ่มเติม

| เอกสาร | เนื้อหา |
| --- | --- |
| [ติดตั้งและดูแลระบบ](docs/OPERATIONS.md) | Native MongoDB, Production build, HTTPS และการดูแลประจำวัน |
| [Docker ทั้งระบบ](docs/OPERATIONS.md#docker-ทั้งระบบ) | รัน Frontend, Backend และ MongoDB ด้วย Compose |
| [สำรองและกู้คืน](docs/OPERATIONS.md#สำรองและกู้คืน) | เตรียม Database Tools และสำรอง/กู้คืนข้อมูล |
| [คู่มือลูกค้า](docs/USER-GUIDE.md) | สำรวจตลาด จองล็อก ชำระเงิน และติดตามรายการ |
| [คู่มือผู้จัดการ/เจ้าของ](docs/ADMIN-GUIDE.md) | จัดการข้อมูล ตรวจสลิป Dashboard และรายงาน |
| [ผลทดสอบ](docs/TESTING.md) | บันทึกการตรวจ API, Browser, Docker และข้อมูลถาวร |
| [แบบรับงาน UAT](docs/UAT.md) | รายการทดลองใช้งานและการรับรองโดยผู้ใช้ |

ระบบจัดเตรียมสำหรับรันในเครื่อง การตรวจบัญชีรับเงินจริงและการลงนาม UAT เป็นขั้นตอนของผู้ดูแลและผู้ใช้
