// Local real-API regression run. Browser plugin unavailable; uses installed Playwright.
// QA servers must use disposable data and the synthetic payment recipient only.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.QA_PLAYWRIGHT_MODULE)).href : 'playwright');
const base = process.env.QA_BASE ?? 'http://localhost:3000';
const output = resolve(process.env.QA_OUTPUT ?? resolve(tmpdir(), 'zonify-operations-qa')); await mkdir(output, { recursive: true });
const date = days => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + days * 86400000));
const errors = [], browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  async function session(role) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce' });
    const r = await ctx.request.post(base + '/api/users/login', { headers: { Origin: base }, data: { email: `${role}@preview.zonify.test`, password: 'ZonifyDemo2026!' } }); assert.equal(r.status(), 200);
    const page = await ctx.newPage(); page.on('pageerror', e => errors.push(e.message)); return { ctx, page };
  }
  const { ctx: buyer, page } = await session('customer'), { ctx: manager, page: admin } = await session('manager');
  await page.goto(base + '/merchant?market=canal'); await page.getByRole('button', { name: 'เพิ่มร้านใหม่', exact: true }).click();
  const name = 'ร้านทดสอบระบบตลาด ' + Date.now();
  await page.getByLabel('ชื่อร้าน', { exact: true }).fill(name); await page.locator('#merchant-market').selectOption('canal');
  await page.locator('#merchant-category option').nth(1).waitFor({ state: 'attached' });
  await page.locator('#merchant-category').selectOption(await page.locator('#merchant-category option').nth(1).getAttribute('value'));
  await page.getByRole('button', { name: 'บันทึกข้อมูลร้าน', exact: true }).click(); await page.getByText('บันทึกข้อมูลร้านแล้ว', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'ปิดแบบฟอร์ม', exact: true }).click();
  const shop = (await (await buyer.request.get(base + '/api/merchant/shops')).json()).items.find(s => s.name === name); assert(shop);
  const floor = await (await buyer.request.get(base + `/api/markets/canal/floor-plan?date=${date(1)}`)).json(); const stall = floor.stalls.find(s => s.status === 'available'); assert(stall);
  await page.goto(base + '/?' + new URLSearchParams({ market: 'canal', date: date(1), stall: stall.id }) + '#floor-plan');
  await page.locator('select[id^="booking-shop-"]').selectOption(shop.id); await page.getByRole('button', { name: 'พักล็อกนี้ 10 นาที', exact: true }).click(); await page.waitForURL(/\/bookings\//);
  const bookingId = new URL(page.url()).pathname.split('/').at(-1);
  // Conflicts must remain reviewable without losing the calendar draft.
  await admin.goto(base + '/admin?section=schedule&market=canal');
  const closure = admin.getByRole('group', { name: 'เพิ่มช่วงปิดล็อก', exact: true });
  await closure.getByRole('combobox').selectOption(stall.id); await closure.getByLabel('วันเริ่ม', { exact: true }).fill(date(1)); await closure.getByLabel('วันสิ้นสุด', { exact: true }).fill(date(1)); await closure.getByLabel('เหตุผล', { exact: true }).fill('ซ่อมพื้นทดสอบ');
  await closure.getByRole('button', { name: 'เพิ่มช่วงปิดล็อก', exact: true }).click();
  const conflict = admin.getByRole('alert').getByRole('link'); await conflict.waitFor(); assert.equal(await conflict.getAttribute('target'), '_blank');
  const popupPromise = admin.waitForEvent('popup'); await conflict.click(); const popup = await popupPromise; await popup.locator('#booking-' + bookingId).waitFor(); await popup.close();
  assert.equal(await closure.getByLabel('เหตุผล', { exact: true }).inputValue(), 'ซ่อมพื้นทดสอบ');
  await closure.getByLabel('วันเริ่ม', { exact: true }).fill(date(2)); await closure.getByLabel('วันสิ้นสุด', { exact: true }).fill(date(3)); await closure.getByRole('button', { name: 'เพิ่มช่วงปิดล็อก', exact: true }).click(); await admin.getByText('บันทึกเรียบร้อยแล้ว', { exact: true }).waitFor();
  const blocked = await (await buyer.request.get(base + `/api/markets/canal/floor-plan?date=${date(2)}`)).json(); assert.equal(blocked.stalls.find(s => s.id === stall.id).unavailableReason, 'ซ่อมพื้นทดสอบ');
  const exception = admin.getByRole('group', { name: 'วันเปิด / ปิดเป็นกรณีพิเศษ', exact: true });
  if (!(await exception.getByLabel('วันที่', { exact: true }).count())) await admin.getByRole('button', { name: 'เพิ่มวันยกเว้น', exact: true }).click();
  await exception.getByLabel('วันที่', { exact: true }).last().fill(date(9)); await exception.getByLabel('เหตุผล', { exact: true }).last().fill('วันหยุดพิเศษทดสอบ ' + Date.now());
  await admin.getByRole('button', { name: 'บันทึกปฏิทิน', exact: true }).focus(); await admin.keyboard.press('Enter'); await admin.getByText('บันทึกเรียบร้อยแล้ว', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'ดำเนินการชำระเงิน', exact: true }).click();
  const sharp = createRequire(resolve('backend/package.json'))('sharp');
  async function submitSlip(color, reference) {
    await page.getByRole('button', { name: 'แสดง QR ชำระเงิน', exact: true }).click();
    await page.getByText('QA ONLY - DO NOT TRANSFER', { exact: true }).waitFor();
    const bytes = await sharp({ create: { width: 100, height: 120, channels: 3, background: color } }).png().toBuffer();
    await page.getByLabel('ภาพสลิป', { exact: true }).setInputFiles({ name: 'synthetic-slip.png', mimeType: 'image/png', buffer: bytes });
    await page.getByLabel('วันและเวลาโอนตามเวลาไทย', { exact: true }).fill(new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 16));
    await page.getByLabel('เลขอ้างอิงการโอน', { exact: true }).fill(reference);
    await page.getByRole('button', { name: 'ส่งสลิปให้ตรวจสอบ', exact: true }).click(); await page.locator('.booking-status.payment_review').waitFor();
  }
  await submitSlip('#ccaa33', 'QA-FIRST-' + Date.now());
  await admin.goto(base + '/admin?section=queue'); await admin.getByRole('link', { name: /รอตรวจสลิป/ }).click();
  let card = admin.locator('#booking-' + bookingId); await card.getByRole('button', { name: 'ตรวจรับ / ปฏิเสธสลิป', exact: true }).click();
  await card.getByLabel('เหตุผลที่สลิปไม่ผ่าน', { exact: true }).fill('ภาพทดสอบไม่ชัด กรุณาส่งใหม่'); await card.getByRole('button', { name: 'ปฏิเสธสลิป ให้แก้ไข', exact: true }).click();
  // Delivery is processed by the real background worker, not a mocked endpoint.
  await page.goto(base + '/notifications');
  const rejectedNotification = page.locator('.booking-card').filter({ has: page.locator(`a[href="/bookings/${bookingId}"]`) }).filter({ hasText: 'สลิปไม่ผ่านการตรวจสอบ: ภาพทดสอบไม่ชัด กรุณาส่งใหม่' });
  await rejectedNotification.waitFor({ timeout: 45000 });
  await rejectedNotification.getByRole('button', { name: 'ทำเครื่องหมายว่าอ่านแล้ว', exact: true }).click();
  await rejectedNotification.getByRole('link', { name: 'ดูรายการจอง', exact: true }).click(); await page.locator('.booking-status.pending_payment').waitFor();
  await submitSlip('#33aacc', 'QA-SECOND-' + Date.now());
  await admin.goto(base + '/admin?section=payments'); card = admin.locator('#booking-' + bookingId); await card.getByRole('button', { name: 'ตรวจรับ / ปฏิเสธสลิป', exact: true }).click();
  await card.getByLabel('เลขอ้างอิงที่ตรวจจากธนาคาร', { exact: true }).fill('QA-VERIFIED-' + Date.now());
  await card.getByLabel('ตรวจชื่อบัญชี ยอด เวลาโอน และเงินเข้าแล้ว').check(); await card.getByRole('button', { name: 'ยืนยันรับชำระเงิน', exact: true }).click();
  await page.goto(base + '/notifications'); await page.locator('.booking-card').filter({ has: page.locator(`a[href="/bookings/${bookingId}"]`) }).filter({ hasText: 'ตรวจรับเงินแล้ว การจองของคุณได้รับการยืนยัน' }).waitFor({ timeout: 45000 });
  await page.getByRole('button', { name: 'อ่านทั้งหมดแล้ว', exact: true }).click(); await page.getByText('ยังไม่อ่าน 0 รายการ', { exact: true }).waitFor();
  const published = await (await buyer.request.get(base + `/api/shops/${shop.id}?date=${date(1)}`)).json(); assert(published.locations.some(s => s.id === stall.id));
  await page.goto(base + `/shops/${shop.id}?date=${date(1)}`); await page.getByRole('heading', { name, exact: true }).waitFor();
  // Queue links, URL persistence and responsive layouts.
  await admin.goto(base + '/admin?section=queue'); await admin.getByRole('link', { name: /รอคืนเงิน/ }).click(); await admin.locator('#booking-refund').waitFor(); assert.equal(await admin.locator('#booking-refund').inputValue(), 'pending'); await admin.reload(); assert.equal(await admin.locator('#booking-refund').inputValue(), 'pending'); await admin.goBack(); assert(new URL(admin.url()).searchParams.get('section') === 'queue');
  for (const width of [360, 390, 768, 1440]) {
    await admin.goto(base + '/admin?section=schedule&market=canal'); await admin.getByRole('heading', { name: 'ปฏิทินเปิดตลาดและปิดล็อก', exact: true }).waitFor(); await admin.setViewportSize({ width, height: 960 });
    assert(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'calendar overflow ' + width); await admin.screenshot({ path: resolve(output, `schedule-${width}.png`), fullPage: true });
    await page.goto(base + '/notifications'); await page.setViewportSize({ width, height: 960 }); await page.getByText('ยังไม่อ่าน 0 รายการ', { exact: true }).waitFor(); assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'notification overflow ' + width); await page.screenshot({ path: resolve(output, `notifications-${width}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []); await writeFile(resolve(output, 'result.json'), JSON.stringify({ passed: true, bookingId, shopId: shop.id, screenshots: output, pageErrors: errors, checks: ['shop creation', 'hold', 'calendar conflict and popup', 'closure range', 'special day', 'keyboard submit', 'payment rejection and retry', 'real worker notification', 'read one/all', 'approval', 'published location', 'queue filters reload/back', '360/390/768/1440 layouts'] }, null, 2));
  console.log('Operations browser QA passed: ' + output);
} finally { await browser.close(); }
