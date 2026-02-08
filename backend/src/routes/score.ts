import { Router } from "express";
import { isDbReady } from "../db";
import { scoreUrl } from "../services/scoreEngine";
import { ScanEvent } from "../models/ScanEvent";
import { Scan } from "../models/Scan";
import { persistScanResult } from "../services/scanPersistence";
import { upsertScamIntel } from "../services/scamIntel";

export const scoreRouter = Router();

scoreRouter.post("/score", async (req, res) => {
  const {
    url,
    domain,
    title,
    price,
    sellerText,
    reviewSnippets,
    checkoutText,
    imageUrls,
    forceRefresh
  } = req.body ?? {};
  const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
  const anonId = typeof req.body?.anonId === "string" ? req.body.anonId : undefined;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  // We intentionally ignore all third-party console warnings/errors from visited pages.
  // Only explicit scan inputs are used for risk analysis and storage.

  let result;
  try {
    result = await scoreUrl({
      url,
      domain,
      title,
      price,
      sellerText,
      reviewSnippets,
      checkoutText,
      imageUrls,
      userId,
      anonId,
      forceRefresh: forceRefresh === true || forceRefresh === "true"
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid URL";
    return res.status(400).json({ error: message });
  }

  if (isDbReady()) {
    ScanEvent.create({
      userId,
      anonId,
      domain: result.domain,
      urlHash: result.urlHash,
      timestamp: new Date(),
      createdAt: new Date()
    }).catch(console.error);
  }

  if (result.cached) {
    if (isDbReady()) {
      Scan.create({
        userId,
        anonId,
        domain: result.domain,
        urlHash: result.urlHash,
        riskScore: result.riskScore,
        confidence: result.confidence,
        reasons: result.reasons
      }).catch(console.error);
    }

    return res.json({
      riskScore: result.riskScore,
      confidence: result.confidence,
      reasons: result.reasons
    });
  }

  persistScanResult(
    {
      userId,
      anonId,
      domain: result.domain,
      normalizedUrl: result.normalizedUrl,
      urlHash: result.urlHash,
      riskScore: result.riskScore,
      confidence: result.confidence,
      reasons: result.reasons,
      detectionSignals: result.detectionSignals,
      checkedAt: new Date()
    },
    { skipScanEvent: true }
  ).catch(console.error);

  if (isDbReady() && (result.riskScore >= 90 || result.detectionSignals.includes("safe_browsing"))) {
    upsertScamIntel({
      domain: result.domain,
      source: "score",
      evidenceIncrement: 1
    }).catch(console.error);
  }

  return res.json({
    riskScore: result.riskScore,
    confidence: result.confidence,
    reasons: result.reasons
  });
});
