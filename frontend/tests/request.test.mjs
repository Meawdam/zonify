import test from 'node:test';
import assert from 'node:assert/strict';
import { requestJSON, RequestTimeoutError } from '../app/lib/request.ts';

test('deadline covers a stalled response body and never retries a write', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_url, { signal }) => {
    calls++;
    return { status: 200, json: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })) };
  };
  const keepAlive = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(requestJSON('/api/example', { method: 'POST' }, 20), e => e instanceof RequestTimeoutError && e.message.includes('ก่อนส่งซ้ำ'));
    assert.equal(calls, 1);
  } finally { clearTimeout(keepAlive); globalThis.fetch = original; }
});
test('caller cancellation stays distinct from timeout; empty responses are accepted', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal((await requestJSON('/api/example')).data, null);
    globalThis.fetch = async (_url, { signal }) => { throw signal.reason; };
    const controller = new AbortController(); controller.abort(new Error('unmounted'));
    await assert.rejects(requestJSON('/api/example', { signal: controller.signal }), /unmounted/);
  } finally { globalThis.fetch = original; }
});
