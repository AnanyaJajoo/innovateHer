import mongoose, { Schema } from "mongoose";

export interface EventDocument {
  userId?: string;
  anonId?: string;
  domain?: string;
  riskScoreBucket?: string;
  actionTaken?: "ignored" | "left" | "reported" | "proceeded";
  createdAt: Date;
  expiresAt: Date;
}

const schema = new Schema<EventDocument>(
  {
    userId: { type: String },
    anonId: { type: String },
    domain: { type: String },
    riskScoreBucket: { type: String },
    actionTaken: { type: String, enum: ["ignored", "left", "reported", "proceeded"] },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: "events" }
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Event = mongoose.model<EventDocument>("Event", schema);
