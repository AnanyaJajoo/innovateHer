import { NextRequest, NextResponse } from "next/server";
import { addEvent } from "@/lib/storage";
import type { EventLog } from "@/types/events";

// POST: extension sends event log
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const log: EventLog = {
      timestamp: body.timestamp ?? new Date().toISOString(),
      domain: body.domain ?? "",
      riskScore: typeof body.riskScore === "number" ? body.riskScore : 0,
      category: body.category ?? "unknown",
      actionTaken: ["ignored", "left", "reported"].includes(body.actionTaken)
        ? body.actionTaken
        : "ignored",
    };
    if (body.price != null) log.price = Number(body.price);
    if (body.pathHash) log.pathHash = body.pathHash;

    addEvent(log);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }
}
