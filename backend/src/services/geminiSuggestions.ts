import OpenAI from "openai";

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { suggestions: [], error: "OPENAI_API_KEY is not configured" };
  }

  const openai = new OpenAI({ apiKey });

  const prompt = `You are a shopping assistant. A user is looking at this product: "${productName}".

Suggest 3 similar, real products that can be found on Amazon. For each product provide:
1. name: The exact or near-exact product name as it would appear on Amazon
2. description: A one-sentence description (max 80 characters)
3. estimatedPriceRange: An approximate price range like "$20-$35"

Respond ONLY with a valid JSON array. No markdown, no code fences, no explanation. Example format:
[
  {
    "name": "Product Name Here",
    "description": "Brief description here",
    "estimatedPriceRange": "$XX-$YY"
  }
]`;

  try {
    console.log(`[InnovateHer] Sending request to OpenAI for product: "${productName}"`);
    const completion = await openai.responses.create({
      model: "gpt-5-nano",
      input: prompt,
    });

    const responseText = (completion.output_text).trim();

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
      return { suggestions: [], error: "Unexpected OpenAI response format" };
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
    return { suggestions: [], error: `OpenAI API error: ${message}` };
  }
}
