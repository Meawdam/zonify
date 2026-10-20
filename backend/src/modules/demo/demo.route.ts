import { Router } from "express";
import { env } from "../../config/env.js";
import { demoActivity } from "./demo-state.js";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware.js";

export const demoRouter = Router();
demoRouter.use((req, res, next) => {
  if (!env.DEMO_MODE) return next();
  if (demoActivity.resetting) { res.status(503).json({ code: "DEMO_RESETTING", message: "กำลังรีเซ็ตข้อมูลเดโม กรุณารอสักครู่แล้วเข้าสู่ระบบใหม่" }); return; }
  demoActivity.active++;
  let completed = false;
  const finish = () => { if (!completed) { completed = true; demoActivity.active--; } };
  // A disconnected client does not cancel awaited database writes. Release only
  // when the handler attempts its final response, including error responses.
  // A handler that never completes keeps reset blocked rather than losing data.
  const originalEnd = res.end;
  res.end = function (this: typeof res, ...args: Parameters<typeof res.end>) {
    try { return originalEnd.apply(this, args); } finally { finish(); }
  } as typeof res.end;
  next();
});
demoRouter.post("/demo/reset", (req, res, next) => env.DEMO_MODE ? next() : res.sendStatus(404), authMiddleware, requireRole("owner"), async (_req, res) => {
  // Authentication is asynchronous: another reset can acquire the lock while
  // this request is authenticating. Only the owner of the lock may release it.
  if (demoActivity.resetting) { res.status(503).json({ message: "มีการรีเซ็ตเดโมอยู่แล้ว กรุณารอสักครู่" }); return; }
  demoActivity.resetting = true;
  try {
    const deadline = Date.now() + 5000;
    while (demoActivity.active > 1 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    if (demoActivity.active > 1) { res.status(503).json({ message: "ยังมีคำขอที่กำลังทำงาน กรุณาลองรีเซ็ตใหม่" }); return; }
    const { seedDemo } = await import("../../scripts/seed-demo.js");
    await seedDemo(true);
    res.json({ ok: true, message: "รีเซ็ตข้อมูลเดโมแล้ว กรุณาเข้าสู่ระบบใหม่" });
  } finally { demoActivity.resetting = false; }
});
