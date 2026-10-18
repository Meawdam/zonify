"use client";
import "./admin-schedule.css";
import Link from 'next/link';
import { useState } from 'react';
import type { AdminReferences } from '../lib/admin';
import { MarketSchedule, ScheduleError, scheduleRequest } from '../lib/admin-schedule';
import { usePublicData } from '../lib/use-public-data';
import { useURLState } from '../lib/use-url-state';
import { discardEdits, useUnsavedGuard } from '../lib/use-unsaved-guard';
import { bookingStatusLabels, type BookingStatus } from '../lib/bookings';

export function AdminSchedule({ refs, onDirtyChange }: { refs: AdminReferences; onDirtyChange: (dirty: boolean) => void }) {
  const { params, update } = useURLState();
  const requested = refs.markets.find(m => m.id === params.get('market'))?.id ?? refs.markets[0]?.id ?? '';
  const [dirtyMarket, setDirtyMarket] = useState<string | null>(null);
  const market = dirtyMarket ?? requested;
  const result = usePublicData<MarketSchedule>(market ? '/api/admin/markets/' + market + '/schedule' : null);
  return <section><div className="admin-section-heading"><div><h2>ปฏิทินเปิดตลาดและปิดล็อก</h2><p>กำหนดวันเปิดประจำ วันยกเว้น และช่วงปิดล็อกชั่วคราว</p></div></div>
    <label className="admin-market-picker">ตลาด<select value={market} onChange={e => { if (dirtyMarket && !discardEdits()) return; setDirtyMarket(null); onDirtyChange(false); update({ market: e.target.value }); }}>{refs.markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
    {dirtyMarket && requested !== market && <p role="status">ยังเก็บแบบร่างของตลาดเดิมไว้ กรุณาบันทึกหรือละทิ้งก่อนเปลี่ยนตลาด</p>}
    {!market ? <p>เพิ่มตลาดก่อนตั้งค่าปฏิทิน</p> : result.loading ? <p role="status">กำลังโหลดปฏิทิน…</p> : result.error ? <p className="form-alert" role="alert">{result.error} <button onClick={result.retry}>ลองใหม่</button></p> : result.data && <ScheduleEditor key={market} initial={result.data} refs={refs} onDirtyChange={dirty => { setDirtyMarket(dirty ? market : null); onDirtyChange(dirty); }}/>}</section>;
}
function ScheduleEditor({ initial, refs, onDirtyChange }: { initial: MarketSchedule; refs: AdminReferences; onDirtyChange: (dirty: boolean) => void }) {
  const [saved, setSaved] = useState(initial), [draft, setDraft] = useState(initial);
  const [closure, setClosure] = useState({ stallId: '', startsOn: '', endsOn: '', reason: '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState<Error | null>(null), [notice, setNotice] = useState('');
  const calendarDirty = JSON.stringify(draft.openWeekdays) !== JSON.stringify(saved.openWeekdays) || JSON.stringify(draft.exceptions) !== JSON.stringify(saved.exceptions);
  const dirty = calendarDirty || Object.values(closure).some(Boolean);
  useUnsavedGuard(dirty);
  function edit(next: MarketSchedule) { setDraft(next); onDirtyChange(JSON.stringify(next.openWeekdays) !== JSON.stringify(saved.openWeekdays) || JSON.stringify(next.exceptions) !== JSON.stringify(saved.exceptions) || Object.values(closure).some(Boolean)); setNotice(''); }
  function editClosure(next: typeof closure) { setClosure(next); onDirtyChange(calendarDirty || Object.values(next).some(Boolean)); setNotice(''); }
  async function mutate(path: string, method: string, body: unknown, clearClosure = false) {
    setBusy(true); setError(null); setNotice('');
    try {
      const next = await scheduleRequest(initial.marketId + path, method, body);
      setSaved(next); setDraft(next);
      if (clearClosure) setClosure({ stallId: '', startsOn: '', endsOn: '', reason: '' });
      onDirtyChange(!clearClosure && Object.values(closure).some(Boolean)); setNotice('บันทึกเรียบร้อยแล้ว');
    } catch (cause) { setError(cause instanceof Error ? cause : new Error('เชื่อมต่อระบบไม่ได้')); }
    finally { setBusy(false); }
  }
  async function reload() {
    if (dirty && !discardEdits()) return;
    setBusy(true); setError(null);
    try { const next = await scheduleRequest(initial.marketId + '/schedule'); setSaved(next); setDraft(next); setClosure({ stallId: '', startsOn: '', endsOn: '', reason: '' }); onDirtyChange(false); setNotice('โหลดข้อมูลล่าสุดแล้ว'); }
    catch (cause) { setError(cause instanceof Error ? cause : new Error('โหลดไม่สำเร็จ')); }
    finally { setBusy(false); }
  }
  const stalls = refs.stalls.filter(s => s.marketId === initial.marketId);
  return <div className="schedule-editor">
    {error && <div className="form-alert" role="alert"><p>{error.message}</p>{error instanceof ScheduleError && error.status === 409 && <><p>เก็บแบบร่างไว้แล้ว ตรวจรายการที่เกี่ยวข้องในแท็บใหม่ หรือโหลดข้อมูลล่าสุดก่อนลองอีกครั้ง</p>{error.total > 0 && <p>รายการที่ขัดแย้งทั้งหมด {error.total} รายการ</p>}<ul>{error.conflicts.map(item => <li key={item.id}><Link target="_blank" rel="noopener noreferrer" href={'/admin?' + new URLSearchParams({ section: 'bookings', market: initial.marketId, date: item.date }) + '#booking-' + item.id}>{item.date} • {item.stallCode} • {item.shopName || item.id} • {bookingStatusLabels[item.status as BookingStatus] ?? item.status} (เปิดแท็บใหม่)</Link></li>)}</ul></>}</div>}
    {notice && <p className="form-notice" role="status">{notice}</p>}
    <button className="text-link" disabled={busy} onClick={reload}>โหลดข้อมูลล่าสุด / ละทิ้งแบบร่าง</button>
    <form onSubmit={e => { e.preventDefault(); void mutate('/schedule', 'PUT', { version: saved.version, openWeekdays: draft.openWeekdays, exceptions: draft.exceptions }); }}>
      <fieldset disabled={busy}><legend>วันเปิดประจำสัปดาห์</legend><div className="booking-filters">{['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'].map((day, index) => <label key={day}><input type="checkbox" checked={draft.openWeekdays.includes(index)} onChange={e => edit({ ...draft, openWeekdays: e.target.checked ? [...draft.openWeekdays, index].sort() : draft.openWeekdays.filter(d => d !== index) })}/>{day}</label>)}</div></fieldset>
      <fieldset disabled={busy}><legend>วันเปิด / ปิดเป็นกรณีพิเศษ</legend><p className="form-description">วันยกเว้นมีผลแทนวันเปิดประจำสัปดาห์</p>{draft.exceptions.map((exception, index) => <div className="admin-filters" key={index}>
        <label>วันที่<input type="date" required value={exception.date} onChange={e => edit({ ...draft, exceptions: draft.exceptions.map((x, i) => i === index ? { ...x, date: e.target.value } : x) })}/></label>
        <label>สถานะ<select value={String(exception.open)} onChange={e => edit({ ...draft, exceptions: draft.exceptions.map((x, i) => i === index ? { ...x, open: e.target.value === 'true' } : x) })}><option value="true">เปิดตลาด</option><option value="false">ปิดตลาด</option></select></label>
        <label>เหตุผล<input maxLength={500} value={exception.reason} onChange={e => edit({ ...draft, exceptions: draft.exceptions.map((x, i) => i === index ? { ...x, reason: e.target.value } : x) })}/></label>
        <button type="button" className="text-link" onClick={() => edit({ ...draft, exceptions: draft.exceptions.filter((_, i) => i !== index) })}>ลบวันยกเว้น</button>
      </div>)}<button type="button" className="button button-white" onClick={() => edit({ ...draft, exceptions: [...draft.exceptions, { date: '', open: false, reason: '' }] })}>เพิ่มวันยกเว้น</button></fieldset>
      <button className="button button-green" disabled={busy || !calendarDirty}>บันทึกปฏิทิน</button>
    </form>
    <h3>ปิดล็อกชั่วคราว</h3><p className="form-description">ช่วงวันที่รวมวันเริ่มและวันสิ้นสุด การปิดที่กระทบรายการจองจะถูกปฏิเสธ</p>
    {calendarDirty && <p role="status">บันทึกปฏิทินก่อนเพิ่มหรือลบช่วงปิดล็อก</p>}
    <form onSubmit={e => { e.preventDefault(); void mutate('/closures', 'POST', { version: saved.version, ...closure }, true); }}><fieldset className="admin-filters" disabled={busy || calendarDirty}><legend>เพิ่มช่วงปิดล็อก</legend>
      <label>ล็อก<select required value={closure.stallId} onChange={e => editClosure({ ...closure, stallId: e.target.value })}><option value="">เลือกล็อก</option>{stalls.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}</select></label>
      <label>วันเริ่ม<input type="date" required value={closure.startsOn} onChange={e => editClosure({ ...closure, startsOn: e.target.value })}/></label>
      <label>วันสิ้นสุด<input type="date" required min={closure.startsOn || undefined} value={closure.endsOn} onChange={e => editClosure({ ...closure, endsOn: e.target.value })}/></label>
      <label>เหตุผล<input required maxLength={500} value={closure.reason} onChange={e => editClosure({ ...closure, reason: e.target.value })}/></label><button className="button button-green">เพิ่มช่วงปิดล็อก</button>
    </fieldset></form>
    <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>ล็อก</th><th>ช่วงวันที่</th><th>เหตุผล</th><th>จัดการ</th></tr></thead><tbody>{saved.closures.map(item => <tr key={item.id}><td>{stalls.find(s => s.id === item.stallId)?.code ?? item.stallId}</td><td>{item.startsOn} – {item.endsOn}</td><td>{item.reason}</td><td><button className="text-link" disabled={busy || calendarDirty} onClick={() => { if (window.confirm('ลบช่วงปิดล็อกนี้หรือไม่?')) void mutate('/closures/' + item.id, 'DELETE', { version: saved.version }); }}>ลบช่วงปิด</button></td></tr>)}{!saved.closures.length && <tr><td colSpan={4}>ไม่มีช่วงปิดล็อก</td></tr>}</tbody></table></div>
  </div>;
}
