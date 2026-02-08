import express from "express";
import { siteRiskRouter } from "./routes/siteRisk";
import { aiImageDetectRouter } from "./routes/aiImageDetect";
import { extractProductImageRouter } from "./routes/extractProductImage";
import { extractProductImageDetectRouter } from "./routes/extractProductImageDetect";

export const createApp = () => {
  const app = express();

  app.use(express.json({ limit: "200kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", siteRiskRouter);
  app.use("/api", aiImageDetectRouter);
  app.use("/api", extractProductImageRouter);
  app.use("/api", extractProductImageDetectRouter);

  return app;
};
