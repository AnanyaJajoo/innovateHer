export interface ProductSuggestion {
  name: string;
  description: string;
  amazonSearchUrl: string;
  estimatedPriceRange?: string;
}

export interface SuggestionsResult {
  suggestions: ProductSuggestion[];
  error?: string;
}

export async function getSuggestedProducts(
  productName: string
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

    // Strip potential markdown code fences
    const cleaned = responseText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed: Array<{
      name?: string;
      description?: string;
      estimatedPriceRange?: string;
    }> = JSON.parse(cleaned);

    if (!Array.isArray(parsed)) {
      return { suggestions: [], error: "Unexpected Gemini response format" };
    }

    const suggestions: ProductSuggestion[] = parsed
      .filter((item) => item.name && typeof item.name === "string")
      .slice(0, 3)
      .map((item) => ({
        name: item.name!,
        description: item.description || "",
        amazonSearchUrl: `https://www.amazon.com/s?k=${encodeURIComponent(item.name!)}`,
        estimatedPriceRange: item.estimatedPriceRange || undefined,
      }));

    return { suggestions };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { suggestions: [], error: `Gemini API error: ${message}` };
  }
}
