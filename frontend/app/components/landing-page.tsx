"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Icon } from "./icons";
import { MarketExplorer } from "./market-explorer";
import { Advertisements } from "./advertisements";
import { InfoDialog, type DialogMode } from "./info-dialog";

import { AccountMenu } from "./account-menu";
import type { User } from "../lib/auth";

function Brand() {
  return <a href="#" className="brand" aria-label="Zonify หน้าแรก"><Icon name="store"/><span>Zonify</span></a>;
}

export function LandingPage({ user, initialDate, initialMarket, initialStall }: { user: User | null; initialDate: string; initialMarket: string; initialStall: string }) {
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [menu, setMenu] = useState(false);
  const closeDialog = useCallback(() => setDialog(null), []);
  return <>
    <header className="site-header"><div className="container header-inner">
      <Brand/>
      <button className="mobile-menu" aria-label="เปิดเมนู" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}>เมนู</button>
      <nav id="main-nav" className={menu ? "nav open" : "nav"} aria-label="เมนูหลัก">
        <a href="#markets" onClick={() => setMenu(false)}>สำรวจตลาด</a><a href="#shops" onClick={() => setMenu(false)}>ค้นหาร้านค้า</a>
        <button className="nav-link" onClick={() => { setDialog("owner"); setMenu(false); }}>สำหรับเจ้าของตลาด</button>
        <AccountMenu user={user}/>
      </nav>
    </div></header>
    <main>
      <section className="hero"><div className="container hero-grid">
        <div className="hero-copy"><h1>ตลาดที่ใช่<br/>พื้นที่ของคุณ</h1><p>เลือกตลาด ดูผังล็อก และค้นหาร้านที่อยากแวะ</p>
          <div className="hero-actions"><a href="#markets" className="button button-green">เริ่มเลือกตลาด <Icon/></a><a href="#how-it-works" className="text-link">ดูวิธีสำรวจ <Icon/></a></div>
          <div className="landscape-line" aria-hidden="true"><svg viewBox="0 0 420 90" fill="none"><path d="M2 72 42 60 63 67 94 51 110 55 151 32 183 45 212 24 232 30 271 51 300 46 326 58 418 73M30 79h352M50 72V43l-11 19h22L50 43M79 70V30l-12 20h24L79 30M83 30V20M81 20h4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg></div>
        </div>
        <div className="hero-visual"><Image src="/images/sunseto-hero.webp" alt="บรรยากาศตลาดริมคลองเชียงใหม่ยามเย็น" fill loading="eager" fetchPriority="high" sizes="(max-width: 680px) 100vw, 55vw"/><span className="sun-mark" aria-hidden="true">☼</span></div>
      </div>
      <div id="how-it-works" className="container steps" aria-label="ขั้นตอนการสำรวจตลาด">
        {[{ title: "เลือกตลาด", copy: "ค้นหาตลาดที่ตรงกับสไตล์ของคุณ" }, { title: "ดูล็อกบนผัง", copy: "ดูตำแหน่ง ขนาด ราคา และสถานะ" }, { title: "ค้นหาร้านค้า", copy: "ดูร้านที่สนใจและตำแหน่งบนผัง" }].map((step, index) => <div className="step" key={step.title}><span className="step-number">0{index + 1}</span><h2>{step.title}</h2><p>{step.copy}</p></div>)}
      </div></section>
      <MarketExplorer initialDate={initialDate} initialMarket={initialMarket} initialStall={initialStall} loggedIn={!!user}/>
      <Advertisements/>
      <section className="cta-section"><div className="container cta-inner"><h2>เริ่มร้านเล็ก ๆ ในตลาดที่ใช่</h2><p>พื้นที่ดี ๆ รอให้เรื่องราวของคุณเริ่มต้น</p><a className="button button-white" href="#markets">เลือกตลาดของคุณ <Icon/></a></div></section>
    </main>
    <footer><div className="container footer-inner"><Brand/><p>© 2026 Zonify · พื้นที่ทดลองเลือกล็อกตลาดนัดเชียงใหม่</p></div></footer>
    {dialog && <InfoDialog mode={dialog} onClose={closeDialog}/>}
  </>;
}
