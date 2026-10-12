import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "../lib/auth";
import { AccountMenu } from "./account-menu";
import { Icon } from "./icons";
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
      <nav aria-label="เมนูบัญชี"><AccountMenu user={user}/></nav>
    </div></header>
    <main id="secondary-content" tabIndex={-1} className={(wide ? "admin-page" : "account-page") + (auth ? " secondary-auth" : "")}>
      <div className="account-heading"><Link href="/" className="text-link secondary-back"><Icon name="arrow"/>กลับหน้าแรก</Link><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="secondary-content">{children}</div>
    </main>
  </div>;
}
