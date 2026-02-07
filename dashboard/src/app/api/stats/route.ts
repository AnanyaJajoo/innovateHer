import { NextRequest, NextResponse } from "next/server";
import { getDailyUserStats, getGlobalStats } from "@/lib/storage";

// GET: aggregated stats for dashboard
// Query: userId (optional), days (default 7), scope=user|global
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "global";
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10) || 7));
  const userId = searchParams.get("userId") ?? "default";

  try {
    if (scope === "user") {
      const stats = getDailyUserStats(userId, days);
      return NextResponse.json({ scope: "user", userId, days, stats });
    }
    const stats = getGlobalStats(days);
    return NextResponse.json({ scope: "global", days, stats });
  } catch (e) {
    return NextResponse.json({ error: "Failed to aggregate stats" }, { status: 500 });
  }
}
