"use client";
import { useEffect } from "react";
export const discardEdits = () => window.confirm("มีข้อมูลที่ยังไม่บันทึก ต้องการละทิ้งการแก้ไขหรือไม่?");
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const originPath = location.pathname;
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    // The navigate event precedes popstate and Next's synchronous route restoration.
    const beforeTraverse = (event: Event) => {
      const traversal = event as Event & { navigationType: string; destination: { url: string } };
      if (traversal.navigationType === "traverse" && event.cancelable && new URL(traversal.destination.url).pathname !== originPath && !discardEdits()) event.preventDefault();
    };
    const navigate = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      const url = new URL(target.href);
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (!discardEdits()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    navigation?.addEventListener("navigate", beforeTraverse);
    window.addEventListener("beforeunload", unload); document.addEventListener("click", navigate, true);
    return () => { navigation?.removeEventListener("navigate", beforeTraverse); window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); };
  }, [dirty]);
}
