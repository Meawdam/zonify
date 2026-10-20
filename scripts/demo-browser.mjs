// Real API demo verification. Requires the isolated start-demo.mjs profile.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.QA_PLAYWRIGHT_MODULE)).href : 'playwright');
const base = 'http://127.0.0.1:3001', origin = base;
const output = resolve(process.env.QA_OUTPUT ?? resolve(tmpdir(), 'zonify-prototype-qa')); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], warnings = [], checks = [];
const startWidth = Number(process.env.QA_VIEWPORT_WIDTH ?? 1440);
const today = offset => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + offset * 86400000));
const password = 'ZonifyDemo2026!';
const observe = page => { page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); }); };
async function login(page, email) {
  await page.goto(base + '/login'); await page.getByLabel('อีเมล', { exact: true }).fill(email); await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click(); await page.waitForURL(base + '/');
}
try {
  const buyer = await browser.newContext({ viewport: { width: startWidth, height: 960 }, reducedMotion: 'reduce' });
  const manager = await browser.newContext({ viewport: { width: startWidth, height: 960 }, reducedMotion: 'reduce' });
  const page = await buyer.newPage(), admin = await manager.newPage(); observe(page); observe(admin);
  await page.goto(base + '/demo'); await page.getByRole('heading', { name: 'ทดลองใช้ Zonify', exact: true }).waitFor();
  await page.goto(base); await page.getByRole('link', { name: 'จองพื้นที่ขายของ', exact: true }).waitFor();
  assert.equal(await page.title(), 'Zonify — จองล็อกตลาดนัด เห็นผังจริงก่อนเลือก');
  await page.evaluate(() => document.fonts.ready); assert(await page.evaluate(() => document.fonts.check('16px "' + getComputedStyle(document.body).fontFamily.split(',')[0].replaceAll('"', '').trim() + '"')));
  await page.screenshot({ path: resolve(output, 'home-start-' + startWidth + '.png'), caret: 'initial' });
  const email = 'prototype-' + Date.now() + '@demo.zonify.test';
  await page.goto(base + '/register');
  await page.getByLabel('ชื่อ', { exact: true }).fill('ผู้เช่าทดลอง'); await page.getByLabel('อีเมล', { exact: true }).fill(email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill(password); await page.getByLabel('ยืนยันรหัสผ่าน', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click(); await page.waitForURL(/\/login/);
  await login(page, email); await page.reload(); await page.goto(base + '/merchant?market=canal');
  await page.getByRole('button', { name: 'เพิ่มร้านใหม่', exact: true }).click();
  const shopName = 'ร้าน Prototype ' + Date.now(); await page.getByLabel('ชื่อร้าน', { exact: true }).fill(shopName);
  await page.locator('#merchant-market').selectOption('canal');
  await page.locator('#merchant-category option').nth(1).waitFor({ state: 'attached' });
  await page.locator('#merchant-category').selectOption(await page.locator('#merchant-category option').nth(1).getAttribute('value'));
  await page.getByRole('button', { name: 'บันทึกข้อมูลร้าน', exact: true }).click(); await page.getByText('บันทึกข้อมูลร้านแล้ว', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'ปิดแบบฟอร์ม', exact: true }).click();
  const shop = (await (await buyer.request.get(base + '/api/merchant/shops')).json()).items.find(s => s.name === shopName); assert(shop);
  const date = today(2);
  const floor = await (await buyer.request.get(base + '/api/markets/canal/floor-plan?date=' + date)).json();
  const stall = floor.stalls.find(s => s.status === 'available'); assert(stall);
  await page.goto(base + '/?' + new URLSearchParams({ market: 'canal', date, stall: stall.id }) + '#floor-plan');
  await page.locator('select[id^="booking-shop-"]').selectOption(shop.id); await page.getByRole('button', { name: 'พักล็อกนี้ 10 นาที', exact: true }).click(); await page.waitForURL(/\/bookings\//);
  const bookingId = new URL(page.url()).pathname.split('/').at(-1); await page.locator('.booking-status.held').waitFor();
  await page.reload(); await page.getByRole('button', { name: 'ดำเนินการชำระเงิน', exact: true }).click(); await page.locator('.booking-status.pending_payment').waitFor();
  checks.push('registration, login, refresh, shop creation, hold, confirm');
  async function sendDemo() {
    await page.getByRole('button', { name: 'แสดง QR ชำระเงิน', exact: true }).click();
    await page.getByText('QR นี้เป็นข้อมูลจำลองสำหรับสาธิต ไม่ใช้ชำระเงินผ่านธนาคาร', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'สร้างและส่งสลิปจำลอง', exact: true }).click(); await page.locator('.booking-status.payment_review').waitFor();
  }
  await sendDemo();
  await login(admin, 'manager@demo.zonify.test'); await admin.goto(base + '/admin');
  await admin.getByRole('heading', { name: 'งานที่ต้องดำเนินการ', exact: true }).waitFor();
  checks.push('admin defaults to queue');
  await admin.goto(base + '/admin?section=payments'); let card = admin.locator('#booking-' + bookingId);
  await card.getByRole('button', { name: 'ตรวจรับ / ปฏิเสธสลิป', exact: true }).click();
  await card.getByLabel('เหตุผลที่สลิปไม่ผ่าน', { exact: true }).fill('หลักฐานจำลองไม่ชัด');
  await card.getByRole('button', { name: 'ปฏิเสธสลิป ให้แก้ไข', exact: true }).click();
  await page.reload(); await page.locator('.booking-status.pending_payment').waitFor(); await sendDemo();
  await admin.reload(); card = admin.locator('#booking-' + bookingId);
  await card.getByRole('button', { name: 'ตรวจรับ / ปฏิเสธสลิป', exact: true }).click();
  assert((await card.getByLabel('เลขอ้างอิงหลักฐานจำลอง', { exact: true }).inputValue()).startsWith('DEMO-'));
  await card.getByLabel('ตรวจข้อมูลจำลองแล้ว', { exact: true }).check(); await card.getByRole('button', { name: 'ยืนยันรับชำระเงิน', exact: true }).click();
  await page.reload(); await page.locator('.booking-status.confirmed').waitFor();
  checks.push('non-bank QR, demo slip, rejection, resubmit, manager approval, confirmed status');
  const published = await (await buyer.request.get(base + `/api/shops/${shop.id}?date=${date}`)).json(); assert(published.locations.some(s => s.id === stall.id));
  const rival = await browser.newContext(); const auth = await rival.request.post(base + '/api/users/login', { headers: { Origin: origin }, data: { email: 'customer@demo.zonify.test', password } }); assert.equal(auth.status(), 200);
  const taken = await rival.request.post(base + '/api/bookings/holds', { headers: { Origin: origin }, data: { stallId: stall.id, date, shopId: 'demo-merchant-shop' } }); assert.equal(taken.status(), 409);
  checks.push('confirmed shop location and competing hold rejected');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 960 }); await page.goto(base + '/bookings/' + bookingId); await page.locator('.booking-status.confirmed').waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'booking overflow ' + width);
    await page.screenshot({ path: resolve(output, 'booking-' + width + '.png'), fullPage: true, caret: 'initial' });
    await admin.setViewportSize({ width, height: 960 }); await admin.goto(base + '/admin'); await admin.getByRole('heading', { name: 'งานที่ต้องดำเนินการ', exact: true }).waitFor();
    assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'admin overflow ' + width);
    await admin.screenshot({ path: resolve(output, 'admin-' + width + '.png'), fullPage: true, caret: 'initial' });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base); await page.getByRole('button', { name: 'เปิดเมนู', exact: true }).click();
  assert(await page.locator('#main-nav').isVisible()); await page.getByRole('link', { name: 'ดูผังล็อก', exact: true }).click();
  checks.push('desktop/mobile no overflow, mobile navigation');
  await page.goto(base + '/merchant?market=canal'); await page.getByRole('button', { name: 'เพิ่มร้านใหม่', exact: true }).click();
  const unsavedName = 'ข้อมูลต้องคงอยู่เมื่อ timeout'; await page.getByLabel('ชื่อร้าน', { exact: true }).fill(unsavedName);
  await page.locator('#merchant-market').selectOption('canal'); await page.locator('#merchant-category option').nth(1).waitFor({ state: 'attached' });
  await page.locator('#merchant-category').selectOption(await page.locator('#merchant-category option').nth(1).getAttribute('value'));
  const intercepted = [];
  await page.route('**/api/merchant/shops', route => { if (route.request().method() === 'POST') intercepted.push(route); else return route.continue(); });
  await page.getByRole('button', { name: 'บันทึกข้อมูลร้าน', exact: true }).click();
  await page.getByText('ใช้เวลานานเกินไป ยังไม่ทราบผลรายการ กรุณาโหลดข้อมูลล่าสุดก่อนส่งซ้ำ', { exact: true }).waitFor({ timeout: 25000 });
  assert.equal(await page.getByLabel('ชื่อร้าน', { exact: true }).inputValue(), unsavedName);
  assert(await page.getByRole('button', { name: 'บันทึกข้อมูลร้าน', exact: true }).isEnabled()); assert.equal(intercepted.length, 1);
  await page.screenshot({ path: resolve(output, 'timeout-preserved.png'), fullPage: true, caret: 'initial' });
  for (const route of intercepted) await route.abort().catch(() => {});
  await page.unroute('**/api/merchant/shops');
  checks.push('stalled write times out, form remains intact, controls recover, no automatic retry');
  // Chrome can report unused Next dev CSS preloads after route changes. Keep
  // these in the evidence, while still failing on application warnings/errors.
  const frameworkPreloads = warnings.filter(w => w.includes('/_next/static/chunks/') && w.includes('.css was preloaded') && w.includes('but not used within'));
  const applicationWarnings = warnings.filter(w => !frameworkPreloads.includes(w));
  assert.deepEqual(errors, []); assert.deepEqual(applicationWarnings, []);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, checks, errors, warnings, bookingId, output }, null, 2));
  console.log('Prototype browser QA passed: ' + output);
} finally { await browser.close(); }
