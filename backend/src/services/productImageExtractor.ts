import { fetch } from "undici";
import * as cheerio from "cheerio";
import { chromium } from "playwright";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;
const HEAD_TIMEOUT_MS = 5000;
const PLAYWRIGHT_TIMEOUT_MS = 15000;
const PLAYWRIGHT_CONCURRENCY = 2;
const MIN_AREA = 40000;
const MIN_WIDTH = 200;
const IMAGE_EXT_REGEX =
  /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?|#|$)/i;

type LimitFn = <T>(fn: () => Promise<T>) => Promise<T>;

let limitPromise: Promise<LimitFn> | null = null;

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
}

const getPlaywrightLimit = async () => {
  if (!limitPromise) {
    limitPromise = import("p-limit").then(
      (mod) => (mod as { default: (n: number) => LimitFn }).default
    ).then((createLimit) => createLimit(PLAYWRIGHT_CONCURRENCY));
  }
  return limitPromise;
};

export type ExtractDebug = {
  ogImage?: string;
  twitterImage?: string;
  jsonLdImages?: string[];
  selectedReason?: string;
};

export type ExtractResult = {
  source: "metadata" | "playwright";
  imageUrl: string | null;
  alternates: string[];
  debug: ExtractDebug;
};

export type MetadataCandidates = {
  ogImage?: string;
  twitterImage?: string;
  jsonLdImages: string[];
};

export async function extractProductImage(
  url: string
): Promise<ExtractResult> {
  let html: string | null = null;

  try {
    html = await fetchHtml(url);
  } catch {
    html = null;
  }

  if (html) {
    const metadataResult = await extractFromMetadata(html, url);
    if (metadataResult.imageUrl) {
      return { ...metadataResult, source: "metadata" };
    }
  }

  const playwrightResult = await extractWithPlaywright(url);
  return { ...playwrightResult, source: "playwright" };
}

export const normalizeUrl = (
  candidate: string | undefined,
  baseUrl: string
): string | null => {
  if (!candidate) {
    return null;
  }

  try {
    const normalized = new URL(candidate, baseUrl);
    if (!["http:", "https:"].includes(normalized.protocol)) {
      return null;
    }
    return normalized.toString();
  } catch {
    return null;
  }
};

export const extractMetadataCandidates = (html: string): MetadataCandidates => {
  const $ = cheerio.load(html);
  const ogImage =
    $('meta[property="og:image"]').attr("content") ??
    $('meta[property="og:image:url"]').attr("content") ??
    undefined;
  const twitterImage =
    $('meta[name="twitter:image"]').attr("content") ??
    $('meta[name="twitter:image:src"]').attr("content") ??
    undefined;
  const jsonLdImages = extractFromJsonLd(html);

  return { ogImage, twitterImage, jsonLdImages };
};

export const extractFromJsonLd = (html: string): string[] => {
  const $ = cheerio.load(html);
  const results: string[] = [];
  const scripts = $('script[type="application/ld+json"]').toArray();

  const collectImages = (node: unknown) => {
    if (!node) {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(collectImages);
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    const typed = node as Record<string, unknown>;
    if (typed["@graph"]) {
      collectImages(typed["@graph"]);
    }

    const typeValue = typed["@type"];
    const isProduct =
      (typeof typeValue === "string" && typeValue.includes("Product")) ||
      (Array.isArray(typeValue) &&
        typeValue.some(
          (entry) => typeof entry === "string" && entry.includes("Product")
        ));

    if (isProduct && typed.image) {
      const image = typed.image;
      if (typeof image === "string") {
        results.push(image);
      } else if (Array.isArray(image)) {
        image.forEach((item) => {
          if (typeof item === "string") {
            results.push(item);
          } else if (
            item &&
            typeof item === "object" &&
            typeof (item as { url?: unknown }).url === "string"
          ) {
            results.push((item as { url: string }).url);
          }
        });
      } else if (
        typeof image === "object" &&
        typeof (image as { url?: unknown }).url === "string"
      ) {
        results.push((image as { url: string }).url);
      }
    }

    Object.values(typed).forEach(collectImages);
  };

  scripts.forEach((script) => {
    const raw = $(script).contents().text();
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      collectImages(parsed);
    } catch {
      return;
    }
  });

  return results;
};

