"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

type XAxisGranularity = "days" | "months" | "years";

interface DailyStat {
  date: string;
  totalEvents: number;
  uniqueDomains?: number;
  byAction: Record<string, number>;
  riskScoreBins: { bin: string; count: number }[];
  cumulativeEvents?: number;
  cumulativeUniqueDomains?: number;
}

interface StatsResponse {
  scope: string;
  days: number;
  stats: DailyStat[];
  realSeries?: DailyStat[];
  debugSeries?: DailyStat[];
  simulatedUsed?: boolean;
  userId?: string;
  safeDomains?: Array<{ domain: string; riskScore: number }>;
  riskyDomains?: Array<{ domain: string; riskScore: number }>;
}

const LINE_COLOR = "#424874";

function formatDateLabel(dateStr: string, granularity: XAxisGranularity): string {
  const d = dateStr.includes("T") ? new Date(dateStr) : new Date(dateStr + "T12:00:00");
  if (granularity === "days") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  if (granularity === "months") {
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return d.getFullYear().toString();
}

function aggregateByGranularity(
  stats: DailyStat[],
  granularity: XAxisGranularity
): { date: string; display: string; scams: number }[] {
  if (!stats.length) return [];

  const bucket = new Map<string, { date: string; scams: number }>();
  const sorted = [...stats].sort((a, b) => a.date.localeCompare(b.date));
  for (const s of sorted) {
    const d = s.date.includes("T") ? new Date(s.date) : new Date(s.date + "T12:00:00");
    let key: string;
    let bucketDate: string;
    if (granularity === "days") {
      key = s.date;
      bucketDate = s.date;
    } else if (granularity === "months") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      bucketDate = `${key}-01`;
    } else {
      key = String(d.getFullYear());
      bucketDate = `${key}-01-01`;
    }
    const value = s.totalEvents;
    const existing = bucket.get(key);
    if (existing) {
      existing.scams += value;
    } else {
      bucket.set(key, { date: bucketDate, scams: value });
    }
  }

  const entries = Array.from(bucket.entries())
    .map(([key, entry]) => ({
      date: key,
      display: formatDateLabel(entry.date, granularity),
      scams: entry.scams,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return entries;
}

export default function DashboardPage() {
  const [scope, setScope] = useState<"user" | "global">("global");
  const [xAxisGranularity, setXAxisGranularity] = useState<XAxisGranularity>("days");
  const [rangeDays, setRangeDays] = useState(31);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [userScamsTotal, setUserScamsTotal] = useState(0);
  const [userId, setUserId] = useState<string>("Guest");
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [anonId, setAnonId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const paramUserId = params.get("userId");
    const paramDisplayName = params.get("displayName");
    if (paramUserId && paramDisplayName) {
      setUserId(paramUserId);
      setDisplayName(paramDisplayName);
      try {
        sessionStorage.setItem("illume_userId", paramUserId);
        sessionStorage.setItem("illume_displayName", paramDisplayName);
        localStorage.setItem("illume_userId", paramUserId);
        localStorage.setItem("illume_displayName", paramDisplayName);
      } catch {
        // ignore
      }
      return;
    }
    const sessionUserId = sessionStorage.getItem("illume_userId");
    const sessionDisplayName = sessionStorage.getItem("illume_displayName");
    if (sessionUserId) {
      setUserId(sessionUserId);
      if (sessionDisplayName) setDisplayName(sessionDisplayName);
      return;
    }
    const localUserId = localStorage.getItem("illume_userId") ?? localStorage.getItem("userId");
    const localDisplayName = localStorage.getItem("illume_displayName");
    if (localUserId && localUserId.trim()) {
      setUserId(localUserId);
      if (localDisplayName) setDisplayName(localDisplayName);
    }
    const storedAnonId = localStorage.getItem("anonUserId");
    if (storedAnonId) setAnonId(storedAnonId);
  }, []);

  const fetchDays = useMemo(() => {
    if (xAxisGranularity === "years") return 365;
    if (xAxisGranularity === "months") return 365;
    return rangeDays;
  }, [xAxisGranularity, rangeDays]);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        scope,
        days: String(fetchDays),
      });

      if (scope === "user") {
        if (userId && userId !== "Guest") {
          params.set("userId", userId);
        } else if (anonId) {
          params.set("anonId", anonId);
        }
      }

      const res = await fetch(`/api/stats?${params}`);
      const json = (await res.json().catch(() => null)) as StatsResponse | null;
      if (!res.ok) {
        if (res.status === 400 && (json as any)?.error === "missing_user_identifier") {
          let storedAnonId = localStorage.getItem("anonUserId");
          if (!storedAnonId) {
            storedAnonId =
              crypto?.randomUUID?.() ??
              `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            localStorage.setItem("anonUserId", storedAnonId);
          }
          setAnonId(storedAnonId);
          return;
        }
        throw new Error("Failed to fetch");
      }
      if (json) setData(json);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scope, fetchDays, userId, anonId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Always fetch user-scope stats for the "Scams Detected" box
  useEffect(() => {
    async function fetchUserScams() {
      try {
        const params = new URLSearchParams({ scope: "user", days: String(fetchDays) });
        if (userId && userId !== "Guest") params.set("userId", userId);
        else if (anonId) params.set("anonId", anonId);
        const res = await fetch(`/api/stats?${params}`);
        if (!res.ok) return;
        const json = (await res.json()) as StatsResponse;
        const total = (json.stats ?? []).reduce((sum, d) => sum + d.totalEvents, 0);
        setUserScamsTotal(total);
      } catch {
        // keep previous value
      }
    }
    fetchUserScams();
  }, [fetchDays, userId, anonId]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const realSeries = data.realSeries ?? data.stats ?? [];
    const debugSeries = data.debugSeries ?? [];
    const useSimulated = Boolean(data.simulatedUsed) && debugSeries.length > 0;
    const series = useSimulated ? debugSeries : realSeries;
    if (!series.length) return [];

    // For user scope, only show days that have data (dynamic based on sites visited)
    if (data.scope === "user") {
      const aggregated = aggregateByGranularity(series, xAxisGranularity);
      return aggregated.filter((d) => d.scams > 0);
    }

    return aggregateByGranularity(series, xAxisGranularity);
  }, [data, xAxisGranularity]);


  return (
    <div className="min-h-screen text-[#424874] p-6 flex flex-col" style={{ background: "var(--bg)" }}>
      <div className="max-w-5xl mx-auto flex-1 w-full">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-[#424874]" style={{ fontFamily: "Nunito, sans-serif" }}>
            Scams detected
          </h1>
          <p className="text-[#7b7fa3] text-base mt-2">
            Number of scams detected over time
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex rounded-full overflow-hidden border-2 border-[#F3CDEE] p-1 shadow-sm" style={{ boxShadow: "0 4px 16px rgba(243, 205, 238, 0.3)" }}>
            <button
              onClick={() => setScope("global")}
              className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all ${scope === "global" ? "bg-[#424874] text-white shadow-md" : "text-[#424874] hover:bg-[#F3CDEE]/40"}`}
            >
              Global
            </button>
            <button
              onClick={() => setScope("user")}
              className={`px-5 py-2.5 text-sm font-semibold rounded-full transition-all ${scope === "user" ? "bg-[#424874] text-white shadow-md" : "text-[#424874] hover:bg-[#F3CDEE]/40"}`}
            >
              My stats
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#7b7fa3]"></span>
            <select
              value={xAxisGranularity}
              onChange={(e) => setXAxisGranularity(e.target.value as XAxisGranularity)}
              className="bg-white/80 border-2 border-[#F3CDEE] rounded-2xl px-4 py-2.5 text-sm font-medium text-[#424874] focus:outline-none focus:ring-2 focus:ring-[#F3CDEE] focus:ring-offset-2"
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>

          {xAxisGranularity === "days" && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#7b7fa3]">Range:</span>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="bg-white/80 border-2 border-[#F3CDEE] rounded-2xl px-4 py-2.5 text-sm font-medium text-[#424874] focus:outline-none focus:ring-2 focus:ring-[#F3CDEE] focus:ring-offset-2"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={31}>31 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>
          )}
        </div>

        {loading && (
          <div className="text-[#7b7fa3] text-base py-10 font-medium">Loading...</div>
        )}

        {!loading && data && (
          <>
            {/* Chart */}
            <section
              className="rounded-3xl p-8 border-2 border-[#F3CDEE]"
              style={{ background: "var(--surface)", boxShadow: "0 8px 32px rgba(243, 205, 238, 0.25)" }}
            >
              <div className="h-[400px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 8, right: 8, left: 56, bottom: 24 }}
                    >
                      <CartesianGrid strokeDasharray="4 4" stroke="#F3CDEE" vertical={false} />
                      <XAxis
                        dataKey="display"
                        stroke="#7b7fa3"
                        fontSize={13}
                        tickLine={false}
                        axisLine={{ stroke: "#F3CDEE", strokeWidth: 2 }}
                      />
                      <YAxis
                        stroke="#7b7fa3"
                        fontSize={13}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        label={{
                          value: "Scams detected",
                          angle: -90,
                          position: "insideLeft",
                          dx: -24,
                          style: { fill: "#7b7fa3", fontSize: 13, fontFamily: "Nunito, sans-serif" },
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#fff",
                          border: "2px solid #F3CDEE",
                          borderRadius: 16,
                          boxShadow: "0 8px 24px rgba(66, 72, 116, 0.12)",
                          fontFamily: "Nunito, sans-serif",
                        }}
                        labelStyle={{ color: "#424874", fontWeight: 700 }}
                        formatter={(value: number) => [value.toLocaleString(), "Scams detected"]}
                        labelFormatter={(_, payload) => payload[0]?.payload?.display ?? ""}
                      />
                      <Line
                        type="monotone"
                        dataKey="scams"
                        stroke={LINE_COLOR}
                        strokeWidth={2.5}
                        dot={{ fill: LINE_COLOR, r: 4, strokeWidth: 0 }}
                        activeDot={{ fill: LINE_COLOR, r: 6, strokeWidth: 2, stroke: "#fff" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-[#7b7fa3] text-base font-medium border-2 border-dashed border-[#F3CDEE] rounded-2xl bg-white/50">
                    No scam data in this period. Data will appear as the extension detects scams.
                  </div>
                )}
              </div>
            </section>

            {/* Scams detected + Money saved boxes */}
            <div className="grid grid-cols-2 gap-6 mt-6">
              <section
                className="rounded-3xl p-8 border-2 border-[#F3CDEE] text-center"
                style={{ background: "var(--surface)", boxShadow: "0 4px 18px rgba(243, 205, 238, 0.2)" }}
              >
                <p className="text-sm font-bold text-[#7b7fa3] uppercase tracking-wider mb-2">Scams Detected</p>
                <p className="text-5xl font-bold text-[#424874]">{userScamsTotal.toLocaleString()}</p>
              </section>
              <section
                className="rounded-3xl p-8 border-2 border-[#F3CDEE] text-center"
                style={{ background: "var(--surface)", boxShadow: "0 4px 18px rgba(243, 205, 238, 0.2)" }}
              >
                <p className="text-sm font-bold text-[#7b7fa3] uppercase tracking-wider mb-2">Money Saved</p>
                <p className="text-5xl font-bold text-[#7ba892]">$1.4k</p>
              </section>
            </div>

            {/* Risky + Safe domains */}
            <section
              className="rounded-3xl p-6 border-2 border-[#F3CDEE] mt-6"
              style={{ background: "var(--surface)", boxShadow: "0 4px 18px rgba(243, 205, 238, 0.2)" }}
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base font-bold text-[#424874] mb-3">Risky domains</h3>
                  {(data.riskyDomains ?? []).length === 0 ? (
                    <div className="text-sm text-[#7b7fa3] font-medium">No risky domains yet.</div>
                  ) : (
                    <div className="space-y-2 text-sm max-h-[220px] overflow-y-auto pr-1">
                      {(data.riskyDomains ?? []).map((entry) => (
                        <div
                          key={`risky-${entry.domain}`}
                          className="flex items-center justify-between border-b border-[#F3CDEE]/40 pb-2"
                        >
                          <a
                            href={`https://${entry.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#424874] truncate hover:underline hover:text-[#353b62]"
                          >
                            {entry.domain}
                          </a>
                          <div className="text-[#7b7fa3] shrink-0 ml-2">Risk: {entry.riskScore}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#424874] mb-3">Safe domains</h3>
                  {(data.safeDomains ?? []).length === 0 ? (
                    <div className="text-sm text-[#7b7fa3] font-medium">No safe domains yet.</div>
                  ) : (
                    <div className="space-y-2 text-sm max-h-[220px] overflow-y-auto pr-1">
                      {(data.safeDomains ?? []).map((entry) => (
                        <div
                          key={`safe-${entry.domain}`}
                          className="flex items-center justify-between border-b border-[#F3CDEE]/40 pb-2"
                        >
                          <a
                            href={`https://${entry.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[#424874] truncate hover:underline hover:text-[#353b62]"
                          >
                            {entry.domain}
                          </a>
                          <div className="text-[#7b7fa3] shrink-0 ml-2">Risk: {entry.riskScore}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        )}

        {!loading && !data && (
          <div className="text-[#7b7fa3] py-10 font-medium">Could not load stats. Make sure the API is running.</div>
        )}
      </div>

      <footer className="mt-12 pt-8 border-t-2 border-[#F3CDEE]">
        <div className="max-w-5xl mx-auto">
          <section
            className="rounded-3xl p-5 flex items-center gap-4 border-2 border-[#F3CDEE]"
            style={{ background: "var(--surface)", boxShadow: "0 4px 20px rgba(243, 205, 238, 0.2)" }}
          >
            <div className="w-14 h-14 rounded-full bg-[#424874] flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-md">
              {(displayName ?? userId).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#424874] truncate text-lg">
                {displayName ?? (userId !== "Guest" ? userId : "Guest")}
              </p>
              <p className="text-sm text-[#7b7fa3] font-medium">View and manage your detection stats</p>
            </div>
          </section>
        </div>
      </footer>
    </div>
  );
}
