"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
export function AccountDataBoundary({ children }: { children: ReactNode }) {
  const [revoked, setRevoked] = useState(false), router = useRouter();
  useEffect(() => {
    const invalidate = () => { setRevoked(true); router.refresh(); };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("zonify-session") : null;
    channel?.addEventListener("message", invalidate);
    window.addEventListener("zonify-session", invalidate);
    return () => { channel?.close(); window.removeEventListener("zonify-session", invalidate); };
  }, [router]);
  return revoked ? <p className="catalog-state" role="status">บัญชีมีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่เพื่อใช้ข้อมูลปัจจุบัน <button className="text-link" onClick={() => window.location.reload()}>โหลดหน้าใหม่</button></p> : children;
}
