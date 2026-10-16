"use client";
import { useId, useState } from "react";
import { Icon } from "./icons";
import { StallPlan } from "./stall-plan";
import { usePublicData, type InitialData } from "../lib/use-public-data";
import { baht, statusLabels, type FloorPlan, type Market } from "../lib/catalog";
import { BookingAction } from "./booking-action";
import { DataWarning } from "./data-warning";
import { useURLState } from "../lib/use-url-state";
export function FloorBrowser({ market, date, initialStall, loggedIn = false, initialPlan }: { market: Market; date: string; initialStall: string; loggedIn?: boolean; initialPlan?: InitialData<FloorPlan> }) {
  const { update } = useURLState(), detailId = useId();
  const [view, setView] = useState("map"), [status, setStatus] = useState(""), [zone, setZone] = useState(""), [maxPrice, setMaxPrice] = useState("");
  const { data: plan, initialError: error, refreshError, loading, retry } = usePublicData<FloorPlan>(`/api/markets/${encodeURIComponent(market.id)}/floor-plan?date=${date}`, 15_000, true, initialPlan);
  function select(id: string) { update({ market: market.id, date, stall: id }); }
  if (loading && !plan) return <div className="catalog-state" role="status">กำลังโหลดผังและสถานะล็อก…</div>;
  if (error) return <div className="catalog-state" role="alert">โหลดผังไม่ได้ กรุณาลองใหม่ <button className="text-link" onClick={retry}>ลองโหลดผังอีกครั้ง</button></div>;
  if (!plan || !plan.stalls.length) return <div className="catalog-state">ตลาดนี้ยังไม่มีผังล็อกสำหรับแสดง</div>;
  const selected = plan.stalls.find(s => s.id === initialStall);
  const zones = [...new Set(plan.stalls.map(s => s.zoneName).filter((z): z is string => !!z))];
  const visible = plan.stalls.filter(s => (!status || s.status === status) && (!zone || s.zoneName === zone) && (!maxPrice || s.pricePerDay <= Number(maxPrice)));
  return <>
    <DataWarning error={refreshError} retry={retry}/>
    <div className="availability-summary" aria-label="จำนวนล็อกแยกตามสถานะ">{(Object.keys(statusLabels) as Array<keyof typeof statusLabels>).map(status => <span className={`summary-${status}`} key={status}>{statusLabels[status]} <strong>{plan.counts[status]}</strong></span>)}</div>
    <div className="plan-layout"><div className="floor-chooser">
      <div className="floor-view-switch" role="group" aria-label="รูปแบบการเลือกล็อก"><button className="button button-white" aria-pressed={view === "map"} onClick={() => setView("map")}>ดูผัง</button><button className="button button-white" aria-pressed={view === "list"} onClick={() => setView("list")}>ดูรายการล็อก</button></div>
      <div className="selection-summary" aria-live="polite">{selected ? <><strong>{selected.code} · {baht(selected.pricePerDay)} บาท/วัน</strong><span>{statusLabels[selected.status]}</span><a className="text-link" href={"#" + detailId} onClick={() => document.getElementById(detailId)?.focus()}>ดูรายละเอียดและดำเนินการต่อ</a></> : <span>เลือกล็อกบนผังหรือรายการเพื่อดูราคาและทำรายการต่อ</span>}</div>
      {view === "map" ? <StallPlan plan={plan} selected={selected?.id ?? null} onSelect={select}/> : <div className="stall-list-view">
        <div className="stall-list-filters"><label>สถานะ<select aria-label="กรองล็อกตามสถานะ" value={status} onChange={e => setStatus(e.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>โซน<select aria-label="กรองล็อกตามโซน" value={zone} onChange={e => setZone(e.target.value)}><option value="">ทุกโซน</option>{zones.map(z => <option key={z}>{z}</option>)}</select></label><label>ราคาสูงสุด (บาท/วัน)<input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}/></label></div>
        <ul className="stall-list" aria-label="รายการล็อก">{visible.map(stall => <li key={stall.id}><button className="stall-list-item" aria-pressed={selected?.id === stall.id} onClick={() => select(stall.id)}><strong>ล็อก {stall.code}</strong><span>{statusLabels[stall.status]} · {baht(stall.pricePerDay)} บาท/วัน</span><small>{stall.zoneName} · {stall.width} × {stall.depth} เมตร</small></button></li>)}</ul>{!visible.length && <p role="status">ไม่พบล็อกตามตัวกรอง</p>}
      </div>}

      </div>
      <aside id={detailId} tabIndex={-1} className="selection-panel" aria-label="รายละเอียดล็อก">
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
