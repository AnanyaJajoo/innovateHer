import { Router } from "express";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fetch } from "undici";
import { extractProductImage } from "../services/productImageExtractor";
import { pollForResult, uploadForDetection } from "../services/realityDefender";

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

extractProductImageDetectRouter.post(
  "/extract-product-image-detect",
  async (req, res) => {
    const url = req.body?.url;
    if (typeof url !== "string" || !isValidHttpUrl(url)) {
      return res.status(400).json({ error: "Invalid URL" });
    }

    const imageResult = await extractProductImage(url);
    if (!imageResult.imageUrl) {
      return res.json({
        image: imageResult,
        detection: null
      });
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "rd-"));

    try {
      const { buffer, contentType } = await downloadImage(imageResult.imageUrl);
      const ext = extensionFromContentType(contentType);
      const tmpPath = path.join(tmpDir, `product-image.${ext}`);
      await fs.writeFile(tmpPath, buffer);

      const { client, requestId } = await uploadForDetection(tmpPath);
      const sdkResult = await pollForResult(client, requestId, {
        pollingInterval: 3000,
        timeoutMs: 30000
      });

      if (!sdkResult) {
        return res.json({ image: imageResult, detection: { requestId, status: "PENDING" } });
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

      return res.json({
        image: imageResult,
        detection: payload
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return res.status(502).json({ error: message });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }
);
