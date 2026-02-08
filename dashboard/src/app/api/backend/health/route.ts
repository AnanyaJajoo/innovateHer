import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:4000";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { ok: res.ok, status: res.status, ...data },
      { status: res.ok ? 200 : res.status }
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Backend unreachable" },
      { status: 502 }
    );
  }
}
