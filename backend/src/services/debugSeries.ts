export interface DebugSeriesPoint {
  date: string;
  totalEvents: number;
  uniqueDomains: number;
  byAction: Record<string, number>;
  riskScoreBins: { bin: string; count: number }[];
  cumulativeEvents?: number;
  cumulativeUniqueDomains?: number;
}

const mulberry32 = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const hashSeed = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

export const buildDebugSeries = (input: {
  days?: number;
  points?: number;
  seed?: string;
}): DebugSeriesPoint[] => {
  const days = input.days ?? 31;
  const points = Math.max(2000, input.points ?? 2000);
  const seedValue = hashSeed(input.seed ?? "dev-seed");
  const rand = mulberry32(seedValue);

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  start.setUTCHours(0, 0, 0, 0);

  const series: DebugSeriesPoint[] = [];
  for (let i = 0; i < points; i += 1) {
    const t = i / points;
    const dayOffset = Math.floor(t * days);
    const hour = Math.floor(rand() * 24);
    const minute = Math.floor(rand() * 60);
    const pointDate = new Date(start);
    pointDate.setUTCDate(start.getUTCDate() + dayOffset);
    pointDate.setUTCHours(hour, minute, 0, 0);

    const cycle = Math.sin((dayOffset / days) * Math.PI * 2);
    const spike = rand() > 0.97 ? rand() * 8 : 0;
    const base = 2 + cycle * 3 + rand() * 2 + spike;
    const totalEvents = Math.max(0, Math.round(base));
    const uniqueDomains = Math.max(1, Math.round(totalEvents * (0.6 + rand() * 0.4)));

    const reported = Math.round(totalEvents * (0.25 + rand() * 0.25));
    const left = Math.round(totalEvents * (0.2 + rand() * 0.25));
    const proceeded = Math.max(0, Math.round(totalEvents * 0.1));
    const ignored = Math.max(0, totalEvents - reported - left - proceeded);

    const riskScoreBins = [
      { bin: "0-20", count: Math.max(0, Math.round(totalEvents * 0.1)) },
      { bin: "20-40", count: Math.max(0, Math.round(totalEvents * 0.15)) },
      { bin: "40-60", count: Math.max(0, Math.round(totalEvents * 0.2)) },
      { bin: "60-80", count: Math.max(0, Math.round(totalEvents * 0.25)) },
      { bin: "80-100", count: Math.max(0, Math.round(totalEvents * 0.3)) }
    ];

    series.push({
      date: pointDate.toISOString(),
      totalEvents,
      uniqueDomains,
      byAction: { ignored, left, reported, proceeded },
      riskScoreBins
    });
  }

  const sorted = series.sort((a, b) => a.date.localeCompare(b.date));
  let cumulativeEvents = 0;
  let cumulativeUnique = 0;
  for (const entry of sorted) {
    cumulativeEvents += entry.totalEvents;
    cumulativeUnique += entry.uniqueDomains;
    entry.cumulativeEvents = cumulativeEvents;
    entry.cumulativeUniqueDomains = cumulativeUnique;
  }

  return sorted;
};
