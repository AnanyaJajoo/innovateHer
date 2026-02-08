import { Router } from "express";
import { SiteRiskCache } from "../models/SiteRiskCache";
import { Scan } from "../models/Scan";
import { ScanEvent } from "../models/ScanEvent";
import { RiskAssessment } from "../models/RiskAssessment";
import { isDbReady } from "../db";
import { computeRuleRisk } from "../services/riskRules";
import { checkSafeBrowsing } from "../services/safeBrowsing";
import { hashUrl } from "../utils/hash";
import { normalizeUrl } from "../utils/normalizeUrl";
import { RISK_HIGH_THRESHOLD } from "../config/metrics";
import { upsertScamIntel } from "../services/scamIntel";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const siteRiskRouter = Router();

siteRiskRouter.post("/site-risk", async (req, res) => {
  const {
    url,
    forceRefresh = false,
    userId,
    anonId
  } = req.body ?? {};

  // We intentionally ignore all third-party console warnings/errors from visited pages.
  // Only explicit scan inputs are used for risk analysis and storage.

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
  // We only store hashed URLs (no raw paths or page content).

  if (isDbReady()) {
    const cached = await SiteRiskCache.findOne({
      urlHash,
      domain: parsed.domain
    })
      .lean()
      .catch((err) => {
        console.error(err);
        return null;
      });

    if (cached && !forceRefresh) {
      const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
      if (ageMs < ONE_DAY_MS) {
        const confidence = Math.min(0.95, Math.max(0.2, cached.riskScore / 100));
        Scan.findOneAndUpdate(
          { urlHash, domain: cached.domain, userId, anonId },
          {
            userId,
            anonId,
            domain: cached.domain,
            urlHash,
            riskScore: cached.riskScore,
            confidence,
            reasons: cached.reasons
          },
          { upsert: true, new: true }
        ).catch(console.error);

        ScanEvent.create({
          userId,
          anonId,
          domain: cached.domain,
          urlHash,
          timestamp: new Date()
        }).catch(console.error);

        // Cached result did not run fresh analysis; do not create a new risk assessment here.

        SiteRiskCache.updateOne(
          { urlHash, domain: cached.domain },
          { $set: { checkedAt: new Date() } }
        ).catch(console.error);

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
    ).catch(console.error);
  }

  if (isDbReady()) {
    const confidence = Math.min(0.95, Math.max(0.2, riskScore / 100));
    Scan.findOneAndUpdate(
      { urlHash, domain: payload.domain, userId, anonId },
      {
        userId,
        anonId,
        domain: payload.domain,
        urlHash,
        riskScore: payload.riskScore,
        confidence,
        reasons: payload.reasons
      },
      { upsert: true, new: true }
    ).catch(console.error);

    ScanEvent.create({
      userId,
      anonId,
      domain: payload.domain,
      urlHash,
      timestamp: new Date()
    }).catch(console.error);

    RiskAssessment.create({
      userId,
      anonId,
      domain: payload.domain,
      urlHash,
      riskScore: payload.riskScore,
      confidence,
      detectionSignals: [
        "site_risk",
        ...(safeBrowsing.flagged ? ["safe_browsing"] : [])
      ]
    }).catch(console.error);

    if (safeBrowsing.flagged || riskScore >= 90) {
      upsertScamIntel({
        domain: payload.domain,
        source: "site_risk",
        evidenceIncrement: 1
      }).catch(console.error);
    }
  }

  return res.json({
    domain: payload.domain,
    normalizedUrl: payload.normalizedUrl,
    riskScore: payload.riskScore,
    reasons: payload.reasons,
    cached: false
  });
});
