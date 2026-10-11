import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { AuthShell } from "../components/auth-shell";
import { ProfileForms } from "../components/account-forms";
export const metadata = { title: "บัญชีของฉัน | Zonify" };
export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return <AuthShell title="บัญชีของฉัน" subtitle="จัดการข้อมูลส่วนตัวและรหัสผ่าน" user={user}><ProfileForms user={user}/></AuthShell>;
}
