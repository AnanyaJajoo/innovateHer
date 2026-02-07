import mongoose, { Schema } from "mongoose";

export interface ReportDocument {
  domain: string;
  userId?: string;
  type: "scam" | "bad_experience" | "false_positive";
  category: string;
  title: string;
  body: string;
  status: "published" | "removed";
  createdAt: Date;
  updatedAt: Date;
}

const reportSchema = new Schema<ReportDocument>(
  {
    domain: { type: String, required: true },
    userId: { type: String },
    type: { type: String, required: true, enum: ["scam", "bad_experience", "false_positive"] },
    category: { type: String, default: "other" },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 4000 },
    status: { type: String, default: "published", enum: ["published", "removed"] }
  },
  { timestamps: true, versionKey: false }
);

reportSchema.index({ domain: 1, createdAt: -1 });

export const Report = mongoose.model<ReportDocument>("Report", reportSchema);
