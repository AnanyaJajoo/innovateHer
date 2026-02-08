import { Router } from "express";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fetch } from "undici";
import { extractProductImage } from "../services/productImageExtractor";
import { pollForResult, uploadForDetection } from "../services/realityDefender";
import { persistScanResult } from "../services/scanPersistence";
import { normalizeUrl } from "../utils/normalizeUrl";
import { hashUrl, hashBufferWithSalt } from "../utils/hash";
import { HASH_SALT } from "../config/metrics";
import { SiteRiskCache } from "../models/SiteRiskCache";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export const extractProductImageDetectRouter = Router();

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const AI_IMAGE_CACHE_DOMAIN = "ai-image";

/** In-flight detection by image URL so only one download+detect runs per product image. */
const inFlightByImageUrl = new Map<
  string,
  Promise<{
    imageResult: { imageUrl: string; [k: string]: unknown };
    payload: object;
    riskScore: number;
    reasons: string[];
  }>
>();

/** In-flight detection by image hash so concurrent requests for the same image share one API call. */
const inFlightByImageHash = new Map<
  string,
  Promise<{ payload: object; riskScore: number; reasons: string[] }>
>();

extractProductImageDetectRouter.post(
  "/extract-product-image-detect",
  async (req, res) => {
    const url = req.body?.url;
    if (typeof url !== "string" || !isValidHttpUrl(url)) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const parsed = normalizeUrl(url);
    const urlHash = hashUrl(parsed.normalizedUrl);
    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const anonId = typeof req.body?.anonId === "string" ? req.body.anonId : undefined;

    const imageResult = await extractProductImage(url);
    if (!imageResult.imageUrl) {
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
        reasons: ["image_not_found"],
        detectionSignals: ["image_extraction"],
        checkedAt: new Date()
      }).catch(console.error);

      return res.json({
        image: imageResult,
        detection: null
      });
    }

    const imageUrl = imageResult.imageUrl;
    let runPromise = inFlightByImageUrl.get(imageUrl);
    if (!runPromise) {
      runPromise = (async () => {
        console.log(`[ai-image-detect] extracted image url: ${imageUrl}`);
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rd-"));
        try {
          const { buffer, contentType } = await downloadImage(imageUrl);
          const imageHash = hashBufferWithSalt(buffer, HASH_SALT);

          const cached = await SiteRiskCache.findOne({
            urlHash: imageHash,
            domain: AI_IMAGE_CACHE_DOMAIN
          })
            .lean()
            .catch(() => null);

          if (cached) {
            const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
            if (ageMs < ONE_DAY_MS) {
              return {
                imageResult,
                payload: {
                  status: "COMPLETE",
                  finalScore: cached.riskScore,
                  reasons: cached.reasons,
                  cached: true
                },
                riskScore: cached.riskScore,
                reasons: cached.reasons ?? []
              };
            }
          }

          let detectionPromise = inFlightByImageHash.get(imageHash);
          if (!detectionPromise) {
            detectionPromise = (async () => {
              const ext = extensionFromContentType(contentType);
              const tmpPath = path.join(tmpDir, `product-image.${ext}`);
              await fs.writeFile(tmpPath, buffer);

              console.log("[ai-image-detect] Product image confirmed; making 1 API call per page.");
          const { client, requestId } = await uploadForDetection(tmpPath);
              const sdkResult = await pollForResult(client, requestId, {
                pollingInterval: 3000,
                timeoutMs: 30000
              });

              if (!sdkResult) {
                return {
                  payload: { requestId, status: "PENDING" } as object,
                  riskScore: 0,
                  reasons: [] as string[]
                };
              }

              const status = sdkResult.status ?? "UNABLE_TO_EVALUATE";
              const finalScore =
                typeof sdkResult.score === "number"
                  ? Math.round(sdkResult.score * 100)
                  : null;

              const payload: {
                requestId: string;
                status: string;
                finalScore: number | null;
                reasons?: string[];
                error?: string;
              } = { requestId, status, finalScore };

              if (status === "NOT_APPLICABLE") {
                payload.reasons =
                  sdkResult.metadata?.reasons
                    ?.map((reason) => reason.message)
                    .filter((reason): reason is string => Boolean(reason)) ?? [];
              }

              if (status === "UNABLE_TO_EVALUATE") {
                payload.error =
                  sdkResult.error?.message ??
                  sdkResult.message ??
                  "Unable to evaluate image";
              }

              const riskScore = typeof payload.finalScore === "number" ? payload.finalScore : 0;
              const reasons = payload.reasons ?? [];
              if (payload.error) {
                reasons.push(payload.error);
              }

              SiteRiskCache.findOneAndUpdate(
                { urlHash: imageHash, domain: AI_IMAGE_CACHE_DOMAIN },
                {
                  domain: AI_IMAGE_CACHE_DOMAIN,
                  normalizedUrl: imageUrl ?? "ai-image",
                  urlHash: imageHash,
                  riskScore,
                  reasons,
                  checkedAt: new Date()
                },
                { upsert: true, new: true }
              ).catch(console.error);

              return { payload, riskScore, reasons };
            })().finally(() => {
              inFlightByImageHash.delete(imageHash);
            });
            inFlightByImageHash.set(imageHash, detectionPromise);
          }

          const result = await detectionPromise;
          return {
            imageResult,
            payload: result.payload,
            riskScore: result.riskScore,
            reasons: result.reasons
          };
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true });
        }
      })();
      runPromise.finally(() => inFlightByImageUrl.delete(imageUrl));
      inFlightByImageUrl.set(imageUrl, runPromise);
    }

    let sharedResult: {
      imageResult: { imageUrl: string; [k: string]: unknown };
      payload: object;
      riskScore: number;
      reasons: string[];
    };
    try {
      sharedResult = await runPromise;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: message });
    }

    persistScanResult({
      userId,
      anonId,
      domain: parsed.domain,
      normalizedUrl: parsed.normalizedUrl,
      urlHash,
      riskScore: sharedResult.riskScore,
      confidence:
        typeof (sharedResult.payload as { finalScore?: number }).finalScore === "number"
          ? (sharedResult.payload as { finalScore: number }).finalScore / 100
          : 0.2,
      reasons: sharedResult.reasons.length ? sharedResult.reasons : ["ai_image_detect"],
      detectionSignals: ["image_extraction", "ai_image_detect"],
      checkedAt: new Date()
    }).catch(console.error);

    if (
      sharedResult.riskScore === 0 &&
      (sharedResult.payload as { status?: string }).status === "PENDING"
    ) {
      return res.json({
        image: sharedResult.imageResult,
        detection: sharedResult.payload
      });
    }

    return res.json({
      image: sharedResult.imageResult,
      detection: sharedResult.payload
    });
  }
);
