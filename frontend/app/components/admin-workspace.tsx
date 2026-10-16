"use client";
import { useCallback, useState } from "react";
import type { User } from "../lib/auth";
import { adminLabels, type AdminKind, type AdminReferences } from "../lib/admin";
import { usePublicData } from "../lib/use-public-data";
import { ResourcePanel } from "./admin-catalog";
import { FloorEditor } from "./admin-floor";
import { UserList } from "./admin-users";
import { DataWarning } from "./data-warning";
import { useURLState } from "../lib/use-url-state";
import { adminSection } from "../lib/url-state";
import { BookingList } from "./booking-workspace";
import { Dashboard, Reports } from "./report-workspace";

type WorkspaceTab = AdminKind | "floor" | "users" | "bookings" | "holds" | "payments" | "dashboard" | "reports";
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
    setDirtySection(null); update({ section: next, market: null, q: null, page: null, status: null, date: null });
  }
  const refs = usePublicData<AdminReferences>("/api/admin/references", 0, true);
  const [notice, setNotice] = useState("");
  function refresh() { refs.retry(); }
  return <div className="admin-workspace">
    <div className="admin-navigation">
    <label className="admin-section-picker">ส่วนจัดการ<select value={tab} onChange={e => { setTab(e.target.value as WorkspaceTab); setNotice(""); }}>
      {Object.entries(adminLabels).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
      <option value="floor">จัดผังล็อก</option><option value="users">ผู้ใช้</option><option value="bookings">รายการจอง</option><option value="holds">พักล็อก</option><option value="payments">ตรวจชำระเงิน</option><option value="dashboard">Dashboard</option><option value="reports">รายงาน</option>
    </select></label>
    <nav className="admin-tabs" aria-label="เมนูจัดการ">{(Object.keys(adminLabels) as AdminKind[]).map(kind => <button key={kind} aria-current={tab === kind ? "page" : undefined} onClick={() => { setTab(kind); setNotice(""); }}>{adminLabels[kind]}</button>)}<button aria-current={tab === "floor" ? "page" : undefined} onClick={() => { setTab("floor"); setNotice(""); }}>จัดผังล็อก</button><button aria-current={tab === "users" ? "page" : undefined} onClick={() => { setTab("users"); setNotice(""); }}>ผู้ใช้</button></nav>
    <nav className="admin-tabs" aria-label="เมนูรายการจอง"><button aria-current={tab === "bookings" ? "page" : undefined} onClick={() => { setTab("bookings"); setNotice(""); }}>รายการจอง</button><button aria-current={tab === "holds" ? "page" : undefined} onClick={() => { setTab("holds"); setNotice(""); }}>พักล็อก</button><button aria-current={tab === "payments" ? "page" : undefined} onClick={() => { setTab("payments"); setNotice(""); }}>ตรวจชำระเงิน</button></nav>
    <nav className="admin-tabs" aria-label="เมนูสรุปผล"><button aria-current={tab === "dashboard" ? "page" : undefined} onClick={() => { setTab("dashboard"); setNotice(""); }}>Dashboard</button><button aria-current={tab === "reports" ? "page" : undefined} onClick={() => { setTab("reports"); setNotice(""); }}>รายงาน</button></nav>
    </div>
    {dirtySection && requested !== dirtySection && <p className="form-alert" role="status">ยังเก็บแบบฟอร์มที่ไม่บันทึกไว้ในส่วนเดิม บันทึกหรือปิดแบบฟอร์มก่อนเปิดส่วนที่เลือกจากประวัติ URL</p>}
    <DataWarning error={refs.refreshError} retry={refs.retry}/>
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {refs.loading && !refs.data ? <p className="catalog-state" role="status">กำลังโหลดข้อมูลจัดการ…</p> : refs.initialError ? <p className="catalog-state" role="alert">{refs.initialError} <button className="text-link" onClick={refs.retry}>ลองใหม่</button></p> : refs.data && <>
      {tab === "dashboard" ? <Dashboard today={today} markets={refs.data.markets}/> : tab === "reports" ? <Reports today={today} markets={refs.data.markets} owner={user.role === "owner"}/> : tab === "bookings" || tab === "holds" || tab === "payments" ? <BookingList key={tab} manager holdsOnly={tab === "holds"} defaultStatus={tab === "payments" ? "payment_review" : ""}/> : tab === "users" ? <UserList key="users" user={user}/> : tab === "floor" ? <FloorEditor key="floor" refs={refs.data} onChange={refresh} onDirtyChange={markDirty}/> : <ResourcePanel key={tab} kind={tab} refs={refs.data} onChange={refresh} onNotice={setNotice} onDirtyChange={markDirty}/>}
    </>}
  </div>;
}
