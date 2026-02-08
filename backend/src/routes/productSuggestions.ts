import { Router } from "express";
import { extractProductName } from "../services/productNameExtractor";
import { getSuggestedProducts } from "../services/geminiSuggestions";
import { isDbReady } from "../db";
import { ProductSuggestionCache } from "../models/ProductSuggestionCache";
import { hashUrl, hashWithSalt } from "../utils/hash";
import { normalizeUrl } from "../utils/normalizeUrl";

export const productSuggestionsRouter = Router();

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PRODUCT_SUGGESTIONS_SALT = "product-suggestions";

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
    return host.includes("amazon.") || host.includes("temu.") || host.includes("walmart.");
  } catch {
    return false;
  }
};

const getSearchProvider = (url: string | undefined) => {
  if (!url) {
    return "amazon";
  }
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("walmart.")) {
      return "walmart";
    }
  } catch {
    return "amazon";
  }
  return "amazon";
};

productSuggestionsRouter.post("/product-suggestions", async (req, res) => {
  const { url, productName: providedName } = req.body ?? {};

  // Only process Amazon, Temu, and Walmart URLs
  if (typeof url === "string" && !isSupportedDomain(url)) {
    return res.status(400).json({
      error: "Product suggestions are only supported for Amazon, Temu, and Walmart.",
    });
  }

  let productName: string | null = null;
  let cacheKey: string | null = null;

  if (typeof providedName === "string" && providedName.trim().length > 0) {
    productName = providedName.trim();
    cacheKey = hashWithSalt(productName.toLowerCase(), PRODUCT_SUGGESTIONS_SALT);
  } else if (typeof url === "string" && isValidHttpUrl(url)) {
    const normalizedUrl = normalizeUrl(url).normalizedUrl;
    cacheKey = hashUrl(normalizedUrl);
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

  const searchProvider = getSearchProvider(url);
  if (cacheKey && isDbReady()) {
    const cached = await ProductSuggestionCache.findOne({
      cacheKey,
      searchProvider
    })
      .lean()
      .catch(() => null);
    if (cached) {
      const ageMs = Date.now() - new Date(cached.checkedAt).getTime();
      if (ageMs < ONE_DAY_MS) {
        return res.json({
          productName: cached.productName,
          suggestions: cached.suggestions
        });
      }
    }
  }

  try {
    const result = await getSuggestedProducts(productName, {
      searchProvider
    });

    if (result.error) {
      return res.status(502).json({
        productName,
        suggestions: result.suggestions,
        error: result.error,
      });
    }

    if (cacheKey && isDbReady()) {
      ProductSuggestionCache.findOneAndUpdate(
        { cacheKey, searchProvider },
        {
          cacheKey,
          searchProvider,
          productName,
          suggestions: result.suggestions,
          checkedAt: new Date()
        },
        { upsert: true, new: true }
      ).catch(console.error);
    }

    return res.json({
      productName,
      suggestions: result.suggestions
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(502).json({ error: message });
  }
});
