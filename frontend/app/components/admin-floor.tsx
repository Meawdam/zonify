"use client";
import { useCallback, useState } from "react";
import { type AdminRow, type AdminReferences } from "../lib/admin";
import { usePublicData } from "../lib/use-public-data";
import { StallPlan } from "./stall-plan";
import { baht, type FloorPlan } from "../lib/catalog";
import { ResourceEditor } from "./admin-catalog";
import { discardEdits } from "../lib/use-unsaved-guard";
export function FloorEditor({ refs, onChange, onDirtyChange }: { refs: AdminReferences; onChange: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const [dirty, setDirty] = useState(false);
  const markDirty = useCallback((value: boolean) => { setDirty(value); onDirtyChange(value); }, [onDirtyChange]);
  const [marketId, setMarket] = useState(refs.markets.find(m => m.active)?.id ?? "");
  const [selected, setSelected] = useState<string | null>(null);
  const [editor, setEditor] = useState<AdminRow | null>(null);
  const [notice, setNotice] = useState("");
  const result = usePublicData<FloorPlan>(marketId ? "/api/markets/" + marketId + "/floor-plan" : null);
  const row = refs.stalls.find(s => s.id === selected);
  function openEditor() { if (!row || (dirty && !discardEdits())) return; setNotice(""); setEditor(row); }
  return <section><div className="admin-section-heading"><div><h2>จัดผังล็อก</h2><p>เลือกล็อกบนผังเพื่อแก้แถว คอลัมน์ โซน ขนาด และราคา</p></div></div>
    <label className="admin-market-picker">ตลาด<select aria-label="ตลาด" value={marketId} onChange={e => { if (dirty && !discardEdits()) return; setMarket(e.target.value); setSelected(null); setEditor(null); }}>{refs.markets.filter(m => m.active).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {!marketId ? <p className="catalog-state">เพิ่มตลาดก่อนจัดผังล็อก</p> : result.loading ? <p className="catalog-state">กำลังโหลดผัง…</p> : result.error ? <p className="catalog-state" role="alert">{result.error} <button className="text-link" onClick={result.retry}>โหลดใหม่</button></p> : result.data && <div className="admin-floor-layout"><StallPlan plan={result.data} selected={selected} onSelect={setSelected}/><aside className="admin-floor-selection"><h3>{row ? "ล็อก " + row.code : "เลือกล็อกบนผัง"}</h3>{row && <><p>แถว {row.rowOrder} • คอลัมน์ {row.column}</p><p>{row.width} × {row.depth} เมตร</p><p>{baht(Number(row.pricePerDay))} บาท/วัน</p><button className="button button-orange" onClick={openEditor}>แก้ตำแหน่งและข้อมูล</button></>}<p className="form-description">เปลี่ยนตำแหน่งแล้วกดบันทึก ระบบจะตรวจว่าตำแหน่งไม่ซ้ำกับล็อกอื่น</p></aside></div>}
    {editor && <ResourceEditor key={editor.id} kind="stalls" initial={editor} refs={refs} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice("บันทึกตำแหน่งล็อกแล้ว"); result.retry(); onChange(); }} onDirtyChange={markDirty}/>}
  </section>;
}
