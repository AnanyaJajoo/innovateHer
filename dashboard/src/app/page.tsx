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

const LINE_COLOR = "#7c3aed";
const AREA_FILL = "rgba(124, 58, 237, 0.08)";

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
    <div className="min-h-screen bg-white text-[#1d1d1f] p-6 flex flex-col">
      <div className="max-w-5xl mx-auto flex-1 w-full">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Scams detected</h1>
          <p className="text-[#6e6e73] text-sm mt-1">
            Number of scams detected over time
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex rounded-lg border border-[#e5e5e7] overflow-hidden">
            <button
              onClick={() => setScope("global")}
              className={`px-4 py-2 text-sm font-medium ${scope === "global" ? "bg-accent text-white" : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5e7]"}`}
            >
              Global
            </button>
            <button
              onClick={() => setScope("user")}
              className={`px-4 py-2 text-sm font-medium ${scope === "user" ? "bg-accent text-white" : "bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5e7]"}`}
            >
              My stats
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6e6e73]">X-axis:</span>
            <select
              value={xAxisGranularity}
              onChange={(e) => setXAxisGranularity(e.target.value as XAxisGranularity)}
              className="bg-white border border-[#e5e5e7] rounded-lg px-3 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="days">Days</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>

          {xAxisGranularity === "days" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#6e6e73]">Range:</span>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="bg-white border border-[#e5e5e7] rounded-lg px-3 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-accent"
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
          <div className="text-[#6e6e73] text-sm py-8">Loading…</div>
        )}

        {!loading && data && (
          <section className="bg-white border border-[#e5e5e7] rounded-xl p-6 shadow-sm">
            <div className="h-[400px] w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 0, bottom: 24 }}
                  >
                    <defs>
                      <linearGradient id="scamsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e5e5e7"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="display"
                      stroke="#6e6e73"
                      fontSize={12}
                      tickLine={false}
                      axisLine={{ stroke: "#e5e5e7" }}
                    />
                    <YAxis
                      dataKey="scams"
                      stroke="#6e6e73"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: "Scams detected",
                        angle: -90,
                        position: "insideLeft",
                        style: { fill: "#6e6e73", fontSize: 12 },
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#fff",
                        border: "1px solid #e5e5e7",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      labelStyle={{ color: "#1d1d1f" }}
                      formatter={(value: number) => [value, "Scams detected"]}
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
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: LINE_COLOR, stroke: "#fff", strokeWidth: 2 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[#6e6e73] text-sm border border-dashed border-[#e5e5e7] rounded-lg">
                  No scam data in this period. Data will appear as the extension detects scams.
                </div>
              )}
            </div>
          </section>
        )}

        {!loading && !data && (
          <div className="text-[#6e6e73] py-8">Could not load stats. Make sure the API is running.</div>
        )}
      </div>

      <footer className="mt-12 pt-6 border-t border-[#e5e5e7]">
        <div className="max-w-5xl mx-auto">
          <section className="bg-[#f5f5f7] border border-[#e5e5e7] rounded-xl p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-lg shrink-0">
              {userId.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[#1d1d1f] truncate">{userId}</p>
              <p className="text-sm text-[#6e6e73]">View and manage your detection stats</p>
            </div>
          </section>
        </div>
      </footer>
    </div>
  );
}
