import { expireBookings } from "./booking.service.js";
export function startBookingExpiry() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await expireBookings(); }
    catch (error) { console.error("Booking expiry failed", error instanceof Error ? error.name : "Unknown error"); }
    finally { busy = false; }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, 15_000);
  timer.unref();
  return () => clearInterval(timer);
}
