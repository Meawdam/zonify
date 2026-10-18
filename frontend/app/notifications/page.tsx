import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { AuthShell } from "../components/auth-shell";
import { NotificationHistory } from "../components/notifications";
export const metadata = { title: "การแจ้งเตือน | Zonify" };
export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=%2Fnotifications");
  return <AuthShell title="การแจ้งเตือน" subtitle="ติดตามผลการตรวจสลิป การจอง และการคืนเงิน" user={user}><NotificationHistory/></AuthShell>;
}
