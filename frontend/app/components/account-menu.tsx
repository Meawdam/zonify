"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type User } from "../lib/auth";
import { NotificationBell } from "./notifications";
export function AccountMenu({ user }: { user: User | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  function enterAdmin(event: { preventDefault: () => void }) {
    event.preventDefault();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- A document entry preserves native beforeunload protection for dirty editors on Back.
    window.location.assign("/admin");
  }
  async function logout() {
    if (!window.dispatchEvent(new Event("zonify-before-logout", { cancelable: true }))) return;
    setBusy(true); setError("");
    try { await api("/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <div className="account-menu">
    {user && <NotificationBell key={user.id}/>}
    {user && <Link href="/merchant">ร้านของฉัน</Link>}
    {user && <Link href="/bookings">รายการจองของฉัน</Link>}
    {/* A document boundary makes cross-route Back trigger beforeunload in browsers without Navigation API. */}
    {user && user.role !== "customer" && <Link href="/admin" prefetch={false} onNavigate={enterAdmin}>จัดการตลาด</Link>}
    {user ? <><Link href="/profile" className="account-name">บัญชี: {user.name}</Link><button className="nav-link" onClick={logout} disabled={busy}>{busy ? "กำลังออก…" : "ออกจากระบบ"}</button></> : <Link href="/login">เข้าสู่ระบบ</Link>}
    {error && <span role="alert" className="field-error">{error}</span>}
  </div>;
}
