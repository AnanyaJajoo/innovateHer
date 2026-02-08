import { describe, expect, it } from "vitest";
import { extractNameFromUrl } from "./productNameExtractor";

describe("extractNameFromUrl", () => {
  it("extracts a readable name from a Temu product URL", () => {
    const url =
      "https://www.temu.com/womens-elegant-v-neck-christmas-print-maxi-dress-with-poinsettia--a-line-silhouette-long-sleeve-floor-length-party-dress-for-holiday-events-christmas-party-outfit-casual-to-formal-wear-spring-autumn-seasonal-outfits-red-green-g-601104347060146.html";

    const result = extractNameFromUrl(url);
    expect(result).toContain("Christmas Print Maxi Dress");
    expect(result?.toLowerCase()).toContain("poinsettia");
  });

  it("returns null for non-product paths", () => {
    const result = extractNameFromUrl("https://www.temu.com/");
    expect(result).toBeNull();
  });

  it("extracts a readable name from a Walmart product URL", () => {
    const url =
      "https://www.walmart.com/ip/Plaid-Dress-For-Women-Button-Down-Shirts-Dresses-Pocketed-Women-s-Christmas-Plaid-Dress-Long-Sleeve-Button-Down-Mini-Shirtdress-Clearance-Red-XL/1326107024";

    const result = extractNameFromUrl(url);
    expect(result).toContain("Plaid Dress For Women");
    expect(result?.toLowerCase()).toContain("christmas");
  });
});
