"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError } from "../lib/auth";
import { bookingRequest, type Booking } from "../lib/bookings";
import type { Stall } from "../lib/catalog";
import { usePublicData } from "../lib/use-public-data";
import type { MerchantShops } from "../lib/merchant";
export function BookingAction({ stall, marketId, date, loggedIn, refresh }: { stall: Stall; marketId: string; date: string; loggedIn: boolean; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const shops = usePublicData<MerchantShops>(loggedIn ? "/api/merchant/shops" : null, 0, true);
  const [selectedShop, setSelectedShop] = useState("");
  const eligible = shops.data?.items.filter(s => s.marketId === marketId && s.active) ?? [];
  const shopId = eligible.some(s => s.id === selectedShop) ? selectedShop : eligible.length === 1 ? eligible[0].id : "";
  const back = "/?" + new URLSearchParams({ market: marketId, stall: stall.id, date }) + "#floor-plan";
  async function hold() {
    setBusy(true); setError("");
    try {
      const booking = await bookingRequest<Booking>("/bookings/holds", { stallId: stall.id, date, shopId });
      router.push("/bookings/" + booking.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.push("/login?notice=expired&next=" + encodeURIComponent(back)); return; }
      setError(e instanceof ApiError && e.fields.date ? e.fields.date : e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      if (e instanceof ApiError && e.status === 409) refresh();
    } finally { setBusy(false); }
  }
  return <div className="booking-action">
    {stall.unavailableReason && <p className="form-alert" role="status">{stall.unavailableReason}</p>}
    {loggedIn && <div className="booking-shop-select"><label htmlFor={"booking-shop-" + stall.id}>จองให้ร้าน<select id={"booking-shop-" + stall.id} value={shopId} disabled={busy || !shops.data} onChange={e => setSelectedShop(e.target.value)}><option value="">เลือกร้านของคุณ</option>{eligible.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{shops.error && <p role="alert">{shops.error} <button className="text-link" onClick={shops.retry}>โหลดร้านใหม่</button></p>}{shops.loading && !shops.data && <p role="status">กำลังโหลดร้าน…</p>}{shops.data && !eligible.length && <p>ยังไม่มีร้านที่เปิดใช้งานในตลาดนี้</p>}<Link className="text-link" href={"/merchant?" + new URLSearchParams({ market: marketId, returnTo: back })}>เพิ่มหรือจัดการร้าน</Link></div>}
    {error && <p className="form-alert" role="alert">{error}</p>}
    {!loggedIn && stall.status === "available" ? <Link className="button button-orange" href={"/login?next=" + encodeURIComponent(back)}>เข้าสู่ระบบเพื่อพักล็อก</Link> : <button className="button button-orange" disabled={!loggedIn || !shopId || busy || stall.status !== "available"} onClick={hold}>{busy ? "กำลังพักล็อก…" : stall.status === "available" ? "พักล็อกนี้ 10 นาที" : "ล็อกนี้ไม่ว่าง"}</button>}
    <p className="catalog-note">พักล็อกครั้งละหนึ่งล็อกต่อวัน แล้วตรวจรายละเอียดและดำเนินการชำระเงิน ราคายึดตามเวลาที่พักล็อก การจองสำเร็จเมื่อผู้จัดการตรวจรับเงินแล้ว</p>
    <Link className="text-link" href="/bookings">ดูรายการจองของฉัน</Link>
  </div>;
}
