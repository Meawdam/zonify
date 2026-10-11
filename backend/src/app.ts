import express from "express";

import { swaggerCustomCss } from "./config/swagger-theme.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";

import { errorHandler } from "./middlewares/error-handler.js";

import userRouter from "./modules/users/user.route.js"
import { requireOrigin } from "./middlewares/request-security.js";
import catalogRouter from "./modules/catalog/catalog.route.js";
import adminRouter from "./modules/admin/admin.route.js";
import bookingRouter, { managerBookingRouter, managerHoldRouter } from "./modules/bookings/booking.route.js";
import { paymentRouter, paymentAdminRouter } from "./modules/payments/payment.route.js";
import advertisementRouter from "./modules/advertisements/advertisement.route.js";
import { reportAdminRouter, reportOwnerRouter } from "./modules/reports/report.route.js";

const app = express();

app.disable("x-powered-by");
app.use("/api", requireOrigin);
app.use(express.json({ limit: "16kb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: swaggerCustomCss,
    customSiteTitle: "Zonify API Docs",
  })
);

app.use("/api/users", userRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/bookings", paymentRouter);
app.use("/api/admin/bookings", paymentAdminRouter);
app.use("/api/admin/bookings", managerBookingRouter);
app.use("/api/admin/holds", managerHoldRouter);
app.use("/api/admin", adminRouter);
app.use("/api/admin", reportAdminRouter);
app.use("/api/owner", reportOwnerRouter);
app.use("/api", catalogRouter);
app.use("/api", advertisementRouter);

app.use(errorHandler);

export default app;
