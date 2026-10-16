// Run against QA_BASE (default :3000); this script owns an isolated API on QA_API_PORT (default :4000).
import { createRequire } from "node:module";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireBackend = createRequire(join(root, "backend/package.json"));
const mongoose = requireBackend("mongoose"), bcrypt = requireBackend("bcrypt");
const { MongoMemoryServer } = requireBackend("mongodb-memory-server");
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.QA_PLAYWRIGHT_MODULE)).href : "playwright");
const tls = process.env.QA_TLS === "1", base = process.env.QA_BASE ?? (tls ? "https://localhost:3443" : "http://localhost:3000");
const apiPort = Number(process.env.QA_API_PORT ?? 4000);
const output = resolve(process.env.QA_OUTPUT ?? join(root, ".data/browser-qa")); await mkdir(output, { recursive: true });
const password = " browser-qa-123 ", updatedPassword = " changed-qa-456 ";
let mongo, server, browser, proxy, stopWorker;
try {
  mongo = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongo.getUri("zonify_system_browser_test"); process.env.JWT_SECRET = randomBytes(32).toString("hex"); process.env.APP_ORIGIN = base;
  process.env.PROMPTPAY_ID = ""; process.env.PROMPTPAY_NAME = "";
  const load = path => import(pathToFileURL(join(root, "backend/dist", path)).href);
  const { default: app } = await load("app.js"); await (await load("config/database.js")).connectDatabase();
  await (await load("scripts/seed-catalog.js")).seedCatalog(); await (await load("scripts/seed-ads.js")).seedAdvertisements();
  const { UserModel } = await load("modules/users/schema/user.schema.js");
  const { SessionModel } = await load("modules/users/schema/session.schema.js");
  for (const role of ["manager", "owner"]) await UserModel.create({ name: "Browser QA " + role, email: role + "@browser.qa.test", role, password: await bcrypt.hash(password, 4) });
  server = app.listen(apiPort); await once(server, "listening"); stopWorker = (await load("modules/bookings/booking.worker.js")).startBookingExpiry();
  if (tls) {
    proxy = spawn(process.execPath, [join(root, "scripts/local-https.mjs")], { env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    await new Promise((done, reject) => { const timer = setTimeout(() => reject(new Error("HTTPS proxy startup timed out")), 10000); proxy.stdout.once("data", () => { clearTimeout(timer); done(); }); proxy.once("exit", () => { clearTimeout(timer); reject(new Error("HTTPS proxy failed; check TLS_CERT/TLS_KEY and :3443")); }); });
  }
  browser = await chromium.launch({ headless: true, ...(process.env.QA_CHROME_PATH ? { executablePath: process.env.QA_CHROME_PATH } : {}) });
  const errors = [];
  const context = await browser.newContext({ ignoreHTTPSErrors: tls, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message)); page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
  async function login(p, email, pass = password) {
    await p.goto(base + "/login"); await p.getByLabel("อีเมล", { exact: true }).fill(email); await p.getByLabel("รหัสผ่าน", { exact: true }).fill(pass); await p.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click(); await p.waitForURL(base + "/"); await p.goto(base + "/profile");
  }
  const email = "customer@browser.qa.test";
  await page.goto(base + "/register"); await page.getByLabel("ชื่อ", { exact: true }).fill("ลูกค้าทดสอบระบบ");
  await page.getByLabel("อีเมล", { exact: true }).fill(email); await page.getByLabel("รหัสผ่าน", { exact: true }).fill(password); await page.getByLabel("ยืนยันรหัสผ่าน", { exact: true }).fill(password);
  await page.getByRole("button", { name: "สมัครสมาชิก", exact: true }).click(); await page.waitForURL("**/login?notice=registered"); await login(page, email);
  const cookie = (await context.cookies(base)).find(c => c.name === "zonify_session"); assert(cookie?.httpOnly); assert.equal(cookie.secure, tls); assert.equal(cookie.sameSite, "Lax");
  assert(!await page.evaluate(() => document.cookie.includes("zonify_session")));
  await page.reload(); await page.getByLabel("ชื่อ", { exact: true }).fill("แก้ไขผ่าน HTTPS"); await page.getByLabel("ชื่อ", { exact: true }).focus(); await page.keyboard.press("Tab"); assert.equal(await page.locator(":focus").getAttribute("name"), "phone");
  await page.getByLabel("เบอร์โทร (ไม่บังคับ)").fill("0812345678"); await page.getByRole("button", { name: "บันทึกโปรไฟล์", exact: true }).click(); await page.getByRole("status").filter({ hasText: "บันทึกโปรไฟล์แล้ว" }).waitFor(); await page.reload(); assert.equal(await page.getByLabel("ชื่อ", { exact: true }).inputValue(), "แก้ไขผ่าน HTTPS");
  assert.equal((await context.request.get(base + "/api/admin/dashboard")).status(), 403);
  const wrongOrigin = await context.request.patch(base + "/api/users/me", { headers: { Origin: "https://untrusted.example", "X-Forwarded-Host": "localhost:3443" }, data: { name: "Must not save" } }); assert.equal(wrongOrigin.status(), 403);
  const second = await browser.newContext({ ignoreHTTPSErrors: tls }); const otherPage = await second.newPage(); await login(otherPage, email);
  await page.getByLabel("รหัสผ่านเดิม", { exact: true }).fill(password); await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(updatedPassword); await page.getByLabel("ยืนยันรหัสผ่านใหม่", { exact: true }).fill(updatedPassword);
  await page.getByRole("button", { name: "เปลี่ยนรหัสผ่าน", exact: true }).click(); await page.waitForURL("**/login?notice=password-changed");
  assert.equal((await second.request.get(base + "/api/users/me")).status(), 401); await second.close(); await login(page, email, updatedPassword);
  await page.setViewportSize({ width: 390, height: 844 }); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: join(output, "profile-mobile.png"), fullPage: true, caret: "initial" });
  const oldCookie = (await context.cookies(base)).find(c => c.name === "zonify_session"); await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click(); await page.waitForURL("**/login");
  assert(!(await context.cookies(base)).some(c => c.name === "zonify_session"));
  assert.equal((await context.request.get(base + "/api/users/me", { headers: { Cookie: `zonify_session=${oldCookie.value}` } })).status(), 401);
  await login(page, email, updatedPassword); await SessionModel.updateMany({}, { $set: { expiresAt: new Date(0) } }); await page.reload(); await page.waitForURL("**/login");
  for (const role of ["manager", "owner"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page, role + "@browser.qa.test"); await page.goto(base + "/admin");
    await page.getByRole("button", { name: "เพิ่มตลาด", exact: true }).click();
    await page.locator("#admin-markets-name").fill("ตลาด QA " + role); await page.locator("#admin-markets-location").fill("ข้อมูลทดสอบแยก");
    await page.getByRole("button", { name: "บันทึกข้อมูล", exact: true }).click(); await page.getByRole("status").filter({ hasText: "บันทึกข้อมูลเรียบร้อยแล้ว" }).waitFor();
    const row = page.getByRole("row").filter({ hasText: "ตลาด QA " + role }); await row.getByRole("button", { name: "แก้ไข", exact: true }).click();
    await page.locator("#admin-markets-name").fill("ตลาด QA แก้ไข " + role); await page.getByRole("button", { name: "บันทึกข้อมูล", exact: true }).click();
    await page.getByRole("row").filter({ hasText: "ตลาด QA แก้ไข " + role }).waitFor();
    await page.getByRole("button", { name: "จัดผังล็อก", exact: true }).click(); await page.getByRole("heading", { name: "จัดผังล็อก", exact: true }).waitFor();
    await page.getByRole("button", { name: "ผู้ใช้", exact: true }).click(); await page.getByRole("region", { name: "ตารางผู้ใช้", exact: true }).waitFor();
    await page.getByRole("button", { name: "Dashboard", exact: true }).click(); await page.getByRole("heading", { name: "ภาพรวมตลาด", exact: true }).waitFor();
    await page.getByRole("button", { name: "รายงาน", exact: true }).click(); await page.getByRole("link", { name: "ดาวน์โหลด CSV ของตัวกรองที่แสดง", exact: true }).waitFor();
    const download = page.waitForEvent("download"); await page.getByRole("link", { name: "ดาวน์โหลด CSV ของตัวกรองที่แสดง", exact: true }).click(); const file = await download; assert.equal(file.suggestedFilename(), "zonify-bookings.csv"); await file.saveAs(join(output, role + "-bookings.csv"));
    assert.equal((await context.request.get(base + "/api/owner/reports/revenue")).status(), role === "owner" ? 200 : 403);
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(output, role + "-report-mobile.png"), fullPage: true, caret: "initial" }); await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click(); await page.waitForURL("**/login");
  }
  await page.goto(base + "/"); await page.getByRole("heading", { name: "ข่าวจากตลาด", exact: true }).waitFor(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await page.screenshot({ path: join(output, "public-mobile.png"), fullPage: true, caret: "initial" });
  assert.deepEqual(errors, []); console.log(`PASS ${tls ? "HTTPS" : "HTTP"}: registration/login/refresh/profile/keyboard/password revocation/logout/expiry/roles/dashboard/CSV/mobile; private cookie; no browser errors or warnings`);
} finally {
  await browser?.close(); proxy?.kill(); stopWorker?.(); if (server) await new Promise(done => server.close(done)); await mongoose.disconnect(); await mongo?.stop();
}
