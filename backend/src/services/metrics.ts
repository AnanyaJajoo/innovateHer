import { DEFAULT_AVG_ORDER_VALUE, PROTECTION_FACTORS, RISK_HIGH_THRESHOLD } from "../config/metrics";
import { Event } from "../models/Event";
import { FlagEvent } from "../models/FlagEvent";
import { RiskAssessment } from "../models/RiskAssessment";
import { ScanEvent } from "../models/ScanEvent";

export const getProtectionFactor = (score: number) => {
  if (score >= 90) return PROTECTION_FACTORS.critical;
  if (score >= 80) return PROTECTION_FACTORS.high;
  if (score >= 70) return PROTECTION_FACTORS.elevated;
  return 0;
};

export const computeProtectedDollars = (
  score: number,
  price?: number,
  defaultAvg: number = DEFAULT_AVG_ORDER_VALUE
) => {
  if (score < RISK_HIGH_THRESHOLD) return 0;
  const base = typeof price === "number" && Number.isFinite(price) ? price : defaultAvg;
  const factor = getProtectionFactor(score);
  return Math.max(0, Math.round(base * factor * 100) / 100);
};

export const getGlobalMetricsSummary = async (days?: number) => {
  const match: Record<string, unknown> = {};
  if (days && Number.isFinite(days)) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    match.$or = [{ timestamp: { $gte: cutoff } }, { createdAt: { $gte: cutoff } }];
  }
  const assessmentMatch: Record<string, unknown> = {};
  if (match.$or) {
    assessmentMatch.createdAt = { $gte: (match.$or as Array<any>)[0].timestamp.$gte };
  }

  const [pagesScanned, highRiskDetected] = await Promise.all([
    ScanEvent.countDocuments(match).catch(() => 0),
    RiskAssessment.countDocuments({
      ...assessmentMatch,
      riskScore: { $gte: RISK_HIGH_THRESHOLD }
    }).catch(() => 0)
  ]);

  return { pagesScanned, highRiskDetected };
};

export const getUserMetricsSummary = async (input: {
  userId?: string;
  anonId?: string;
  days?: number;
}) => {
  const match: Record<string, unknown> = {};
  if (input.userId) match.userId = input.userId;
  if (input.anonId) match.anonId = input.anonId;
  if (input.days && Number.isFinite(input.days)) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - input.days);
    match.$or = [{ timestamp: { $gte: cutoff } }, { createdAt: { $gte: cutoff } }];
  }

  const assessmentMatch: Record<string, unknown> = {};
  if (input.userId) assessmentMatch.userId = input.userId;
  if (input.anonId) assessmentMatch.anonId = input.anonId;
  if (match.$or) {
    assessmentMatch.createdAt = { $gte: (match.$or as Array<any>)[0].timestamp.$gte };
  }

  const [pagesScanned, highRiskDetected] = await Promise.all([
    ScanEvent.countDocuments(match).catch(() => 0),
    RiskAssessment.countDocuments({
      ...assessmentMatch,
      riskScore: { $gte: RISK_HIGH_THRESHOLD }
    }).catch(() => 0)
  ]);

  return { pagesScanned, highRiskDetected };
};

export const getTopFlaggedDomains = async (limit: number) => {
  return FlagEvent.aggregate([
    { $match: { domain: { $ne: null } } },
    { $group: { _id: "$domain", count: { $sum: 1 }, lastSeen: { $max: "$createdAt" } } },
    { $sort: { count: -1, lastSeen: -1 } },
    { $limit: limit },
    { $project: { _id: 0, domain: "$_id", count: 1, lastSeen: 1 } }
  ]).catch(() => []);
};

export const getImprovementSeries = async (input: {
  userId?: string;
  anonId?: string;
  weeks: number;
}) => {
  const match: Record<string, unknown> = {};
  if (input.userId) match.userId = input.userId;
  if (input.anonId) match.anonId = input.anonId;

  if (!input.userId && !input.anonId) return [];

  const highRisk = await RiskAssessment.aggregate([
    { $match: { ...match, riskScore: { $gte: RISK_HIGH_THRESHOLD } } },
    {
      $group: {
        _id: { year: { $isoWeekYear: "$createdAt" }, week: { $isoWeek: "$createdAt" } },
        count: { $sum: 1 }
      }
    }
  ]).catch(() => []);

  const correctFlags = await Event.aggregate([
    { $match: { ...match, actionTaken: "reported" } },
    {
      $group: {
        _id: { year: { $isoWeekYear: "$createdAt" }, week: { $isoWeek: "$createdAt" } },
        count: { $sum: 1 }
      }
    }
  ]).catch(() => []);

  const toKey = (entry: any) => `${entry._id.year}-W${String(entry._id.week).padStart(2, "0")}`;
  const getIsoWeekKey = (date: Date) => {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  };
  const highMap = new Map<string, number>();
  for (const entry of highRisk) highMap.set(toKey(entry), entry.count);
  const flagMap = new Map<string, number>();
  for (const entry of correctFlags) flagMap.set(toKey(entry), entry.count);

  const series = [];
  for (let i = input.weeks - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i * 7);
    const key = getIsoWeekKey(date);
    const highRiskViews = highMap.get(key) ?? 0;
    const correct = flagMap.get(key) ?? 0;
    const rate = highRiskViews > 0 ? Math.min(1, correct / highRiskViews) : 0;
    series.push({ week: key, highRiskViews, correctFlags: correct, correctFlagRate: rate });
  }

  return series;
};
