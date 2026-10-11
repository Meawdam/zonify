import { LandingPage } from "./components/landing-page";
import { currentUser } from "./lib/server-auth";
import { validDate } from "./lib/catalog";
export default async function Home({ searchParams }: { searchParams: Promise<{ market?: string; stall?: string; date?: string }> }) {
  const [user, params] = await Promise.all([currentUser(), searchParams]);
  const initialDate = typeof params.date === "string" && validDate(params.date) ? params.date : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return <LandingPage user={user} initialDate={initialDate} initialMarket={typeof params.market === "string" ? params.market : ""} initialStall={typeof params.stall === "string" ? params.stall : ""}/>;
}
