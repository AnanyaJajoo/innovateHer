import express from "express";
import { siteRiskRouter } from "./routes/siteRisk";
import { aiImageDetectRouter } from "./routes/aiImageDetect";
import { extractProductImageRouter } from "./routes/extractProductImage";
import { extractProductImageDetectRouter } from "./routes/extractProductImageDetect";
import { eventsRouter } from "./routes/events";
import { reportsRouter } from "./routes/reports";
import { metricsRouter } from "./routes/metrics";
import { statsRouter } from "./routes/stats";
import { visitedRouter } from "./routes/visited";
import { scoreRouter } from "./routes/score";

export const createApp = () => {
  const app = express();

  app.use(express.json({ limit: "200kb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "backend" });
  });

  app.use("/api", siteRiskRouter);
  app.use("/api", aiImageDetectRouter);
  app.use("/api", extractProductImageRouter);
  app.use("/api", extractProductImageDetectRouter);
  app.use("/api", scoreRouter);
  app.use("/api", eventsRouter);
  app.use("/api", reportsRouter);
  app.use("/api", metricsRouter);
  app.use("/api", statsRouter);
  app.use("/api", visitedRouter);

  return app;
};
