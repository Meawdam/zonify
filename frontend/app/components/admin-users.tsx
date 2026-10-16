"use client";
import { useState } from "react";
import { api, roleLabels, type User } from "../lib/auth";
import { usePublicData } from "../lib/use-public-data";
export function UserList({ user }: { user: User }) {
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
