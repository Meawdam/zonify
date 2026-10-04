"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

const markets = [
  { name: "กาดมีนัดคลอง", location: "ตลาดริมคลอง · เชียงใหม่", type: "สินค้าหลากหลาย", price: 150 },
  { name: "ตลาดนัดมหาวิทยาลัย", location: "พื้นที่กิจกรรมนักศึกษา · เชียงใหม่", type: "อาหารและไลฟ์สไตล์", price: 120 },
  { name: "ตลาดชุมชนรักษ์", location: "ลานกลางชุมชน · เชียงใหม่", type: "สินค้าชุมชน", price: 100 },
];
const occupied = new Set(["A03", "A06", "B02", "B05", "C04", "D01", "D06", "E02"]);
const rows = ["A", "B", "C", "D", "E"];

function Brand() {
  return <a href="#" className="brand" aria-label="Zonify หน้าแรก"><Icon name="house"/><span><strong>Zonify</strong><small>จองล็อกตลาดนัด</small></span></a>;
}
function SectionTitle({ label, title, description }: { label: string; title: string; description?: string }) {
  return <div className="section-title"><p className="eyebrow">{label}</p><h2>{title}</h2>{description && <p className="muted">{description}</p>}</div>;
}
function Legend() {
  return <div className="legend"><span><i className="available-dot"/>ว่าง</span><span><i className="occupied-dot"/>จองแล้ว</span><span><i className="selected-dot"/>เลือกอยู่</span></div>;
}

