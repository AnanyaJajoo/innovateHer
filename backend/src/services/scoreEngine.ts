import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fetch } from "undici";
import { isDbReady } from "../db";
import { SiteRiskCache } from "../models/SiteRiskCache";
import { computeRuleRisk } from "./riskRules";
import { checkSafeBrowsing } from "./safeBrowsing";
import { extractProductImage } from "./productImageExtractor";
import { pollForResult, uploadForDetection } from "./realityDefender";
import { normalizeUrl } from "../utils/normalizeUrl";
import { hashUrl } from "../utils/hash";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

const downloadImage = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      throw new Error("URL does not appear to be an image");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error("Image exceeds size limit");
    }

    return { buffer, contentType };
  } finally {
    clearTimeout(timeout);
  }
};

const extensionFromContentType = (contentType: string) => {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "img";
};

const detectImageScore = async (imageUrl: string) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rd-"));
  try {
    const { buffer, contentType } = await downloadImage(imageUrl);
    const ext = extensionFromContentType(contentType);
    const tmpPath = path.join(tmpDir, `product-image.${ext}`);
    await fs.writeFile(tmpPath, buffer);

    const { client, requestId } = await uploadForDetection(tmpPath);
    const sdkResult = await pollForResult(client, requestId, {
      pollingInterval: 3000,
      timeoutMs: 30000
    });

    if (!sdkResult) {
      return { score: null, reasons: ["ai_image_pending"] };
    }

    const status = sdkResult.status ?? "UNABLE_TO_EVALUATE";
    const finalScore =
      typeof sdkResult.score === "number"
        ? Math.round(sdkResult.score * 100)
        : null;

    const reasons: string[] = [];
    if (status === "NOT_APPLICABLE") {
      reasons.push(
        ...(sdkResult.metadata?.reasons
          ?.map((reason) => reason.message)
          .filter((reason): reason is string => Boolean(reason)) ?? [])
      );
    }

    if (status === "UNABLE_TO_EVALUATE") {
      const msg =
        sdkResult.error?.message ??
        sdkResult.message ??
        "Unable to evaluate image";
      reasons.push(msg);
    }

    return { score: finalScore, reasons };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
};

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

  const candidateImages: string[] = [];
  if (Array.isArray(input.imageUrls)) {
    candidateImages.push(
      ...input.imageUrls.filter((value) => typeof value === "string")
    );
  }

  if (!candidateImages.length) {
    const imageResult = await extractProductImage(input.url);
    if (imageResult.imageUrl) {
      candidateImages.push(imageResult.imageUrl);
      detectionSignals.push("image_extraction");
    }
  }

  if (candidateImages.length) {
    try {
      const detection = await detectImageScore(candidateImages[0]);
      if (typeof detection.score === "number") {
        riskScore = Math.max(riskScore, detection.score);
        detectionSignals.push("ai_image_detect");
        if (detection.reasons.length) {
          reasons.push(...detection.reasons);
        }
      }
    } catch {
      // Ignore detection errors to avoid blocking scoring.
    }
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
