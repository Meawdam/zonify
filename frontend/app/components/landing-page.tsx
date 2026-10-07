"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Icon } from "./icons";
import { markets } from "./market-data";
import { BookingDialog, type DialogMode } from "./booking-dialog";
import { StallPlan } from "./stall-plan";

function Brand() {
  return <a href="#" className="brand" aria-label="Zonify หน้าแรก"><Icon name="store"/><span>Zonify</span></a>;
}

export function LandingPage() {
  const [marketIndex, setMarketIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [date, setDate] = useState("2026-10-10");
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [menu, setMenu] = useState(false);
  const closeDialog = useCallback(() => setDialog(null), []);
  const current = markets[marketIndex];
  const validDate = date >= "2026-10-07" && date <= "2027-10-07";
  function changeMarket(index: number) { setMarketIndex(index); setSelected(null); }
  function viewMarket(index: number) {
    changeMarket(index);
    document.getElementById("floor-plan")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  return <>
    <header className="site-header"><div className="container header-inner">
      <Brand/>
      <button className="mobile-menu" aria-label="เปิดเมนู" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}>เมนู</button>
      <nav id="main-nav" className={menu ? "nav open" : "nav"} aria-label="เมนูหลัก">
        <a href="#markets" onClick={() => setMenu(false)}>สำรวจตลาด</a><a href="#how-it-works" onClick={() => setMenu(false)}>วิธีจอง</a>
        <button className="nav-link" onClick={() => { setDialog("owner"); setMenu(false); }}>สำหรับเจ้าของตลาด</button>
        <a className="button button-orange" href="#markets" onClick={() => setMenu(false)}>เลือกตลาด</a>
      </nav>
    </div></header>
    <main>
      <section className="hero"><div className="container hero-grid">
        <div className="hero-copy"><h1>ตลาดที่ใช่<br/>พื้นที่ของคุณ</h1><p>เลือกตลาด ดูผังจริง แล้วจองล็อกที่อยากขาย</p>
          <div className="hero-actions"><a href="#markets" className="button button-green">เริ่มเลือกตลาด <Icon/></a><a href="#how-it-works" className="text-link">ดูวิธีจอง <Icon/></a></div>
          <div className="landscape-line" aria-hidden="true"><svg viewBox="0 0 420 90" fill="none"><path d="M2 72 42 60 63 67 94 51 110 55 151 32 183 45 212 24 232 30 271 51 300 46 326 58 418 73M30 79h352M50 72V43l-11 19h22L50 43M79 70V30l-12 20h24L79 30M83 30V20M81 20h4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg></div>
        </div>
        <div className="hero-visual"><Image src="/images/sunseto-hero.webp" alt="บรรยากาศตลาดริมคลองเชียงใหม่ยามเย็น" fill priority sizes="(max-width: 680px) 100vw, 55vw"/><span className="sun-mark" aria-hidden="true">☼</span></div>
      </div>
      <div id="how-it-works" className="container steps" aria-label="ขั้นตอนการจอง">
        {[{ title: "เลือกตลาด", copy: "ค้นหาตลาดที่ตรงกับสไตล์ของคุณ" }, { title: "เลือกล็อกบนผัง", copy: "ดูผังจริง เลือกพื้นที่ที่ต้องการ" }, { title: "ตรวจสอบและจอง", copy: "ตรวจสอบข้อมูลก่อนตัดสินใจจอง" }].map((step, index) => <div className="step" key={step.title}><span className="step-number">0{index + 1}</span><h2>{step.title}</h2><p>{step.copy}</p></div>)}
      </div></section>
      <section id="markets" className="markets-section"><div className="container">
        <div className="section-top"><h2>เริ่มจากตลาดที่คุณชอบ</h2><p>เชียงใหม่มีตลาดที่รอให้คุณมาเป็นส่วนหนึ่ง</p></div>
        <div className="market-gallery">{markets.map((market, index) => <article className="market-card" key={market.id}>
          <button className={`market-image photo-${market.photo}`} aria-label={`ดูผัง ${market.name}`} onClick={() => viewMarket(index)}/>
          <div className="market-caption"><h3>{market.name}</h3><span>เริ่ม {market.price} บาท / วัน</span></div>
          <div className="market-meta"><span><Icon name="pin"/>{market.location}</span><button className="text-link" onClick={() => viewMarket(index)}>ดูผังตลาด <Icon/></button></div>
        </article>)}</div>
      </div></section>
      <section id="floor-plan" className="plan-section"><div className="container">
        <div className="section-top plan-heading"><div><h2>เห็นผังจริง ก่อนเลือกพื้นที่</h2><p>เลือกล็อกที่ใช่ เห็นตำแหน่งจริงของตลาด</p></div>
          <div className="plan-filters"><label className="select-control"><Icon name="pin"/><select aria-label="เลือกตลาด" value={marketIndex} onChange={event => changeMarket(Number(event.target.value))}>{markets.map((market, index) => <option key={market.id} value={index}>{market.name}</option>)}</select><Icon name="chevron"/></label>
            <label className="date-control"><Icon name="calendar"/><input type="date" aria-label="วันที่จอง" min="2026-10-07" max="2027-10-07" value={date} onInput={event => { setDate(event.currentTarget.value); setSelected(null); }}/></label></div>
        </div>
        <div className="plan-layout"><StallPlan selected={selected} onSelect={setSelected}/>
          <aside className="selection-panel" aria-live="polite"><h3>{selected ? `ล็อก ${selected}` : "เลือกล็อกของคุณ"}</h3><p className="selection-intro">{selected ? "พื้นที่ที่คุณเลือก" : "กดเลือกล็อกสีเขียวบนผัง"}</p>
            <div className="detail-row"><Icon name="pin"/><div><strong>{current.name}</strong><span>{current.location}</span></div></div>
            <div className="detail-row"><Icon name="area"/><div><strong>2 × 2 เมตร</strong><span>ขนาดพื้นที่</span></div></div>
            <div className="detail-row"><Icon name="coin"/><div><strong>{current.price} บาท / วัน</strong><span>ค่าเช่าพื้นที่</span></div></div>
            <button className="button button-orange booking-action" disabled={!selected || !validDate} onClick={() => setDialog("booking")}>ตรวจสอบการจอง <Icon/></button>
            <small className="demo-label">ข้อมูลตัวอย่างสำหรับทดลองเลือก</small>
          </aside>
        </div>
      </div></section>
      <section className="cta-section"><div className="container cta-inner"><h2>เริ่มร้านเล็ก ๆ ในตลาดที่ใช่</h2><p>พื้นที่ดี ๆ รอให้เรื่องราวของคุณเริ่มต้น</p><a className="button button-white" href="#markets">เลือกตลาดของคุณ <Icon/></a></div></section>
    </main>
    <footer><div className="container footer-inner"><Brand/><p>© 2026 Zonify · พื้นที่ทดลองเลือกล็อกตลาดนัดเชียงใหม่</p></div></footer>
    {dialog && <BookingDialog mode={dialog} market={current} selected={selected ?? ""} date={date} onClose={closeDialog}/>}
  </>;
}
