import mongoose, { Schema } from "mongoose";

export interface ScanDocument {
  userId?: string;
  anonId?: string;
  domain: string;
  urlHash: string;
  riskScore: number;
  confidence: number;
  reasons: Array<{ code: string; meta?: any } | string>;
  createdAt: Date;
}

const schema = new Schema<ScanDocument>(
  {
    userId: { type: String },
    anonId: { type: String },
    domain: { type: String, required: true },
    urlHash: { type: String, required: true },
    riskScore: { type: Number, required: true },
    confidence: { type: Number, required: true },
    reasons: { type: [Schema.Types.Mixed], required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

schema.index({ userId: 1, createdAt: -1 });
schema.index({ domain: 1, createdAt: -1 });

export const Scan = mongoose.model<ScanDocument>("Scan", schema);
