import { Router } from "express";
import { isDbReady } from "../db";
import { Event } from "../models/Event";
import { Scan } from "../models/Scan";
import { SiteRiskCache } from "../models/SiteRiskCache";
import { RiskAssessment } from "../models/RiskAssessment";
import { buildDebugSeries } from "../services/debugSeries";
import { buildStatsSeries } from "../services/statsSeries";
import { RISK_HIGH_THRESHOLD } from "../config/metrics";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const statsRouter = Router();

statsRouter.get("/stats", async (req, res) => {
  const startedAt = Date.now();
  const scope = (req.query?.scope as string) ?? "global";
  const days = clamp(Number(req.query?.days ?? 7), 1, 365);
  const userId = typeof req.query?.userId === "string" ? req.query.userId : undefined;
  const anonId = typeof req.query?.anonId === "string" ? req.query.anonId : undefined;
  const debugSeed = req.query?.debugSeed as string | undefined;
  const simulated = req.query?.simulated as string | undefined;

  // Validate user scope requires user identifier
  if (scope === "user" && !userId && !anonId) {
    return res.status(400).json({
      error: "missing_user_identifier"
    });
  }

  if (!isDbReady()) {
    console.warn(`Stats: DB not ready (scope=${scope}, days=${days})`);
    return res.json({ scope, days, stats: [] });
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);

  const scanMatch: Record<string, unknown> = { createdAt: { $gte: cutoff } };
  const assessmentMatch: Record<string, unknown> = { createdAt: { $gte: cutoff } };
  const eventMatch: Record<string, unknown> = { createdAt: { $gte: cutoff } };
  const cacheMatch: Record<string, unknown> = { checkedAt: { $gte: cutoff } };

  if (scope === "user") {
    if (userId) {
      scanMatch.userId = userId;
      assessmentMatch.userId = userId;
      eventMatch.userId = userId;
    } else if (anonId) {
      scanMatch.anonId = anonId;
      assessmentMatch.anonId = anonId;
      eventMatch.anonId = anonId;
    }
  }

  const [assessments, events, scans, caches] = await Promise.all([
    RiskAssessment.find(assessmentMatch)
      .select({ riskScore: 1, createdAt: 1, domain: 1 })
      .lean()
      .catch((err) => {
        console.error("Stats: assessment query failed", err);
        return [];
      }),
    Event.find(eventMatch)
      .select({ actionTaken: 1, createdAt: 1 })
      .lean()
      .catch((err) => {
        console.error("Stats: event query failed", err);
        return [];
      }),
    Scan.find(scanMatch)
      .select({ riskScore: 1, createdAt: 1, domain: 1 })
      .lean()
      .catch((err) => {
        console.error("Stats: scan query failed", err);
        return [];
      }),
    SiteRiskCache.find(cacheMatch)
      .select({ domain: 1, checkedAt: 1 })
      .lean()
      .catch((err) => {
        console.error("Stats: cache query failed", err);
        return [];
      })
  ]);

  const stats = buildStatsSeries({
    scope: scope === "user" ? "user" : "global",
    days,
    userId,
    anonId,
    assessments,
    events,
    scans,
    caches
  });

  const realSeries = {
    scope,
    days,
    stats,
    ...(scope === "user" ? { userId: userId ?? anonId ?? "default" } : {})
  };

  const shouldSimulate =
    scope === "global" &&
    (simulated === "1" ||
      simulated === "true" ||
      process.env.SIMULATED_GLOBAL_STATS === "1" ||
      process.env.SIMULATED_GLOBAL_STATS === "true");
  const debugSeries = shouldSimulate
    ? buildDebugSeries({ days, points: 2200, seed: debugSeed ?? "simulated" })
    : [];

  const listLimit = clamp(Number(req.query?.limit ?? 20), 1, 100);
  const baseMatch = scope === "user"
    ? userId
      ? { userId }
      : { anonId }
    : {};

  const [riskyDomains, safeDomains] = await Promise.all([
    scope === "global"
      ? SiteRiskCache.aggregate([
          { $sort: { checkedAt: -1 } },
          {
            $group: {
              _id: "$domain",
              riskScore: { $first: "$riskScore" },
              checkedAt: { $first: "$checkedAt" }
            }
          },
          { $match: { riskScore: { $gte: RISK_HIGH_THRESHOLD } } },
          { $sort: { checkedAt: -1 } },
          { $limit: listLimit },
          { $project: { _id: 0, domain: "$_id", riskScore: 1, checkedAt: 1 } }
        ]).catch(() => [])
      : Scan.aggregate([
          { $match: baseMatch },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$domain",
              riskScore: { $first: "$riskScore" },
              createdAt: { $first: "$createdAt" }
            }
          },
          { $match: { riskScore: { $gte: RISK_HIGH_THRESHOLD } } },
          { $sort: { createdAt: -1 } },
          { $limit: listLimit },
          { $project: { _id: 0, domain: "$_id", riskScore: 1, createdAt: 1 } }
        ]).catch(() => []),
    scope === "global"
      ? SiteRiskCache.aggregate([
          { $sort: { checkedAt: -1 } },
          {
            $group: {
              _id: "$domain",
              riskScore: { $first: "$riskScore" },
              checkedAt: { $first: "$checkedAt" }
            }
          },
          { $match: { riskScore: { $lt: RISK_HIGH_THRESHOLD } } },
          { $sort: { checkedAt: -1 } },
          { $limit: listLimit },
          { $project: { _id: 0, domain: "$_id", riskScore: 1, checkedAt: 1 } }
        ]).catch(() => [])
      : Scan.aggregate([
          { $match: baseMatch },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$domain",
              riskScore: { $first: "$riskScore" },
              createdAt: { $first: "$createdAt" }
            }
          },
          { $match: { riskScore: { $lt: RISK_HIGH_THRESHOLD } } },
          { $sort: { createdAt: -1 } },
          { $limit: listLimit },
          { $project: { _id: 0, domain: "$_id", riskScore: 1, createdAt: 1 } }
        ]).catch(() => [])
  ]);

  if (scope === "user") {
    const domains = new Set<string>();
    for (const scan of scans) {
      if (scan.domain) domains.add(scan.domain);
    }
    const domainList = Array.from(domains).slice(0, 20);
    console.log(
      `Stats user domains (${domains.size}): ${domainList.join(", ")}${domains.size > 20 ? "..." : ""}`
    );
  }

  const durationMs = Date.now() - startedAt;
  console.log(`Stats: scope=${scope} days=${days} ms=${durationMs}`);

  return res.json({
    ...realSeries,
    realSeries: realSeries.stats,
    debugSeries,
    simulatedUsed: shouldSimulate,
    safeDomains,
    riskyDomains
  });
});
