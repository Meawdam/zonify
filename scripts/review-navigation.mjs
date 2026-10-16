import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { chromium } = await import(process.env.QA_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.QA_PLAYWRIGHT_MODULE)).href : 'playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const base = process.env.QA_BASE ?? 'http://localhost:3100';
  await fetch('http://127.0.0.1:4100/__qa', { method: 'POST', body: JSON.stringify({ role: 'manager' }) });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: 'zonify_session', value: 'fixture-only', url: base }]);
  const page = await context.newPage();
  await page.goto(base);
  await page.getByRole('link', { name: 'จัดการตลาด', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มตลาด', exact: true }).click();
  await page.locator('#admin-markets-name').fill('KEEP-ROUTE-DRAFT');
  page.once('dialog', d => d.dismiss());
  await page.goBack({ waitUntil: 'commit', timeout: 1000 }).catch(error => { if (!/Timeout|ERR_ABORTED/.test(error.message)) throw error; });
  // A cancelled cross-route traversal must leave the original component mounted.
  await page.waitForURL(u => u.pathname === '/admin', { timeout: 4000 });
  assert.equal(await page.locator('#admin-markets-name').inputValue(), 'KEEP-ROUTE-DRAFT');
  page.once('dialog', d => d.accept()); await page.goBack();
  await page.waitForURL(u => u.pathname === '/');
  console.log('PASS: browser Back cancellation preserves editor; acceptance leaves route');
} finally { await browser.close(); }
