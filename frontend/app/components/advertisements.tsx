"use client";
import Link from "next/link";
import { usePublicData } from "../lib/use-public-data";
type Advertisement = { id: string; name: string; description: string; photo: string; market: { name: string }; href: string };
export function Advertisements() {
  const result = usePublicData<{ items: Advertisement[] }>("/api/advertisements", 60_000, true);
  if (result.loading && !result.data) return null;
  if (result.error) return <div className="container"><p className="catalog-state" role="alert">โหลดข่าวประชาสัมพันธ์ไม่ได้ <button className="text-link" onClick={result.retry}>ลองอีกครั้ง</button></p></div>;
  if (!result.data?.items.length) return null;
  return <section className="advertisement-section container" aria-label="ข่าวประชาสัมพันธ์"><div className="section-heading"><h2>ข่าวจากตลาด</h2><p>กิจกรรมและร้านที่อยากชวนคุณแวะ</p></div><div className="advertisement-grid">
    {result.data.items.map(a => <article key={a.id} className="advertisement-card"><div className={"market-image photo-" + a.photo} aria-hidden="true"/><div className="advertisement-copy"><span>ประชาสัมพันธ์ • {a.market.name}</span><h3>{a.name}</h3><p>{a.description}</p><Link className="text-link" href={a.href}>ดูรายละเอียด</Link></div></article>)}
  </div></section>;
}
