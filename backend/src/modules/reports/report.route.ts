import { Router } from "express";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware.js";
import { dashboardQuery, reportQuery, dashboard, bookingReport, revenueReport, reportCSV } from "./report.service.js";
export const reportAdminRouter = Router();
reportAdminRouter.use(authMiddleware, requireRole("manager", "owner"));
reportAdminRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
reportAdminRouter.get("/dashboard", async (req, res) => res.json(await dashboard(dashboardQuery.parse(req.query))));
reportAdminRouter.get("/reports/bookings", async (req, res) => res.json(await bookingReport(reportQuery.parse(req.query))));
reportAdminRouter.get("/reports/bookings/export", async (req, res) => {
  const report = await bookingReport(reportQuery.parse(req.query));
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="zonify-bookings.csv"', "X-Content-Type-Options": "nosniff" });
  res.send(reportCSV(["ช่วงวันที่จอง", "รหัสตลาด", "ตลาด", "สถานะ", "จำนวนรายการ", "ยอดค่าเช่ารายการ (ไม่ใช่รายรับ)"], report.rows.map(r => [r.period, r.marketId, r.marketName, r.status, r.count, r.bookingAmount])));
});
export const reportOwnerRouter = Router();
reportOwnerRouter.use(authMiddleware, requireRole("owner"));
reportOwnerRouter.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
reportOwnerRouter.get("/reports/revenue", async (req, res) => res.json(await revenueReport(reportQuery.parse(req.query))));
reportOwnerRouter.get("/reports/revenue/export", async (req, res) => {
  const report = await revenueReport(reportQuery.parse(req.query));
  res.set({ "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="zonify-revenue.csv"', "X-Content-Type-Options": "nosniff" });
  res.send(reportCSV(["ช่วงวันที่บันทึกรับหรือคืนเงิน (Asia/Bangkok)", "รหัสตลาด", "ตลาด", "รับเงิน (บาท)", "คืนแล้ว (บาท)", "สุทธิ (บาท)", "รายการรับเงิน", "รายการคืนเงิน"], report.rows.map(r => [r.period, r.marketId, r.marketName, r.received, r.refunded, r.net, r.receivedCount, r.refundedCount])));
});
