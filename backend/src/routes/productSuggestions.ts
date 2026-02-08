import { Router } from "express";
import { extractProductName } from "../services/productNameExtractor";
import { getSuggestedProducts } from "../services/geminiSuggestions";

export const productSuggestionsRouter = Router();

const isValidHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isSupportedDomain = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes("amazon.") || host.includes("temu.");
  } catch {
    return false;
  }
};

productSuggestionsRouter.post("/product-suggestions", async (req, res) => {
  const { url, productName: providedName } = req.body ?? {};

  // Only process Amazon and Temu URLs
  if (typeof url === "string" && !isSupportedDomain(url)) {
    return res.status(400).json({
      error: "Product suggestions are only supported for Amazon and Temu.",
    });
  }

  let productName: string | null = null;

  if (typeof providedName === "string" && providedName.trim().length > 0) {
    productName = providedName.trim();
  } else if (typeof url === "string" && isValidHttpUrl(url)) {
    const extraction = await extractProductName(url);
    productName = extraction.productName;
  }

  console.log(`[InnovateHer] Product detected: "${productName}"`);

  const genericNames = ["temu", "amazon", "amazon.com", "temu.com", "home", "shop", "store"];
  if (!productName || genericNames.includes(productName.toLowerCase())) {
    return res.status(400).json({
      error: "Could not identify a product on this page.",
    });
  }

  try {
    const result = await getSuggestedProducts(productName);

    if (result.error) {
      return res.status(502).json({
        productName,
        suggestions: result.suggestions,
        error: result.error,
      });
    }

    return res.json({
      productName,
      suggestions: result.suggestions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
});
