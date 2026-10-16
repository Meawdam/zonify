"use client";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../lib/auth";
import { baht } from "../lib/catalog";
import { bookingRequest, bookingTime, type Booking, type BookingStatus } from "../lib/bookings";
import { thaiTransferISO } from "../lib/payment-time";
import { fieldAccessibility } from "../lib/form-fields";
function FieldError({ id, message }: { id: string; message?: string }) { return message ? <small id={id + "-error"} className="field-error">{message}</small> : null; }
type PaymentQR = { amount: number; recipient: { id: string; name: string }; expiresAt: string; qrDataUrl: string };
export function PaymentPanel({ booking, manager = false, expired = false, refresh, onNotice }: {
  booking: Booking; manager?: boolean; expired?: boolean; refresh: () => void; onNotice?: (message: string) => void;
}) {
  const [qr, setQR] = useState<PaymentQR | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState<{ message: string; status: BookingStatus } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({}), [showReview, setShowReview] = useState(false);
  const formRef = useRef<HTMLFormElement>(null), router = useRouter();
  const panelRef = useRef<HTMLElement>(null), errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (busy) return;
    if (Object.keys(fields).length) panelRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    else if (error) errorRef.current?.focus();
  }, [fields, error, busy]);
  const latest = booking.payment.attempts.at(-1);
  function success(message: string, status: BookingStatus) { if (onNotice) onNotice(message); else setNotice({ message, status }); refresh(); }
  async function perform(run: () => Promise<void>) {
    setBusy(true); setError(""); setFields({}); setNotice(null); onNotice?.("");
    try { await run(); } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) { router.replace("/login?notice=expired&next=" + encodeURIComponent(manager ? "/profile" : "/bookings/" + booking.id)); return; }
        setFields(e.fields); if (e.status === 409) refresh();
      }
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    } finally { setBusy(false); }
  }
  async function upload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget), slip = form.get("slip");
    if (!(slip instanceof File) || !slip.size || !["image/png", "image/jpeg"].includes(slip.type) || slip.size > 5 * 1024 * 1024) {
      setFields({ slip: "เลือกภาพ PNG หรือ JPEG ขนาดไม่เกิน 5 MB" }); return;
    }
    const time = thaiTransferISO(String(form.get("transferredAt")));
    if (!time) { setFields({ transferredAt: "กรุณาระบุวันและเวลาโอนตามเวลาไทยที่ถูกต้อง" }); return; }
    form.set("transferredAt", time);
    await perform(async () => { const updated = await bookingRequest<Booking>("/bookings/" + booking.id + "/payment/slip", form); formRef.current?.reset(); success("ส่งสลิปแล้ว รอผู้จัดการตรวจสอบ ยังไม่ยืนยันว่ารับชำระเงิน", updated.status); });
  }
  async function review(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget), decision = String(form.get("decision"));
    await perform(async () => { const updated = await bookingRequest<Booking>("/admin/bookings/" + booking.id + "/payment/review", {
      decision, attemptId: latest!.id, ...(decision === "approve" ? { verifiedReference: form.get("verifiedReference") } : { reason: form.get("reason") }),
    }); setShowReview(false); success(decision === "approve" ? "ตรวจรับชำระเงินแล้ว ยืนยันการจอง" : "ปฏิเสธสลิปแล้ว ลูกค้ามีเวลาแก้ไข 30 นาที", updated.status); });
  }
  const suffix = booking.id, activeQR = qr?.expiresAt === booking.expiresAt ? qr : null;
  return <section ref={panelRef} className="payment-panel" aria-label="ข้อมูลชำระเงิน" aria-busy={busy}>
    {error && <p ref={errorRef} tabIndex={-1} className="form-alert" role="alert">{error}</p>}{notice?.status === booking.status && <p className="form-notice" role="status">{notice.message}</p>}
    {booking.payment.paidAt && <p className="form-notice">ผู้จัดการตรวจรับ {baht(booking.price)} บาท • {bookingTime(booking.payment.paidAt)}<br/>เลขอ้างอิง {booking.payment.approvedReference}</p>}
    {!manager && booking.status === "pending_payment" && !expired && <>
      <h3>ชำระค่าเช่า {baht(booking.price)} บาท</h3>
      <p className="form-description">ตรวจชื่อบัญชีผู้รับและยอดในแอปธนาคารก่อนโอน จากนั้นส่งสลิปภายในเวลาที่เหลือ การส่งสลิปยังไม่ถือว่ารับชำระเงิน</p>
      {latest?.status === "rejected" && <p className="form-alert">สลิปไม่ผ่าน: {latest.reviewReason}<br/>หากโอนแล้ว อย่าโอนซ้ำ ให้แก้ข้อมูลหรือส่งหลักฐานที่ถูกต้อง หรือติดต่อผู้จัดการ</p>}
      {!activeQR ? <button className="button button-green" disabled={busy} onClick={() => perform(async () => {
        setQR(await bookingRequest<PaymentQR>("/bookings/" + booking.id + "/payment/qr", {})); refresh();
      })}>{busy ? "กำลังโหลด…" : "แสดง QR ชำระเงิน"}</button> : <>
        <div className="payment-qr"><Image src={activeQR.qrDataUrl} width={320} height={320} alt={"QR PromptPay ยอด " + baht(activeQR.amount) + " บาท"} unoptimized/><p><strong>{activeQR.recipient.name}</strong><br/>พร้อมเพย์ {activeQR.recipient.id}<br/>{baht(activeQR.amount)} บาท</p><a className="text-link" href={activeQR.qrDataUrl} download={"zonify-" + booking.id + ".png"}>บันทึกภาพ QR</a></div>
        <form className="payment-form" onSubmit={upload} ref={formRef}><fieldset disabled={busy}><legend>ส่งหลักฐานการโอน</legend>
          <label htmlFor={"slip-" + suffix}>ภาพสลิป</label><input id={"slip-" + suffix} name="slip" type="file" accept="image/png,image/jpeg" required {...fieldAccessibility("slip-" + suffix, fields.slip, true)}/><small id={"slip-" + suffix + "-hint"}>PNG/JPEG ไม่เกิน 5 MB</small><FieldError id={"slip-" + suffix} message={fields.slip}/>
          <label htmlFor={"amount-" + suffix}>ยอดที่โอน (บาท)</label><input id={"amount-" + suffix} name="amount" type="number" min="0.01" max="9999999.99" step="0.01" defaultValue={booking.price.toFixed(2)} required {...fieldAccessibility("amount-" + suffix, fields.amount)}/><FieldError id={"amount-" + suffix} message={fields.amount}/>
          <label htmlFor={"time-" + suffix}>วันและเวลาโอนตามเวลาไทย</label><input id={"time-" + suffix} name="transferredAt" type="datetime-local" required {...fieldAccessibility("time-" + suffix, fields.transferredAt, true)}/><small id={"time-" + suffix + "-hint"}>เวลาไทย (Asia/Bangkok, UTC+07:00) แม้อุปกรณ์ใช้เขตเวลาอื่น</small><FieldError id={"time-" + suffix} message={fields.transferredAt}/>
          <label htmlFor={"reference-" + suffix}>เลขอ้างอิงการโอน</label><input id={"reference-" + suffix} name="reference" minLength={4} maxLength={80} pattern="(?:[A-Za-z0-9]|-)+" required {...fieldAccessibility("reference-" + suffix, fields.reference, true)}/><small id={"reference-" + suffix + "-hint"}>ตัวอักษรอังกฤษ ตัวเลข หรือขีดกลาง 4–80 ตัว</small><FieldError id={"reference-" + suffix} message={fields.reference}/>
          <button className="button button-orange" type="submit">{busy ? "กำลังส่งสลิป…" : "ส่งสลิปให้ตรวจสอบ"}</button>
        </fieldset></form>
      </>}
    </>}
    {booking.status === "payment_review" && <p className="form-description">รอผู้จัดการตรวจสลิป ล็อกยังคงสงวนไว้ระหว่างตรวจสอบ โปรดอย่าโอนซ้ำ</p>}
    {!!booking.payment.attempts.length && <details className="payment-history" open={manager && booking.status === "payment_review"}><summary>ประวัติสลิป {booking.payment.attempts.length} ครั้ง</summary>
      {booking.payment.attempts.map((a, index) => <div className="payment-attempt" key={a.id}><p><strong>ครั้งที่ {index + 1} • {a.status === "review" ? "รอตรวจสอบ" : a.status === "approved" ? "ผ่านแล้ว" : "ไม่ผ่าน"}</strong><br/>{baht(a.amount)} บาท • โอน {bookingTime(a.transferredAt)}<br/>เลขอ้างอิง {a.reference}</p>
        {a.reviewReason && <p className="form-description">เหตุผล: {a.reviewReason}</p>}<a className="text-link" href={a.slipUrl} target="_blank" rel="noopener noreferrer">เปิดภาพสลิปครั้งที่ {index + 1}</a>
        {manager && a.id === latest?.id && booking.status === "payment_review" && <Image className="payment-slip" src={a.slipUrl} alt={"ภาพสลิปครั้งที่ " + (index + 1)} width={600} height={800} unoptimized/>}
      </div>)}
    </details>}
    {manager && booking.status === "payment_review" && latest && <>
      <button className="button button-green" disabled={busy} onClick={() => setShowReview(v => !v)}>ตรวจรับ / ปฏิเสธสลิป</button>
      {showReview && <div className="payment-review-forms">
        <form className="payment-form" onSubmit={review}><fieldset disabled={busy}><legend>ตรวจรับชำระเงิน</legend><input type="hidden" name="decision" value="approve"/>
          <p className="form-description">ตรวจเงินเข้าบัญชีผู้รับ ยอด {baht(booking.price)} บาท เวลาโอน และเลขอ้างอิงกับธนาคาร ระบบไม่ได้ตรวจธนาคารอัตโนมัติ</p>
          <label htmlFor={"verified-" + suffix}>เลขอ้างอิงที่ตรวจจากธนาคาร</label><input id={"verified-" + suffix} name="verifiedReference" minLength={4} maxLength={80} pattern="(?:[A-Za-z0-9]|-)+" required {...fieldAccessibility("verified-" + suffix, fields.verifiedReference)}/><FieldError id={"verified-" + suffix} message={fields.verifiedReference}/>
          <label className="payment-check"><input type="checkbox" required/>ตรวจชื่อบัญชี ยอด เวลาโอน และเงินเข้าแล้ว</label><button className="button button-green" type="submit">{busy ? "กำลังบันทึก…" : "ยืนยันรับชำระเงิน"}</button>
        </fieldset></form>
        <form className="payment-form" onSubmit={review}><fieldset disabled={busy}><legend>ปฏิเสธหลักฐาน</legend><input type="hidden" name="decision" value="reject"/>
          <label htmlFor={"reject-" + suffix}>เหตุผลที่สลิปไม่ผ่าน</label><textarea id={"reject-" + suffix} name="reason" required maxLength={500} {...fieldAccessibility("reject-" + suffix, fields.reason)}/><FieldError id={"reject-" + suffix} message={fields.reason}/>
          <button className="button button-white" type="submit">{busy ? "กำลังบันทึก…" : "ปฏิเสธสลิป ให้แก้ไข"}</button>
        </fieldset></form>
      </div>}
    </>}
    {booking.payment.refund && <div className="payment-refund"><h3>{booking.payment.refund.status === "pending" ? "รอผู้จัดการคืนเงิน" : "บันทึกคืนเงินแล้ว"} {baht(booking.payment.refund.amount)} บาท</h3>
      {booking.payment.refund.status === "refunded" ? <p>เลขอ้างอิง {booking.payment.refund.reference} • {bookingTime(booking.payment.refund.completedAt!)}</p> : <p className="form-description">ยกเลิกพื้นที่แล้ว แต่ยังไม่มีบันทึกว่าคืนเงิน โปรดติดต่อผู้จัดการ</p>}
      {manager && booking.payment.refund.status === "pending" && <form className="payment-form" onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void perform(async () => { const updated = await bookingRequest<Booking>("/admin/bookings/" + booking.id + "/payment/refund", { reference: form.get("reference") }); success("บันทึกคืนเงินแล้ว", updated.status); }); }}><fieldset disabled={busy}><legend>บันทึกหลังโอนคืนเงินจริง</legend>
        <label htmlFor={"refund-" + suffix}>เลขอ้างอิงการคืนเงิน</label><input id={"refund-" + suffix} name="reference" required minLength={4} maxLength={80} pattern="(?:[A-Za-z0-9]|-)+" {...fieldAccessibility("refund-" + suffix, fields.reference)}/><FieldError id={"refund-" + suffix} message={fields.reference}/>
        <label className="payment-check"><input type="checkbox" required/>โอนคืนเงินให้ลูกค้าแล้ว</label><button type="submit" className="button button-green">บันทึกคืนเงิน</button>
      </fieldset></form>}
    </div>}
  </section>;
}
