import { Router } from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  pollForResult,
  uploadForDetection
} from "../services/realityDefender";
import { SiteRiskCache } from "../models/SiteRiskCache";
import { hashBufferWithSalt } from "../utils/hash";
import { HASH_SALT } from "../config/metrics";
import { persistScanResult } from "../services/scanPersistence";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp"
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES }
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const aiImageDetectRouter = Router();

aiImageDetectRouter.post(
  "/ai-image-detect",
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "image file is required" });
    }

    // We ignore all third-party console warnings/errors from visited pages.
    // Only explicit user-uploaded media is analyzed here.

    if (!ALLOWED_MIME.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Unsupported image type" });
    }

    const userId = typeof req.body?.userId === "string" ? req.body.userId : undefined;
    const anonId = typeof req.body?.anonId === "string" ? req.body.anonId : undefined;
    const domain = typeof req.body?.domain === "string" ? req.body.domain : undefined;
    const forceRefresh = req.body?.forceRefresh === true || req.body?.forceRefresh === "true";

    const imageHash = hashBufferWithSalt(req.file.buffer, HASH_SALT);

    // Cache-first: check if we already analyzed this image
    if (!forceRefresh) {
      const cached = await SiteRiskCache.findOne({
        urlHash: imageHash,
        domain: domain ?? "image"
      })
        .lean()
        .catch((err) => {
          console.error(err);
          return null;
        });

      if (cached) {
        const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
        if (ageMs < ONE_DAY_MS) {
          // Return cached result and update persistence
          persistScanResult({
            userId,
            anonId,
            domain: domain ?? "image",
            urlHash: imageHash,
            riskScore: cached.riskScore,
            confidence: Math.min(0.95, Math.max(0.2, cached.riskScore / 100)),
            reasons: cached.reasons,
            detectionSignals: ["ai_image_detect_cached"],
            checkedAt: new Date()
          }).catch(console.error);

          return res.json({
            status: "COMPLETE",
            finalScore: cached.riskScore,
            reasons: cached.reasons,
            cached: true
          });
        }
      }
    }

    // Cache miss or stale - run detection
    const originalName = req.file.originalname || "upload";
    const safeName = path.basename(originalName);
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rd-"));
    const tmpPath = path.join(tmpDir, safeName);

    await fs.writeFile(tmpPath, req.file.buffer);

    try {
      const { client, requestId } = await uploadForDetection(tmpPath);
      const sdkResult = await pollForResult(client, requestId, {
        pollingInterval: 3000,
        timeoutMs: 30000
      });

      if (!sdkResult) {
        return res.json({ requestId, status: "PENDING" });
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

      // Persist result to all required collections
      if (typeof finalScore === "number") {
        const confidence = Math.min(0.95, Math.max(0.2, finalScore / 100));
        const reasons = payload.reasons ?? [];
        if (payload.error) {
          reasons.push(payload.error);
        }

        persistScanResult({
          userId,
          anonId,
          domain: domain ?? "image",
          urlHash: imageHash,
          riskScore: finalScore,
          confidence,
          reasons: reasons.length ? reasons : ["ai_image_detect"],
          detectionSignals: ["ai_image_detect"],
          checkedAt: new Date()
        }).catch(console.error);
      }

      return res.json(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({
        status: "UNABLE_TO_EVALUATE",
        error: message
      });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
);
