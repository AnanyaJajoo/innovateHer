import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

// GET: aggregated stats for dashboard
// Query: userId (optional), days (default 7), scope=user|global
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") ?? "global";
  const days = Math.min(365, Math.max(1, parseInt(searchParams.get("days") ?? "7", 10) || 7));
  const userId = searchParams.get("userId") ?? "default";
  const debugSeed = searchParams.get("debugSeed");

  try {
    const params = new URLSearchParams({ scope, days: String(days), userId });
    if (debugSeed) params.set("debugSeed", debugSeed);
    const res = await fetch(`${BACKEND_URL}/api/stats?${params.toString()}`, {
      cache: "no-store"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(
        `Stats proxy error: backend responded ${res.status} for scope=${scope} days=${days}`
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error(
      `Stats proxy error: backend unreachable at ${BACKEND_URL} (${e instanceof Error ? e.message : "unknown error"})`
    );
    return NextResponse.json(
      { error: "Backend unreachable", backendUrl: BACKEND_URL },
      { status: 502 }
    );
  }
}
