import { isDbReady } from "../db";
import { ScanEvent } from "../models/ScanEvent";
import { Scan } from "../models/Scan";
import { RiskAssessment } from "../models/RiskAssessment";
import { SiteRiskCache } from "../models/SiteRiskCache";

export type ScanResult = {
  userId?: string;
  anonId?: string;
  domain: string;
  normalizedUrl?: string;
  urlHash: string;
  riskScore: number;
  confidence?: number;
  reasons: Array<{ code: string; meta?: any } | string>;
  detectionSignals?: string[];
  checkedAt?: Date;
};

export const persistScanResult = async (
  input: ScanResult,
  options?: { skipScanEvent?: boolean }
) => {
  if (!isDbReady()) return;

  const timestamp = input.checkedAt ?? new Date();
  const confidence =
    typeof input.confidence === "number"
      ? input.confidence
      : Math.min(0.95, Math.max(0.2, input.riskScore / 100));

  if (!options?.skipScanEvent) {
    ScanEvent.create({
      userId: input.userId,
      anonId: input.anonId,
      domain: input.domain,
      urlHash: input.urlHash,
      timestamp,
      createdAt: timestamp
    }).catch(console.error);
  }

  Scan.create({
    userId: input.userId,
    anonId: input.anonId,
    domain: input.domain,
    urlHash: input.urlHash,
    riskScore: input.riskScore,
    confidence,
    reasons: input.reasons
  }).catch(console.error);

  RiskAssessment.create({
    userId: input.userId,
    anonId: input.anonId,
    domain: input.domain,
    urlHash: input.urlHash,
    riskScore: input.riskScore,
    confidence,
    detectionSignals: input.detectionSignals ?? []
  }).catch(console.error);

  SiteRiskCache.findOneAndUpdate(
    { urlHash: input.urlHash, domain: input.domain },
    {
      domain: input.domain,
      normalizedUrl: input.normalizedUrl,
      urlHash: input.urlHash,
      riskScore: input.riskScore,
      reasons: input.reasons,
      checkedAt: timestamp
    },
    { upsert: true, new: true }
  ).catch(console.error);
};
