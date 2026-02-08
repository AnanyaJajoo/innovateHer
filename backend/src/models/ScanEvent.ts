import mongoose, { Schema } from "mongoose";

export interface ScanEventDocument {
  userId?: string;
  anonId?: string;
  domain: string;
  urlHash: string;
  timestamp: Date;
  createdAt?: Date;
}

const schema = new Schema<ScanEventDocument>(
  {
    userId: { type: String },
    anonId: { type: String },
    domain: { type: String, required: true },
    urlHash: { type: String, required: true },
    timestamp: { type: Date, default: () => new Date() },
    createdAt: { type: Date }
  },
  { timestamps: false, versionKey: false, collection: "scanevents" }
);

schema.index({ userId: 1, timestamp: -1 });
schema.index({ domain: 1, timestamp: -1 });

export const ScanEvent = mongoose.model<ScanEventDocument>(
  "ScanEvent",
  schema,
  "scanevents"
);
