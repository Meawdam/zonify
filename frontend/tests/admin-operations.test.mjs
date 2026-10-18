import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSection, bookingRefundFilter } from '../app/lib/url-state.ts';
test('admin operational sections survive URL reload', () => {
  assert.equal(adminSection('schedule'), 'schedule');
  assert.equal(adminSection('queue'), 'queue');
});
test('refund filter only applies to manager booking lists', () => {
  assert.equal(bookingRefundFilter('pending', true, false), 'pending');
  assert.equal(bookingRefundFilter('pending', false, false), '');
  assert.equal(bookingRefundFilter('pending', true, true), '');
  for (const value of [null, '', 'refunded', 'PENDING']) assert.equal(bookingRefundFilter(value, true, false), '');
});
