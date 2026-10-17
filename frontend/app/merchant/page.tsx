import { redirect } from "next/navigation";
import { currentUser } from "../lib/server-auth";
import { SecondaryShell } from "../components/secondary-shell";
import { MerchantWorkspace } from "../components/merchant-workspace";
export const metadata = { title: "ร้านของฉัน | Zonify" };
export default async function MerchantPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser();
  if (!user) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) if (typeof value === "string" && ["market", "returnTo"].includes(key)) query.set(key, value);
    redirect("/login?next=" + encodeURIComponent("/merchant" + (query.size ? "?" + query : "")));
  }
  return <SecondaryShell title="ร้านของฉัน" subtitle="ดูแลร้านของคุณ เลือกพื้นที่ขาย และติดตามการจองในที่เดียว" user={user} wide><MerchantWorkspace/></SecondaryShell>;
}
