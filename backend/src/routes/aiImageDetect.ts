import { Router } from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  pollForResult,
  uploadForDetection
} from "../services/realityDefender";

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

export const aiImageDetectRouter = Router();

aiImageDetectRouter.post(
  "/ai-image-detect",
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "image file is required" });
    }

    if (!ALLOWED_MIME.includes(req.file.mimetype)) {
      return res.status(400).json({ error: "Unsupported image type" });
    }

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
