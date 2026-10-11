"use client";
import { useEffect, useState } from "react";
type Result<T> = { key: string; sourceUrl: string; data: T | null; error: string };
export function usePublicData<T>(url: string | null, pollMs = 0, keepPrevious = false) {
  const [attempt, setAttempt] = useState(0);
  const key = url + "|" + attempt;
  const [result, setResult] = useState<Result<T> | null>(null);
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const response = await fetch(url!, { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "โหลดข้อมูลไม่สำเร็จ");
        if (!controller.signal.aborted) setResult({ key, sourceUrl: url!, data: data as T, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setResult({ key, sourceUrl: url!, data: null, error: error instanceof Error ? error.message : "เชื่อมต่อระบบไม่ได้" });
      } finally { busy = false; }
    }
    void load();
    const refreshVisible = () => { if (document.visibilityState === "visible") void load(); };
    const timer = pollMs ? setInterval(refreshVisible, pollMs) : null;
    if (pollMs) window.addEventListener("focus", refreshVisible);
    return () => { controller.abort(); if (timer) clearInterval(timer); window.removeEventListener("focus", refreshVisible); };
  }, [url, key, pollMs]);
  const current = result?.key === key ? result : null;
  return { data: current ? current.data : keepPrevious && result?.sourceUrl === url ? result.data : null, error: current?.error ?? "", loading: !!url && !current, retry: () => setAttempt(n => n + 1) };
}
