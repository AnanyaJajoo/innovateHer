// In-memory store for demo; replace with MongoDB + aggregation pipelines later.
// Privacy: we only keep domain + score bins, not full URLs.

import type { EventLog, DailyUserStats, GlobalStats } from "@/types/events";

const FAKE_DOMAINS = [
  "phish-example.com",
  "fake-shop-xyz.net",
  "scam-offer.io",
  "suspicious-deals.com",
  "clone-site.org",
];
const ACTIONS: EventLog["actionTaken"][] = ["ignored", "left", "reported"];
const CATEGORIES = ["phishing", "fake_shop", "clone", "scam"];

function seedFakeEvents(): void {
  const base = new Date();
  // Global-only events (no userId): spread over last 31 days
  for (let i = 0; i < 55; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - Math.floor(Math.random() * 31));
    events.push({
      timestamp: d.toISOString(),
      domain: FAKE_DOMAINS[Math.floor(Math.random() * FAKE_DOMAINS.length)],
      riskScore: 0.3 + Math.random() * 0.6,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      actionTaken: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
    });
  }
  // User "default" events (show in My stats): last 31 days
  for (let i = 0; i < 28; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() - Math.floor(Math.random() * 31));
    events.push({
      timestamp: d.toISOString(),
      domain: FAKE_DOMAINS[Math.floor(Math.random() * FAKE_DOMAINS.length)],
      riskScore: 0.2 + Math.random() * 0.7,
      category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      actionTaken: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
      userId: "default",
    });
  }
}

const events: EventLog[] = [];
seedFakeEvents();

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
    if (e.userId !== userId) continue;
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

/** Fake global daily total in 500k–900k; varies a lot day-to-day but stable per date */
function fakeGlobalTotalForDate(dateKey: string): number {
  let h = 0;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  // Strong mixing so consecutive dates get very different values across 500k–900k
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  const range = 400_001;
  return 500_000 + ((h >>> 0) % range);
}

/** Deterministic "random" 0–1 from date key */
function seedFromDate(dateKey: string, salt: number): number {
  let h = salt;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export function getGlobalStats(days: number = 7): GlobalStats[] {
  const result: GlobalStats[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    const totalEvents = fakeGlobalTotalForDate(key);
    const r1 = seedFromDate(key, 1);
    const r2 = seedFromDate(key, 2);
    const ignored = Math.floor(totalEvents * (0.4 + r1 * 0.2));
    const left = Math.floor(totalEvents * (0.3 + r2 * 0.2));
    const reported = Math.max(0, totalEvents - ignored - left);
    const uniqueDomains = Math.floor(1000 + (totalEvents % 5000));

    result.push({
      date: key,
      totalEvents,
      uniqueDomains,
      byAction: { ignored, left, reported },
      riskScoreBins: [
        { bin: "0-0.2", count: Math.floor(totalEvents * 0.1) },
        { bin: "0.2-0.4", count: Math.floor(totalEvents * 0.2) },
        { bin: "0.4-0.6", count: Math.floor(totalEvents * 0.35) },
        { bin: "0.6-0.8", count: Math.floor(totalEvents * 0.25) },
        { bin: "0.8-1", count: Math.floor(totalEvents * 0.1) },
      ],
    });
  }
  return result;
}