export function LandingPage() {
  const [market, setMarket] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [dialog, setDialog] = useState<"booking" | "owner" | null>(null);
  const [menu, setMenu] = useState(false);
  const modalRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDialog(null);
      if (event.key !== "Tab") return;
      const controls = modalRef.current?.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = originalOverflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [dialog]);
  const current = markets[market];
  function chooseMarket(index: number) { setMarket(index); setSelected(null); }

  return <>
    <header className="site-header"><div className="container header-inner"><Brand/><button className="mobile-menu" aria-label="เปิดเมนู" aria-expanded={menu} onClick={() => setMenu(!menu)}>เมนู</button><nav className={menu ? "nav open" : "nav"} aria-label="เมนูหลัก"><a href="#how-it-works" onClick={() => setMenu(false)}>วิธีใช้งาน</a><a href="#markets" onClick={() => setMenu(false)}>ตลาดนัดต่างๆ</a><a href="#for-you" onClick={() => setMenu(false)}>สำหรับผู้จัดงาน</a><a className="button button-green" href="#markets" onClick={() => setMenu(false)}>เลือกตลาดที่ใช่เลย <Icon/></a></nav></div></header>
    <main>
      <section className="hero"><div className="container hero-grid"><div className="hero-copy"><h1>จองล็อกตลาดนัด<br/><span>เห็นผังจริงก่อนเลือก</span></h1><p>เลือกตลาด ดูตำแหน่งล็อก และเข้าใจสถานะได้ในที่เดียว</p><div className="hero-actions"><a className="button button-orange" href="#markets">เลือกตลาดที่ใช่เลย <Icon/></a><a className="button button-outline" href="#for-you">สำหรับเจ้าของตลาด</a></div><p className="hero-note"><i/>ข้อมูลที่ชัดเจนช่วยให้เริ่มต้นขายของได้ง่ายขึ้น</p></div><div className="hero-visual"><div className="market-photo" role="img" aria-label="บรรยากาศตลาดริมน้ำยามค่ำคืน"/><div className="location-badge"><Icon name="pin"/> ตลาดนัดน่าเดิน · บรรยากาศที่คุ้นเคย</div><div className="mini-map"><div className="mini-heading"><div><small>เลือกตลาดที่ชอบ</small><strong>{markets[0].name}</strong></div><a href="#floor-plan" aria-label="ดูผังตลาด"><Icon/></a></div><div className="mini-canvas"><span>ทางเดินหลัก</span><div className="mini-slots">{Array.from({ length: 24 }, (_, i) => <i key={i} className={i === 8 ? "mini-selected" : [5, 7, 15].includes(i) ? "mini-occupied" : ""}/>)}</div><small>ทางเข้า</small></div><Legend/></div><div className="visual-check"><span><Icon name="check"/></span><div><strong>เห็นตำแหน่งก่อนเลือก</strong><small>มั่นใจกับพื้นที่ขายของคุณ</small></div></div></div></div><div className="container hero-bottom"><span>สำรวจตลาดที่ใช่คุณ</span><a href="#markets" aria-label="เลื่อนลงไปเลือกตลาด"><span/>↓</a></div></section>

      <section id="markets" className="markets-section section"><div className="container"><div className="section-top"><SectionTitle label="เริ่มต้นจากตลาดที่ใช่" title="เลือกตลาด แล้วดูผังล็อกได้เลย" description="ตัวอย่างบรรยากาศตลาดที่พร้อมให้คุณเลือกพื้นที่"/><a className="text-link" href="#floor-plan">เลือกดูผัง <Icon/></a></div><div className="market-list">{markets.map((item, index) => <button key={item.name} className={`market-row ${market === index ? "active" : ""}`} onClick={() => { chooseMarket(index); document.getElementById("floor-plan")?.scrollIntoView({ behavior: "smooth" }); }} aria-pressed={market === index}><span className="row-number">0{index + 1}</span><span className="icon-box"><Icon name="store"/></span><span className="market-info"><strong>{item.name}</strong><small>{item.location}</small></span><span className="row-link">ดูผัง <Icon/></span></button>)}</div></div></section>

      <section id="floor-plan" className="plan-section section"><div className="container"><div className="section-top"><SectionTitle label="ผังที่เลือกได้" title="เห็นตำแหน่งจริง ก่อนตัดสินใจจอง" description="แต่ละสีบอกสถานะของล็อก เลือกพื้นที่ที่อยู่ในใจ"/><span className="location-label"><Icon name="pin"/>{current.location}</span></div><div className="plan-layout"><div className="plan-card"><div className="plan-toolbar"><span className="icon-box"><Icon name="store"/></span><div><strong>{current.name}</strong><small>ผังจำลองสำหรับทดลองเลือก</small></div><div className="zoom-control"><button aria-label="ย่อผัง" disabled={zoom === 80} onClick={() => setZoom(value => Math.max(80, value - 10))}><Icon name="zoom"/></button><span>{zoom}%</span><button aria-label="ขยายผัง" disabled={zoom === 120} onClick={() => setZoom(value => Math.min(120, value + 10))}><Icon name="zoom"/></button></div></div><div className="plan-canvas"><div className="floor-grid" style={{ transform: `scale(${zoom / 100})` }}><div className="map-landmark">● จุดบริการส่วนกลาง ●</div>{rows.map(row => <div className={`slot-row row-${row}`} key={row}>{Array.from({ length: 6 }, (_, index) => { const code = `${row}0${index + 1}`; const taken = occupied.has(code); return <button key={code} disabled={taken} className={`slot ${taken ? "occupied" : ""} ${selected === code ? "selected" : ""}`} aria-label={`ล็อก ${code} ${taken ? "จองแล้ว" : "ว่าง"}`} aria-pressed={selected === code} onClick={() => setSelected(code)}><strong>{code}</strong><small>{taken ? "จองแล้ว" : "ว่าง"}</small></button>; })}</div>)}<div className="walkway">ทางเดินส่วนกลาง</div><div className="entrance"><span>↑</span> ทางเข้า</div></div></div><div className="plan-footer"><Legend/><small>เลือกเฉพาะล็อกที่มีสถานะว่างได้</small></div></div><aside className="selection-panel" aria-live="polite"><p className="panel-step"><span>01</span> รายละเอียดล็อก</p><h3>{selected ? `ล็อก ${selected}` : "เลือกล็อกที่ต้องการ"}</h3><p>{selected ? "พื้นที่ที่คุณเลือก พร้อมดูรายละเอียดก่อนจอง" : "เลือกล็อกสีเขียวบนผังเพื่อดูตำแหน่งและพื้นที่"}</p><dl><div><dt>ตลาด</dt><dd>{current.name}</dd></div><div><dt>หมวดหมู่</dt><dd>{current.type}</dd></div>{selected && <><div><dt>ขนาดพื้นที่</dt><dd>2 × 2 เมตร</dd></div><div><dt>ค่าเช่าต่อวัน</dt><dd>{current.price} บาท</dd></div><div><dt>สถานะ</dt><dd>ว่าง พร้อมเลือก</dd></div></>}</dl><div className="panel-bottom"><button className="button" disabled={!selected} onClick={() => setDialog("booking")}>ดูตัวอย่างการจอง <Icon/></button><small>ตัวอย่างพื้นที่สำหรับทดลองเลือก ยังไม่มีการจองจริง</small></div></aside></div></div></section>

      <section id="how-it-works" className="steps-section section"><div className="container"><div className="section-top"><SectionTitle label="ขั้นตอนใช้งาน" title="จองพื้นที่ขายของได้เป็นลำดับ"/><p className="section-aside">เห็นข้อมูลตลาดไปพร้อมกับการวางแผน<br/>เริ่มต้นขายของในพื้นที่ที่ใช่</p></div><div className="steps">{[{ title: "เลือกตลาด", copy: "ดูข้อมูลตลาดที่ชอบและพื้นที่ที่ต้องการ" }, { title: "เลือกล็อกบนผัง", copy: "เห็นตำแหน่งจริงและสถานะของแต่ละล็อก" }, { title: "ชำระเงินและรับ QR ยืนยัน", copy: "เป็นขั้นตอนของระบบจริง ส่วนนี้ยังไม่มีการรับชำระเงิน" }].map((item, index) => <div className="step" key={item.title}><span className="step-number">0{index + 1}</span><div><h3>{item.title}</h3><p>{item.copy}</p></div><div className="step-line"/></div>)}</div></div></section>

      <section id="for-you" className="roles-section section"><div className="container"><SectionTitle label="ออกแบบเพื่อคนในตลาด" title="จัดการตลาดง่ายขึ้น ทั้งคนขายและคนจัดงาน"/><div className="role-grid"><article className="role-card seller"><div className="role-top"><small>สำหรับผู้ขาย</small><span className="icon-box"><Icon name="store"/></span></div><h3>พ่อค้าแม่ค้า</h3><p>เลือกตำแหน่งร้านได้อย่างชัดเจน พร้อมเห็นสถานะก่อนตัดสินใจ</p><ul><li><Icon name="check"/>เห็นตำแหน่งล็อกก่อนจอง</li><li><Icon name="check"/>ลดการจองซ้ำและความสับสน</li><li><Icon name="check"/>มีพื้นที่ให้คุณเริ่มต้นขาย</li></ul><a href="#markets" className="text-link">เลือกตลาดที่ชอบ <Icon/></a></article><article className="role-card owner"><div className="role-top"><small>สำหรับผู้จัดงาน</small><span className="icon-box"><Icon name="grid"/></span></div><h3>เจ้าของตลาด</h3><p>ดูแลผังและการจองจากภาพรวมเดียว ลดงานที่ต้องจัดการด้วยตนเอง</p><ul><li><Icon name="check"/>จัดการผังล็อก</li><li><Icon name="check"/>ตรวจสอบสถานะพื้นที่</li><li><Icon name="check"/>ดูข้อมูลร้านค้า</li></ul><button className="text-link" onClick={() => setDialog("owner")}>ดูรายละเอียด <Icon/></button></article></div></div></section>

      <section className="stories-section section"><div className="container"><div className="section-top"><SectionTitle label="พื้นที่เล็กๆ ของร้านค้า" title="ร้านน่าตามในกาดนี้"/><span className="story-note"><i/>แรงบันดาลใจจากตลาด</span></div><div className="stories-grid">{[{ title: "จิ๋วแจกไม้", copy: "ดอกไม้และของขวัญ", photo: "flower" }, { title: "ขนมโฮมเมด", copy: "ขนมทำสด", photo: "bakery" }, { title: "เสื้อผ้ามือสอง", copy: "แฟชั่นและไลฟ์สไตล์", photo: "clothes" }].map((item, index) => <article className="story" key={item.title}><div className={`story-photo photo-${item.photo}`} role="img" aria-label={item.copy}><span>0{index + 1}</span></div><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div></div></section>
      <section className="cta-section"><div className="container cta-inner"><div><p className="eyebrow">พร้อมลองเลือกพื้นที่หรือยัง</p><h2>เริ่มจากตลาดที่ใช่<br/>แล้วเลือกล็อกของคุณ</h2></div><a className="button button-white" href="#markets">เลือกตลาดข้างล่าง <Icon/></a><div className="cta-art" aria-hidden="true"><i/><i/><i/></div></div></section>
    </main>
    <footer><div className="container"><div className="footer-top"><Brand/><p>พื้นที่เล็กๆ ของความตั้งใจ</p><nav aria-label="เมนูท้ายหน้า"><a href="#how-it-works">วิธีใช้งาน</a><a href="#markets">ตลาดนัดต่างๆ</a><a href="#for-you">สำหรับผู้จัดงาน</a></nav></div><div className="footer-bottom"><span>© 2026 Zonify · จองล็อกตลาดนัด</span><span>พื้นที่ทดลองใช้งานสำหรับเลือกล็อกตลาด</span></div></div></footer>
    {dialog && <div className="modal-backdrop" onClick={() => setDialog(null)}><section ref={modalRef} className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={event => event.stopPropagation()}><button className="modal-close" aria-label="ปิดหน้าต่าง" autoFocus onClick={() => setDialog(null)}><Icon name="close"/></button><span className="icon-box"><Icon name={dialog === "booking" ? "store" : "grid"}/></span><h2 id="dialog-title">{dialog === "booking" ? "พื้นที่ที่คุณเลือก" : "สำหรับเจ้าของตลาด"}</h2>{dialog === "booking" ? <><p>{current.name} · ล็อก {selected}</p><dl><div><dt>ขนาดพื้นที่</dt><dd>2 × 2 เมตร</dd></div><div><dt>ค่าเช่าต่อวัน</dt><dd>{current.price} บาท</dd></div></dl><p className="demo-notice">นี่คือตัวอย่างการเลือกพื้นที่ ยังไม่ได้เชื่อมระบบจองหรือชำระเงินจริง</p></> : <><p>จัดการผังล็อก ตรวจสอบพื้นที่ว่าง และดูร้านค้าได้จากที่เดียว</p><p className="demo-notice">หน้าจัดการตลาดยังอยู่ระหว่างพัฒนา ตอนนี้สามารถทดลองเลือกตลาดและล็อกบนหน้าเว็บได้</p></>}<button className="button button-green" onClick={() => setDialog(null)}>กลับไปดูผัง <Icon/></button></section></div>}
  </>;
}
