export function Icon({ name = "arrow", className = "" }: { name?: "arrow" | "store" | "pin" | "check" | "zoom" | "grid" | "house" | "close" | "search" | "calendar" | "tag" | "chevron" | "play" | "plus" | "minus" | "coin" | "area" | "tent"; className?: string }) {
  const paths = {
    arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
    store: <><path d="M4 9h16l-2-5H6L4 9ZM5 9v11h14V9M9 20v-6h6v6"/><path d="M4 9v2a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0V9"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    zoom: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5M7 10h6M10 7v6"/></>,
    grid: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16M15 4v16M4 15h16"/></>,
    house: <><path d="m2 10 10-8 10 8M5 8v13h14V8M9 21v-8h6v8M3 10h18M7 6h10"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/></>,
    tag: <><path d="M3 4h9l9 9-8 8-10-10V4Z"/><circle cx="8" cy="9" r="1"/></>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    play: <path d="m9 6 9 6-9 6V6Z"/>,
    plus: <path d="M5 12h14M12 5v14"/>,
    minus: <path d="M5 12h14"/>,
    coin: <><circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9M12 6v12"/></>,
    area: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v3M12 4v3M16 4v3M4 8h3M4 12h3M4 16h3M10 17l7-7M12 10h5v5"/></>,
    tent: <><path d="M2 20h20M3 17c5-1 8-6 9-14 1 8 4 13 9 14M5 18c4-1 6-5 7-10 1 5 3 9 7 10M12 5v14M7 20l5-2 5 2"/><circle cx="12" cy="2" r=".8"/></>,
  };
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
