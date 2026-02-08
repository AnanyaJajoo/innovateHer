import { Router } from "express";
import { extractProductImage } from "../services/productImageExtractor";

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
    const result = await extractProductImage(url);
    return res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
});
