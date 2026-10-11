import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { AuthShell } from "../components/auth-shell";
import { BookingList } from "../components/booking-workspace";
export const metadata = { title: "รายการจองของฉัน | Zonify" };
export default async function BookingsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fbookings");
  return <AuthShell title="รายการจองของฉัน" subtitle="ตรวจสถานะ พักล็อก และติดตามรายการจองของคุณ" user={user}><BookingList/></AuthShell>;
}
