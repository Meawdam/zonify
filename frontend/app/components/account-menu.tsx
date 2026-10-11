"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type User } from "../lib/auth";
export function AccountMenu({ user }: { user: User | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  async function logout() {
    setBusy(true); setError("");
    try { await api("/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  return <div className="account-menu">
    {user && <Link href="/bookings">รายการจองของฉัน</Link>}
    {user && user.role !== "customer" && <Link href="/admin">จัดการตลาด</Link>}
    {user ? <><Link href="/profile" className="account-name">บัญชี: {user.name}</Link><button className="nav-link" onClick={logout} disabled={busy}>{busy ? "กำลังออก…" : "ออกจากระบบ"}</button></> : <Link href="/login">เข้าสู่ระบบ</Link>}
    {error && <span role="alert" className="field-error">{error}</span>}
  </div>;
}
