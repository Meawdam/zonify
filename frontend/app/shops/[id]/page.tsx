import Link from "next/link";
import Image from "next/image";
import { validDate } from "../../lib/catalog";
import { notFound } from "next/navigation";
import { currentUser } from "../../lib/server-auth";
import type { Shop } from "../../lib/catalog";
import { AuthShell } from "../../components/auth-shell";
import { Icon } from "../../components/icons";
import { shopReturnHref } from "../../lib/url-state";
export const metadata = { title: "ร้านค้า | Zonify" };
export default async function ShopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string; date?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = shopReturnHref(typeof query.returnTo === "string" ? query.returnTo : undefined);
  const date = typeof query.date === "string" && validDate(query.date) ? query.date : "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id)) notFound();
  const [response, user] = await Promise.all([
    fetch(`${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/shops/${encodeURIComponent(id)}${date ? "?date=" + date : ""}`, { cache: "no-store" }),
    currentUser(),
  ]);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("โหลดข้อมูลร้านค้าไม่ได้");
  const shop: Shop = await response.json();
  const position = new URLSearchParams({ market: shop.market.id, ...(shop.locationDate ? { date: shop.locationDate } : {}), ...(shop.stall ? { stall: shop.stall.id } : {}) });
  return <AuthShell title={shop.name} subtitle={shop.market.name + " · " + shop.market.location} user={user}>
    <article className="shop-detail">
      {shop.photoUrl && <Image unoptimized src={shop.photoUrl} width={640} height={360} style={{ width: "100%", height: "auto", borderRadius: 16 }} alt={shop.name}/>}
      <span className="shop-detail-mark" aria-hidden="true"><Icon name="store"/></span><span className="shop-category"><Icon name="store"/>{shop.category.name}</span>
      <p className="shop-description">{shop.description}</p>
      <dl><div><dt>ตลาด</dt><dd>{shop.market.name}</dd></div><div><dt>ตำแหน่ง</dt><dd>{shop.stall ? "ล็อก " + shop.stall.code : "ยังไม่ระบุตำแหน่งล็อก"}</dd></div><div><dt>เวลาเปิดร้าน</dt><dd>{shop.hours || "ยังไม่ระบุเวลาเปิดร้าน"}</dd></div></dl>
      {shop.phone && <p>โทร: <a href={"tel:" + shop.phone.replace(/[^+0-9]/g, "")}>{shop.phone}</a></p>}{shop.contactUrl && /^https?:\/\//.test(shop.contactUrl) && <p><a href={shop.contactUrl} target="_blank" rel="noopener noreferrer">เว็บไซต์ / ช่องทางติดต่อร้าน</a></p>}
      <form method="get"><label htmlFor="shop-location-date">ดูตำแหน่งวันที่ <input id="shop-location-date" name="date" type="date" defaultValue={shop.locationDate}/></label><input type="hidden" name="returnTo" value={returnTo}/><button className="button button-white" type="submit">ดูวันที่นี้</button></form>
      <p className="catalog-note">{shop.locationSource === "reservation" ? `ตำแหน่งจากการจองที่ยืนยันแล้ว วันที่ ${shop.locationDate}` : "ตำแหน่งร้านจากข้อมูลที่ผู้ดูแลกำหนด"}</p>
      {(shop.locations?.length ?? 0) > 1 && <ul>{shop.locations!.map(s => <li key={s.id}><Link href={"/?" + new URLSearchParams({ market: shop.market.id, date: shop.locationDate!, stall: s.id }) + "#floor-plan"}>ดูล็อก {s.code}</Link></li>)}</ul>}
      <div className="shop-detail-actions"><Link href={`/?${position}#floor-plan`} className="button button-green">{shop.stall ? "ดูตำแหน่งบนผัง" : "ดูผังตลาด"} <Icon/></Link><a href={returnTo} className="text-link">กลับไปรายชื่อร้านค้า</a></div>
    </article>
  </AuthShell>;
}
