"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  ComposedChart,
} from "recharts";

type XAxisGranularity = "days" | "months" | "years";

interface DailyStat {
  date: string;
  totalEvents: number;
  uniqueDomains?: number;
  byAction: Record<string, number>;
  riskScoreBins: { bin: string; count: number }[];
}

interface StatsResponse {
  scope: string;
  days: number;
  stats: DailyStat[];
  userId?: string;
}

const LINE_COLOR = "#424874";
const AREA_FILL = "rgba(243, 205, 238, 0.4)";

function formatDateLabel(dateStr: string, granularity: XAxisGranularity): string {
  const d = new Date(dateStr + "T12:00:00");
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

  const bucket = new Map<string, number>();
  for (const s of stats) {
    const d = new Date(s.date + "T12:00:00");
    let key: string;
    if (granularity === "days") {
      key = s.date;
    } else if (granularity === "months") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } else {
      key = String(d.getFullYear());
    }
    bucket.set(key, (bucket.get(key) ?? 0) + s.totalEvents);
  }

  const entries = Array.from(bucket.entries())
    .map(([date, scams]) => ({
      date,
      display: formatDateLabel(
        granularity === "days" ? date : date + (granularity === "months" ? "-01" : "-01-01"),
        granularity
      ),
      scams,
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
  const [userId, setUserId] = useState<string>("Guest");

  useEffect(() => {
    setUserId(localStorage.getItem("userId") ?? "Guest");
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
        userId: userId === "Guest" ? "default" : userId,
      });
      const res = await fetch(`/api/stats?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: StatsResponse = await res.json();
      setData(json);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [scope, fetchDays, userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const chartData = useMemo(() => {
    if (!data?.stats?.length) return [];
    return aggregateByGranularity(data.stats, xAxisGranularity);
  }, [data?.stats, xAxisGranularity]);

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
          <div className="text-[#7b7fa3] text-base py-10 font-medium">Loading…</div>
        )}

        {!loading && data && (
          <section
            className="rounded-3xl p-8 border-2 border-[#F3CDEE]"
            style={{ background: "var(--surface)", boxShadow: "0 8px 32px rgba(243, 205, 238, 0.25)" }}
          >
            <div className="h-[400px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 56, bottom: 24 }}
                  >
                    <defs>
                      <linearGradient id="scamsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F3CDEE" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#F3CDEE" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#F3CDEE"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="display"
                      stroke="#7b7fa3"
                      fontSize={13}
                      tickLine={false}
                      axisLine={{ stroke: "#F3CDEE", strokeWidth: 2 }}
                    />
                    <YAxis
                      dataKey="scams"
                      stroke="#7b7fa3"
                      fontSize={13}
                      tickLine={false}
                      axisLine={false}
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
                      labelFormatter={(_, payload) =>
                        payload[0]?.payload?.display ?? ""
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="scams"
                      fill="url(#scamsGradient)"
                      stroke="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="scams"
                      stroke={LINE_COLOR}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 6, fill: "#424874", stroke: "#F3CDEE", strokeWidth: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#7b7fa3] text-base font-medium border-2 border-dashed border-[#F3CDEE] rounded-2xl bg-white/50">
                  No scam data in this period. Data will appear as the extension detects scams.
                </div>
              )}
            </div>
          </section>
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
              {userId.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[#424874] truncate text-lg">{userId}</p>
              <p className="text-sm text-[#7b7fa3] font-medium">View and manage your detection stats</p>
            </div>
          </section>
        </div>
      </footer>
    </div>
  );
}
