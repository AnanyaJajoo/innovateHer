import { NextRequest, NextResponse } from "next/server";

/** Deterministic hash for a date string — stable across requests */
function hashDate(dateKey: string, salt: number = 0): number {
  let h = salt;
  for (let i = 0; i < dateKey.length; i++) h = (h * 31 + dateKey.charCodeAt(i)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Global: 500k–800k per day */
function fakeGlobalTotal(dateKey: string): number {
  return 500_000 + (hashDate(dateKey) % 300_001);
}

/** User: 1–6 per day */
function fakeUserTotal(dateKey: string): number {
  return 1 + (hashDate(dateKey, 7) % 6);
}

function buildSeries(days: number, totalFn: (key: string) => number) {
  const stats = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    stats.push({
      date: key,
      totalEvents: totalFn(key),
      byAction: { ignored: 0, left: 0, reported: 0 },
      riskScoreBins: [],
    });
  }
  return stats;
}

const RISKY_DOMAINS = [
  { domain: "phish-example.com", riskScore: 90 },
  { domain: "fake-shop-xyz.net", riskScore: 85 },
  { domain: "scam-offer.io", riskScore: 80 },
  { domain: "suspicious-deals.com", riskScore: 75 },
  { domain: "clone-site.org", riskScore: 70 },
  { domain: "fraud-store.biz", riskScore: 65 },
  { domain: "notreal-shop.top", riskScore: 60 },
];

const SAFE_DOMAINS = [
  { domain: "amazon.com", riskScore: 0 },
  { domain: "google.com", riskScore: 0 },
  { domain: "github.com", riskScore: 0 },
  { domain: "wikipedia.org", riskScore: 0 },
  { domain: "apple.com", riskScore: 0 },
  { domain: "microsoft.com", riskScore: 0 },
  { domain: "stackoverflow.com", riskScore: 0 },
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "global";
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10) || 7));

  const isUser = scope === "user";
  const stats = buildSeries(days, isUser ? fakeUserTotal : fakeGlobalTotal);

  return NextResponse.json({
    scope,
    days,
    stats,
    riskyDomains: RISKY_DOMAINS,
    safeDomains: SAFE_DOMAINS,
  });
}
