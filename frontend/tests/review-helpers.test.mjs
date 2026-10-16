import test from 'node:test';
import assert from 'node:assert/strict';
import { thaiTransferISO } from '../app/lib/payment-time.ts';
import { pageNumber, resourceId, adminSection, shopFilters, shopReturnHref } from '../app/lib/url-state.ts';

test('Thai transfer time identifies the same instant regardless of device timezone', () => {
  for (const zone of ['UTC', 'Asia/Bangkok', 'America/Los_Angeles']) {
    const old = process.env.TZ; process.env.TZ = zone;
    try {
      assert.equal(thaiTransferISO('2026-10-15T14:00'), '2026-10-15T07:00:00.000Z');
      assert.equal(thaiTransferISO('2026-01-01T00:15'), '2025-12-31T17:15:00.000Z');
      assert.equal(thaiTransferISO('2024-02-29T23:59'), '2024-02-29T16:59:00.000Z');
    } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old; }
  }
});
test('Thai transfer time rejects invalid calendar dates and ambiguous input', () => {
  for (const value of ['', '2026-02-29T14:00', '2026-04-31T14:00', '2026-01-01T24:00', '2026-01-01T14:60', '2026-01-01', '2026-01-01T14:00Z', '0000-01-01T14:00']) assert.equal(thaiTransferISO(value), null, value);
});
test('URL values have bounded validated fallbacks', () => {
  assert.equal(pageNumber('2'), 2);
  assert.equal(pageNumber('10000'), 10000);
  for (const value of ['0', '-1', 'NaN', '1.5', '10001', '9999999999999999999']) assert.equal(pageNumber(value), 1);
  assert.equal(resourceId('qa-market'), 'qa-market');
  assert.equal(resourceId('../../admin'), '');
  assert.equal(adminSection('payments'), 'payments');
  assert.equal(adminSection('invalid'), 'markets');
});
test('shop return links preserve independent floor context and reject external redirects', () => {
  const params = new URLSearchParams('market=qa-market&stall=qa-stall-0&date=2026-10-16&shopMarket=qa-market&q=กาแฟ&category=qa-category&page=2');
  assert.deepEqual(shopFilters(params), { market: 'qa-market', q: 'กาแฟ', category: 'qa-category', page: 2 });
  const href = shopReturnHref('/?' + params + '#shops');
  assert.equal(href, '/?' + params + '#shops');
  for (const value of ['https://evil.test/', '//evil.test/', '/admin', '/?next=https://evil.test']) assert.equal(shopReturnHref(value), '/#shops');
});
