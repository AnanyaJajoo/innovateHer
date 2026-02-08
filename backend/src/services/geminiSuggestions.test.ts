import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSuggestedProducts } from "./geminiSuggestions";

const buildGeminiPayload = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] } }]
});

describe("getSuggestedProducts", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.GEMINI_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("returns a clear error when API key is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await getSuggestedProducts("Vacuum Cleaner");
    expect(result.error).toBe("GEMINI_API_KEY is not configured");
    expect(result.suggestions).toHaveLength(0);
  });

  it("bubbles up non-OK API responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Server error"
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSuggestedProducts("Desk lamp");
    expect(result.error).toContain("Gemini API error (500)");
    expect(result.suggestions).toHaveLength(0);
  });

  it("parses JSON arrays even when wrapped in code fences", async () => {
    const responseText = `\`\`\`json
[
  {
    "name": "Ceramic Mug",
    "description": "Dishwasher-safe mug",
    "estimatedPriceRange": "$12-$18"
  }
]
\`\`\``;

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildGeminiPayload(responseText)
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSuggestedProducts("Coffee mug");
    expect(result.error).toBeUndefined();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].name).toBe("Ceramic Mug");
    expect(result.suggestions[0].amazonSearchUrl).toContain("Ceramic%20Mug");
  });

  it("accepts responses that wrap suggestions in an object", async () => {
    const responseText = JSON.stringify({
      suggestions: [{ name: "Noise Cancelling Headphones" }]
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildGeminiPayload(responseText)
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSuggestedProducts("Headphones");
    expect(result.error).toBeUndefined();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].name).toBe("Noise Cancelling Headphones");
  });

  it("extracts JSON arrays surrounded by extra text", async () => {
    const responseText =
      "Sure! Here you go: [ { \"name\": \"Yoga Mat\", \"description\": \"Non-slip mat\" } ] Thanks!";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildGeminiPayload(responseText)
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSuggestedProducts("Yoga mat");
    expect(result.error).toBeUndefined();
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].name).toBe("Yoga Mat");
  });

  it("returns an error when Gemini returns empty content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => buildGeminiPayload("")
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSuggestedProducts("Smartwatch");
    expect(result.error).toBe("Empty response from Gemini");
  });
});
