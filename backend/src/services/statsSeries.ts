import { RISK_HIGH_THRESHOLD } from "../config/metrics";

export type StatAssessment = {
  createdAt?: Date;
  riskScore?: number;
  domain?: string;
  userId?: string;
  anonId?: string;
};

export type StatEvent = {
  createdAt?: Date;
  actionTaken?: string;
  userId?: string;
  anonId?: string;
};

export type StatScan = {
  createdAt?: Date;
  domain?: string;
  userId?: string;
  anonId?: string;
};

export type StatCache = {
  checkedAt?: Date;
  domain?: string;
};

export type DailyStat = {
  date: string;
  totalEvents: number;
  uniqueDomains: number;
  byAction: Record<string, number>;
  riskScoreBins: { bin: string; count: number }[];
  cumulativeEvents?: number;
  cumulativeUniqueDomains?: number;
};

const getDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getRiskBin = (score: number) => {
  if (score < 20) return "0-20";
  if (score < 40) return "20-40";
  if (score < 60) return "40-60";
  if (score < 80) return "60-80";
  return "80-100";
};

const matchesUser = (
  entry: { userId?: string; anonId?: string },
  userId?: string,
  anonId?: string
) => {
  if (userId) return entry.userId === userId;
  if (anonId) return entry.anonId === anonId;
  return true;
};

export const buildStatsSeries = (input: {
  scope: "global" | "user";
  days: number;
  userId?: string;
  anonId?: string;
  assessments: StatAssessment[];
  events: StatEvent[];
  scans: StatScan[];
  caches: StatCache[];
  highRiskThreshold?: number;
}): DailyStat[] => {
  if (input.scope === "user" && !input.userId && !input.anonId) {
    const empty: DailyStat[] = [];
    for (let i = input.days - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i);
      empty.push({
        date: getDateKey(date),
        totalEvents: 0,
        uniqueDomains: 0,
        byAction: { ignored: 0, left: 0, reported: 0, proceeded: 0 },
        riskScoreBins: [],
        cumulativeEvents: 0,
        cumulativeUniqueDomains: 0
      });
    }
    return empty;
  }

  const threshold = input.highRiskThreshold ?? RISK_HIGH_THRESHOLD;
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

  for (const assessment of input.assessments) {
    if (!assessment.createdAt) continue;
    if (input.scope === "user" && !matchesUser(assessment, input.userId, input.anonId)) {
      continue;
    }
    const dateKey = getDateKey(new Date(assessment.createdAt));
    const bucket = ensure(dateKey);
    const score = Number(assessment.riskScore ?? 0);
    const bin = getRiskBin(score);
    bucket.riskScoreBins[bin] = (bucket.riskScoreBins[bin] ?? 0) + 1;
    if (score >= threshold) {
      bucket.totalEvents += 1;
    }
  }

  for (const event of input.events) {
    if (!event.createdAt) continue;
    if (input.scope === "user" && !matchesUser(event, input.userId, input.anonId)) {
      continue;
    }
    const dateKey = getDateKey(new Date(event.createdAt));
    const bucket = ensure(dateKey);
    const action = event.actionTaken ?? "ignored";
    bucket.byAction[action] = (bucket.byAction[action] ?? 0) + 1;
  }

  if (input.scope === "global") {
    for (const cache of input.caches) {
      if (!cache.checkedAt) continue;
      const dateKey = getDateKey(new Date(cache.checkedAt));
      const bucket = ensure(dateKey);
      if (cache.domain) bucket.uniqueDomains.add(cache.domain);
    }
  } else {
    for (const scan of input.scans) {
      if (!scan.createdAt) continue;
      if (!matchesUser(scan, input.userId, input.anonId)) continue;
      const dateKey = getDateKey(new Date(scan.createdAt));
      const bucket = ensure(dateKey);
      if (scan.domain) bucket.uniqueDomains.add(scan.domain);
    }
  }

  const stats: Array<DailyStat & { _domains?: Set<string> }> = [];
  for (let i = input.days - 1; i >= 0; i -= 1) {
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
      })),
      _domains: bucket.uniqueDomains
    });
  }

  let cumulativeEvents = 0;
  const cumulativeDomains = new Set<string>();
  for (const entry of stats) {
    cumulativeEvents += entry.totalEvents;
    entry._domains?.forEach((domain) => cumulativeDomains.add(domain));
    entry.cumulativeEvents = cumulativeEvents;
    entry.cumulativeUniqueDomains = cumulativeDomains.size;
    delete entry._domains;
  }

  return stats;
};
