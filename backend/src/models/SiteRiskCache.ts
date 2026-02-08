import mongoose, { Schema } from "mongoose";

export interface SiteRiskCacheDocument {
  domain: string;
  normalizedUrl: string;
  urlHash: string;
  riskScore: number;
  reasons: Array<string | { code: string; meta?: any }>;
  checkedAt: Date;
}

const siteRiskCacheSchema = new Schema<SiteRiskCacheDocument>(
  {
    domain: { type: String, required: true },
    normalizedUrl: { type: String, required: true },
    urlHash: { type: String, required: true },
    riskScore: { type: Number, required: true },
    reasons: { type: [Schema.Types.Mixed], required: true },
    checkedAt: { type: Date, required: true }
  },
  { versionKey: false, collection: "siteriskcaches" }
);

siteRiskCacheSchema.index({ urlHash: 1, domain: 1 }, { unique: true });

export const SiteRiskCache = mongoose.model<SiteRiskCacheDocument>(
  "SiteRiskCache",
  siteRiskCacheSchema,
  "siteriskcaches"
);
