"use client";
import { useState } from "react";
import { Icon } from "./icons";
import { StallPlan } from "./stall-plan";
import { usePublicData } from "../lib/use-public-data";
import { baht, statusLabels, type FloorPlan, type Market } from "../lib/catalog";
import { BookingAction } from "./booking-action";
export function FloorBrowser({ market, date, initialStall, loggedIn = false }: { market: Market; date: string; initialStall: string; loggedIn?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialStall || null);
  const { data: plan, error, loading, retry } = usePublicData<FloorPlan>(`/api/markets/${encodeURIComponent(market.id)}/floor-plan?date=${date}`, 15_000, true);
  if (loading && !plan) return <div className="catalog-state" role="status">กำลังโหลดผังและสถานะล็อก…</div>;
  if (error) return <div className="catalog-state" role="alert">โหลดผังไม่ได้ กรุณาลองใหม่ <button className="text-link" onClick={retry}>ลองโหลดผังอีกครั้ง</button></div>;
  if (!plan || !plan.stalls.length) return <div className="catalog-state">ตลาดนี้ยังไม่มีผังล็อกสำหรับแสดง</div>;
  const selected = plan.stalls.find(s => s.id === selectedId);
  return <>
    <div className="availability-summary" aria-label="จำนวนล็อกแยกตามสถานะ">{(Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map(status => <span className={`summary-${status}`} key={status}>{statusLabels[status]} <strong>{plan.counts[status]}</strong></span>)}</div>
    <div className="plan-layout"><StallPlan plan={plan} selected={selected?.id ?? null} onSelect={setSelectedId}/>
      <aside className="selection-panel" aria-live="polite" aria-label="รายละเอียดล็อก">
        <h3>{selected ? `ล็อก ${selected.code}` : "เลือกล็อกของคุณ"}</h3>
        <p className="selection-intro">{selected ? statusLabels[selected.status] : "กดเลือกล็อกบนผังเพื่อดูรายละเอียด"}</p>
        <div className="detail-row"><Icon name="pin"/><div><strong>{market.name}</strong><span>{market.location}</span></div></div>
        {selected ? <>
          <div className="detail-row"><Icon name="area"/><div><strong>{selected.width} × {selected.depth} เมตร</strong><span>ขนาดพื้นที่</span></div></div>
          <div className="detail-row"><Icon name="coin"/><div><strong>{baht(selected.pricePerDay)} บาท / วัน</strong><span>ค่าเช่าพื้นที่</span></div></div>
          <p className="stall-description">{selected.description}</p>
          {selected.zoneName && <p className="stall-description">{selected.zoneName}</p>}
          {selected.holdExpiresAt && <p className="map-hint">พักล็อกถึง {new Intl.DateTimeFormat("th-TH", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(new Date(selected.holdExpiresAt))}</p>}
        </> : <div className="selection-empty"><span className="selection-empty-icon"><Icon name="store"/></span><strong>พื้นที่ของคุณเริ่มตรงนี้</strong><p className="stall-description">เลือกล็อกบนผังเพื่อดูขนาด ราคา และสถานะของพื้นที่</p></div>}
        {selected && <BookingAction key={selected.id} stall={selected} marketId={market.id} date={date} loggedIn={loggedIn} refresh={retry}/>}
      </aside>
    </div>
    <div className="refresh-note"><span>ข้อมูลล่าสุด {new Intl.DateTimeFormat("th-TH", { timeStyle: "medium", timeZone: "Asia/Bangkok" }).format(new Date(plan.updatedAt))} • อัปเดตทุก 15 วินาที</span><button className="text-link" onClick={retry}>รีเฟรชสถานะ</button></div>
  </>;
}
