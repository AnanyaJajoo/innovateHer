// In-memory store for demo; replace with MongoDB + aggregation pipelines later.
// Privacy: we only keep domain + score bins, not full URLs.

import type { EventLog, DailyUserStats, GlobalStats } from "@/types/events";

const events: EventLog[] = [];

function getScoreBin(score: number): string {
  if (score < 0.2) return "0-0.2";
  if (score < 0.4) return "0.2-0.4";
  if (score < 0.6) return "0.4-0.6";
  if (score < 0.8) return "0.6-0.8";
  return "0.8-1";
}

function getDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function addEvent(log: EventLog): void {
  events.push({ ...log, timestamp: log.timestamp || new Date().toISOString() });
}

export function getDailyUserStats(userId: string, days: number = 7): DailyUserStats[] {
  const byDate = new Map<string, EventLog[]>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  for (const e of events) {
    const d = new Date(e.timestamp);
    if (d < cutoff) continue;
    const key = getDateKey(e.timestamp);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  }

  const result: DailyUserStats[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const dayEvents = byDate.get(key) ?? [];

    const byAction = { ignored: 0, left: 0, reported: 0 } as Record<string, number>;
    const byCategory: Record<string, number> = {};
    const binCounts: Record<string, number> = {};
    const domainCounts: Record<string, number> = {};

    for (const e of dayEvents) {
      byAction[e.actionTaken] = (byAction[e.actionTaken] ?? 0) + 1;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
      const bin = getScoreBin(e.riskScore);
      binCounts[bin] = (binCounts[bin] ?? 0) + 1;
      domainCounts[e.domain] = (domainCounts[e.domain] ?? 0) + 1;
    }

    result.push({
      date: key,
      totalEvents: dayEvents.length,
      byAction,
      byCategory,
      riskScoreBins: Object.entries(binCounts).map(([bin, count]) => ({ bin, count })),
      domains: Object.entries(domainCounts).map(([domain, count]) => ({ domain, count })),
    });
  }
  return result;
}

export function getGlobalStats(days: number = 7): GlobalStats[] {
  const byDate = new Map<string, EventLog[]>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  for (const e of events) {
    const d = new Date(e.timestamp);
    if (d < cutoff) continue;
    const key = getDateKey(e.timestamp);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  }

  const result: GlobalStats[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const dayEvents = byDate.get(key) ?? [];

    const byAction = { ignored: 0, left: 0, reported: 0 } as Record<string, number>;
    const binCounts: Record<string, number> = {};
    const domains = new Set<string>();

    for (const e of dayEvents) {
      byAction[e.actionTaken] = (byAction[e.actionTaken] ?? 0) + 1;
      binCounts[getScoreBin(e.riskScore)] = (binCounts[getScoreBin(e.riskScore)] ?? 0) + 1;
      domains.add(e.domain);
    }

    result.push({
      date: key,
      totalEvents: dayEvents.length,
      uniqueDomains: domains.size,
      byAction,
      riskScoreBins: Object.entries(binCounts).map(([bin, count]) => ({ bin, count })),
    });
  }
  return result;
}
