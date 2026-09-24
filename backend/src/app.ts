import express from "express";

import { swaggerCustomCss } from "./config/swagger-theme.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger.js";

import { errorHandler } from "./middlewares/error-handler.js";

import userRouter from "./modules/users/user.route.js"

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: swaggerCustomCss,
    customSiteTitle: "My Project API Docs",
  })
);

app.use("/api/users", userRouter);

app.use(errorHandler);

export default app;