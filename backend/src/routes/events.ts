import { Router } from "express";
import { Event } from "../models/Event";
import { FlagEvent } from "../models/FlagEvent";
import { isDbReady } from "../db";
import { normalizeUrl } from "../utils/normalizeUrl";
import { hashUrl } from "../utils/hash";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getRiskBucket = (score?: number) => {
  if (typeof score !== "number" || Number.isNaN(score)) return undefined;
  const normalized = score <= 1 ? score * 100 : score;
  const clamped = clamp(normalized, 0, 100);
  if (clamped < 20) return "0-20";
  if (clamped < 40) return "20-40";
  if (clamped < 60) return "40-60";
  if (clamped < 80) return "60-80";
  return "80-100";
};

export const eventsRouter = Router();

eventsRouter.post("/event", async (req, res) => {
  const {
    userId,
    anonId,
    domain,
    url,
    riskScore,
    actionTaken
  } = req.body ?? {};

  const normalizedAction = ["ignored", "left", "reported", "proceeded"].includes(actionTaken)
    ? actionTaken
    : undefined;

  if (isDbReady()) {
    const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS);
    const riskScoreBucket = getRiskBucket(riskScore);
    let normalizedDomain = domain;
    let urlHash: string | undefined;

    if (typeof url === "string") {
      try {
        const parsed = normalizeUrl(url);
        normalizedDomain = parsed.domain;
        urlHash = hashUrl(parsed.normalizedUrl);
      } catch {
        // ignore invalid URL input
      }
    }

    Event.create({
      userId,
      anonId,
      domain: normalizedDomain,
      riskScoreBucket,
      actionTaken: normalizedAction,
      expiresAt
    }).catch(console.error);

    if (normalizedAction === "reported") {
      FlagEvent.create({
        userId,
        anonId,
        domain: normalizedDomain,
        urlHash,
        flagType: "reported"
      }).catch(console.error);
    }
  }

  return res.json({ ok: true });
});
