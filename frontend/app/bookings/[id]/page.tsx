import { redirect, notFound } from "next/navigation";
import { currentUser } from "../../lib/server-auth";
import { AuthShell } from "../../components/auth-shell";
import { BookingDetail } from "../../components/booking-workspace";
export const metadata = { title: "รายละเอียดการจอง | Zonify" };
export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user] = await Promise.all([params, currentUser()]);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]{0,79}$/.test(id)) notFound();
  if (!user) redirect("/login?next=" + encodeURIComponent("/bookings/" + id));
  return <AuthShell title="รายละเอียดการจอง" subtitle="พักล็อก · ตรวจรายละเอียด · ชำระเงิน · รอตรวจสลิป · ยืนยันแล้ว" user={user}><BookingDetail key={id} id={id}/></AuthShell>;
}
