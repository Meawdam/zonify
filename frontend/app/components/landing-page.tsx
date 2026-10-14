"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Icon } from "./icons";
import { MarketExplorer } from "./market-explorer";
import { Advertisements } from "./advertisements";
import { InfoDialog, type DialogMode } from "./info-dialog";

import { AccountMenu } from "./account-menu";
import type { User } from "../lib/auth";
import "./landing-preview.css";

function Brand() {
  return <a href="#" className="brand" aria-label="Zonify หน้าแรก"><Icon name="store"/><span>Zonify</span></a>;
}

export function LandingPage({ user, initialDate, initialMarket, initialStall }: { user: User | null; initialDate: string; initialMarket: string; initialStall: string }) {
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [menu, setMenu] = useState(false);
  const closeDialog = useCallback(() => setDialog(null), []);
  return <div className="zonify-preview">
    <header className="site-header"><div className="container header-inner">
      <Brand/>
      <button className="mobile-menu" aria-label="เปิดเมนู" aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}>เมนู</button>
      <nav id="main-nav" className={menu ? "nav open" : "nav"} aria-label="เมนูหลัก">
        <a href="#markets" onClick={() => setMenu(false)}>สำรวจตลาด</a><a href="#floor-plan" onClick={() => setMenu(false)}>ดูผังล็อก</a><a href="#shops" onClick={() => setMenu(false)}>ค้นหาร้านค้า</a>
        <button className="nav-link" onClick={() => { setDialog("owner"); setMenu(false); }}>สำหรับเจ้าของตลาด</button>
        <AccountMenu user={user}/>
      </nav>
    </div></header>
    <main>
      <section className="hero"><div className="container hero-grid">
        <div className="hero-copy"><h1>ตลาดที่ใช่<br/><span>พื้นที่ของคุณ</span></h1><p>เลือกตลาด ดูผังล็อก และค้นหาร้านที่อยากแวะ</p>
          <div className="hero-actions"><a href="#markets" className="button button-green">เริ่มเลือกตลาด <Icon/></a><a href="#how-it-works" className="text-link">ดูวิธีสำรวจ <Icon/></a></div>
        </div>
        <figure className="hero-media"><div className="hero-visual"><Image src="/images/zonify-editorial-hero.webp" alt="ภาพจำลองบรรยากาศตลาดริมคลองเชียงใหม่ยามเย็น" fill loading="eager" fetchPriority="high" sizes="(max-width: 800px) 100vw, 55vw"/></div><figcaption><span>บรรยากาศตลาดเชียงใหม่</span><a href="#floor-plan">สำรวจพื้นที่ <Icon/></a></figcaption></figure>
      </div>
      <div id="how-it-works" className="container steps" aria-label="ขั้นตอนการสำรวจตลาด">
        {[{ title: "เลือกตลาด", copy: "ค้นหาตลาดที่ตรงกับสไตล์ของคุณ", icon: "pin" as const }, { title: "ดูล็อกบนผัง", copy: "ดูตำแหน่ง ขนาด ราคา และสถานะ", icon: "grid" as const }, { title: "ค้นหาร้านค้า", copy: "ดูร้านที่สนใจและตำแหน่งบนผัง", icon: "store" as const }].map((step, index) => <div className="step" key={step.title}><div className="step-mark"><span className="step-number">0{index + 1}</span><span className="step-icon"><Icon name={step.icon}/></span></div><div><h2>{step.title}</h2><p>{step.copy}</p></div></div>)}
      </div></section>
      <MarketExplorer initialDate={initialDate} initialMarket={initialMarket} initialStall={initialStall} loggedIn={!!user}/>
      <Advertisements/>
      <section className="cta-section"><div className="container cta-inner"><div><h2>เริ่มร้านเล็ก ๆ ในตลาดที่ใช่</h2><p>พื้นที่ดี ๆ รอให้เรื่องราวของคุณเริ่มต้น</p></div><a className="button button-white" href="#markets">เลือกตลาดของคุณ <Icon/></a></div></section>
    </main>
    <footer><div className="container footer-inner"><Brand/><p>© 2026 Zonify · พื้นที่ทดลองเลือกล็อกตลาดนัดเชียงใหม่</p></div></footer>
    {dialog && <InfoDialog mode={dialog} onClose={closeDialog}/>}
  </div>;
}
