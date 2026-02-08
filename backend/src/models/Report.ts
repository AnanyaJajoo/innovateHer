import mongoose, { Schema } from "mongoose";

export interface ReportDocument {
  domain: string;
  userId?: string;
  anonId?: string;
  reportType: "scam" | "bad_experience" | "false_positive";
  category: string;
  title: string;
  body: string;
  publishStatus: "published" | "removed";
  createdAt: Date;
  updatedAt: Date;
  type?: "scam" | "bad_experience" | "false_positive";
  status?: "published" | "removed";
}

const reportSchema = new Schema<ReportDocument>(
  {
    domain: { type: String, required: true },
    userId: { type: String },
    anonId: { type: String },
    reportType: {
      type: String,
      required: true,
      enum: ["scam", "bad_experience", "false_positive"]
    },
    category: { type: String, default: "other" },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, required: true, maxlength: 4000 },
    publishStatus: { type: String, default: "published", enum: ["published", "removed"] },
    type: { type: String, enum: ["scam", "bad_experience", "false_positive"] },
    status: { type: String, enum: ["published", "removed"] }
  },
  { timestamps: true, versionKey: false, collection: "reports" }
);

reportSchema.index({ domain: 1, createdAt: -1 });

export const Report = mongoose.model<ReportDocument>("Report", reportSchema);
