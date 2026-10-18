"use client";
import { useEffect, useState } from "react";
type Result<T> = { key: string; sourceUrl: string; data: T | null; error: string; pending: boolean; status: number };
export type InitialData<T> = { url: string; data: T; fetchedAt: number };
// State belongs to this hook instance, never a shared cache of account data.
export function usePublicData<T>(url: string | null, pollMs = 0, keepPrevious = false, initial?: InitialData<T>) {
  const [attempt, setAttempt] = useState(0);
  const key = url + "|" + attempt;
  const [result, setResult] = useState<Result<T> | null>(() => initial && initial.url === url
    ? { key, sourceUrl: initial.url, data: initial.data, error: "", pending: false, status: 200 } : null);
  const seedUrl = initial?.url, seededAt = initial?.fetchedAt ?? 0;
  useEffect(() => {
    if (!url) return;
    const sourceUrl = url, controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy || controller.signal.aborted) return;
      busy = true;
      await Promise.resolve();
      if (controller.signal.aborted) { busy = false; return; }
      setResult(previous => ({ key, sourceUrl, data: keepPrevious && previous?.sourceUrl === sourceUrl ? previous.data : null, error: "", pending: true, status: 0 }));
      let status = 0;
      try {
        const response = await fetch(sourceUrl, { signal: controller.signal, credentials: "same-origin", cache: "no-store" });
        status = response.status;
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message ?? "โหลดข้อมูลไม่สำเร็จ");
        if (!controller.signal.aborted) setResult({ key, sourceUrl, data: data as T, error: "", pending: false, status });
      } catch (error) {
        if (!controller.signal.aborted) setResult(previous => ({ key, sourceUrl,
          data: keepPrevious && ![401, 403, 404, 410].includes(status) && previous?.sourceUrl === sourceUrl ? previous.data : null,
          error: error instanceof Error ? error.message : "เชื่อมต่อระบบไม่ได้", pending: false, status }));
      } finally { busy = false; }
    }
    const seedFresh = sourceUrl === seedUrl && attempt === 0 && Date.now() - seededAt < (pollMs || 60_000);
    if (!seedFresh) void load();
    const refreshVisible = () => { if (document.visibilityState === "visible") void load(); };
    let timer: ReturnType<typeof setInterval> | null = null;
    const firstPoll = pollMs ? setTimeout(() => {
      refreshVisible(); timer = setInterval(refreshVisible, pollMs);
    }, seedFresh ? Math.max(1, pollMs - (Date.now() - seededAt)) : pollMs) : null;
    if (pollMs) { window.addEventListener("focus", refreshVisible); document.addEventListener("visibilitychange", refreshVisible); }
    return () => { controller.abort(); if (timer) clearInterval(timer); if (firstPoll) clearTimeout(firstPoll); window.removeEventListener("focus", refreshVisible); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [url, key, pollMs, keepPrevious, seedUrl, seededAt, attempt]);
  const sameResource = !!url && result?.sourceUrl === url;
  const current = sameResource && result.key === key ? result : null;
  const data = current ? current.data : keepPrevious && sameResource ? result.data : null;
  const error = current?.error ?? "", pending = !!url && (!current || current.pending);
  return { data, error, status: current?.status ?? 0, loading: pending && !data, refreshing: pending && !!data,
    initialError: !data ? error : "", refreshError: data ? error : "", retry: () => setAttempt(n => n + 1) };
}
