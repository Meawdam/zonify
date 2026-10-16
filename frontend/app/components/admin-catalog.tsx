"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../lib/auth";
import { adminFields, adminLabels, adminRequest, defaults, type AdminKind, type AdminRow, type AdminReferences, type AdminResults } from "../lib/admin";
import { usePublicData } from "../lib/use-public-data";
import { baht } from "../lib/catalog";
import { useURLState } from "../lib/use-url-state";
import { pageNumber, resourceId } from "../lib/url-state";
import { discardEdits, useUnsavedGuard } from "../lib/use-unsaved-guard";
import { fieldAccessibility } from "../lib/form-fields";
export function ResourcePanel({ kind, refs, onChange, onNotice, onDirtyChange }: { kind: AdminKind; refs: AdminReferences; onChange: () => void; onNotice: (message: string) => void; onDirtyChange: (dirty: boolean) => void }) {
  const { params: url, update } = useURLState();
  const page = pageNumber(url.get("page")), q = (url.get("q") ?? "").slice(0, 100);
  const marketId = refs.markets.some(m => m.id === resourceId(url.get("market"))) ? resourceId(url.get("market")) : "";
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback((value: boolean) => { setDirty(value); onDirtyChange(value); }, [onDirtyChange]);
  const [editor, setEditor] = useState<AdminRow | null>(null);
  function openEditor(row: AdminRow) { if (dirty && !discardEdits()) return; setEditor(row); onNotice(""); }
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
    <div className="admin-section-heading"><div><h2>{adminLabels[kind]}</h2><p>เพิ่ม แก้ไข และปิดใช้งานข้อมูล</p></div><button className="button button-green" onClick={() => openEditor(defaults(kind, marketId || refs.markets[0]?.id || ""))}>เพิ่ม{adminLabels[kind]}</button></div>
    <form className="admin-filters" onSubmit={e => { e.preventDefault(); update({ q: String(new FormData(e.currentTarget).get("q") ?? "").trim(), page: null }); }}>
      <label>ค้นหาชื่อหรือรหัส<input key={q} name="q" defaultValue={q} maxLength={100}/></label>
      {["zones", "stalls", "shops", "advertisements"].includes(kind) && <label>ตลาด<select aria-label="ตลาด" value={marketId} onChange={e => update({ market: e.target.value, page: null })}><option value="">ทุกตลาด</option>{refs.markets.map(m => <option key={m.id} value={m.id}>{m.name}{!m.active ? " (ปิดแสดง)" : ""}</option>)}</select></label>}
      <button className="button button-white" type="submit">ค้นหา</button><button className="text-link" type="button" onClick={result.retry}>โหลดใหม่</button>
    </form>
    {error && <p className="form-alert" role="alert">{error}</p>}
    {result.loading ? <p className="catalog-state" role="status">กำลังโหลด…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button onClick={result.retry}>ลองใหม่</button></p> : result.data && <>
      <p className="admin-result-count">ทั้งหมด {result.data.total} รายการ</p>
      <div className="admin-table-scroll" tabIndex={0} role="region" aria-label={"ตาราง" + adminLabels[kind]}><table className="admin-table"><thead><tr><th>ชื่อ / รหัส</th><th>รายละเอียด</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
        {result.data.items.map((row: AdminRow) => <tr key={row.id}><td><strong>{row.name ?? row.code}</strong><small>{row.id}</small></td><td>{summary(kind, row, refs)}</td><td><span className={"admin-badge " + (row.active === false || row.enabled === false ? "inactive" : "")}>{row.active === false || row.enabled === false ? "ปิดใช้งาน" : "เปิดใช้งาน"}</span></td><td><div className="admin-row-actions"><button className="text-link" onClick={() => openEditor(row)}>แก้ไข</button><button className="text-link" onClick={() => disable(row)} disabled={busy === row.id || row.active === false || row.enabled === false}>{busy === row.id ? "กำลังบันทึก…" : "ปิดใช้งาน"}</button></div></td></tr>)}
        {!result.data.items.length && <tr><td colSpan={4}>ไม่พบข้อมูลตามตัวกรอง</td></tr>}
      </tbody></table></div>
      {result.data.pages > 1 && <div className="pagination"><button className="button button-white" disabled={page <= 1} onClick={() => update({ page: page - 1 })}>ก่อนหน้า</button><span>หน้า {page} / {result.data.pages}</span><button className="button button-white" disabled={page >= result.data.pages} onClick={() => update({ page: page + 1 })}>ถัดไป</button></div>}
    </>}
    {editor && <ResourceEditor key={editor.id || "new"} kind={kind} initial={editor} refs={refs} onClose={() => setEditor(null)} onSaved={saved} onDirtyChange={markDirty}/>}
  </section>;
}
function summary(kind: AdminKind, row: AdminRow, refs: AdminReferences) {
  if (kind === "markets") return row.location;
  if (kind === "categories") return "ลำดับ " + row.order;
  const market = refs.markets.find(m => m.id === row.marketId)?.name ?? row.marketId;
  if (kind === "advertisements") return market + " • " + row.startsOn + " ถึง " + row.endsOn;
  if (kind === "zones") return market;
  if (kind === "stalls") return market + " • " + row.width + " × " + row.depth + " ม. • " + baht(Number(row.pricePerDay)) + " บาท/วัน • แถว " + row.rowOrder + " คอลัมน์ " + row.column;
  return market + " • " + (refs.categories.find(c => c.id === row.categoryId)?.name ?? "");
}
export function ResourceEditor({ kind, initial, refs, onClose, onSaved, onDirtyChange }: { kind: AdminKind; initial: AdminRow; refs: AdminReferences; onClose: () => void; onSaved: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null);
  const editing = !!initial.id;
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  useUnsavedGuard(dirty);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  function options(key: string): Array<{ id: string; name: string }> {
    if (key === "photo") return [{ id: "canal", name: "ริมน้ำ" }, { id: "community", name: "ชุมชน" }, { id: "sunday", name: "ถนนคนเดิน" }];
    const rows = key === "marketId" ? refs.markets : key === "categoryId" ? refs.categories : key === "shopId" ? refs.shops.filter(s => s.marketId === values.marketId) : key === "zoneId" ? refs.zones.filter(z => z.marketId === values.marketId) : refs.stalls.filter(s => s.marketId === values.marketId);
    return rows.map((row: AdminRow) => ({ id: row.id, name: String(row.name ?? row.code) + (row.active === false || row.enabled === false ? " (ปิดใช้งาน)" : "") }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setErrors({});
    const body: Record<string, unknown> = {};
    for (const field of adminFields[kind]) {
      if (editing && field.key === "marketId") continue;
      const value = values[field.key];
      body[field.key] = ["zoneId", "stallId", "shopId"].includes(field.key) && !value ? null : value;
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
    <div className="admin-section-heading"><h3>{editing ? "แก้ไข" : "เพิ่ม"}{adminLabels[kind]}</h3><button className="text-link" disabled={busy} onClick={() => { if (!dirty || discardEdits()) onClose(); }}>ปิดแบบฟอร์ม</button></div>
    {editing && <p className="form-description">รหัส {initial.id} • เวอร์ชัน {initial.version} • ตลาดของข้อมูลเดิมเปลี่ยนไม่ได้</p>}
    {error && <p className="form-alert" role="alert">{error}</p>}
    <form ref={form} onSubmit={submit}><fieldset disabled={busy}><div className="admin-form-grid">{adminFields[kind].map(field => {
      const id = "admin-" + kind + "-" + field.key;
      const common = { id, name: field.key, ...fieldAccessibility(id, errors[field.key]) };
      const value = values[field.key];
      const change = (next: string | number | boolean) => setValues(v => ({ ...v, [field.key]: next, ...(field.key === "marketId" ? { zoneId: "", stallId: "", shopId: "" } : {}) }));
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
