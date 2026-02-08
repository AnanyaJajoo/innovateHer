import { ScamIntel } from "../models/ScamIntel";

export interface ScamIntelSignalInput {
  domain?: string;
  vendorId?: string;
  aiGeneratedPatterns?: string[];
  duplicateReviewHashes?: string[];
  repeatedImageHashes?: string[];
  source?: string;
  evidenceIncrement?: number;
}

export const upsertScamIntel = async (input: ScamIntelSignalInput) => {
  if (!input.domain && !input.vendorId) return null;

  const addToSet: Record<string, unknown> = {
    aiGeneratedPatterns: { $each: input.aiGeneratedPatterns ?? [] },
    duplicateReviewHashes: { $each: input.duplicateReviewHashes ?? [] },
    repeatedImageHashes: { $each: input.repeatedImageHashes ?? [] }
  };

  if (input.domain) addToSet.domains = input.domain;
  if (input.vendorId) addToSet.vendors = input.vendorId;
  if (input.source) addToSet.sources = input.source;

  const update: Record<string, unknown> = {
    $set: { lastSeenAt: new Date(), updatedAt: new Date() },
    $addToSet: addToSet
  };

  if (input.evidenceIncrement) {
    update.$inc = { evidenceCount: input.evidenceIncrement };
  }

  const filter: Record<string, unknown> = {};
  if (input.domain) filter.domains = input.domain;
  if (input.vendorId) filter.vendors = input.vendorId;

  return ScamIntel.findOneAndUpdate(filter, update, { upsert: true, new: true }).catch(
    (err) => {
      console.error(err);
      return null;
    }
  );
};
