import mongoose, { Schema } from "mongoose";

export interface ProductSuggestionCacheDocument {
  cacheKey: string;
  searchProvider: string;
  productName: string;
  suggestions: Array<Record<string, unknown>>;
  checkedAt: Date;
}

const productSuggestionCacheSchema = new Schema<ProductSuggestionCacheDocument>(
  {
    cacheKey: { type: String, required: true },
    searchProvider: { type: String, required: true },
    productName: { type: String, required: true },
    suggestions: { type: [Schema.Types.Mixed], required: true },
    checkedAt: { type: Date, required: true }
  },
  { versionKey: false, collection: "productsuggestioncaches" }
);

productSuggestionCacheSchema.index(
  { cacheKey: 1, searchProvider: 1 },
  { unique: true }
);

export const ProductSuggestionCache =
  mongoose.model<ProductSuggestionCacheDocument>(
    "ProductSuggestionCache",
    productSuggestionCacheSchema,
    "productsuggestioncaches"
  );
