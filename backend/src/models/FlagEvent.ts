import mongoose, { Schema } from "mongoose";

export interface FlagEventDocument {
  userId?: string;
  anonId?: string;
  domain?: string;
  urlHash?: string;
  flagType?: string;
  createdAt: Date;
}

const schema = new Schema<FlagEventDocument>(
  {
    userId: { type: String },
    anonId: { type: String },
    domain: { type: String },
    urlHash: { type: String },
    flagType: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: "flagevents" }
);

schema.index({ domain: 1, createdAt: -1 });
schema.index({ userId: 1, createdAt: -1 });

export const FlagEvent = mongoose.model<FlagEventDocument>(
  "FlagEvent",
  schema,
  "flagevents"
);
