"use client";
import Link from "next/link";
import { type FormEvent } from "react";
import { usePublicData } from "../lib/use-public-data";
import type { Category, Market, ShopResults } from "../lib/catalog";
import { Icon } from "./icons";
import { useURLState } from "../lib/use-url-state";
import { shopFilters } from "../lib/url-state";
import type { InitialData } from "../lib/use-public-data";
export function ShopDirectory({ markets, initialCategories }: { markets: Market[]; initialCategories?: InitialData<{ items: Category[] }> }) {
  const categories = usePublicData<{ items: Category[] }>("/api/categories", 0, true, initialCategories);
  const { params, update } = useURLState();
  const filters = shopFilters(params);
  if (markets.length && !markets.some(m => m.id === filters.market)) filters.market = "";
  if (categories.data && !categories.data.items.some(c => c.id === filters.category)) filters.category = "";
  const returnTo = "/?" + params.toString() + "#shops";
  const query = new URLSearchParams({ page: String(filters.page), limit: "6" });
  if (filters.q) query.set("q", filters.q);
  if (filters.market) query.set("market", filters.market);
  if (filters.category) query.set("category", filters.category);
  const shops = usePublicData<ShopResults>("/api/shops?" + query);
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); update({ q: String(new FormData(event.currentTarget).get("q") ?? "").trim().slice(0, 100), page: null }, "shops"); }
  function clear() { update({ q: null, shopMarket: null, category: null, page: null }, "shops"); }
  return <section id="shops" className="directory-section"><div className="container">
    <div className="section-top"><div><h2>ค้นหาร้านที่อยากแวะ</h2><p>อาหาร งานคราฟต์ และร้านเล็ก ๆ ในตลาดที่คุณชอบ</p></div></div>
    <form className="directory-filters" onSubmit={search} role="search" aria-label="ค้นหาร้านค้า">
      <label className="shop-search"><span>ชื่อร้านหรือสินค้า</span><div><Icon name="search"/><input key={filters.q} name="q" type="search" maxLength={100} placeholder="เช่น กาแฟ เซรามิก ผ้าทอ" defaultValue={filters.q}/></div></label>
      <label><span>ตลาด</span><select aria-label="กรองร้านตามตลาด" value={filters.market} onChange={e => update({ shopMarket: e.target.value, page: null }, "shops")}><option value="">ทุกตลาด</option>{markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
      <label><span>หมวดหมู่</span><select aria-label="กรองร้านตามหมวดหมู่" value={filters.category} disabled={!categories.data} onChange={e => update({ category: e.target.value, page: null }, "shops")}><option value="">ทุกหมวดหมู่</option>{categories.data?.items.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <button type="submit" className="button button-green">ค้นหาร้าน</button>
    </form>
    {categories.error && <p className="form-alert" role="alert">โหลดหมวดหมู่ไม่ได้ <button className="text-link" onClick={categories.retry}>ลองโหลดหมวดหมู่อีกครั้ง</button></p>}
    <div className="directory-results" aria-live="polite" aria-busy={shops.loading}>
      {shops.loading ? <p className="catalog-state" role="status">กำลังค้นหาร้านค้า…</p> : shops.error ? <div className="catalog-state" role="alert">โหลดร้านค้าไม่ได้ <button className="text-link" onClick={shops.retry}>ลองโหลดร้านค้าอีกครั้ง</button></div> : shops.data ? <>
        <div className="result-count"><p>พบ {shops.data.total} ร้าน{filters.q ? ` สำหรับ “${filters.q}”` : ""}</p><button className="text-link" onClick={clear}>ล้างตัวกรอง</button></div>
        {shops.data.items.length ? <div className="shop-grid">{shops.data.items.map(shop => <article className="shop-card" key={shop.id}>
          <span className="shop-category"><Icon name="store"/>{shop.category.name}</span>
          <h3><Link href={{ pathname: `/shops/${shop.id}`, query: { returnTo } }}>{shop.name}</Link></h3><p>{shop.description}</p>
          <div className="shop-position"><Icon name="pin"/><span>{shop.market.name}{shop.stall ? ` · ล็อก ${shop.stall.code}` : ""}</span></div>
          <Link href={{ pathname: `/shops/${shop.id}`, query: { returnTo } }} className="text-link" aria-label={`ดูรายละเอียด ${shop.name}`}>ดูร้านค้า <Icon/></Link>
        </article>)}</div> : <div className="catalog-state">ไม่พบร้านค้าที่ตรงกับการค้นหา ลองเปลี่ยนคำค้นหรือล้างตัวกรอง</div>}
        {shops.data.pages > 1 && <nav className="pagination" aria-label="หน้ารายชื่อร้านค้า">
          <button className="button button-white" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 }, "shops")}>ก่อนหน้า</button>
          <span>หน้า {filters.page} / {shops.data.pages}</span>
          <button className="button button-white" disabled={filters.page >= shops.data.pages} onClick={() => update({ page: filters.page + 1 }, "shops")}>ถัดไป</button>
        </nav>}
      </> : null}
    </div>
  </div></section>;
}
