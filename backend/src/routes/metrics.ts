import { Router } from "express";
import { isDbReady } from "../db";
import {
  getGlobalMetricsSummary,
  getImprovementSeries,
  getTopFlaggedDomains,
  getUserMetricsSummary
} from "../services/metrics";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const metricsRouter = Router();

metricsRouter.get("/metrics/summary", async (req, res) => {
  if (!isDbReady()) {
    return res.json({ pagesScanned: 0, highRiskDetected: 0 });
  }
  const days = req.query?.days ? Number(req.query.days) : undefined;
  const summary = await getGlobalMetricsSummary(days);
  return res.json(summary);
});

metricsRouter.get("/metrics/users/:userId/summary", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  if (!isDbReady()) {
    return res.json({ pagesScanned: 0, highRiskDetected: 0 });
  }
  const days = req.query?.days ? Number(req.query.days) : undefined;
  const summary = await getUserMetricsSummary({ userId, days });
  return res.json(summary);
});

metricsRouter.get("/metrics/users/:userId/improvement", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }
  if (!isDbReady()) {
    return res.json({ series: [] });
  }
  const weeks = clamp(Number(req.query?.weeks ?? 12), 4, 52);
  const series = await getImprovementSeries({ userId, weeks });
  return res.json({ series });
});

metricsRouter.get("/metrics/top-domains", async (req, res) => {
  if (!isDbReady()) {
    return res.json({ domains: [] });
  }
  const limit = clamp(Number(req.query?.limit ?? 10), 1, 50);
  const domains = await getTopFlaggedDomains(limit);
  return res.json({ domains });
});
