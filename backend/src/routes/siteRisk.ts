import { Router } from "express";
import { SiteRiskCache } from "../models/SiteRiskCache";
import { isDbReady } from "../db";
import { computeRuleRisk } from "../services/riskRules";
import { checkSafeBrowsing } from "../services/safeBrowsing";
import { hashUrl } from "../utils/hash";
import { normalizeUrl } from "../utils/normalizeUrl";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const siteRiskRouter = Router();

siteRiskRouter.post("/site-risk", async (req, res) => {
  const { url, forceRefresh = false } = req.body ?? {};

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  let parsed;
  try {
    parsed = normalizeUrl(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const urlHash = hashUrl(parsed.normalizedUrl);

  if (isDbReady()) {
    const cached = await SiteRiskCache.findOne({
      urlHash,
      domain: parsed.domain
    }).lean();

    if (cached && !forceRefresh) {
      const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
      if (ageMs < ONE_DAY_MS) {
        return res.json({
          domain: cached.domain,
          normalizedUrl: cached.normalizedUrl,
          riskScore: cached.riskScore,
          reasons: cached.reasons,
          cached: true
        });
      }
    }
  }

  const ruleResult = computeRuleRisk({
    url: parsed.url,
    rawUrl: url,
    domain: parsed.domain
  });

  let riskScore = ruleResult.riskScore;
  const reasons = [...ruleResult.reasons];

  const safeBrowsing = await checkSafeBrowsing(url);
  if (safeBrowsing.flagged) {
    riskScore = Math.max(riskScore, 90);
    reasons.unshift("Google Safe Browsing flagged this URL");
  }

  const payload = {
    domain: parsed.domain,
    normalizedUrl: parsed.normalizedUrl,
    urlHash,
    riskScore,
    reasons: reasons.slice(0, 6),
    checkedAt: new Date()
  };

  if (isDbReady()) {
    await SiteRiskCache.findOneAndUpdate(
      { urlHash, domain: parsed.domain },
      payload,
      { upsert: true, new: true }
    );
  }

  return res.json({
    domain: payload.domain,
    normalizedUrl: payload.normalizedUrl,
    riskScore: payload.riskScore,
    reasons: payload.reasons,
    cached: false
  });
});
