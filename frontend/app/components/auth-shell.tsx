import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "../lib/auth";
import { AccountMenu } from "./account-menu";
export function AuthShell({ title, subtitle, user = null, children }: { title: string; subtitle: string; user?: User | null; children: ReactNode }) {
  return <>
    <header className="site-header"><div className="container header-inner">
      <Link href="/" className="brand"><span>Zonify</span></Link><AccountMenu user={user}/>
    </div></header>
    <main className="account-page"><div className="account-heading"><Link href="/" className="text-link">กลับหน้าแรก</Link><h1>{title}</h1><p>{subtitle}</p></div>{children}</main>
  </>;
}
