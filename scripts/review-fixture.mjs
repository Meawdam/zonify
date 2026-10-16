// Isolated UI fixtures only. This server never opens a database or contacts a bank.
import http from 'node:http';
export const market = { id: 'qa-market', version: 0, active: true, name: 'ตลาดทดสอบ', location: 'เชียงใหม่', description: 'ข้อมูลจำลอง', photo: 'canal', landmark: 'คลอง', entrance: 'ทางเข้า', minPrice: 250 };
export const category = { id: 'qa-category', version: 0, active: true, name: 'อาหาร' };
export const stalls = Array.from({ length: 24 }, (_, i) => ({ id: 'qa-stall-' + i, version: 0, marketId: market.id, code: 'A' + (i + 1), row: 'A', rowOrder: Math.floor(i / 6), column: i % 6 + 1, width: 2, depth: 2, pricePerDay: 250 + i * 10, description: 'พื้นที่ทดสอบ', zoneId: 'qa-zone', zoneName: 'โซนอาหาร', status: i === 1 ? 'held' : i === 2 ? 'booked' : 'available', enabled: true, holdExpiresAt: null }));
export const customer = { id: 'qa-customer', name: 'ลูกค้าทดสอบ', email: 'customer@fixture.test', phone: '', role: 'customer' };
export const booking = { id: 'qa-booking', date: '2026-10-16', status: 'pending_payment', price: 250, createdAt: '2026-10-15T00:00:00Z', updatedAt: '2026-10-15T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z', cancelledAt: null, cancelReason: '', customer, stall: { id: stalls[0].id, marketId: market.id, code: 'A1', width: 2, depth: 2, marketName: market.name, zoneName: 'โซนอาหาร' }, payment: { recipient: null, paidAt: null, approvedReference: null, attempts: [], refund: null } };
export const shop = { id: 'qa-shop', name: 'ร้านกาแฟทดสอบ', description: 'กาแฟ', hours: '10:00–18:00', market: { id: market.id, name: market.name, location: market.location }, category, stall: { id: stalls[0].id, code: 'A1' } };
const state = { bookingStatus: 200, delay: 100, role: 'customer', slipError: false };
export const requests = [];
export function createFixture() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/__qa') {
      if (req.method === 'POST') { let raw = ''; for await (const chunk of req) raw += chunk; Object.assign(state, JSON.parse(raw)); }
      res.end(JSON.stringify({ state, requests })); return;
    }
    requests.push({ path: url.pathname + url.search, method: req.method, at: Date.now() });
    await new Promise(done => setTimeout(done, state.delay));
    let data;
    if (url.pathname === '/api/users/me') data = { ...customer, id: 'qa-' + state.role, role: state.role };
    else if (url.pathname === '/api/markets') data = { items: [market] };
    else if (url.pathname === '/api/categories') data = { items: [category] };
    else if (url.pathname.includes('/floor-plan')) data = { market, date: url.searchParams.get('date') ?? booking.date, updatedAt: '2026-10-16T07:00:00Z', counts: { available: 22, held: 1, booked: 1, unavailable: 0 }, stalls };
    else if (url.pathname === '/api/shops') data = { items: [shop], total: 12, page: Number(url.searchParams.get('page') ?? 1), limit: 6, pages: 2 };
    else if (url.pathname === '/api/shops/qa-shop') data = shop;
    else if (url.pathname === '/api/admin/references') data = { markets: [market], categories: [category], zones: [{ id: 'qa-zone', name: 'โซนอาหาร', marketId: market.id }], stalls, shops: [{ ...shop, marketId: market.id }] };
    else if (url.pathname.endsWith('/payment/qr')) data = { amount: 250, expiresAt: booking.expiresAt, recipient: { id: 'fixture', name: 'บัญชีจำลอง ห้ามโอนเงินจริง' }, qrDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=' };
    else if (url.pathname.endsWith('/payment/slip')) {
      let raw = ''; for await (const chunk of req) raw += chunk;
      if (state.slipError) { res.statusCode = 400; data = { message: 'ตรวจข้อมูลอีกครั้ง', errors: [{ path: ['reference'], message: 'เลขอ้างอิงไม่ถูกต้อง' }] }; }
      else data = { ...booking, status: 'payment_review' };
      requests.push({ path: 'slip-body', body: raw });
    }
    else if (url.pathname.startsWith('/api/bookings/qa-booking')) {
      res.statusCode = state.bookingStatus;
      data = state.bookingStatus === 200 ? booking : { message: state.bookingStatus === 401 ? 'เซสชันหมดอายุ' : 'ระบบขัดข้องชั่วคราว' };
    }
    else if (url.pathname === '/api/bookings/other-booking') { res.statusCode = 404; data = { message: 'ไม่พบรายการใหม่' }; }
    else if (url.pathname.includes('/bookings') || url.pathname.includes('/holds')) data = { items: [booking], total: 1, page: 1, pages: 1 };
    else if (url.pathname === '/api/advertisements') data = { items: [] };
    else if (url.pathname === '/api/users') data = [customer];
    else if (url.pathname.startsWith('/api/admin/')) data = { items: [market], total: 1, page: 1, pages: 1 };
    else { res.statusCode = 404; data = { message: 'No fixture: ' + url.pathname }; }
    res.end(JSON.stringify(data));
  });
}
if (process.argv[1]?.endsWith('review-fixture.mjs')) createFixture().listen(4100, '127.0.0.1', () => console.log('Fixture API http://127.0.0.1:4100 (no database)'));
