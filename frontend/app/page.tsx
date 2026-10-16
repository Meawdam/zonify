import { LandingPage } from "./components/landing-page";
import { currentUser } from "./lib/server-auth";
import { validDate } from "./lib/catalog";
import { initialCatalog } from "./lib/server-catalog";
import { resourceId } from "./lib/url-state";
export default async function Home({ searchParams }: { searchParams: Promise<{ market?: string; stall?: string; date?: string }> }) {
  const userPromise = currentUser(), params = await searchParams;
  const initialDate = typeof params.date === "string" && validDate(params.date) ? params.date : new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const initialMarket = resourceId(typeof params.market === "string" ? params.market : "");
  const [user, initialData] = await Promise.all([userPromise, initialCatalog(initialMarket, initialDate)]);
  return <LandingPage user={user} initialDate={initialDate} initialMarket={initialMarket} initialStall={resourceId(typeof params.stall === "string" ? params.stall : "")} initialData={initialData}/>;
}
