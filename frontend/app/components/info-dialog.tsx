"use client";
import { useEffect, useRef } from "react";
import { Icon } from "./icons";
export type DialogMode = "owner" | "how";
export function InfoDialog({ mode, onClose }: { mode: DialogMode; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const controls = ref.current?.querySelectorAll<HTMLElement>("button, a[href], input, select");
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", handleKey); previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onClick={onClose}>
    <section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={event => event.stopPropagation()}>
      <button className="modal-close" aria-label="ปิดหน้าต่าง" onClick={onClose}><Icon name="close"/></button>
      <span className="dialog-icon"><Icon name="grid"/></span>
      <h2 id="dialog-title">{mode === "owner" ? "สำหรับเจ้าของตลาด" : "สำรวจตลาดของคุณ"}</h2>
      <p className="dialog-subtitle">ดูผังพื้นที่ สถานะล็อก และค้นหาร้านค้าได้จากหน้าเว็บ</p>
      <p className="demo-notice">หน้าจัดการตลาดและระบบจองอยู่ระหว่างพัฒนา การเลือกล็อกในขณะนี้เป็นการดูข้อมูลเท่านั้น</p>
      <button className="button button-green" onClick={onClose}>กลับไปสำรวจตลาด <Icon/></button>
    </section>
  </div>;
}
