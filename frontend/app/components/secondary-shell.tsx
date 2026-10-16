import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import type { User } from "../lib/auth";
import { AccountMenu } from "./account-menu";
import { Icon } from "./icons";
import { AccountDataBoundary } from "./account-data-boundary";
import "./secondary-shell.css";

export function SecondaryShell({ title, subtitle, user = null, wide = false, auth = false, children }: {
  title: string;
  subtitle: string;
  user?: User | null;
  wide?: boolean;
  auth?: boolean;
  children: ReactNode;
}) {
  return <div className="zonify-secondary">
    <a className="secondary-skip" href="#secondary-content">ข้ามไปเนื้อหา</a>
    <header className="site-header"><div className="container header-inner">
      <Link href="/" className="brand" aria-label="Zonify หน้าแรก"><Icon name="store"/><span>Zonify</span></Link>
      <nav aria-label="เมนูบัญชี"><AccountMenu user={user}/>{auth && !user && <Link className="secondary-register-link" href="/register">สมัครสมาชิก</Link>}</nav>
    </div></header>
    <main id="secondary-content" tabIndex={-1} className={(wide ? "admin-page" : "account-page") + (auth ? " secondary-auth" : "")}>
      <div className="account-heading"><div className="heading-copy"><Link href="/" className="text-link secondary-back"><Icon name="arrow"/>กลับหน้าแรก</Link><h1>{title}</h1><p>{subtitle}</p></div>{auth && <div className="auth-market-photo"><Image src="/images/zonify-editorial-hero.webp" alt="ภาพจำลองตลาดริมคลองเชียงใหม่" fill sizes="(max-width: 760px) 100vw, 50vw" loading="eager"/></div>}</div>
      <div className="secondary-content"><AccountDataBoundary key={user ? user.id + ":" + user.role : "anonymous"}>{children}</AccountDataBoundary></div>
    </main>
    <footer className="secondary-footer"><div className="container footer-inner"><Link href="/" className="brand" aria-label="Zonify หน้าแรก"><Icon name="store"/><span>Zonify</span></Link><p>© 2026 Zonify · พื้นที่ทดลองเลือกล็อกตลาดนัดเชียงใหม่</p></div></footer>
  </div>;
}
