"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

type ActionTaken = "ignored" | "left" | "reported";

interface DailyStat {
  date: string;
  totalEvents: number;
  uniqueDomains?: number;
  byAction: Record<ActionTaken, number>;
  riskScoreBins: { bin: string; count: number }[];
}

interface StatsResponse {
  scope: string;
  days: number;
  stats: DailyStat[];
  userId?: string;
}

const ACTION_COLORS: Record<ActionTaken, string> = {
  ignored: "#8c8c96",
  left: "#00c2a8",
  reported: "#e85d5d",
};

const BIN_ORDER = ["0-0.2", "0.2-0.4", "0.4-0.6", "0.6-0.8", "0.8-1"];
const BIN_COLORS = ["#00c2a8", "#5fd4b8", "#f0c674", "#e89d5d", "#e85d5d"];

type TimePeriod = "days" | "months" | "years";

export default function DashboardPage() {
  const [scope, setScope] = useState<"user" | "global">("global");
  const [days, setDays] = useState(7);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("days");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        scope,
        days: String(days),
        userId: typeof window !== "undefined" ? localStorage.getItem("userId") ?? "default" : "default",
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
  }, [scope, days]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const chartData = data?.stats?.map((d) => ({
    date: d.date.slice(5),
    events: d.totalEvents,
    ignored: d.byAction?.ignored ?? 0,
    left: d.byAction?.left ?? 0,
    reported: d.byAction?.reported ?? 0,
  })) ?? [];

  // Aggregate data for scam detection graph based on time period
  const getScamChartData = () => {
    if (!data?.stats) return [];

    const aggregated = new Map<string, { count: number; sortKey: string }>();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    data.stats.forEach((stat) => {
      const date = new Date(stat.date);
      let key: string;
      let sortKey: string;
      let displayKey: string;

      if (timePeriod === "days") {
        key = stat.date; // YYYY-MM-DD
        sortKey = key;
        displayKey = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
      } else if (timePeriod === "months") {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        sortKey = key;
        displayKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      } else {
        key = String(date.getFullYear());
        sortKey = key;
        displayKey = key;
      }

      const existing = aggregated.get(key);
      if (existing) {
        existing.count += stat.totalEvents;
      } else {
        aggregated.set(key, { count: stat.totalEvents, sortKey });
      }
    });

    return Array.from(aggregated.entries())
      .map(([dateKey, { count, sortKey }]) => {
        const date = new Date(dateKey + (timePeriod === "days" ? "" : timePeriod === "months" ? "-01" : "-01-01"));
        let displayKey: string;
        
        if (timePeriod === "days") {
          displayKey = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
        } else if (timePeriod === "months") {
          displayKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        } else {
          displayKey = dateKey;
        }
        
        return {
          date: displayKey,
          dateKey: sortKey, // Keep original for sorting
          scams: count,
        };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  };

  const scamChartData = getScamChartData();

  const lastStat = data?.stats?.[data.stats.length - 1];
  const riskBins = lastStat?.riskScoreBins ?? [];
  const sortedBins = [...riskBins].sort(
    (a, b) => BIN_ORDER.indexOf(a.bin) - BIN_ORDER.indexOf(b.bin)
  );
  const actionPieData = lastStat
    ? (["ignored", "left", "reported"] as const)
        .filter((a) => (lastStat.byAction[a] ?? 0) > 0)
        .map((key) => ({ name: key, value: lastStat.byAction[key], color: ACTION_COLORS[key] }))
    : [];

  return (
    <div className="min-h-screen bg-bg text-[#e8e8ec] p-6">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-[#FFFFFF] text-sm mt-1">Metrics and anonymized stats from extension events</p>
        </header>

        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex rounded-lg border border-[#2a2a30] overflow-hidden">
            <button
              onClick={() => setScope("global")}
              className={`px-4 py-2 text-sm font-medium ${scope === "global" ? "bg-accent text-[#0f0f12]" : "bg-surface text-[#8c8c96] hover:bg-[#2a2a30]"}`}
            >
              Global
            </button>
            <button
              onClick={() => setScope("user")}
              className={`px-4 py-2 text-sm font-medium ${scope === "user" ? "bg-accent text-[#0f0f12]" : "bg-surface text-[#8c8c96] hover:bg-[#2a2a30]"}`}
            >
              My stats
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="days" className="text-sm text-[#8c8c96]">Days</label>
            <select
              id="days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="bg-surface border border-[#2a2a30] rounded-lg px-3 py-2 text-sm text-[#e8e8ec] focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={7}>7</option>
              <option value={14}>14</option>
              <option value={31}>31</option>
            </select>
          </div>
        </div>

        {loading && (
          <div className="text-[#8c8c96] text-sm py-8">Loading stats…</div>
        )}

        {!loading && data && (
          <div className="space-y-8">
            <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-gray-900">
                  Scams Detected Over Time
                </h2>
                <div className="flex items-center gap-2">
                  <label htmlFor="timePeriod" className="text-sm text-gray-600">Time Period:</label>
                  <select
                    id="timePeriod"
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value as TimePeriod)}
                    className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>
              <div className="h-80">
                {scamChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scamChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6b7280" 
                        fontSize={12}
                        tick={{ fill: "#6b7280" }}
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={12}
                        label={{ value: "Number of Scams", angle: -90, position: "insideLeft", style: { textAnchor: "middle", fill: "#6b7280" } }}
                        tick={{ fill: "#6b7280" }}
                      />
                      <Tooltip
                        contentStyle={{ 
                          background: "#ffffff", 
                          border: "1px solid #e5e7eb", 
                          borderRadius: 8,
                          color: "#111827"
                        }}
                        labelStyle={{ color: "#111827", fontWeight: 600 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="scams" 
                        stroke="#22c55e" 
                        strokeWidth={2}
                        dot={{ fill: "#22c55e", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                    No scam data available
                  </div>
                )}
              </div>
            </section>

            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="bg-surface border border-[#2a2a30] rounded-xl p-6">
                <h2 className="text-sm font-medium uppercase tracking-wider text-[#8c8c96] mb-4">
                  Actions (last day)
                </h2>
                <div className="h-48 flex items-center justify-center">
                  {actionPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={actionPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={72}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {actionPieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "#18181c", border: "1px solid #2a2a30", borderRadius: 8 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <span className="text-[#8c8c96] text-sm">No data for last day</span>
                  )}
                </div>
              </section>

              <section className="bg-surface border border-[#2a2a30] rounded-xl p-6">
                <h2 className="text-sm font-medium uppercase tracking-wider text-[#8c8c96] mb-4">
                  Risk score bins (last day)
                </h2>
                <div className="h-48">
                  {sortedBins.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sortedBins}
                        layout="vertical"
                        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                      >
                        <XAxis type="number" stroke="#8c8c96" fontSize={12} />
                        <YAxis type="category" dataKey="bin" stroke="#8c8c96" fontSize={12} width={48} />
                        <Tooltip
                          contentStyle={{ background: "#18181c", border: "1px solid #2a2a30", borderRadius: 8 }}
                        />
                        <Bar dataKey="count" fill="#00c2a8" radius={[0, 4, 4, 0]} name="Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#8c8c96] text-sm">
                      No data for last day
                    </div>
                  )}
                </div>
              </section>
            </div>

            {scope === "global" && data.stats.length > 0 && (
              <section className="bg-surface border border-[#2a2a30] rounded-xl p-6">
                <h2 className="text-sm font-medium uppercase tracking-wider text-[#8c8c96] mb-2">
                  Global summary
                </h2>
                <p className="text-sm text-[#8c8c96]">
                  Total events in period:{" "}
                  <span className="text-[#e8e8ec] font-medium">
                    {data.stats.reduce((s, d) => s + d.totalEvents, 0)}
                  </span>
                  {" · "}
                  Unique domains (last day):{" "}
                  <span className="text-[#e8e8ec] font-medium">
                    {(data.stats[data.stats.length - 1] as { uniqueDomains?: number })?.uniqueDomains ?? "—"}
                  </span>
                </p>
              </section>
            )}
          </div>
        )}

        {!loading && !data && (
          <div className="text-[#8c8c96] py-8">Could not load stats. Make sure the API is running.</div>
        )}
      </div>
    </div>
  );
}
