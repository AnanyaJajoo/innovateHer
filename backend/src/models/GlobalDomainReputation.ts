import mongoose, { Schema } from "mongoose";

export interface GlobalDomainReputationDocument {
  domain: string;
  totalReports: number;
  scamReports: number;
  falsePositiveReports: number;
  aggregateRiskScore: number;
  confidence: number;
  updatedAt: Date;
  reportCountTotal?: number;
  reportCountScam?: number;
  reportCountFalsePositive?: number;
  score?: number;
}

const schema = new Schema<GlobalDomainReputationDocument>(
  {
    domain: { type: String, required: true, unique: true },
    totalReports: { type: Number, default: 0 },
    scamReports: { type: Number, default: 0 },
    falsePositiveReports: { type: Number, default: 0 },
    aggregateRiskScore: { type: Number, default: 0 },
    reportCountTotal: { type: Number },
    reportCountScam: { type: Number },
    reportCountFalsePositive: { type: Number },
    score: { type: Number },
    confidence: { type: Number, default: 0 },
    updatedAt: { type: Date, default: () => new Date() }
  },
  { timestamps: false, versionKey: false, collection: "globaldomainreputations" }
);

export const GlobalDomainReputation = mongoose.model<GlobalDomainReputationDocument>(
  "GlobalDomainReputation",
  schema
);
