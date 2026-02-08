import { Router } from "express";
import { extractProductImage } from "../services/productImageExtractor";
import { persistScanResult } from "../services/scanPersistence";
import { normalizeUrl } from "../utils/normalizeUrl";
import { hashUrl } from "../utils/hash";

export const extractProductImageRouter = Router();

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

extractProductImageRouter.post("/extract-product-image", async (req, res) => {
  const url = req.body?.url;
  if (typeof url !== "string" || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const parsed = normalizeUrl(url);
    const urlHash = hashUrl(parsed.normalizedUrl);
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const anonId = typeof req.body?.anonId === "string" ? req.body.anonId : undefined;

    const result = await extractProductImage(url);

    // We intentionally ignore all third-party console warnings/errors from visited pages.
    // Only explicit scan inputs are stored.
    persistScanResult({
      userId,
      anonId,
      domain: parsed.domain,
      normalizedUrl: parsed.normalizedUrl,
      urlHash,
      riskScore: 0,
      confidence: 0.2,
      reasons: ["image_extraction"],
      detectionSignals: ["image_extraction"],
      checkedAt: new Date()
    }).catch(console.error);

    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
});
