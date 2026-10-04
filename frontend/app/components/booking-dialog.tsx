"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icons";
import type { Market } from "./market-data";

export type DialogMode = "booking" | "owner" | "how";

export function BookingDialog({ mode, market, selected, date, onClose }: {
  mode: DialogMode;
  market: Market;
  selected: string;
  date: string;
  onClose: () => void;
}) {
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
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [onClose]);

  const title = mode === "booking" ? "พื้นที่ที่คุณเลือก" : mode === "how" ? "เริ่มต้นร้านของคุณ ใน 3 ขั้นตอน" : "สำหรับเจ้าของตลาด";

  return <div className="modal-backdrop" onClick={onClose}>
    <section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={event => event.stopPropagation()}>
      <button className="modal-close" aria-label="ปิดหน้าต่าง" onClick={onClose}><Icon name="close"/></button>
      <span className="dialog-icon"><Icon name={mode === "booking" ? "store" : mode === "how" ? "tent" : "grid"}/></span>
      <h2 id="dialog-title">{title}</h2>
      {mode === "booking" ? <>
        <p className="dialog-subtitle">{market.name} · เชียงใหม่</p>
        <dl className="booking-summary">
          <div><dt>ล็อก</dt><dd>{selected}</dd></div>
          <div><dt>ขนาดพื้นที่</dt><dd>2 × 2 เมตร</dd></div>
          <div><dt>ราคา</dt><dd>{market.price} บาท / วัน</dd></div>
          {date && <div><dt>วันที่</dt><dd>{new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`))}</dd></div>}
        </dl>
        <p className="demo-notice">นี่คือตัวอย่างการเลือกพื้นที่ ยังไม่ได้ยืนยันการจองหรือชำระเงินจริง</p>
      </> : mode === "how" ? <ol className="how-list">
        <li><strong>ค้นหาตลาดที่ใช่</strong><p>เลือกจังหวัด วันที่ และประเภทสินค้าที่อยากขาย</p></li>
        <li><strong>เลือกพื้นที่บนผัง</strong><p>ดูตำแหน่งและสถานะ เลือกล็อกสีเขียวที่ยังว่าง</p></li>
        <li><strong>ตรวจสอบรายละเอียด</strong><p>ดูพื้นที่และค่าเช่าก่อนตัดสินใจ ระบบนี้ยังเป็นตัวอย่างการจอง</p></li>
      </ol> : <>
        <p className="dialog-subtitle">ดูแลพื้นที่ขายและร้านค้าได้จากภาพรวมเดียว</p>
        <ul className="owner-features"><li><Icon name="check"/>จัดการผังและตำแหน่งล็อก</li><li><Icon name="check"/>ตรวจสอบสถานะพื้นที่ว่าง</li><li><Icon name="check"/>ดูข้อมูลการจองของร้านค้า</li></ul>
        <p className="demo-notice">หน้าจัดการตลาดยังอยู่ระหว่างพัฒนา คุณสามารถทดลองเลือกพื้นที่บนหน้าเว็บได้ตอนนี้</p>
      </>}
      <button className="button button-green" onClick={onClose}>กลับไปเลือกพื้นที่ <Icon/></button>
    </section>
  </div>;
}
