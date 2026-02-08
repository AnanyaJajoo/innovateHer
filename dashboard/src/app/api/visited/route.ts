import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? "";
  const anonId = searchParams.get("anonId") ?? "";
  const limit = searchParams.get("limit") ?? "50";

  try {
    const params = new URLSearchParams({ userId, anonId, limit });
    const res = await fetch(`${BACKEND_URL}/api/visited?${params.toString()}`, {
      cache: "no-store"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`Visited proxy error: backend responded ${res.status}`);
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { error: "Backend unreachable" },
      { status: 502 }
    );
  }
}