const fetchHtml = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
};

const extractFromMetadata = async (
  html: string,
  baseUrl: string
): Promise<ExtractResult> => {
  const { ogImage, twitterImage, jsonLdImages } =
    extractMetadataCandidates(html);
  let queryImage: string | undefined;
  try {
    const parsed = new URL(baseUrl);
    const topGalleryUrl = parsed.searchParams.get("top_gallery_url");
    if (topGalleryUrl) {
      queryImage = topGalleryUrl;
    }
  } catch {
    queryImage = undefined;
  }

  const candidates: Array<{ url: string; reason: string }> = [];
  if (ogImage) {
    candidates.push({ url: ogImage, reason: "og:image" });
  }
  if (twitterImage) {
    candidates.push({ url: twitterImage, reason: "twitter:image" });
  }
  if (queryImage) {
    candidates.push({ url: queryImage, reason: "query:top_gallery_url" });
  }
  jsonLdImages.forEach((image) =>
    candidates.push({ url: image, reason: "json-ld" })
  );

  const validUrls: string[] = [];
  let selectedReason: string | undefined;
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate.url, baseUrl);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    const isValid = await validateImageUrl(normalized);
    if (!isValid) {
      continue;
    }
    if (!selectedReason) {
      selectedReason = candidate.reason;
    }
    validUrls.push(normalized);
  }

  return {
    source: "metadata",
    imageUrl: validUrls[0] ?? null,
    alternates: validUrls.slice(1),
    debug: {
      ogImage,
      twitterImage,
      jsonLdImages,
      selectedReason
    }
  };
};

