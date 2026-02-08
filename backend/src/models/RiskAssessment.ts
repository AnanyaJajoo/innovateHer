import mongoose, { Schema } from "mongoose";

export interface RiskAssessmentDocument {
  userId?: string;
  anonId?: string;
  domain?: string;
  urlHash?: string;
  riskScore: number;
  confidence: number;
  detectionSignals: string[];
  createdAt: Date;
}

const schema = new Schema<RiskAssessmentDocument>(
  {
    userId: { type: String },
    anonId: { type: String },
    domain: { type: String },
    urlHash: { type: String },
    riskScore: { type: Number, required: true },
    confidence: { type: Number, required: true },
    detectionSignals: { type: [String], default: [] }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: "riskassessments" }
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ domain: 1, createdAt: -1 });
schema.index({ riskScore: -1, createdAt: -1 });

export const RiskAssessment = mongoose.model<RiskAssessmentDocument>(
  "RiskAssessment",
  schema,
  "riskassessments"
);
