import { fetch } from "undici";
import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;

export interface ProductNameResult {
  productName: string | null;
  source: "json-ld" | "og:title" | "meta-title" | "html-title" | null;
}

export async function extractProductName(
  url: string
): Promise<ProductNameResult> {
  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return { productName: null, source: null };
      }
      html = await response.text();
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return { productName: null, source: null };
  }

  const $ = cheerio.load(html);

  // Priority 1: JSON-LD Product schema "name" field
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const script of scripts) {
    const raw = $(script).contents().text();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const name = findProductName(parsed);
      if (isUsableName(name)) {
        return { productName: name, source: "json-ld" };
      }
    } catch {
      continue;
    }
  }

  // Priority 2: og:title meta tag
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (isUsableName(ogTitle)) {
    return { productName: ogTitle.trim(), source: "og:title" };
  }

  // Priority 3: <meta name="title">
  const metaTitle = $('meta[name="title"]').attr("content");
  if (isUsableName(metaTitle)) {
    return { productName: metaTitle.trim(), source: "meta-title" };
  }

  // Priority 4: <title> tag (clean up common store suffixes)
  const titleText = $("title").text();
  if (titleText && titleText.trim().length > 2) {
    const cleaned = titleText
      .replace(
        /\s*[\|–—-]\s*(Amazon|eBay|Walmart|Target|Temu|Shop|Store|Buy).*$/i,
        ""
      )
      .trim();
    const candidate = cleaned || titleText.trim();
    if (isUsableName(candidate)) {
      return {
        productName: candidate,
        source: "html-title",
      };
    }
  }

  const fallbackFromUrl = extractNameFromUrl(url);
  if (fallbackFromUrl) {
    return { productName: fallbackFromUrl, source: null };
  }

  return { productName: null, source: null };
}

const GENERIC_NAMES = new Set([
  "temu",
  "amazon",
  "amazon.com",
  "temu.com",
  "home",
  "shop",
  "store"
]);

const isUsableName = (value: string | null | undefined): value is string => {
  if (!value || value.trim().length <= 2) {
    return false;
  }
  const cleaned = value.trim().toLowerCase();
  return !GENERIC_NAMES.has(cleaned);
};

export const extractNameFromUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (!path || path === "/") {
      return null;
    }

    const segments = path.split("/").filter(Boolean);
    if (segments.length === 0) {
      return null;
    }

    // Walmart product URLs often look like /ip/<product-name>/<id>
    const ipIndex = segments.indexOf("ip");
    if (ipIndex !== -1 && segments[ipIndex + 1]) {
      const walmartName = segments[ipIndex + 1];
      const normalizedWalmart = normalizeSlug(walmartName);
      return normalizedWalmart ? normalizedWalmart : null;
    }

    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) {
      return null;
    }

    const normalized = normalizeSlug(lastSegment);
    return normalized ? normalized : null;
  } catch {
    return null;
  }
};

const normalizeSlug = (segment: string): string | null => {
  const withoutExt = segment.replace(/\.html?$/i, "");
  const withoutId = withoutExt.replace(/-g-\d+$/i, "");
  const numericOnly = /^\d+$/.test(withoutId);
  if (numericOnly) {
    return null;
  }
  const normalized = withoutId
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length <= 2) {
    return null;
  }

  const titleCased = normalized
    .split(" ")
    .map((word) =>
      word.length > 2 ? word[0].toUpperCase() + word.slice(1) : word
    )
    .join(" ");

  return isUsableName(titleCased) ? titleCased : null;
};

function findProductName(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const result = findProductName(item);
      if (result) return result;
    }
    return null;
  }

  const typed = node as Record<string, unknown>;

  if (typed["@graph"]) {
    const result = findProductName(typed["@graph"]);
    if (result) return result;
  }

  const typeValue = typed["@type"];
  const isProduct =
    (typeof typeValue === "string" && typeValue.includes("Product")) ||
    (Array.isArray(typeValue) &&
      typeValue.some(
        (entry) => typeof entry === "string" && entry.includes("Product")
      ));

  if (
    isProduct &&
    typeof typed.name === "string" &&
    typed.name.trim().length > 0
  ) {
    return typed.name.trim();
  }

  for (const val of Object.values(typed)) {
    const result = findProductName(val);
    if (result) return result;
  }

  return null;
}
