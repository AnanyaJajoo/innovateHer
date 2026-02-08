import mongoose, { Schema } from "mongoose";

export interface ScamIntelDocument {
  domains: string[];
  vendors: string[];
  aiGeneratedPatterns: string[];
  duplicateReviewHashes: string[];
  repeatedImageHashes: string[];
  evidenceCount: number;
  sources: string[];
  lastSeenAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ScamIntelDocument>(
  {
    domains: { type: [String], default: [] },
    vendors: { type: [String], default: [] },
    aiGeneratedPatterns: { type: [String], default: [] },
    duplicateReviewHashes: { type: [String], default: [] },
    repeatedImageHashes: { type: [String], default: [] },
    evidenceCount: { type: Number, default: 0 },
    sources: { type: [String], default: [] },
    lastSeenAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() }
  },
  { timestamps: false, versionKey: false, collection: "scamintels" }
);

// No compound index on parallel arrays to avoid MongoDB error.

export const ScamIntel = mongoose.model<ScamIntelDocument>(
  "ScamIntel",
  schema,
  "scamintels"
);
