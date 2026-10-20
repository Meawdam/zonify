const base = 'http://127.0.0.1:4001';
const login = await fetch(base + '/api/users/login', { method: 'POST', headers: { Origin: 'http://127.0.0.1:3001', 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@demo.zonify.test', password: 'ZonifyDemo2026!' }), signal: AbortSignal.timeout(10000) });
if (!login.ok) throw new Error('Cannot sign in to the local demo. Start node scripts/start-demo.mjs first.');
const cookie = login.headers.get('set-cookie')?.split(';')[0];
const result = await fetch(base + '/api/demo/reset', { method: 'POST', headers: { Origin: 'http://127.0.0.1:3001', Cookie: cookie }, signal: AbortSignal.timeout(30000) });
if (!result.ok) throw new Error('Demo reset failed: ' + result.status);
console.log((await result.json()).message);
