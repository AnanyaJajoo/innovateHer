export interface ProductSuggestion {
  name: string;
  description: string;
  searchUrl: string;
  amazonSearchUrl?: string;
  estimatedPriceRange?: string;
}

export interface SuggestionsResult {
  suggestions: ProductSuggestion[];
  error?: string;
}

export type SearchProvider = "amazon" | "walmart";

export async function getSuggestedProducts(
  productName: string,
  options?: { searchProvider?: SearchProvider }
): Promise<SuggestionsResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { suggestions: [], error: "GEMINI_API_KEY is not configured" };
  }

  const prompt = `You are a shopping assistant. A user is looking at this product: "${productName}".

Suggest 1 similar, real products that can be found on Amazon. For each product provide:
1. name: The shortened product name as it would appear on Amazon (3 words max)
2. description: A one-sentence description (max 80 characters)
3. estimatedPriceRange: An approximate price range like "$20-$35"

Respond ONLY with a valid JSON array. No markdown, no code fences, no explanation. Example format:
[
  {
    "name": "Product Name Here",
    "description": "Brief description here (one sentence)",
    "estimatedPriceRange": "$XX-$YY"
  }
]`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    console.log(`[InnovateHer] Sending request to Gemini for product: "${productName}"`);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { suggestions: [], error: `Gemini API error (${response.status}): ${errorBody}` };
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const responseText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!responseText) {
      return { suggestions: [], error: "Empty response from Gemini" };
    }

    const parsed = parseSuggestionsFromText(responseText);
    if (!parsed) {
      return { suggestions: [], error: "Unexpected Gemini response format" };
    }

    const searchProvider = options?.searchProvider ?? "amazon";
    const suggestions: ProductSuggestion[] = parsed
      .filter((item) => typeof item.name === "string" && item.name.trim().length > 0)
      .slice(0, 3)
      .map((item) => {
        const name = item.name!.trim();
        const searchUrl = buildSearchUrl(searchProvider, name);
        return {
          name,
          description: item.description || "",
          searchUrl,
          amazonSearchUrl: searchProvider === "amazon" ? searchUrl : undefined,
          estimatedPriceRange:
            typeof item.estimatedPriceRange === "string" && item.estimatedPriceRange.trim().length > 0
              ? item.estimatedPriceRange.trim()
              : undefined,
        };
      });

    return { suggestions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { suggestions: [], error: `Gemini API error: ${message}` };
  }
}

const buildSearchUrl = (provider: SearchProvider, query: string) => {
  const encoded = encodeURIComponent(query);
  switch (provider) {
    case "walmart":
      return `https://www.walmart.com/search?q=${encoded}`;
    case "amazon":
    default:
      return `https://www.amazon.com/s?k=${encoded}`;
  }
};

const parseSuggestionsFromText = (
  responseText: string
): Array<{
  name?: string;
  description?: string;
  estimatedPriceRange?: string;
}> | null => {
  // Strip potential markdown code fences
  const cleaned = responseText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const tryParse = (value: string) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  };

  const unwrapSuggestions = (value: unknown) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (
      value &&
      typeof value === "object" &&
      Array.isArray((value as { suggestions?: unknown }).suggestions)
    ) {
      return (value as { suggestions: unknown[] }).suggestions;
    }
    return null;
  };

  const direct = unwrapSuggestions(tryParse(cleaned));
  if (direct) {
    return direct as Array<{
      name?: string;
      description?: string;
      estimatedPriceRange?: string;
    }>;
  }

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start !== -1 && end > start) {
    const bracketed = cleaned.slice(start, end + 1);
    const bracketedParsed = unwrapSuggestions(tryParse(bracketed));
    if (bracketedParsed) {
      return bracketedParsed as Array<{
        name?: string;
        description?: string;
        estimatedPriceRange?: string;
      }>;
    }
  }

  return null;
};
