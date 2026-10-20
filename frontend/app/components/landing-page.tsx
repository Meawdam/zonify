"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { Icon } from "./icons";
import { MarketExplorer } from "./market-explorer";
import { Advertisements } from "./advertisements";
import { InfoDialog, type DialogMode } from "./info-dialog";

import { AccountMenu } from "./account-menu";
import type { User } from "../lib/auth";
import type { LandingData } from "../lib/server-catalog";
import "./landing-preview.css";

function Brand() {
  return <a href="#" className="brand" aria-label="Zonify หน้าแรก"><Icon name="store"/><span>Zonify</span></a>;
}

export function LandingPage({ user, initialDate, initialMarket, initialStall, initialData }: { user: User | null; initialDate: string; initialMarket: string; initialStall: string; initialData?: LandingData }) {
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
        <div className="hero-copy"><h1>ตลาดที่ใช่<br/><span>พื้นที่ของคุณ</span></h1><p>หาพื้นที่ขายของ ดูราคาและผังล็อกก่อนจอง หรือค้นหาร้านที่อยากแวะ</p>
          <div className="hero-actions"><a href="#markets" className="button button-green">จองพื้นที่ขายของ <Icon/></a><a href="#shops" className="text-link">ค้นหาร้านค้า <Icon name="store"/></a></div><a href="#how-it-works" className="text-link booking-how-link">ดูขั้นตอนการจอง <Icon/></a>
        </div>
        <figure className="hero-media"><div className="hero-visual"><Image src="/images/zonify-editorial-hero.webp" alt="ภาพจำลองบรรยากาศตลาดริมคลองเชียงใหม่ยามเย็น" fill loading="eager" fetchPriority="high" sizes="(max-width: 800px) 100vw, 55vw"/></div><figcaption><span>บรรยากาศตลาดเชียงใหม่</span><a href="#floor-plan">สำรวจพื้นที่ <Icon/></a></figcaption></figure>
      </div>
      <div id="how-it-works" className="container steps" aria-label="ขั้นตอนการจองพื้นที่">
        {[{ title: "เลือกตลาดและวันขาย", copy: "ดูผัง ขนาด ราคา และล็อกที่ว่าง", icon: "pin" as const }, { title: "เลือกร้านและพักล็อก", copy: "เข้าสู่ระบบ เพิ่มร้าน แล้วพักล็อก 10 นาที", icon: "grid" as const }, { title: "ส่งหลักฐานและรอยืนยัน", copy: "เข้าสู่ขั้นชำระเงิน ส่งสลิปภายใน 30 นาที แล้วรอผู้จัดการอนุมัติ", icon: "store" as const }].map((step, index) => <div className="step" key={step.title}><div className="step-mark"><span className="step-number">0{index + 1}</span><span className="step-icon"><Icon name={step.icon}/></span></div><div><h2>{step.title}</h2><p>{step.copy}</p></div></div>)}
      </div></section>
      <MarketExplorer initialDate={initialDate} initialMarket={initialMarket} initialStall={initialStall} initialData={initialData} loggedIn={!!user}/>
      <Advertisements/>
      <section className="cta-section"><div className="container cta-inner"><div><h2>เริ่มร้านเล็ก ๆ ในตลาดที่ใช่</h2><p>พื้นที่ดี ๆ รอให้เรื่องราวของคุณเริ่มต้น</p></div><a className="button button-white" href="#markets">เลือกตลาดของคุณ <Icon/></a></div></section>
    </main>
    <footer><div className="container footer-inner"><Brand/><p>© 2026 Zonify · พื้นที่ทดลองเลือกล็อกตลาดนัดเชียงใหม่</p></div></footer>
    {dialog && <InfoDialog mode={dialog} onClose={closeDialog}/>}
  </div>;
}
