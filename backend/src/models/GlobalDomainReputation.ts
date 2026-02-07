import mongoose, { Schema } from "mongoose";

export interface GlobalDomainReputationDocument {
  domain: string;
  reportCountTotal: number;
  reportCountScam: number;
  reportCountFalsePositive: number;
  score: number;
  confidence: number;
  updatedAt: Date;
}

const schema = new Schema<GlobalDomainReputationDocument>(
  {
    domain: { type: String, required: true, unique: true },
    reportCountTotal: { type: Number, default: 0 },
    reportCountScam: { type: Number, default: 0 },
    reportCountFalsePositive: { type: Number, default: 0 },
    score: { type: Number, default: 50 },
    confidence: { type: Number, default: 0 }
  },
  { timestamps: false, versionKey: false }
);

export const GlobalDomainReputation = mongoose.model<GlobalDomainReputationDocument>(
  "GlobalDomainReputation",
  schema
);