const validateImageUrl = async (candidateUrl: string): Promise<boolean> => {
  if (!candidateUrl.startsWith("http://") && !candidateUrl.startsWith("https://")) {
    return false;
  }

  if (IMAGE_EXT_REGEX.test(candidateUrl)) {
    return true;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);

  try {
    const response = await fetch(candidateUrl, {
      method: "HEAD",
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal
    });
    const contentType = response.headers.get("content-type") ?? "";
    return contentType.startsWith("image/") && response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

const extractWithPlaywright = async (url: string): Promise<ExtractResult> => {
  const limit = await getPlaywrightLimit();
  return limit(async () => {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
    let page: import("playwright").Page | null = null;

    try {
      browser = await chromium.launch({ headless: true });
      page = await browser.newPage({ userAgent: USER_AGENT });
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: PLAYWRIGHT_TIMEOUT_MS
      });

      await page
        .waitForLoadState("networkidle", { timeout: 5000 })
        .catch(() => undefined);
      await page.waitForTimeout(1500);

      const evaluateFn = new Function(
        "args",
        `
        const { minArea, minWidth, host } = args;
        const blacklist =
          /logo|icon|sprite|badge|avatar|flag|banner|ads|promo/i;
        const boostKeywords =
          /product|gallery|carousel|pdp|media|main|hero/i;

        function pickUrl(img) {
          const attrs = [
            "data-src",
            "data-lazy",
            "data-original",
            "data-zoom-image",
            "data-hires",
            "data-large_image",
            "data-image",
            "data-img",
            "data-full"
          ];
          for (const attr of attrs) {
            const value = img.getAttribute(attr);
            if (value) {
              return value;
            }
          }
          return img.currentSrc || img.src || "";
        }

        function getBoost(el) {
          let node = el;
          for (let i = 0; i < 6 && node; i += 1) {
            const text = \`\${String(node.className || "")} \${node.id || ""}\`;
            if (boostKeywords.test(text)) {
              return 1.5;
            }
            node = node.parentElement;
          }
          return 1;
        }

        function getUrlBoost(url, img) {
          let boost = 1;
          const lowerUrl = url.toLowerCase();
          const lowerHost = String(host || "").toLowerCase();

          if (lowerHost.includes("amazon")) {
            if (lowerUrl.includes("/images/i/")) {
              boost *= 1.4;
            }
            if (lowerUrl.includes("/images/g/01/")) {
              boost *= 0.6;
            }
          }

          if (lowerHost.includes("temu") || lowerUrl.includes("kwcdn.com")) {
            if (lowerUrl.includes("kwcdn.com")) {
              boost *= 1.4;
            }
            if (lowerUrl.includes("sprite") || lowerUrl.includes("icon")) {
              boost *= 0.6;
            }
          }

          if (lowerHost.includes("shein") || lowerUrl.includes("sheincdn") || lowerUrl.includes("shein-static")) {
            if (lowerUrl.includes("sheincdn") || lowerUrl.includes("shein-static") || lowerUrl.includes("img.")) {
              boost *= 1.3;
            }
            if (lowerUrl.includes("sprite") || lowerUrl.includes("icon") || lowerUrl.includes("logo")) {
              boost *= 0.6;
            }
          }

          if (
            img.hasAttribute("data-a-dynamic-image") ||
            img.getAttribute("data-a-image-name") === "landingImage"
          ) {
            boost *= 1.3;
          }

          return boost;
        }

        const results = [];
        const images = Array.from(document.images);

        for (const img of images) {
          const url = pickUrl(img);
          if (!url) {
            continue;
          }
          if (img.closest("header, nav, footer")) {
            continue;
          }

          const alt = img.getAttribute("alt") || "";
          const id = img.id || "";
          const className = img.className || "";
          const haystack = \`\${url} \${alt} \${id} \${className}\`;
          if (blacklist.test(haystack)) {
            continue;
          }

          const rect = img.getBoundingClientRect();
          const renderedArea = rect.width * rect.height;
          const naturalArea = img.naturalWidth * img.naturalHeight;
          const area = Math.max(renderedArea, naturalArea);
          const width = Math.max(rect.width, img.naturalWidth);
          const height = Math.max(rect.height, img.naturalHeight);
          const aspectRatio = height ? width / height : 0;

          if (area < minArea || width < minWidth) {
            continue;
          }
          if (aspectRatio > 3.5 || aspectRatio < 0.2) {
            continue;
          }

          const boost = getBoost(img) * getUrlBoost(url, img);
          results.push({ url, score: area * boost });
        }

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, 8);
        `
      ) as (args: { minArea: number; minWidth: number }) => Array<{
        url: string;
        score: number;
      }>;

      const host = new URL(url).hostname;
      const candidates = await page.evaluate(evaluateFn, {
        minArea: MIN_AREA,
        minWidth: MIN_WIDTH,
        host
      });

      const validUrls: string[] = [];
      const seen = new Set<string>();

      for (const candidate of candidates) {
        const normalized = normalizeUrl(candidate.url, url);
        if (!normalized || seen.has(normalized)) {
          continue;
        }
        seen.add(normalized);
        if (await validateImageUrl(normalized)) {
          validUrls.push(normalized);
        }
      }

      return {
        source: "playwright",
        imageUrl: validUrls[0] ?? null,
        alternates: validUrls.slice(1, 6),
        debug: {
          selectedReason: validUrls[0]
            ? "largest-rendered-image"
            : "no-valid-image"
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        source: "playwright",
        imageUrl: null,
        alternates: [],
        debug: { selectedReason: message }
      };
    } finally {
      if (page) {
        await page.close().catch(() => undefined);
      }
      if (browser) {
        await browser.close().catch(() => undefined);
      }
    }
  });
};
