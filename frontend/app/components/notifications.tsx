"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePublicData } from "../lib/use-public-data";
import { bookingRequest, bookingTime } from "../lib/bookings";
import { DataWarning } from "./data-warning";

type Notifications = { items: { id: string; bookingId: string; message: string; createdAt: string; readAt: string | null }[]; total: number; pages: number; unreadCount: number };
export function NotificationBell() {
  const pathname = usePathname();
  const [revoked, setRevoked] = useState(false);
  const result = usePublicData<Notifications>(revoked ? null : "/api/notifications?limit=1", 30_000, true);
  const { retry } = result;
  useEffect(() => {
    const invalidate = () => setRevoked(true);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("zonify-session") : null;
    channel?.addEventListener("message", invalidate);
    window.addEventListener("zonify-session", invalidate);
    return () => { channel?.close(); window.removeEventListener("zonify-session", invalidate); };
  }, []);
  useEffect(() => {
    const refresh = () => retry();
    window.addEventListener("zonify-notifications", refresh);
    return () => window.removeEventListener("zonify-notifications", refresh);
  }, [retry]);
  const count = result.data?.unreadCount;
  return <Link href="/notifications" aria-current={pathname === "/notifications" ? "page" : undefined} aria-label={`การแจ้งเตือน${count ? ` ยังไม่อ่าน ${count} รายการ` : ""}`} title={result.error || "การแจ้งเตือน"}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" style={{ display: "inline", verticalAlign: "middle" }}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
    {" "}แจ้งเตือน{count ? ` (${count > 99 ? "99+" : count})` : ""}
  </Link>;
}
export function NotificationHistory() {
  const [page, setPage] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const result = usePublicData<Notifications>(`/api/notifications?page=${page}&limit=20`, 30_000, true);
  async function read(id?: string) {
    setBusy(true); setError("");
    try { await bookingRequest(id ? `/notifications/${encodeURIComponent(id)}/read` : "/notifications/read-all", {}); result.retry(); window.dispatchEvent(new Event("zonify-notifications")); }
    catch (e) { setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  if (result.loading) return <p role="status" className="catalog-state">กำลังโหลดการแจ้งเตือน…</p>;
  if (result.initialError) return <p role="alert" className="catalog-state">{result.initialError} <button className="text-link" onClick={result.retry}>ลองอีกครั้ง</button>{result.status === 401 && <Link href="/login?next=%2Fnotifications">เข้าสู่ระบบ</Link>}</p>;
  const data = result.data;
  if (!data) return null;
  return <section aria-label="ประวัติการแจ้งเตือน">
    <DataWarning error={result.refreshError} retry={result.retry}/>
    {error && <p className="form-alert" role="alert">{error}</p>}
    <div className="booking-card-heading"><p>ยังไม่อ่าน {data.unreadCount} รายการ</p><button className="button button-white" disabled={busy || !data.unreadCount} onClick={() => void read()}>อ่านทั้งหมดแล้ว</button></div>
    {!data.items.length && <p className="catalog-state">ยังไม่มีการแจ้งเตือน</p>}
    <div className="booking-list">{data.items.map(item => <article key={item.id} className="booking-card">
      <p>{!item.readAt && <strong>ยังไม่อ่าน · </strong>}{item.message}</p>
      <p className="form-description"><time dateTime={item.createdAt}>{bookingTime(item.createdAt)}</time></p>
      <div className="booking-buttons"><Link className="text-link" href={`/bookings/${encodeURIComponent(item.bookingId)}`}>ดูรายการจอง</Link>{!item.readAt && <button className="text-link" disabled={busy} onClick={() => void read(item.id)}>ทำเครื่องหมายว่าอ่านแล้ว</button>}</div>
    </article>)}</div>
    {data.pages > 1 && <nav aria-label="หน้าการแจ้งเตือน" className="booking-buttons"><button className="button button-white" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</button><span>หน้า {page} / {data.pages}</span><button className="button button-white" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>ถัดไป</button></nav>}
  </section>;
}
