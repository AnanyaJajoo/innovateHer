import express from "express";
import { siteRiskRouter } from "./routes/siteRisk";
import { aiImageDetectRouter } from "./routes/aiImageDetect";

export const createApp = () => {
  const app = express();

  app.use(express.json({ limit: "200kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", siteRiskRouter);
  app.use("/api", aiImageDetectRouter);

  return app;
};
