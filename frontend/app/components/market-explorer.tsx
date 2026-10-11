"use client";
import { useState } from "react";
import { usePublicData } from "../lib/use-public-data";
import { baht, validDate, type Market } from "../lib/catalog";
import { Icon } from "./icons";
import { FloorBrowser } from "./floor-browser";
import { ShopDirectory } from "./shop-directory";
export function MarketExplorer({ initialDate, initialMarket, initialStall, loggedIn = false }: { initialDate: string; initialMarket: string; initialStall: string; loggedIn?: boolean }) {
  const markets = usePublicData<{ items: Market[] }>("/api/markets");
  const [marketId, setMarketId] = useState(initialMarket);
  const [date, setDate] = useState(initialDate);
  const current = markets.data?.items.find(m => m.id === marketId) ?? markets.data?.items[0];
  function viewMarket(id: string) {
    setMarketId(id);
    document.getElementById("floor-plan")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <>
    <section id="markets" className="markets-section"><div className="container">
      <div className="section-top"><h2>เริ่มจากตลาดที่คุณชอบ</h2><p>เลือกตลาดแล้วสำรวจพื้นที่และร้านค้า</p></div>
      {markets.loading ? <p className="catalog-state" role="status">กำลังโหลดตลาด…</p> : markets.error ? <p className="catalog-state" role="alert">โหลดตลาดไม่ได้ <button className="text-link" onClick={markets.retry}>ลองโหลดตลาดอีกครั้ง</button></p> : !markets.data?.items.length ? <p className="catalog-state">ยังไม่มีตลาดที่เปิดแสดงข้อมูล</p> : <div className="market-gallery">{markets.data.items.map(market => <article className="market-card" key={market.id}>
        <button className={`market-image photo-${market.photo}`} aria-label={`ดูผัง ${market.name}`} onClick={() => viewMarket(market.id)}/>
        <div className="market-caption"><h3>{market.name}</h3><span>{market.minPrice === null ? "ยังไม่มีราคา" : `เริ่ม ${baht(market.minPrice)} บาท / วัน`}</span></div>
        <div className="market-meta"><span><Icon name="pin"/>{market.location}</span><button className="text-link" onClick={() => viewMarket(market.id)}>ดูผังตลาด <Icon/></button></div>
      </article>)}</div>}
    </div></section>
    <section id="floor-plan" className="plan-section"><div className="container">
      <div className="section-top plan-heading"><div><h2>เห็นผังจริง ก่อนเลือกพื้นที่</h2><p>ดูขนาด ราคา และสถานะล็อกแยกตามวัน</p></div>
        <div className="plan-filters"><label className="select-control"><Icon name="pin"/><select aria-label="เลือกตลาด" value={current?.id ?? ""} disabled={!current} onChange={e => setMarketId(e.target.value)}>{!current && <option value="">ยังไม่มีตลาด</option>}{markets.data?.items.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><Icon name="chevron"/></label>
          <label className="date-control"><Icon name="calendar"/><input type="date" aria-label="วันที่ดูสถานะ" value={date} onChange={e => setDate(e.target.value)} aria-invalid={!validDate(date)}/></label>
        </div>
      </div>
      {!validDate(date) ? <p className="catalog-state" role="alert">กรุณาเลือกวันที่ให้ถูกต้อง</p> : current ? <FloorBrowser key={current.id + "|" + date} market={current} date={date} initialStall={current.id === initialMarket ? initialStall : ""} loggedIn={loggedIn}/> : <p className="catalog-state">เลือกตลาดเพื่อดูผังล็อก</p>}
    </div></section>
    <ShopDirectory markets={markets.data?.items ?? []}/>
  </>;
}
