import { isDbReady } from "../db";
import { SiteRiskCache } from "../models/SiteRiskCache";
import { computeRuleRisk } from "./riskRules";
import { checkSafeBrowsing } from "./safeBrowsing";
import { normalizeUrl } from "../utils/normalizeUrl";
import { hashUrl } from "../utils/hash";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type ScoreInput = {
  url: string;
  domain?: string;
  title?: string;
  price?: number;
  sellerText?: string;
  reviewSnippets?: string[];
  checkoutText?: string;
  imageUrls?: string[];
  userId?: string;
  anonId?: string;
  forceRefresh?: boolean;
};

export type ScoreResult = {
  cached: boolean;
  domain: string;
  normalizedUrl: string;
  urlHash: string;
  riskScore: number;
  confidence: number;
  reasons: string[];
  detectionSignals: string[];
};

const clampConfidence = (score: number) =>
  Math.min(0.95, Math.max(0.2, score / 100));

export const scoreUrl = async (input: ScoreInput): Promise<ScoreResult> => {
  const parsed = normalizeUrl(input.url);
  const domain = parsed.domain;
  const normalizedUrl = parsed.normalizedUrl;
  const urlHash = hashUrl(parsed.normalizedUrl);

  if (isDbReady() && !input.forceRefresh) {
    const cached = await SiteRiskCache.findOne({ domain, urlHash })
      .lean()
      .catch(() => null);
    if (cached) {
      const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
      if (ageMs < ONE_DAY_MS) {
        return {
          cached: true,
          domain,
          normalizedUrl: cached.normalizedUrl ?? normalizedUrl,
          urlHash,
          riskScore: cached.riskScore,
          confidence: clampConfidence(cached.riskScore),
          reasons: (cached.reasons ?? []).map((reason) => String(reason)),
          detectionSignals: []
        };
      }
    }
  }

  const ruleResult = computeRuleRisk({
    url: parsed.url,
    rawUrl: input.url,
    domain
  });

  let riskScore = ruleResult.riskScore;
  const reasons = [...ruleResult.reasons];
  const detectionSignals = ["site_risk"];

  const safeBrowsing = await checkSafeBrowsing(input.url);
  if (safeBrowsing.flagged) {
    riskScore = Math.max(riskScore, 90);
    reasons.unshift("Google Safe Browsing flagged this URL");
    detectionSignals.push("safe_browsing");
  }

  return {
    cached: false,
    domain,
    normalizedUrl,
    urlHash,
    riskScore,
    confidence: clampConfidence(riskScore),
    reasons,
    detectionSignals
  };
};
