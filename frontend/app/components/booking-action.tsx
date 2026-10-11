"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../lib/auth";
import { bookingRequest, type Booking } from "../lib/bookings";
import type { Stall } from "../lib/catalog";
export function BookingAction({ stall, marketId, date, loggedIn, refresh }: { stall: Stall; marketId: string; date: string; loggedIn: boolean; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const back = "/?" + new URLSearchParams({ market: marketId, stall: stall.id, date }) + "#floor-plan";
  async function hold() {
    setBusy(true); setError("");
    try {
      const booking = await bookingRequest<Booking>("/bookings/holds", { stallId: stall.id, date });
      router.push("/bookings/" + booking.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.push("/login?notice=expired&next=" + encodeURIComponent(back)); return; }
      setError(e instanceof ApiError && e.fields.date ? e.fields.date : e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) refresh();
    } finally { setBusy(false); }
  }
  return <div className="booking-action">
    {error && <p className="form-alert" role="alert">{error}</p>}
    {!loggedIn && stall.status === "available" ? <Link className="button button-orange" href={"/login?next=" + encodeURIComponent(back)}>เข้าสู่ระบบเพื่อพักล็อก</Link> : <button className="button button-orange" disabled={!loggedIn || busy || stall.status !== "available"} onClick={hold}>{busy ? "กำลังพักล็อก…" : stall.status === "available" ? "พักล็อกนี้ 10 นาที" : "ล็อกนี้ไม่ว่าง"}</button>}
    <p className="catalog-note">พักล็อกครั้งละหนึ่งล็อกต่อวัน แล้วตรวจรายละเอียดและยืนยันการจอง ราคาจะยึดตามเวลาที่พักล็อก</p>
    <Link className="text-link" href="/bookings">ดูรายการจองของฉัน</Link>
  </div>;
}
