"use client";
import { useState } from "react";
import { usePublicData } from "../lib/use-public-data";
import { baht } from "../lib/catalog";
import { bookingStatusLabels, type BookingStatus } from "../lib/bookings";
import type { AdminRow } from "../lib/admin";
type DashboardData = { date: string; markets: number; shops: number; availability: Record<string, number>; bookings: Partial<Record<BookingStatus, number>>;
  payments: { received: number; refunded: number; net: number }; pendingRefunds: { count: number; amount: number }; perMarket: { id: string; name: string; available: number; held: number; booked: number; unavailable: number }[] };
type BookingReport = { basis: "booking_date"; total: number; rows: { period: string; marketId: string; marketName: string; status: BookingStatus; count: number; bookingAmount: number }[] };
type RevenueReport = { basis: "manager_recorded_payment_and_refund_time"; totals: { received: number; refunded: number; net: number };
  pendingRefunds: { count: number; amount: number }; rows: { period: string; marketId: string; marketName: string; received: number; refunded: number; net: number }[] };
function MarketSelect({ markets, value, onChange }: { markets: AdminRow[]; value: string; onChange: (value: string) => void }) {
  return <label>ตลาด<select aria-label="ตลาดสรุปผล" value={value} onChange={e => onChange(e.target.value)}><option value="">ทุกตลาด</option>{markets.map(m => <option key={m.id} value={m.id}>{m.name}{m.active === false ? " (ปิดแสดง)" : ""}</option>)}</select></label>;
}
function Cards({ items }: { items: { label: string; value: number; money?: boolean }[] }) {
  return <dl className="report-cards">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{baht(item.value)}{item.money ? " บาท" : ""}</dd></div>)}</dl>;
}
export function Dashboard({ today, markets }: { today: string; markets: AdminRow[] }) {
  const [date, setDate] = useState(today), [market, setMarket] = useState("");
  const query = new URLSearchParams({ date, ...(market ? { market } : {}) });
  const result = usePublicData<DashboardData>("/api/admin/dashboard?" + query, 20_000, true);
  return <section className="report-workspace"><div className="admin-section-heading"><div><h2>ภาพรวมตลาด</h2><p>สถานะล็อกและการจองตามวันที่เลือก • อัปเดตทุก 20 วินาที</p></div></div>
    <div className="admin-filters"><label>วันที่ภาพรวม<input aria-label="วันที่ภาพรวม" type="date" value={date} required onChange={e => { if (e.target.value) setDate(e.target.value); }}/></label><MarketSelect markets={markets} value={market} onChange={setMarket}/><button className="text-link" onClick={result.retry}>โหลดภาพรวมใหม่</button></div>
    {result.loading && !result.data ? <p className="catalog-state" role="status">กำลังโหลดภาพรวม…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button className="text-link" onClick={result.retry}>ลองใหม่</button></p> : result.data && <>
      <Cards items={[{ label: "ตลาดที่เปิดแสดง", value: result.data.markets }, { label: "ร้านที่ค้นหาได้", value: result.data.shops }, { label: "ล็อกว่าง", value: result.data.availability.available ?? 0 }, { label: "ล็อกจองแล้ว", value: result.data.availability.booked ?? 0 }]}/>
      <Cards items={[{ label: "พักล็อกอยู่", value: result.data.bookings.held ?? 0 }, { label: "รอชำระเงิน", value: result.data.bookings.pending_payment ?? 0 }, { label: "รอตรวจสลิป", value: result.data.bookings.payment_review ?? 0 }, { label: "ยืนยันการจองแล้ว", value: result.data.bookings.confirmed ?? 0 }]}/>
      <h3>ยอดตามวันที่บันทึกรับหรือคืนเงิน</h3><p className="form-description">ใช้วันที่ผู้จัดการตรวจรับและบันทึกคืนเงิน ตามเวลาไทย ยอดการจองยังไม่ชำระไม่รวมในรายรับ</p>
      <Cards items={[{ label: "บันทึกรับเงิน", value: result.data.payments.received, money: true }, { label: "บันทึกคืนแล้ว", value: result.data.payments.refunded, money: true }, { label: "รับหักคืน", value: result.data.payments.net, money: true }, { label: "รอคืนเงินทั้งหมด", value: result.data.pendingRefunds.amount, money: true }]}/>
      <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="สถานะล็อกแต่ละตลาด"><table className="admin-table"><thead><tr><th>ตลาด</th><th>ว่าง</th><th>พักล็อก</th><th>จองแล้ว</th><th>ปิดใช้งาน</th></tr></thead><tbody>{result.data.perMarket.map(m => <tr key={m.id}><td>{m.name}</td><td>{m.available}</td><td>{m.held}</td><td>{m.booked}</td><td>{m.unavailable}</td></tr>)}{!result.data.perMarket.length && <tr><td colSpan={5}>ไม่มีตลาดที่เปิดแสดงในตัวกรองนี้</td></tr>}</tbody></table></div>
    </>}
  </section>;
}
function Trend({ rows, money }: { rows: { period: string; value: number }[]; money: boolean }) {
  const values = new Map<string, number>(); for (const row of rows) values.set(row.period, (values.get(row.period) ?? 0) + row.value);
  const points = [...values].sort(([a], [b]) => a.localeCompare(b)).slice(-15), max = Math.max(1, ...points.map(([, v]) => Math.abs(v)));
  if (!points.length) return null;
  return <div className="report-trend"><h3>แนวโน้ม 15 ช่วงล่าสุด{money ? " • รับหักคืน" : " • จำนวนรายการ"}</h3><ul>{points.map(([period, value]) => <li key={period}><span>{period}</span><div className="report-track"><span className={value < 0 ? "negative" : ""} style={{ width: Math.abs(value) / max * 100 + "%" }}/></div><strong>{baht(value)}{money ? " บาท" : ""}</strong></li>)}</ul></div>;
}
export function Reports({ today, markets, owner }: { today: string; markets: AdminRow[]; owner: boolean }) {
  const [kind, setKind] = useState<"bookings" | "revenue">("bookings");
  const [from, setFrom] = useState(today.slice(0, 8) + "01"), [to, setTo] = useState(today), [market, setMarket] = useState(""), [group, setGroup] = useState("day");
  const initialQuery = new URLSearchParams({ from: today.slice(0, 8) + "01", to: today, group: "day" }).toString();
  const [query, setQuery] = useState(initialQuery);
  const url = (kind === "bookings" ? "/api/admin/reports/bookings" : "/api/owner/reports/revenue");
  const result = usePublicData<BookingReport | RevenueReport>(url + "?" + query);
  const report = result.data;
  return <section className="report-workspace"><div className="admin-section-heading"><div><h2>รายงาน</h2><p>เลือกช่วงวันไม่เกิน 366 วัน และดาวน์โหลด CSV ได้</p></div></div>
    <div className="report-type"><button className="button button-white" aria-pressed={kind === "bookings"} onClick={() => setKind("bookings")}>รายงานการจอง</button>{owner && <button className="button button-white" aria-pressed={kind === "revenue"} onClick={() => setKind("revenue")}>รายรับของเจ้าของ</button>}</div>
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); setQuery(new URLSearchParams({ from, to, group, ...(market ? { market } : {}) }).toString()); }}>
      <label>วันเริ่มต้น<input type="date" value={from} required onChange={e => setFrom(e.target.value)}/></label><label>วันสิ้นสุด<input type="date" value={to} min={from} required onChange={e => setTo(e.target.value)}/></label><MarketSelect markets={markets} value={market} onChange={setMarket}/>
      <label>รวมผล<select aria-label="รวมผล" value={group} onChange={e => setGroup(e.target.value)}><option value="day">รายวัน</option><option value="month">รายเดือน</option></select></label><button className="button button-green" type="submit">แสดงรายงาน</button><button className="text-link" type="button" onClick={result.retry}>โหลดรายงานใหม่</button>
    </form>
    <p className="form-description">{kind === "bookings" ? "จำนวนและยอดค่าเช่าจัดตามวันที่จอง ยอดค่าเช่าเป็นราคาของรายการแต่ละสถานะ ไม่ใช่เงินที่ได้รับ" : "รายรับจัดตามวันที่ผู้จัดการตรวจรับ และหักเงินคืนตามวันที่บันทึกคืนในเวลาไทย ยอดสุทธิอาจติดลบในวันที่คืนเงิน รอคืนเงินคือยอดค้างทั้งหมดของตลาดที่เลือก"}</p>
    {result.loading ? <p className="catalog-state" role="status">กำลังโหลดรายงาน…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button className="text-link" onClick={result.retry}>ลองใหม่</button></p> : report && <>
      <a className="text-link report-export" href={url + "/export?" + query}>ดาวน์โหลด CSV ของตัวกรองที่แสดง</a>
      <p className="form-description">ข้อมูลที่แสดง: {new URLSearchParams(query).get("from")} ถึง {new URLSearchParams(query).get("to")} • {new URLSearchParams(query).get("group") === "month" ? "รายเดือน" : "รายวัน"}</p>
      {report.basis === "booking_date" ? <>
        <Cards items={[{ label: "รายการทั้งหมด", value: report.total }, { label: "ยืนยันแล้ว", value: report.rows.filter(r => r.status === "confirmed").reduce((n, r) => n + r.count, 0) }, { label: "ยกเลิกแล้ว", value: report.rows.filter(r => r.status === "cancelled").reduce((n, r) => n + r.count, 0) }, { label: "หมดอายุ", value: report.rows.filter(r => r.status === "expired").reduce((n, r) => n + r.count, 0) }]}/>
        <Trend rows={report.rows.map(r => ({ period: r.period, value: r.count }))} money={false}/>
        <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="ตารางรายงานการจอง"><table className="admin-table"><thead><tr><th>ช่วงวันที่จอง</th><th>ตลาด</th><th>สถานะ</th><th>จำนวน</th><th>ยอดค่าเช่ารายการ (บาท)</th></tr></thead><tbody>{report.rows.map(r => <tr key={r.period + r.marketId + r.status}><td>{r.period}</td><td>{r.marketName}</td><td>{bookingStatusLabels[r.status]}</td><td>{r.count}</td><td>{baht(r.bookingAmount)}</td></tr>)}{!report.rows.length && <tr><td colSpan={5}>ไม่มีรายการจองในช่วงที่เลือก</td></tr>}</tbody></table></div>
      </> : <>
        <Cards items={[{ label: "บันทึกรับเงิน", value: report.totals.received, money: true }, { label: "บันทึกคืนแล้ว", value: report.totals.refunded, money: true }, { label: "รับหักคืน", value: report.totals.net, money: true }, { label: "รอคืนเงินทั้งหมด", value: report.pendingRefunds.amount, money: true }]}/>
        <Trend rows={report.rows.map(r => ({ period: r.period, value: r.net }))} money/>
        <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="ตารางรายงานรายรับ"><table className="admin-table"><thead><tr><th>ช่วงวันที่บันทึก</th><th>ตลาด</th><th>รับเงิน (บาท)</th><th>คืนแล้ว (บาท)</th><th>รับหักคืน (บาท)</th></tr></thead><tbody>{report.rows.map(r => <tr key={r.period + r.marketId}><td>{r.period}</td><td>{r.marketName}</td><td>{baht(r.received)}</td><td>{baht(r.refunded)}</td><td>{baht(r.net)}</td></tr>)}{!report.rows.length && <tr><td colSpan={5}>ไม่มีบันทึกรับหรือคืนเงินในช่วงที่เลือก</td></tr>}</tbody></table></div>
      </>}
    </>}
  </section>;
}
