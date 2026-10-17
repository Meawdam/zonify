"use client";
import { useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { ApiError } from "../lib/auth";
import type { Market, Category } from "../lib/catalog";
import { merchantRequest, type MerchantShop } from "../lib/merchant";
import { fieldAccessibility } from "../lib/form-fields";
import { discardEdits, useUnsavedGuard } from "../lib/use-unsaved-guard";

export function MerchantEditor({ shop, markets, categories, initialMarket, onSaved, onClose }: { shop: MerchantShop | null; markets: Market[]; categories: Category[]; initialMarket: string; onSaved: (shop: MerchantShop) => void; onClose: () => void }) {
  const initial = { name: shop?.name ?? "", marketId: shop?.marketId ?? initialMarket, categoryId: shop?.categoryId ?? "", description: shop?.description ?? "", hours: shop?.hours ?? "", phone: shop?.phone ?? "", contactUrl: shop?.contactUrl ?? "" };
  const [draft, setDraft] = useState(initial), [baseline, setBaseline] = useState(initial), [saved, setSaved] = useState(shop);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [fields, setFields] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null), photo = useRef<HTMLInputElement>(null);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [conflict, setConflict] = useState(false), [latest, setLatest] = useState<MerchantShop | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline) || hasPhoto;
  useUnsavedGuard(dirty);
  function close() { if (!dirty || discardEdits()) onClose(); }
  function fail(e: unknown) {
    setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    setFields(e instanceof ApiError ? e.fields : {});
    setConflict(e instanceof ApiError && e.code === "RESOURCE_CHANGED");
    requestAnimationFrame(() => (form.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form.current?.querySelector<HTMLElement>('[role="alert"]'))?.focus());
  }
  async function loadLatest() {
    if (!saved) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/merchant/shops/${saved.id}`, { cache: "no-store", credentials: "same-origin" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "โหลดข้อมูลล่าสุดไม่สำเร็จ");
      setLatest(data); setSaved(data); setConflict(false); setError("");
      setNotice("โหลดเวอร์ชันล่าสุดแล้ว ข้อมูลที่คุณกรอกยังอยู่ ตรวจเทียบด้านล่างก่อนกดบันทึกเพื่อใช้ข้อมูลของคุณ");
    } catch (e) { setError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ"); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setFields({}); setNotice("");
    try {
      const { marketId, ...editable } = draft;
      const result = await merchantRequest<MerchantShop>(saved ? `/shops/${saved.id}` : "/shops", saved ? "PATCH" : "POST", saved ? { ...editable, version: saved.version } : { ...editable, marketId });
      setSaved(result); setBaseline(draft); setLatest(null); setConflict(false); onSaved(result); setNotice("บันทึกข้อมูลร้านแล้ว");
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function upload() {
    const file = photo.current?.files?.[0]; if (!saved || !file) return;
    if (file.size > 5 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(file.type)) { setFields({ photo: "เลือก JPEG หรือ PNG ขนาดไม่เกิน 5 MB" }); photo.current?.focus(); return; }
    setBusy(true); setError(""); setFields({}); setNotice("");
    const body = new FormData(); body.set("photo", file); body.set("version", String(saved.version));
    try { const result = await merchantRequest<MerchantShop>(`/shops/${saved.id}/photo`, "POST", body); setSaved(result); onSaved(result); setHasPhoto(false); if (photo.current) photo.current.value = ""; setNotice("บันทึกรูปร้านแล้ว"); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  const labels = { name: "ชื่อร้าน", description: "รายละเอียดและสินค้าที่ขาย", hours: "เวลาเปิดร้าน", phone: "เบอร์โทรติดต่อร้าน", contactUrl: "เว็บไซต์หรือช่องทางติดต่อ (URL)" };
  return <section className="merchant-editor" aria-labelledby="merchant-editor-title">
    <div className="merchant-heading"><h2 id="merchant-editor-title">{saved ? "แก้ไขร้าน" : "เพิ่มร้านของคุณ"}</h2><button className="text-link" onClick={close} disabled={busy}>ปิดแบบฟอร์ม</button></div>
    <form ref={form} onSubmit={submit}>
      {error && <p className="form-alert" role="alert" tabIndex={-1}>{error}</p>}{notice && <p className="form-notice" role="status">{notice}</p>}
      {conflict && <button type="button" className="button button-white" disabled={busy} onClick={loadLatest}>โหลดเวอร์ชันล่าสุดและคงข้อมูลที่กรอก</button>}
      {latest && <aside aria-label="ข้อมูลที่บันทึกไว้ล่าสุด"><h3>ข้อมูลที่บันทึกไว้ล่าสุด</h3><dl>{Object.entries(labels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{latest[key as keyof typeof labels] || "ไม่ระบุ"}</dd></div>)}</dl><p>ประเภทสินค้า: {categories.find(c => c.id === latest.categoryId)?.name ?? latest.categoryId}</p></aside>}
      <fieldset disabled={busy} className="merchant-fields"><legend className="sr-only">ข้อมูลร้าน</legend>
        <label htmlFor="merchant-market">ตลาด<select id="merchant-market" value={draft.marketId} required disabled={!!saved} {...fieldAccessibility("merchant-market", fields.marketId)} onChange={e => setDraft({ ...draft, marketId: e.target.value })}><option value="">เลือกตลาด</option>{markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}{saved && !markets.some(m => m.id === saved.marketId) && <option value={saved.marketId}>ตลาดปิดใช้งาน</option>}</select>{fields.marketId && <span id="merchant-market-error" className="field-error">{fields.marketId}</span>}</label>
        <label htmlFor="merchant-category">ประเภทสินค้า<select id="merchant-category" value={draft.categoryId} required {...fieldAccessibility("merchant-category", fields.categoryId)} onChange={e => setDraft({ ...draft, categoryId: e.target.value })}><option value="">เลือกประเภทสินค้า</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}{saved && !categories.some(c => c.id === saved.categoryId) && <option value={saved.categoryId}>หมวดหมู่ปิดใช้งาน</option>}</select>{fields.categoryId && <span id="merchant-category-error" className="field-error">{fields.categoryId}</span>}</label>
        {Object.entries(labels).map(([key, label]) => { const field = key as keyof typeof labels, id = "merchant-" + field; return <label key={field} htmlFor={id}>{label}{field === "description" ? <textarea id={id} value={draft[field]} maxLength={2000} {...fieldAccessibility(id, fields[field])} onChange={e => setDraft({ ...draft, [field]: e.target.value })}/> : <input id={id} type={field === "contactUrl" ? "url" : field === "phone" ? "tel" : "text"} value={draft[field]} required={field === "name"} maxLength={field === "contactUrl" ? 500 : field === "phone" ? 30 : 100} {...fieldAccessibility(id, fields[field])} onChange={e => setDraft({ ...draft, [field]: e.target.value })}/>} {fields[field] && <span className="field-error" id={id + "-error"}>{fields[field]}</span>}</label>; })}
      </fieldset>
      <p className="form-description">ข้อมูลติดต่อและรูปภาพจะแสดงบนหน้าร้านสาธารณะ ตลาดของร้านเปลี่ยนไม่ได้ หากขายคนละตลาดให้เพิ่มอีกร้าน</p>
      <button className="button button-green" disabled={busy} type="submit">{busy ? "กำลังบันทึก…" : "บันทึกข้อมูลร้าน"}</button>
      {saved && <div className="merchant-photo">
        {saved.photoUrl && <Image unoptimized src={saved.photoUrl} width={240} height={160} alt={saved.name}/>}
        <label htmlFor="merchant-photo">รูปร้าน (JPEG / PNG ไม่เกิน 5 MB)</label><input ref={photo} id="merchant-photo" type="file" accept="image/jpeg,image/png" disabled={busy} {...fieldAccessibility("merchant-photo", fields.photo)} onChange={e => setHasPhoto(!!e.target.files?.length)}/>
        {fields.photo && <span className="field-error" id="merchant-photo-error">{fields.photo}</span>}
        <button type="button" className="button button-white" disabled={busy || !hasPhoto} onClick={upload}>อัปโหลดรูปร้าน</button>
      </div>}
    </form>
  </section>;
}
