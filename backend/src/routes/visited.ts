import { Router } from "express";
import { isDbReady } from "../db";
import { ScanEvent } from "../models/ScanEvent";
import { RiskAssessment } from "../models/RiskAssessment";
import { SiteRiskCache } from "../models/SiteRiskCache";

export interface VisitedEntry {
  domain: string;
  normalizedUrl?: string;
  urlHash: string;
  riskScore?: number;
  confidence?: number;
  timestamp: Date;
}

export interface VisitedSource extends VisitedEntry {
  userId?: string;
  anonId?: string;
}

export const filterVisited = (
  entries: VisitedSource[],
  userId?: string,
  anonId?: string
) => {
  if (!userId && !anonId) return [];
  return entries.filter((entry) => {
    if (userId && entry.userId === userId) return true;
    if (anonId && entry.anonId === anonId) return true;
    return false;
  });
};

export const sortVisited = (entries: VisitedSource[], limit: number) => {
  return entries
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
};

export const visitedRouter = Router();

visitedRouter.get("/visited", async (req, res) => {
  const userId = typeof req.query?.userId === "string" ? req.query.userId : undefined;
  const anonId = typeof req.query?.anonId === "string" ? req.query.anonId : undefined;
  const limit = Math.min(50, Math.max(1, Number(req.query?.limit ?? 50)));

  if (!isDbReady()) {
    return res.json({ entries: [] });
  }

  if (!userId && !anonId) {
    return res.json({ entries: [] });
  }

  const match: Record<string, unknown> = {};
  if (userId) match.userId = userId;
  if (anonId) match.anonId = anonId;

  const events = await ScanEvent.find(match)
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean()
    .catch((err) => {
      console.error("Visited: scan event query failed", err);
      return [];
    });

  const urlHashes = Array.from(new Set(events.map((e) => e.urlHash)));

  const [assessments, caches] = await Promise.all([
    RiskAssessment.find({ urlHash: { $in: urlHashes } })
      .sort({ createdAt: -1 })
      .lean()
      .catch(() => []),
    SiteRiskCache.find({ urlHash: { $in: urlHashes } })
      .lean()
      .catch(() => [])
  ]);

  const assessmentMap = new Map<string, { riskScore?: number; confidence?: number }>();
  for (const a of assessments) {
    if (!assessmentMap.has(a.urlHash)) {
      assessmentMap.set(a.urlHash, {
        riskScore: a.riskScore,
        confidence: a.confidence
      });
    }
  }

  const cacheMap = new Map<string, { normalizedUrl?: string }>();
  for (const c of caches) {
    cacheMap.set(c.urlHash, { normalizedUrl: c.normalizedUrl });
  }

  const entries: VisitedSource[] = events.map((event) => ({
    userId: event.userId,
    anonId: event.anonId,
    domain: event.domain,
    urlHash: event.urlHash,
    normalizedUrl: cacheMap.get(event.urlHash)?.normalizedUrl,
    riskScore: assessmentMap.get(event.urlHash)?.riskScore,
    confidence: assessmentMap.get(event.urlHash)?.confidence,
    timestamp: event.timestamp
  }));

  const filtered = filterVisited(entries, userId, anonId);
  const sorted = sortVisited(filtered, limit).map((entry) => ({
    domain: entry.domain,
    normalizedUrl: entry.normalizedUrl,
    urlHash: entry.urlHash,
    riskScore: entry.riskScore,
    confidence: entry.confidence,
    timestamp: entry.timestamp
  }));

  return res.json({ entries: sorted });
});
