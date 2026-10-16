import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.QA_PLAYWRIGHT_MODULE)).href : 'playwright');
const base = process.env.QA_BASE ?? 'http://localhost:3100', before = process.argv.includes('--before');
const output = resolve('.data/brownfield/review-fixes', before ? 'before' : 'after');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.QA_CHROME_PATH ? { executablePath: process.env.QA_CHROME_PATH } : { channel: 'chrome' }) });
const control = async data => { await fetch('http://127.0.0.1:4100/__qa', { method: 'POST', body: JSON.stringify(data) }); };
const errors = [], measurements = [];
try {
  await control({ bookingStatus: 200, role: 'customer' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'UTC', reducedMotion: 'reduce' });
  await context.addCookies([{ name: 'zonify_session', value: 'fixture-only', url: base }]);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource:')) errors.push(m.text()); });
  // First navigation warms the development compiler; never include compilation in the measurements.
  await page.goto(base); await page.getByRole('button', { name: 'ล็อก A1 ว่าง', exact: true }).waitFor();
  for (const cold of [true, false]) {
    const p = cold ? await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage() : page;
    await p.goto(base + '/?market=qa-market&date=2026-10-16');
    const slot = p.getByRole('button', { name: 'ล็อก A1 ว่าง', exact: true }); await slot.click();
    measurements.push({ cold, selectableMs: await p.evaluate(() => performance.now()), resources: await p.evaluate(() => performance.getEntriesByType('resource').filter(e => /\/api\//.test(e.name)).map(e => ({ name: e.name, start: e.startTime, duration: e.duration }))) });
    if (cold) await p.context().close();
  }
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await page.goto(base + '/?market=qa-market&date=2026-10-16#floor-plan');
    await page.getByRole('button', { name: 'ล็อก A1 ว่าง', exact: true }).click();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'page overflow ' + width);
    await page.screenshot({ path: resolve(output, 'floor-' + width + '.png'), fullPage: true });
  }
  if (!before) {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto(base + '/?market=qa-market&date=2026-10-16#floor-plan');
    await page.getByRole('button', { name: 'ล็อก A1 ว่าง', exact: true }).click();
    const box = await page.locator('.selection-summary').boundingBox();
    assert(box.y >= 0 && box.y + box.height <= 844, 'selected price and next action must be immediately visible on mobile');
    await page.locator('#floor-plan').screenshot({ path: resolve(output, 'floor-section-390.png'), caret: 'initial' });
  }
  await page.goto(base + '/bookings/qa-booking');
  await page.getByRole('button', { name: 'แสดง QR ชำระเงิน', exact: true }).click();
  await page.locator('[name=slip]').setInputFiles({ name: 'slip.png', mimeType: 'image/png', buffer: Buffer.from('fixture image') });
  await page.locator('[name=transferredAt]').fill('2026-10-15T14:00');
  await page.locator('[name=reference]').fill('KEEP-1234');
  await control({ bookingStatus: 503 });
  await page.waitForResponse(r => r.url().endsWith('/api/bookings/qa-booking') && r.status() === 503);
  const preserved = await page.locator('[name=reference]').count() > 0;
  await page.screenshot({ path: resolve(output, 'poll-error.png'), fullPage: true });
  if (before) { assert.equal(preserved, false, 'baseline should reproduce form loss'); console.log('REPRODUCED: background failure unmounts payment form'); }
  else {
    assert(preserved, 'poll failure removed form');
    assert.equal(await page.locator('[name=reference]').inputValue(), 'KEEP-1234');
    assert.equal(await page.locator('[name=slip]').evaluate(e => e.files[0].name), 'slip.png');
    await control({ bookingStatus: 200 }); await page.getByRole('button', { name: 'ลองโหลดอีกครั้ง', exact: true }).click();
    await page.waitForResponse(r => r.url().endsWith('/api/bookings/qa-booking') && r.status() === 200);
    assert.equal(await page.locator('[name=reference]').inputValue(), 'KEEP-1234');
    // API field errors associate the message and focus with the field, preserving other values.
    await control({ slipError: true });
    await page.getByRole('button', { name: 'ส่งสลิปให้ตรวจสอบ', exact: true }).click();
    await page.locator('[name=reference][aria-invalid=true]').waitFor();
    assert.equal(await page.locator(':focus').getAttribute('name'), 'reference');
    const described = await page.locator('[name=reference]').getAttribute('aria-describedby');
    assert(described.includes('reference-qa-booking-error'));
    assert.equal(await page.locator('[name=slip]').evaluate(e => e.files[0].name), 'slip.png');
    for (const invalid of [{ name: 'wrong.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') }, { name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }]) {
      await page.locator('[name=slip]').setInputFiles(invalid);
      await page.getByRole('button', { name: 'ส่งสลิปให้ตรวจสอบ', exact: true }).click();
      await page.locator('[name=slip][aria-invalid=true]').waitFor();
      assert.equal(await page.locator(':focus').getAttribute('name'), 'slip');
      assert((await page.locator('[name=slip]').getAttribute('aria-describedby')).includes('slip-qa-booking-error'));
      assert.equal(await page.locator('[name=reference]').inputValue(), 'KEEP-1234');
    }
    const requestLog = await (await fetch('http://127.0.0.1:4100/__qa')).json();
    assert(requestLog.requests.some(r => r.path === 'slip-body' && r.body.includes('2026-10-15T07:00:00.000Z')), 'transfer instant must be Thai time on UTC device');
    await control({ bookingStatus: 403, slipError: false });
    await page.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'ระบบขัดข้องชั่วคราว' }).waitFor();
    assert.equal(await page.locator('[name=reference]').count(), 0, '403 must remove private form');
    await control({ bookingStatus: 200 }); await page.getByRole('button', { name: 'ลองโหลดอีกครั้ง', exact: true }).click();
    await page.getByRole('button', { name: 'แสดง QR ชำระเงิน', exact: true }).waitFor();
    await control({ bookingStatus: 401 });
    await page.getByRole('button', { name: 'รีเฟรชรายการ', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'เซสชันหมดอายุ' }).waitFor();
    assert.equal(await page.locator('[name=reference]').count(), 0, '401 must remove private form');
    await control({ bookingStatus: 200 });
    await page.goto(base + '/bookings/other-booking'); await page.getByRole('alert').filter({ hasText: 'ไม่พบรายการใหม่' }).waitFor();
    assert.equal(await page.locator('.booking-reference').count(), 0, 'new booking must not render previous one');
    await control({ bookingStatus: 503 }); await page.goto(base + '/bookings/qa-booking');
    await page.getByRole('alert').filter({ hasText: 'ระบบขัดข้องชั่วคราว' }).waitFor();
    await control({ bookingStatus: 200 }); await page.getByRole('button', { name: 'ลองโหลดอีกครั้ง', exact: true }).click();
    await page.getByRole('button', { name: 'แสดง QR ชำระเงิน', exact: true }).waitFor();
    // URL state survives reload, native Back/Forward, and detail/return navigation.
    await page.goto(base + '/?market=qa-market&date=2026-10-16#shops');
    await page.getByRole('searchbox').fill('กาแฟ'); await page.getByRole('button', { name: 'ค้นหาร้าน', exact: true }).click();
    await page.getByLabel('กรองร้านตามหมวดหมู่').selectOption('qa-category');
    await page.getByRole('button', { name: 'ถัดไป', exact: true }).click();
    await page.waitForResponse(r => r.url().includes('/api/shops?') && r.url().includes('page=2'));
    const directoryURL = page.url(); assert(directoryURL.includes('page=2')); assert(directoryURL.includes('market=qa-market'));
    await page.reload(); assert.equal(await page.getByRole('searchbox').inputValue(), 'กาแฟ');
    await page.getByRole('link', { name: 'ดูรายละเอียด ร้านกาแฟทดสอบ' }).click();
    await page.getByRole('link', { name: 'กลับไปรายชื่อร้านค้า', exact: true }).click();
    await page.waitForURL(directoryURL); assert.equal(await page.getByRole('searchbox').inputValue(), 'กาแฟ');
    await page.getByRole('button', { name: 'ก่อนหน้า', exact: true }).click();
    await page.waitForURL(u => u.searchParams.get('page') === '1');
    await page.goBack(); await page.waitForURL(u => u.searchParams.get('page') === '2');
    await page.goForward(); await page.waitForURL(u => u.searchParams.get('page') === '1');
    // Shared selection across map/list, supported filters, keyboard action and enlarged text.
    await page.goto(base + '/?market=qa-market&stall=qa-stall-0&date=2026-10-16#floor-plan');
    await page.getByRole('button', { name: 'ดูรายการล็อก', exact: true }).click();
    const listButton = page.getByRole('button', { name: /ล็อก A4 ว่าง/ }); await listButton.focus(); await page.keyboard.press('Enter');
    assert((await page.locator('.selection-summary').innerText()).includes('A4'));
    assert((await page.locator('.selection-summary').innerText()).includes('280'));
    await page.getByLabel('กรองล็อกตามสถานะ', { exact: true }).selectOption('available');
    await page.locator('.stall-list-filters').getByLabel('ราคาสูงสุด (บาท/วัน)', { exact: true }).fill('260');
    assert.equal(await page.locator('.stall-list-item').count(), 1);
    await page.getByLabel('กรองล็อกตามโซน', { exact: true }).selectOption('โซนอาหาร');
    assert.equal(await page.locator('.stall-list-item').count(), 1);
    await page.getByRole('button', { name: 'ดูผัง', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'ล็อก A4 ว่าง', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('link', { name: 'ดูรายละเอียดและดำเนินการต่อ', exact: true }).click();
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'รายละเอียดล็อก');
    await page.setViewportSize({ width: 360, height: 1000 });
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('body *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) if (element instanceof HTMLElement) element.style.fontSize = size * 2 + 'px';
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'overflow at 200% text');
    await page.screenshot({ path: resolve(output, 'floor-text-200.png'), fullPage: true });
    // Admin sections, reload/history, and dirty editor cancellation.
    await control({ role: 'manager' });
    await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(base + '/admin?section=payments');
    await page.getByRole('heading', { name: 'จัดการรายการจอง', exact: true }).waitFor();
    assert.equal(await page.locator('#booking-status').inputValue(), 'payment_review');
    await page.reload(); assert.equal(await page.locator('#booking-status').inputValue(), 'payment_review');
    await page.getByRole('button', { name: 'ตลาด', exact: true }).click();
    await page.getByRole('button', { name: 'เพิ่มตลาด', exact: true }).click();
    await page.locator('#admin-markets-name').fill('ยังไม่บันทึก');
    page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'ผู้ใช้', exact: true }).click();
    assert.equal(await page.locator('#admin-markets-name').inputValue(), 'ยังไม่บันทึก');
    page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'ปิดแบบฟอร์ม', exact: true }).click();
    assert.equal(await page.locator('#admin-markets-name').inputValue(), 'ยังไม่บันทึก');
    await page.goBack();
    assert.equal(await page.locator('#admin-markets-name').inputValue(), 'ยังไม่บันทึก', 'Back must retain dirty editor');
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'ปิดแบบฟอร์ม', exact: true }).click();
    await page.getByRole('heading', { name: 'จัดการรายการจอง', exact: true }).waitFor();
    await page.goto(base + '/admin?section=invalid&page=-4');
    await page.getByRole('button', { name: 'เพิ่มตลาด', exact: true }).waitFor();
    // Explicit session invalidation removes data in already open tabs.
    await page.evaluate(() => window.dispatchEvent(new Event('zonify-session')));
    await page.getByRole('status').filter({ hasText: 'บัญชีมีการเปลี่ยนแปลง' }).waitFor();
  }
  await control({ bookingStatus: 200 });
  await writeFile(resolve(output, 'metrics.json'), JSON.stringify({ measurements, errors }, null, 2));
  console.log(JSON.stringify({ before, measurements, errors }, null, 2));
  assert.deepEqual(errors, []);
} finally { await control({ bookingStatus: 200 }); await browser.close(); }
