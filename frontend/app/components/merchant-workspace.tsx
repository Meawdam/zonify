"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePublicData } from "../lib/use-public-data";
import { merchantReturn, type MerchantShop, type MerchantShops } from "../lib/merchant";
import type { Market, Category } from "../lib/catalog";
import { baht } from "../lib/catalog";
import { bookingDate, bookingTime, bookingStatusLabels, type Booking } from "../lib/bookings";
import { useURLState } from "../lib/use-url-state";
import { DataWarning } from "./data-warning";
import { MerchantEditor } from "./merchant-editor";
import "./merchant-workspace.css";

export function MerchantWorkspace() {
  const { params } = useURLState();
  const shops = usePublicData<MerchantShops>("/api/merchant/shops", 0, true);
  const overview = usePublicData<{ counts: { shops: number; current: number; history: number; actionRequired: number; review: number }; amountDue: number; actions: Booking[] }>("/api/merchant/overview", 5000, true);
  const markets = usePublicData<{ items: Market[] }>("/api/markets"), categories = usePublicData<{ items: Category[] }>("/api/categories");
  const [editing, setEditing] = useState<MerchantShop | "new" | null>(null);
  const back = merchantReturn(params.get("returnTo"));
  const available = markets.data?.items ?? [], initialMarket = available.some(m => m.id === params.get("market")) ? params.get("market")! : available[0]?.id ?? "";
  return <div className="merchant-workspace">
    <div className="merchant-actions"><Link className="button button-orange" href={back}>เลือกแผงและจองพื้นที่</Link><Link className="button button-white" href="/bookings">รายการจองและประวัติ</Link></div>
    <DataWarning error={overview.refreshError} retry={overview.retry}/>
    {overview.initialError && <p className="form-alert" role="alert">{overview.initialError} <button className="text-link" onClick={overview.retry}>โหลดภาพรวมใหม่</button></p>}
    {overview.data && <section aria-label="ภาพรวมการเช่า"><div className="merchant-shop-grid">
      <Link className="booking-card" href="/bookings?group=action"><strong>ต้องดำเนินการ {overview.data.counts.actionRequired} รายการ</strong><p>ยอดรอชำระ {baht(overview.data.amountDue)} บาท</p></Link>
      <Link className="booking-card" href="/bookings?group=current"><strong>รายการปัจจุบัน {overview.data.counts.current}</strong><p>รอตรวจสลิป {overview.data.counts.review} รายการ</p></Link>
      <Link className="booking-card" href="/bookings?group=history"><strong>ประวัติ {overview.data.counts.history} รายการ</strong><p>รายการสิ้นสุดและการเช่าที่ผ่านมา</p></Link>
    </div><h2>รายการที่ต้องดำเนินการ</h2>{overview.data.actions.length ? <div className="merchant-shop-grid">{overview.data.actions.map(b => <article className="booking-card" key={b.id}><h3>{b.shop?.name ?? "การจองเดิม"} · {b.stall.code}</h3><p>{b.stall.marketName} · {bookingDate(b.date)}</p><p>{bookingStatusLabels[b.status]} · {baht(b.price)} บาท</p>{b.expiresAt && <p>ดำเนินการก่อน {bookingTime(b.expiresAt)}</p>}{b.payment.attempts.at(-1)?.status === "rejected" && <p className="field-error">สลิปถูกปฏิเสธ: {b.payment.attempts.at(-1)?.reviewReason}</p>}<Link className="button button-orange" href={"/bookings/" + b.id}>{b.status === "held" ? "ตรวจรายละเอียดและชำระเงิน" : "ชำระเงินหรือส่งสลิปใหม่"}</Link></article>)}</div> : <p>ไม่มีรายการที่ต้องดำเนินการในขณะนี้</p>}{overview.data.counts.actionRequired > 6 && <Link href="/bookings?group=action">ดูรายการที่ต้องดำเนินการทั้งหมด</Link>}</section>}
    <DataWarning error={shops.refreshError} retry={shops.retry}/>
    {shops.initialError ? <p className="form-alert" role="alert">{shops.initialError} <button onClick={shops.retry} className="text-link">ลองใหม่</button></p> : !shops.data ? <p role="status">กำลังโหลดร้านของคุณ…</p> : <>
      <div className="merchant-heading"><h2>ร้านทั้งหมดของคุณ ({shops.data.items.length})</h2><button className="button button-green" disabled={!!editing || !markets.data || !categories.data} onClick={() => setEditing("new")}>เพิ่มร้านใหม่</button></div>
      {!shops.data.items.length && <p className="catalog-state">ยังไม่มีร้าน เพิ่มร้านแรกก่อนเลือกแผงเพื่อเริ่มขายในตลาด</p>}
      {!editing && <div className="merchant-shop-grid">{shops.data.items.map(shop => <article className="booking-card" key={shop.id}>
        {shop.photoUrl && <Image className="merchant-shop-image" unoptimized src={shop.photoUrl} alt={shop.name} width={400} height={240}/>}
        <h3>{shop.name}</h3><p>{available.find(m => m.id === shop.marketId)?.name ?? shop.marketId}</p><p>{shop.active ? "เปิดใช้งาน" : "ผู้ดูแลปิดใช้งานร้านนี้"}</p>
        <div className="merchant-actions"><button className="button button-white" disabled={!markets.data || !categories.data} onClick={() => setEditing(shop)}>แก้ไขร้าน {shop.name}</button><Link className="text-link" href={"/bookings?shop=" + shop.id}>ดูรายการของร้าน</Link>{shop.active && <Link className="text-link" href={"/shops/" + shop.id}>ดูหน้าร้านสาธารณะ</Link>}</div>
      </article>)}</div>}
      {editing && markets.data && categories.data && <MerchantEditor key={editing === "new" ? "new" : editing.id} shop={editing === "new" ? null : editing} markets={available} categories={categories.data.items} initialMarket={initialMarket} onSaved={() => shops.retry()} onClose={() => setEditing(null)}/>}
    </>}
    {(markets.error || categories.error) && <p className="form-alert" role="alert">โหลดตลาดหรือหมวดหมู่ไม่สำเร็จ <button className="text-link" onClick={() => { markets.retry(); categories.retry(); }}>ลองโหลดใหม่</button></p>}
  </div>;
}
