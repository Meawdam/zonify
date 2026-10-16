"use client";
import { useSearchParams } from "next/navigation";
export function useURLState() {
  const params = useSearchParams();
  function update(values: Record<string, string | number | null>, hash?: string) {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "") url.searchParams.delete(key); else url.searchParams.set(key, String(value));
    }
    if (hash !== undefined) url.hash = hash;
    window.history.pushState(null, "", url.pathname + url.search + url.hash);
  }
  return { params, update };
}
