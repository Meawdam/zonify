"use client";
import { useCallback, useState } from "react";
import type { User } from "../lib/auth";
import { type AdminKind, type AdminReferences } from "../lib/admin";
import { usePublicData } from "../lib/use-public-data";
import { ResourcePanel } from "./admin-catalog";
import { FloorEditor } from "./admin-floor";
import { UserList } from "./admin-users";
import { DataWarning } from "./data-warning";
import { useURLState } from "../lib/use-url-state";
import { adminSection } from "../lib/url-state";
import { BookingList } from "./booking-workspace";
import { AdminSchedule } from "./admin-schedule";
import { AdminWorkQueue } from "./admin-work-queue";
import { Dashboard, Reports } from "./report-workspace";

type WorkspaceTab = AdminKind | "floor" | "users" | "bookings" | "holds" | "payments" | "dashboard" | "reports" | "schedule" | "queue";
const navigationGroups: { label: string; items: [WorkspaceTab, string][] }[] = [
  { label: "งานประจำวัน", items: [["queue", "งานที่ต้องดำเนินการ"], ["payments", "ตรวจชำระเงิน"], ["bookings", "รายการจอง"], ["holds", "พักล็อก"]] },
  { label: "พื้นที่และร้านค้า", items: [["schedule", "ปฏิทินและปิดล็อก"], ["floor", "จัดผังล็อก"], ["shops", "ร้านค้า"], ["stalls", "ล็อก"], ["zones", "โซน"]] },
  { label: "ภาพรวมและตั้งค่า", items: [["dashboard", "Dashboard"], ["reports", "รายงาน"], ["markets", "ตลาด"], ["categories", "หมวดหมู่"], ["advertisements", "โฆษณา"], ["users", "ผู้ใช้"]] },
];
export function AdminWorkspace({ user, today }: { user: User; today: string }) {
  const { params, update } = useURLState();
  const requested = adminSection(params.get("section"));
  const [dirtySection, setDirtySection] = useState<WorkspaceTab | null>(null);
  // Browser Back/Forward cannot discard an editor: keep its section mounted until saved/closed.
  const tab = dirtySection ?? requested;
  const markDirty = useCallback((dirty: boolean) => setDirtySection(dirty ? tab : null), [tab]);
  function setTab(next: WorkspaceTab) {
    if (next === tab) return;
    if (dirtySection && !window.confirm("มีข้อมูลที่ยังไม่บันทึก ต้องการละทิ้งและเปลี่ยนส่วนจัดการหรือไม่?")) return;
    setDirtySection(null); update({ section: next, market: null, q: null, page: null, status: null, date: null, refund: null });
  }
  const refs = usePublicData<AdminReferences>("/api/admin/references", 0, true);
  const [notice, setNotice] = useState("");
  function refresh() { refs.retry(); }
  return <div className="admin-workspace">
    <div className="admin-navigation">
    <label className="admin-section-picker">ส่วนจัดการ<select value={tab} onChange={e => { setTab(e.target.value as WorkspaceTab); setNotice(""); }}>
      {navigationGroups.map(group => <optgroup key={group.label} label={group.label}>{group.items.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</optgroup>)}
    </select></label>
    {navigationGroups.map(group => <div className="admin-nav-group" key={group.label}><p>{group.label}</p><nav className="admin-tabs" aria-label={group.label}>{group.items.map(([key, label]) => <button key={key} aria-current={tab === key ? "page" : undefined} onClick={() => { setTab(key); setNotice(""); }}>{label}</button>)}</nav></div>)}
    </div>
    {dirtySection && requested !== dirtySection && <p className="form-alert" role="status">ยังเก็บแบบฟอร์มที่ไม่บันทึกไว้ในส่วนเดิม บันทึกหรือปิดแบบฟอร์มก่อนเปิดส่วนที่เลือกจากประวัติ URL</p>}
    <DataWarning error={refs.refreshError} retry={refs.retry}/>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {refs.loading && !refs.data ? <p className="catalog-state" role="status">กำลังโหลดข้อมูลจัดการ…</p> : refs.initialError ? <p className="catalog-state" role="alert">{refs.initialError} <button className="text-link" onClick={refs.retry}>ลองใหม่</button></p> : refs.data && <>
      {tab === "schedule" ? <AdminSchedule refs={refs.data} onDirtyChange={markDirty}/> : tab === "queue" ? <AdminWorkQueue/> : tab === "dashboard" ? <Dashboard today={today} markets={refs.data.markets}/> : tab === "reports" ? <Reports today={today} markets={refs.data.markets} owner={user.role === "owner"}/> : tab === "bookings" || tab === "holds" || tab === "payments" ? <BookingList key={tab} manager holdsOnly={tab === "holds"} defaultStatus={tab === "payments" ? "payment_review" : ""}/> : tab === "users" ? <UserList key="users" user={user}/> : tab === "floor" ? <FloorEditor key="floor" refs={refs.data} onChange={refresh} onDirtyChange={markDirty}/> : <ResourcePanel key={tab} kind={tab} refs={refs.data} onChange={refresh} onNotice={setNotice} onDirtyChange={markDirty}/>}
    </>}
  </div>;
}
