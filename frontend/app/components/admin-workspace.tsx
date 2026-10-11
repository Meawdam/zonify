"use client";
import { useRef, useState, type FormEvent } from "react";
import { ApiError, api, roleLabels, type User } from "../lib/auth";
import { adminFields, adminLabels, adminRequest, defaults, type AdminKind, type AdminRow, type AdminReferences, type AdminResults } from "../lib/admin";
import { usePublicData } from "../lib/use-public-data";
import { StallPlan } from "./stall-plan";
import { baht, type FloorPlan } from "../lib/catalog";
import { BookingList } from "./booking-workspace";

export function AdminWorkspace({ user }: { user: User }) {
  const [tab, setTab] = useState<AdminKind | "floor" | "users" | "bookings" | "holds" | "payments">("markets");
  const refs = usePublicData<AdminReferences>("/api/admin/references", 0, true);
  const [notice, setNotice] = useState("");
  function refresh() { refs.retry(); }
  return <div className="admin-workspace">
    <nav className="admin-tabs" aria-label="เมนูจัดการ">{(Object.keys(adminLabels) as AdminKind[]).map(kind => <button key={kind} aria-current={tab === kind ? "page" : undefined} onClick={() => { setTab(kind); setNotice(""); }}>{adminLabels[kind]}</button>)}<button aria-current={tab === "floor" ? "page" : undefined} onClick={() => { setTab("floor"); setNotice(""); }}>จัดผังล็อก</button><button aria-current={tab === "users" ? "page" : undefined} onClick={() => { setTab("users"); setNotice(""); }}>ผู้ใช้</button></nav>
    <nav className="admin-tabs" aria-label="เมนูรายการจอง"><button aria-current={tab === "bookings" ? "page" : undefined} onClick={() => { setTab("bookings"); setNotice(""); }}>รายการจอง</button><button aria-current={tab === "holds" ? "page" : undefined} onClick={() => { setTab("holds"); setNotice(""); }}>พักล็อก</button><button aria-current={tab === "payments" ? "page" : undefined} onClick={() => { setTab("payments"); setNotice(""); }}>ตรวจชำระเงิน</button></nav>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {refs.loading && !refs.data ? <p className="catalog-state" role="status">กำลังโหลดข้อมูลจัดการ…</p> : refs.error ? <p className="catalog-state" role="alert">{refs.error} <button className="text-link" onClick={refs.retry}>ลองใหม่</button></p> : refs.data && <>
      {tab === "bookings" || tab === "holds" || tab === "payments" ? <BookingList key={tab} manager holdsOnly={tab === "holds"} defaultStatus={tab === "payments" ? "payment_review" : ""}/> : tab === "users" ? <UserList key="users" user={user}/> : tab === "floor" ? <FloorEditor key="floor" refs={refs.data} onChange={refresh}/> : <ResourcePanel key={tab} kind={tab} refs={refs.data} onChange={refresh} onNotice={setNotice}/>}
    </>}
  </div>;
}
function ResourcePanel({ kind, refs, onChange, onNotice }: { kind: AdminKind; refs: AdminReferences; onChange: () => void; onNotice: (message: string) => void }) {
  const [page, setPage] = useState(1);
  const [marketId, setMarket] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQuery] = useState("");
  const [editor, setEditor] = useState<AdminRow | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const params = new URLSearchParams({ page: String(page), q, ...(marketId ? { market: marketId } : {}) });
  const result = usePublicData<AdminResults>("/api/admin/" + kind + "?" + params);
  function saved() { setEditor(null); result.retry(); onChange(); onNotice("บันทึกข้อมูลเรียบร้อยแล้ว"); }
  async function disable(row: AdminRow) {
    if (!window.confirm("ปิดใช้งาน " + (row.name ?? row.code) + " หรือไม่? ข้อมูลจะยังเก็บอยู่และเปิดใช้งานกลับได้")) return;
    setBusy(row.id); setError("");
    try { await adminRequest("/" + kind + "/" + row.id, "DELETE", { version: row.version }); result.retry(); onChange(); onNotice("ปิดใช้งานแล้ว ข้อมูลเดิมยังเก็บอยู่"); }
    catch (e) { setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ"); }
    finally { setBusy(""); }
  }
  return <section aria-label={"จัดการ" + adminLabels[kind]}>
    <div className="admin-section-heading"><div><h2>{adminLabels[kind]}</h2><p>เพิ่ม แก้ไข และปิดใช้งานข้อมูล</p></div><button className="button button-green" onClick={() => { onNotice(""); setEditor(defaults(kind, marketId || refs.markets[0]?.id || "")); }}>เพิ่ม{adminLabels[kind]}</button></div>
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); setQuery(search); setPage(1); }}>
      <label>ค้นหาชื่อหรือรหัส<input value={search} onChange={e => setSearch(e.target.value)} maxLength={100}/></label>
      {["zones", "stalls", "shops"].includes(kind) && <label>ตลาด<select aria-label="ตลาด" value={marketId} onChange={e => { setMarket(e.target.value); setPage(1); }}><option value="">ทุกตลาด</option>{refs.markets.map(m => <option key={m.id} value={m.id}>{m.name}{!m.active ? " (ปิดแสดง)" : ""}</option>)}</select></label>}
      <button className="button button-white" type="submit">ค้นหา</button><button className="text-link" type="button" onClick={result.retry}>โหลดใหม่</button>
    </form>
    {error && <p className="form-alert" role="alert">{error}</p>}
    {result.loading ? <p className="catalog-state" role="status">กำลังโหลด…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button onClick={result.retry}>ลองใหม่</button></p> : result.data && <>
      <p className="admin-result-count">ทั้งหมด {result.data.total} รายการ</p>
      <div className="admin-table-scroll" tabIndex={0} role="region" aria-label={"ตาราง" + adminLabels[kind]}><table className="admin-table"><thead><tr><th>ชื่อ / รหัส</th><th>รายละเอียด</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
        {result.data.items.map(row => <tr key={row.id}><td><strong>{row.name ?? row.code}</strong><small>{row.id}</small></td><td>{summary(kind, row, refs)}</td><td><span className={"admin-badge " + (row.active === false || row.enabled === false ? "inactive" : "")}>{row.active === false || row.enabled === false ? "ปิดใช้งาน" : "เปิดใช้งาน"}</span></td><td><div className="admin-row-actions"><button className="text-link" onClick={() => { onNotice(""); setEditor(row); }}>แก้ไข</button><button className="text-link" onClick={() => disable(row)} disabled={busy === row.id || row.active === false || row.enabled === false}>{busy === row.id ? "กำลังบันทึก…" : "ปิดใช้งาน"}</button></div></td></tr>)}
        {!result.data.items.length && <tr><td colSpan={4}>ไม่พบข้อมูลตามตัวกรอง</td></tr>}
      </tbody></table></div>
      {result.data.pages > 1 && <div className="pagination"><button className="button button-white" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>ก่อนหน้า</button><span>หน้า {page} / {result.data.pages}</span><button className="button button-white" disabled={page >= result.data.pages} onClick={() => setPage(p => p + 1)}>ถัดไป</button></div>}
    </>}
    {editor && <ResourceEditor key={editor.id || "new"} kind={kind} initial={editor} refs={refs} onClose={() => setEditor(null)} onSaved={saved}/>}
  </section>;
}
function summary(kind: AdminKind, row: AdminRow, refs: AdminReferences) {
  if (kind === "markets") return row.location;
  if (kind === "categories") return "ลำดับ " + row.order;
  const market = refs.markets.find(m => m.id === row.marketId)?.name ?? row.marketId;
  if (kind === "zones") return market;
  if (kind === "stalls") return market + " • " + row.width + " × " + row.depth + " ม. • " + baht(Number(row.pricePerDay)) + " บาท/วัน • แถว " + row.rowOrder + " คอลัมน์ " + row.column;
  return market + " • " + (refs.categories.find(c => c.id === row.categoryId)?.name ?? "");
}
function ResourceEditor({ kind, initial, refs, onClose, onSaved }: { kind: AdminKind; initial: AdminRow; refs: AdminReferences; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const editing = !!initial.id;
  function options(key: string): Array<{ id: string; name: string }> {
    if (key === "photo") return [{ id: "canal", name: "ริมน้ำ" }, { id: "community", name: "ชุมชน" }, { id: "sunday", name: "ถนนคนเดิน" }];
    const rows = key === "marketId" ? refs.markets : key === "categoryId" ? refs.categories : key === "zoneId" ? refs.zones.filter(z => z.marketId === values.marketId) : refs.stalls.filter(s => s.marketId === values.marketId);
    return rows.map(row => ({ id: row.id, name: String(row.name ?? row.code) + (row.active === false || row.enabled === false ? " (ปิดใช้งาน)" : "") }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setErrors({});
    const body: Record<string, unknown> = {};
    for (const field of adminFields[kind]) {
      if (editing && field.key === "marketId") continue;
      const value = values[field.key];
      body[field.key] = ["zoneId", "stallId"].includes(field.key) && !value ? null : value;
    }
    if (editing) body.version = initial.version;
    try { await adminRequest("/" + kind + (editing ? "/" + initial.id : ""), editing ? "PATCH" : "POST", body); onSaved(); }
    catch (e) {
      setError(e instanceof Error ? e.message : "เชื่อมต่อระบบไม่ได้");
      if (e instanceof ApiError) { setErrors(e.fields); const key = Object.keys(e.fields)[0]; if (key) form.current?.querySelector<HTMLElement>('[name="' + key + '"]')?.focus(); }
    }
    finally { setBusy(false); }
  }
  return <div className="admin-editor" role="region" aria-label={"แบบฟอร์ม" + adminLabels[kind]}>
    <div className="admin-section-heading"><h3>{editing ? "แก้ไข" : "เพิ่ม"}{adminLabels[kind]}</h3><button className="text-link" disabled={busy} onClick={onClose}>ปิดแบบฟอร์ม</button></div>
    {editing && <p className="form-description">รหัส {initial.id} • เวอร์ชัน {initial.version} • ตลาดของข้อมูลเดิมเปลี่ยนไม่ได้</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}
    <form ref={form} onSubmit={submit}><fieldset disabled={busy}><div className="admin-form-grid">{adminFields[kind].map(field => {
      const id = "admin-" + kind + "-" + field.key;
      const common = { id, name: field.key, "aria-invalid": !!errors[field.key], "aria-describedby": errors[field.key] ? id + "-error" : undefined };
      const value = values[field.key];
      const change = (next: string | number | boolean) => setValues(v => ({ ...v, [field.key]: next, ...(field.key === "marketId" ? { zoneId: "", stallId: "" } : {}) }));
      return <div className={"form-field " + (field.type === "textarea" ? "wide" : "")} key={field.key}>
        {field.type === "checkbox" ? <label className="admin-checkbox"><input {...common} type="checkbox" checked={!!value} onChange={e => change(e.target.checked)}/>{field.label}</label> : <>
          <label htmlFor={id}>{field.label}{field.optional ? " (ไม่จำเป็น)" : ""}</label>
          {field.type === "select" ? <select {...common} required={!field.optional} disabled={editing && field.key === "marketId"} value={String(value ?? "")} onChange={e => change(e.target.value)}><option value="">เลือก{field.label}</option>{options(field.key).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select> : field.type === "textarea" ? <textarea {...common} maxLength={field.max} value={String(value ?? "")} onChange={e => change(e.target.value)}/> : <input {...common} type={field.type} required={!field.optional} min={field.min} max={field.max} maxLength={field.type === "text" ? field.max : undefined} step={field.type === "number" ? field.step ?? 1 : undefined} value={typeof value === "boolean" ? "" : value ?? ""} onChange={e => change(field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}/>}
        </>}
        {errors[field.key] && <p id={id + "-error"} className="field-error">{errors[field.key]}</p>}
      </div>;
    })}</div><button className="button button-orange" type="submit">{busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button></fieldset></form>
  </div>;
}
function FloorEditor({ refs, onChange }: { refs: AdminReferences; onChange: () => void }) {
  const [marketId, setMarket] = useState(refs.markets.find(m => m.active)?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<AdminRow | null>(null);
  const [notice, setNotice] = useState("");
  const result = usePublicData<FloorPlan>(marketId ? "/api/markets/" + marketId + "/floor-plan" : null);
  const row = refs.stalls.find(s => s.id === selected);
  return <section><div className="admin-section-heading"><div><h2>จัดผังล็อก</h2><p>เลือกล็อกบนผังเพื่อแก้แถว คอลัมน์ โซน ขนาด และราคา</p></div></div>
    <label className="admin-market-picker">ตลาด<select aria-label="ตลาด" value={marketId} onChange={e => { setMarket(e.target.value); setSelected(null); setEditor(null); }}>{refs.markets.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {!marketId ? <p className="catalog-state">เพิ่มตลาดก่อนจัดผังล็อก</p> : result.loading ? <p className="catalog-state">กำลังโหลดผัง…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button className="text-link" onClick={result.retry}>โหลดใหม่</button></p> : result.data && <div className="admin-floor-layout"><StallPlan plan={result.data} selected={selected} onSelect={setSelected}/><aside className="admin-floor-selection"><h3>{row ? "ล็อก " + row.code : "เลือกล็อกบนผัง"}</h3>{row && <><p>แถว {row.rowOrder} • คอลัมน์ {row.column}</p><p>{row.width} × {row.depth} เมตร</p><p>{baht(Number(row.pricePerDay))} บาท/วัน</p><button className="button button-orange" onClick={() => { setNotice(""); setEditor(row); }}>แก้ตำแหน่งและข้อมูล</button></>}<p className="form-description">เปลี่ยนตำแหน่งแล้วกดบันทึก ระบบจะตรวจว่าตำแหน่งไม่ซ้ำกับล็อกอื่น</p></aside></div>}
    {editor && <ResourceEditor key={editor.id} kind="stalls" initial={editor} refs={refs} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("บันทึกตำแหน่งล็อกแล้ว"); result.retry(); onChange(); }}/>}
  </section>;
}
function UserList({ user }: { user: User }) {
  const result = usePublicData<User[]>("/api/users");
  const [q, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function remove(row: User) {
    if (!window.confirm("ลบบัญชี " + row.name + " ถาวรหรือไม่?")) return;
    setBusy(row.id); setError("");
    try { await api("/" + row.id, { method: "DELETE" }); result.retry(); }
    catch (e) { setError(e instanceof Error ? e.message : "ลบไม่สำเร็จ"); }
    finally { setBusy(""); }
  }
  const rows = result.data?.filter(row => (row.name + " " + row.email).toLowerCase().includes(q.toLowerCase()));
  return <section><div className="admin-section-heading"><h2>ผู้ใช้</h2></div><p className="form-description">ผู้จัดการและเจ้าของอ่านข้อมูลได้ เจ้าของลบบัญชีอื่นได้ บทบาทกำหนดผ่านคำสั่ง seed</p>
    <label className="admin-market-picker">ค้นหาชื่อหรืออีเมล<input value={q} onChange={e => setQuery(e.target.value)} maxLength={100}/></label>
    {error && <p className="form-alert" role="alert">{error}</p>}
    {result.loading ? <p className="catalog-state">กำลังโหลด…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button onClick={result.retry}>ลองใหม่</button></p> : <div className="admin-table-scroll" tabIndex={0} role="region" aria-label="ตารางผู้ใช้"><table className="admin-table"><thead><tr><th>ชื่อ</th><th>อีเมล / เบอร์โทร</th><th>บทบาท</th>{user.role === "owner" && <th>จัดการ</th>}</tr></thead><tbody>{rows?.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.email}<small>{row.phone || "ไม่ระบุเบอร์โทร"}</small></td><td>{roleLabels[row.role]}</td>{user.role === "owner" && <td><button className="text-link" disabled={row.id === user.id || !!busy} onClick={() => remove(row)}>{busy === row.id ? "กำลังลบ…" : row.id === user.id ? "บัญชีของคุณ" : "ลบบัญชี"}</button></td>}</tr>)}{!rows?.length && <tr><td colSpan={4}>ไม่พบผู้ใช้</td></tr>}</tbody></table></div>}
  </section>;
}
