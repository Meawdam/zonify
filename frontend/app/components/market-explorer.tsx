"use client";
import { usePublicData } from "../lib/use-public-data";
import { baht, validDate, type Market } from "../lib/catalog";
import { Icon } from "./icons";
import { FloorBrowser } from "./floor-browser";
import { ShopDirectory } from "./shop-directory";
import type { LandingData } from "../lib/server-catalog";
import { useURLState } from "../lib/use-url-state";
import { resourceId } from "../lib/url-state";
import { DataWarning } from "./data-warning";
export function MarketExplorer({ initialDate, initialMarket, initialData, loggedIn = false }: { initialDate: string; initialMarket: string; initialStall: string; initialData?: LandingData; loggedIn?: boolean }) {
  const markets = usePublicData<{ items: Market[] }>("/api/markets", 0, true, initialData?.markets);
  const { params, update } = useURLState();
  const marketId = resourceId(params.get("market") ?? initialMarket);
  const date = validDate(params.get("date") ?? "") ? params.get("date")! : initialDate;
  const current = markets.data?.items.find(m => m.id === marketId) ?? markets.data?.items[0];
  function viewMarket(id: string) {
    update({ market: id, stall: null });
    document.getElementById("floor-plan")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <>
    <section id="markets" className="markets-section"><div className="container">
      <div className="section-top market-heading"><h2>เริ่มจากตลาดที่คุณชอบ</h2><p>เลือกตลาดแล้วสำรวจพื้นที่และร้านค้า</p></div>
      <DataWarning error={markets.refreshError} retry={markets.retry}/>
      {markets.loading ? <p className="catalog-state" role="status">กำลังโหลดตลาด…</p> : markets.initialError ? <p className="catalog-state" role="alert">โหลดตลาดไม่ได้ <button className="text-link" onClick={markets.retry}>ลองโหลดตลาดอีกครั้ง</button></p> : !markets.data?.items.length ? <p className="catalog-state">ยังไม่มีตลาดที่เปิดแสดงข้อมูล</p> : <div className="market-gallery">{markets.data.items.map(market => <article className={`market-card${current?.id === market.id ? " is-active" : ""}`} key={market.id}>
        <button className={`market-image photo-${market.photo}`} aria-label={`ดูผัง ${market.name}`} onClick={() => viewMarket(market.id)}/>
        <div className="market-caption"><h3>{market.name}</h3></div>
        <div className="market-facts"><span><Icon name="pin"/>{market.location}</span><span className="market-price">{market.minPrice === null ? "ยังไม่มีราคา" : <>เริ่ม <strong>{baht(market.minPrice)}</strong> บาท / วัน</>}</span></div>
        <div className="market-meta"><button className="text-link" onClick={() => viewMarket(market.id)}>ดูผังตลาด <Icon/></button></div>
      </article>)}</div>}
    </div></section>
    <section id="floor-plan" className="plan-section"><div className="container">
      <div className="section-top plan-heading"><div><h2>เห็นผังจริง ก่อนเลือกพื้นที่</h2><p>ดูขนาด ราคา และสถานะล็อกแยกตามวัน</p></div>
        <div className="plan-filters"><label className="select-control"><Icon name="pin"/><select aria-label="เลือกตลาด" value={current?.id ?? ""} disabled={!current} onChange={e => update({ market: e.target.value, stall: null })}>{!current && <option value="">ยังไม่มีตลาด</option>}{markets.data?.items.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><Icon name="chevron"/></label>
          <label className="date-control"><Icon name="calendar"/><input type="date" aria-label="วันที่ดูสถานะ" value={date} onChange={e => { if (validDate(e.target.value)) update({ date: e.target.value, stall: null }); }} aria-invalid={!validDate(date)}/></label>
        </div>
      </div>
      {!validDate(date) ? <p className="catalog-state" role="alert">กรุณาเลือกวันที่ให้ถูกต้อง</p> : current ? <FloorBrowser key={current.id + "|" + date} market={current} date={date} initialStall={resourceId(params.get("stall"))} initialPlan={initialData?.floor} loggedIn={loggedIn}/> : <p className="catalog-state">เลือกตลาดเพื่อดูผังล็อก</p>}
    </div></section>
    <ShopDirectory markets={markets.data?.items ?? []} initialCategories={initialData?.categories}/>
  </>;
}
