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
      if (name) {
        return { productName: name, source: "json-ld" };
      }
    } catch {
      continue;
    }
  }

  // Priority 2: og:title meta tag
  const ogTitle = $('meta[property="og:title"]').attr("content");
  if (ogTitle && ogTitle.trim().length > 2) {
    return { productName: ogTitle.trim(), source: "og:title" };
  }

  // Priority 3: <meta name="title">
  const metaTitle = $('meta[name="title"]').attr("content");
  if (metaTitle && metaTitle.trim().length > 2) {
    return { productName: metaTitle.trim(), source: "meta-title" };
  }

  // Priority 4: <title> tag (clean up common store suffixes)
  const titleText = $("title").text();
  if (titleText && titleText.trim().length > 2) {
    const cleaned = titleText
      .replace(
        /\s*[\|–—-]\s*(Amazon|eBay|Walmart|Target|Shop|Store|Buy).*$/i,
        ""
      )
      .trim();
    return {
      productName: cleaned || titleText.trim(),
      source: "html-title",
    };
  }

  return { productName: null, source: null };
}

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
