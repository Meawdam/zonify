"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../lib/auth";
import { baht, type Market } from "../lib/catalog";
import { usePublicData } from "../lib/use-public-data";
import { bookingDate, bookingTime, bookingRequest, bookingStatusLabels, floorLink, type Booking, type BookingResults, type BookingStatus } from "../lib/bookings";
import { PaymentPanel } from "./payment-panel";

function useBookingClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return now;
}
function deadline(booking: Booking, now: number | null) {
  return !!booking.expiresAt && now !== null && now >= new Date(booking.expiresAt).valueOf() && ["held", "pending_payment"].includes(booking.status);
}
function Expiry({ booking, now }: { booking: Booking; now: number | null }) {
  if (!booking.expiresAt || !["held", "pending_payment"].includes(booking.status)) return null;
  const seconds = now === null ? null : Math.max(0, Math.ceil((new Date(booking.expiresAt).valueOf() - now) / 1000));
  return <div className="booking-expiry"><span>{booking.status === "held" ? "เวลาพักล็อกที่เหลือ" : "เวลาชำระเงินที่เหลือ"}</span><strong>{seconds === null ? "กำลังคำนวณ…" : Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0")}</strong><small>ถึง {bookingTime(booking.expiresAt)}{seconds === 0 ? " • หมดเวลา กำลังอัปเดตสถานะ" : ""}</small></div>;
}
function BookingFacts({ booking }: { booking: Booking }) {
  return <dl className="booking-facts">
    <div><dt>ตลาด / ล็อก</dt><dd>{booking.stall.marketName} • {booking.stall.code}</dd></div>
    <div><dt>วันที่จอง</dt><dd>{bookingDate(booking.date)}</dd></div>
    <div><dt>ขนาดพื้นที่</dt><dd>{booking.stall.width} × {booking.stall.depth} เมตร{booking.stall.zoneName ? " • " + booking.stall.zoneName : ""}</dd></div>
    <div><dt>ค่าเช่า 1 วัน</dt><dd>{baht(booking.price)} บาท</dd></div>
  </dl>;
}
function BookingControl({ booking, manager, holdsOnly, now, refresh, onNotice }: { booking: Booking; manager: boolean; holdsOnly: boolean; now: number | null; refresh: () => void; onNotice?: (message: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [cancel, setCancel] = useState(false), [reason, setReason] = useState("");
  const router = useRouter();
  const expired = deadline(booking, now);
  async function mutate(action: "confirm" | "cancel") {
    setBusy(true); setError(""); setNotice(""); onNotice?.("");
    const path = manager ? "/admin/" + (holdsOnly ? "holds" : "bookings") + "/" + booking.id + "/" + (holdsOnly ? "release" : "cancel") : "/bookings/" + booking.id + "/" + action;
    try {
      await bookingRequest<Booking>(path, action === "confirm" ? {} : { reason });
      setCancel(false); setReason("");
      const message = action === "confirm" ? "ยืนยันรายการจองแล้ว สถานะรอชำระเงิน" : manager && holdsOnly ? "คืนล็อกแล้ว" : "ยกเลิกรายการแล้ว";
      if (onNotice) onNotice(message); else setNotice(message);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.replace("/login?notice=expired&next=" + encodeURIComponent("/bookings/" + booking.id)); return; }
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) refresh();
    } finally { setBusy(false); }
  }
  const canCancel = !expired && (manager ? ["held", "pending_payment", "confirmed"] : ["held", "pending_payment"]).includes(booking.status);
  return <div className="booking-controls">
    {error && <p className="form-alert" role="alert">{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
    <div className="booking-buttons">
      {!manager && booking.status === "held" && <button className="button button-orange" disabled={busy || expired} onClick={() => mutate("confirm")}>{busy ? "กำลังบันทึก…" : "ยืนยันการจอง"}</button>}
      {canCancel && <button className="button button-white" disabled={busy} onClick={() => { setCancel(v => !v); setNotice(""); }}>{manager && holdsOnly ? "คืนล็อก" : "ยกเลิกรายการ"}</button>}
      <Link className="text-link" href={floorLink(booking)}>ดูตำแหน่งบนผัง</Link>
    </div>
    {cancel && <form className="booking-cancel-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void mutate("cancel"); }}><label htmlFor={"cancel-" + booking.id}>{manager && holdsOnly ? "เหตุผลที่คืนล็อก" : "เหตุผลที่ยกเลิก"}</label><textarea id={"cancel-" + booking.id} value={reason} onChange={e => setReason(e.target.value)} required maxLength={500} disabled={busy}/><button className="button button-green" disabled={busy || !reason.trim()} type="submit">{busy ? "กำลังบันทึก…" : manager && holdsOnly ? "ยืนยันคืนล็อก" : "ยืนยันยกเลิก"}</button></form>}
    {manager && booking.status === "confirmed" && <p className="form-description">หากยกเลิกรายการที่รับเงินแล้ว ระบบจะบันทึกว่ารอคืนเงิน ต้องโอนคืนและบันทึกเลขอ้างอิงแยก</p>}
  </div>;
}
export function BookingDetail({ id }: { id: string }) {
  const result = usePublicData<Booking>("/api/bookings/" + encodeURIComponent(id), 5000, true), now = useBookingClock();
  if (result.loading && !result.data) return <p className="catalog-state" role="status">กำลังโหลดรายการจอง…</p>;
  if (result.error) return <p className="catalog-state" role="alert">{result.error} <button className="text-link" onClick={result.retry}>ลองโหลดอีกครั้ง</button> <Link className="text-link" href="/bookings">กลับรายการของฉัน</Link></p>;
  if (!result.data) return null;
  const booking = result.data;
  return <article className="booking-card">
    <div className="booking-card-heading"><h2>ล็อก {booking.stall.code}</h2><span className={"booking-status " + booking.status}>{bookingStatusLabels[booking.status]}</span></div>
    <p className="booking-reference">รหัสรายการ {booking.id}</p><BookingFacts booking={booking}/><Expiry booking={booking} now={now}/>
    {booking.cancelReason && <p className="form-description">เหตุผลที่ยกเลิก: {booking.cancelReason}</p>}
    <BookingControl booking={booking} manager={false} holdsOnly={false} now={now} refresh={result.retry}/>
    <PaymentPanel booking={booking} expired={deadline(booking, now)} refresh={result.retry}/>
    <div className="booking-footer"><Link className="text-link" href="/bookings">รายการจองของฉัน</Link><button className="text-link" onClick={result.retry}>รีเฟรชรายการ</button></div>
  </article>;
}
export function BookingList({ manager = false, holdsOnly = false, defaultStatus = "" }: { manager?: boolean; holdsOnly?: boolean; defaultStatus?: BookingStatus | "" }) {
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState<BookingStatus | "">(defaultStatus), [date, setDate] = useState(""), [market, setMarket] = useState(""), [page, setPage] = useState(1);
  const refs = usePublicData<{ items: Market[] }>("/api/markets");
  const query = new URLSearchParams({ page: String(page), limit: "6", ...(status && !holdsOnly ? { status } : {}), ...(date ? { date } : {}), ...(market ? { market } : {}) });
  const result = usePublicData<BookingResults>((manager ? "/api/admin/" + (holdsOnly ? "holds" : "bookings") : "/api/bookings/me") + "?" + query, 5000, true), now = useBookingClock();
  return <section className="booking-list">
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {manager && <div className="admin-section-heading"><div><h2>{holdsOnly ? "จัดการพักล็อก" : "จัดการรายการจอง"}</h2><p>ตรวจสถานะและข้อมูลผู้จอง ระบุเหตุผลก่อน{holdsOnly ? "คืนล็อก" : "ยกเลิก"}</p></div></div>}
    <div className="booking-filters">
      {!holdsOnly && <label htmlFor="booking-status">สถานะ<select id="booking-status" aria-label="สถานะ" value={status} onChange={e => { setStatus(e.target.value as BookingStatus | ""); setPage(1); }}><option value="">ทุกสถานะ</option>{Object.entries(bookingStatusLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>}
      <label htmlFor="booking-date">วันที่จอง<input id="booking-date" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }}/></label>
      <label htmlFor="booking-market">ตลาด<select id="booking-market" aria-label="ตลาด" value={market} disabled={!refs.data} onChange={e => { setMarket(e.target.value); setPage(1); }}><option value="">ทุกตลาด</option>{refs.data?.items.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <button className="text-link" onClick={() => { setStatus(""); setDate(""); setMarket(""); setPage(1); }}>ล้างตัวกรอง</button><button className="text-link" onClick={result.retry}>รีเฟรชรายการ</button>
    </div>
    {refs.error && <p className="form-alert" role="alert">{refs.error} <button className="text-link" onClick={refs.retry}>ลองโหลดตลาดใหม่</button></p>}
    {result.loading && !result.data ? <p className="catalog-state" role="status">กำลังโหลดรายการ…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button className="text-link" onClick={result.retry}>ลองโหลดอีกครั้ง</button></p> : result.data && <>
      <p className="admin-result-count" role="status">ทั้งหมด {result.data.total} รายการ{result.loading ? " • กำลังโหลด…" : ""}</p>
      {!result.data.items.length ? <p className="catalog-state">ยังไม่มีรายการที่ตรงกับตัวกรอง</p> : <div className="booking-grid">{result.data.items.map(booking => <article className="booking-card" key={booking.id}>
        <div className="booking-card-heading"><h3>{booking.stall.marketName} • {booking.stall.code}</h3><span className={"booking-status " + booking.status}>{bookingStatusLabels[booking.status]}</span></div>
        <p className="booking-reference">{booking.id}</p><p>{bookingDate(booking.date)} • {baht(booking.price)} บาท</p>
        {manager && <div className="booking-customer"><strong>{booking.customer.name}</strong><span>{booking.customer.email} • {booking.customer.phone || "ไม่ระบุเบอร์โทร"}</span></div>}
        <Expiry booking={booking} now={now}/>{booking.cancelReason && <p className="form-description">เหตุผล: {booking.cancelReason}</p>}
        <BookingControl booking={booking} manager={manager} holdsOnly={holdsOnly} now={now} refresh={result.retry} onNotice={setNotice}/>{!manager && <Link className="text-link" href={"/bookings/" + booking.id}>ดูรายละเอียดรายการ</Link>}
        {manager && !holdsOnly && <PaymentPanel booking={booking} manager refresh={result.retry} onNotice={setNotice}/>}
      </article>)}</div>}
      {(result.data.pages > 1 || page > 1) && <nav className="pagination" aria-label="หน้ารายการจอง"><button className="button button-white" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</button><span>หน้า {page} / {Math.max(1, result.data.pages)}</span><button className="button button-white" disabled={page >= result.data.pages} onClick={() => setPage(p => p + 1)}>ถัดไป</button></nav>}
    </>}
  </section>;
}
