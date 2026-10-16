import "server-only";
import type { Category, FloorPlan, Market } from "./catalog";
import type { InitialData } from "./use-public-data";
export type LandingData = { markets?: InitialData<{ items: Market[] }>; categories?: InitialData<{ items: Category[] }>; floor?: InitialData<FloorPlan> };
async function publicJSON<T>(path: string, reference = false): Promise<InitialData<T> | undefined> {
  try {
    const response = await fetch(`${process.env.BACKEND_URL ?? "http://localhost:4000"}${path}`, {
      ...(reference ? { next: { revalidate: 60 } } : { cache: "no-store" as const }), signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return undefined;
    return { url: path, data: await response.json() as T, fetchedAt: Date.now() };
  } catch { return undefined; } // Initial failures remain retryable in the client.
}
export async function initialCatalog(marketId: string, date: string): Promise<LandingData> {
  const floorURL = (id: string) => `/api/markets/${encodeURIComponent(id)}/floor-plan?date=${date}`;
  const [markets, categories, requestedFloor] = await Promise.all([
    publicJSON<{ items: Market[] }>("/api/markets", true), publicJSON<{ items: Category[] }>("/api/categories", true),
    marketId ? publicJSON<FloorPlan>(floorURL(marketId)) : undefined,
  ]);
  const selected = markets?.data.items.find(m => m.id === marketId) ?? markets?.data.items[0];
  const floor = selected ? selected.id === marketId ? requestedFloor : await publicJSON<FloorPlan>(floorURL(selected.id)) : undefined;
  return { markets, categories, floor };
}
