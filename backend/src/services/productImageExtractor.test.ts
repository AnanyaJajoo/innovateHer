import { describe, expect, it } from "vitest";
import {
  extractFromJsonLd,
  extractMetadataCandidates,
  normalizeUrl
} from "./productImageExtractor";

describe("normalizeUrl", () => {
  it("resolves relative URLs against base", () => {
    const result = normalizeUrl("/images/item.jpg", "https://shop.com/p/123");
    expect(result).toBe("https://shop.com/images/item.jpg");
  });

  it("rejects non-http protocols", () => {
    const result = normalizeUrl("ftp://shop.com/item.jpg", "https://shop.com");
    expect(result).toBeNull();
  });
});

describe("extractMetadataCandidates", () => {
  it("extracts og:image and twitter:image", () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://cdn.shop.com/og.jpg" />
          <meta name="twitter:image" content="https://cdn.shop.com/tw.jpg" />
        </head>
      </html>
    `;
    const { ogImage, twitterImage } = extractMetadataCandidates(html);
    expect(ogImage).toBe("https://cdn.shop.com/og.jpg");
    expect(twitterImage).toBe("https://cdn.shop.com/tw.jpg");
  });
});

describe("extractFromJsonLd", () => {
  it("extracts Product image string", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Product",
          "image": "https://cdn.shop.com/product.jpg"
        }
      </script>
    `;
    const images = extractFromJsonLd(html);
    expect(images).toContain("https://cdn.shop.com/product.jpg");
  });

  it("extracts Product image array", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": ["Product", "Thing"],
          "image": ["https://cdn.shop.com/1.jpg", "https://cdn.shop.com/2.jpg"]
        }
      </script>
    `;
    const images = extractFromJsonLd(html);
    expect(images).toContain("https://cdn.shop.com/1.jpg");
    expect(images).toContain("https://cdn.shop.com/2.jpg");
  });
});
