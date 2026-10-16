import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "../../lib/server-auth";
import type { Shop } from "../../lib/catalog";
import { AuthShell } from "../../components/auth-shell";
import { Icon } from "../../components/icons";
import { shopReturnHref } from "../../lib/url-state";
export const metadata = { title: "ร้านค้า | Zonify" };
export default async function ShopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = shopReturnHref(typeof query.returnTo === "string" ? query.returnTo : undefined);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id)) notFound();
  const [response, user] = await Promise.all([
    fetch(`${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/shops/${encodeURIComponent(id)}`, { cache: "no-store" }),
    currentUser(),
  ]);
  if (response.status === 404) notFound();
  if (!response.ok) throw new Error("โหลดข้อมูลร้านค้าไม่ได้");
  const shop: Shop = await response.json();
  const position = new URLSearchParams({ market: shop.market.id, ...(shop.stall ? { stall: shop.stall.id } : {}) });
  return <AuthShell title={shop.name} subtitle={shop.market.name + " · " + shop.market.location} user={user}>
    <article className="shop-detail">
      <span className="shop-detail-mark" aria-hidden="true"><Icon name="store"/></span><span className="shop-category"><Icon name="store"/>{shop.category.name}</span>
      <p className="shop-description">{shop.description}</p>
      <dl><div><dt>ตลาด</dt><dd>{shop.market.name}</dd></div><div><dt>ตำแหน่ง</dt><dd>{shop.stall ? "ล็อก " + shop.stall.code : "ยังไม่ระบุตำแหน่งล็อก"}</dd></div><div><dt>เวลาเปิดร้าน</dt><dd>{shop.hours || "ยังไม่ระบุเวลาเปิดร้าน"}</dd></div></dl>
      <p className="catalog-note">ตำแหน่งร้านเป็นข้อมูลร้านค้า โปรดดูสถานะพื้นที่แยกตามวันที่บนผัง</p>
      <div className="shop-detail-actions"><Link href={`/?${position}#floor-plan`} className="button button-green">{shop.stall ? "ดูตำแหน่งบนผัง" : "ดูผังตลาด"} <Icon/></Link><a href={returnTo} className="text-link">กลับไปรายชื่อร้านค้า</a></div>
    </article>
  </AuthShell>;
}
