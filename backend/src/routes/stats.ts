import { Router } from "express";
import { isDbReady } from "../db";
import { Event } from "../models/Event";
import { Scan } from "../models/Scan";
import { SiteRiskCache } from "../models/SiteRiskCache";
import { RiskAssessment } from "../models/RiskAssessment";
import { RISK_HIGH_THRESHOLD } from "../config/metrics";
import { buildDebugSeries } from "../services/debugSeries";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getRiskBin = (score: number) => {
  if (score < 20) return "0-20";
  if (score < 40) return "20-40";
  if (score < 60) return "40-60";
  if (score < 80) return "60-80";
  return "80-100";
};

export const statsRouter = Router();

statsRouter.get("/stats", async (req, res) => {
  const startedAt = Date.now();
  const scope = (req.query?.scope as string) ?? "global";
  const days = clamp(Number(req.query?.days ?? 7), 1, 365);
  const userId = typeof req.query?.userId === "string" ? req.query.userId : undefined;
  const anonId = typeof req.query?.anonId === "string" ? req.query.anonId : undefined;
  const debugSeed = req.query?.debugSeed as string | undefined;

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

  const statsByDate = new Map<
    string,
    {
      totalEvents: number;
      byAction: Record<string, number>;
      riskScoreBins: Record<string, number>;
      uniqueDomains: Set<string>;
    }
  >();

  const ensure = (dateKey: string) => {
    if (!statsByDate.has(dateKey)) {
      statsByDate.set(dateKey, {
        totalEvents: 0,
        byAction: { ignored: 0, left: 0, reported: 0, proceeded: 0 },
        riskScoreBins: {},
        uniqueDomains: new Set()
      });
    }
    return statsByDate.get(dateKey)!;
  };

  for (const assessment of assessments) {
    if (!assessment.createdAt) continue;
    const dateKey = getDateKey(new Date(assessment.createdAt));
    const bucket = ensure(dateKey);
    const score = Number(assessment.riskScore ?? 0);
    const bin = getRiskBin(score);
    bucket.riskScoreBins[bin] = (bucket.riskScoreBins[bin] ?? 0) + 1;
    if (score >= RISK_HIGH_THRESHOLD) {
      bucket.totalEvents += 1;
    }
  }

  for (const event of events) {
    if (!event.createdAt) continue;
    const dateKey = getDateKey(new Date(event.createdAt));
    const bucket = ensure(dateKey);
    const action = event.actionTaken ?? "ignored";
    bucket.byAction[action] = (bucket.byAction[action] ?? 0) + 1;
  }

  if (scope === "global") {
    for (const cache of caches) {
      if (!cache.checkedAt) continue;
      const dateKey = getDateKey(new Date(cache.checkedAt));
      const bucket = ensure(dateKey);
      if (cache.domain) bucket.uniqueDomains.add(cache.domain);
    }
  } else {
    for (const scan of scans) {
      if (!scan.createdAt) continue;
      const dateKey = getDateKey(new Date(scan.createdAt));
      const bucket = ensure(dateKey);
      if (scan.domain) bucket.uniqueDomains.add(scan.domain);
    }
  }

  const stats = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const dateKey = getDateKey(date);
    const bucket =
      statsByDate.get(dateKey) ??
      ({
        totalEvents: 0,
        byAction: { ignored: 0, left: 0, reported: 0, proceeded: 0 },
        riskScoreBins: {},
        uniqueDomains: new Set()
      } as const);

    stats.push({
      date: dateKey,
      totalEvents: bucket.totalEvents,
      uniqueDomains: bucket.uniqueDomains.size,
      byAction: bucket.byAction,
      riskScoreBins: Object.entries(bucket.riskScoreBins).map(([bin, count]) => ({
        bin,
        count
      }))
    });
  }

  const nonZeroDays = stats.filter(
    (entry) => entry.totalEvents > 0 || entry.uniqueDomains > 0
  ).length;

  const realSeries = {
    scope,
    days,
    stats,
    ...(scope === "user" ? { userId: userId ?? anonId ?? "default" } : {})
  };

  const isDev = process.env.NODE_ENV !== "production";
  const shouldSeed =
    isDev &&
    (nonZeroDays < 10 || debugSeed === "1" || debugSeed === "true");
  const debugSeries = shouldSeed
    ? buildDebugSeries({ days, points: 2200, seed: debugSeed ?? "dev-seed" })
    : [];

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
    debugUsed: shouldSeed
  });
});
