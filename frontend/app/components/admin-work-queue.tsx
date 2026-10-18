"use client";
import Link from 'next/link';
import { usePublicData } from '../lib/use-public-data';
import { DataWarning } from './data-warning';
export function AdminWorkQueue() {
  const result = usePublicData<{ paymentReview: number; pendingPayment: number; pendingRefund: number }>('/api/admin/work-queue', 30000, true);
  return <section aria-label="งานที่ต้องดำเนินการ"><div className="admin-section-heading"><div><h2>งานที่ต้องดำเนินการ</h2><p>เลือกงานเพื่อเปิดรายการพร้อมตัวกรอง</p></div><button className="text-link" onClick={result.retry}>รีเฟรช</button></div>
    <DataWarning error={result.refreshError} retry={result.retry}/>
    {result.loading ? <p role="status">กำลังโหลดงาน…</p> : result.initialError ? <p className="form-alert" role="alert">{result.initialError} <button onClick={result.retry}>ลองใหม่</button></p> : result.data && <div className="booking-grid">{[
      { key: 'paymentReview' as const, label: 'รอตรวจสลิป', href: '/admin?section=payments&status=payment_review' },
      { key: 'pendingPayment' as const, label: 'รอชำระเงิน', href: '/admin?section=bookings&status=pending_payment' },
      { key: 'pendingRefund' as const, label: 'รอคืนเงิน', href: '/admin?section=bookings&refund=pending' },
    ].map(item => <Link className="booking-card" href={item.href} key={item.key}><h3>{item.label}</h3><strong>{result.data![item.key]} รายการ</strong></Link>)}</div>}
  </section>;
}
