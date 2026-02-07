import { Report } from "../models/Report.js";
import { GlobalDomainReputation } from "../models/GlobalDomainReputation.js";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const recomputeDomainReputation = async (domain: string) => {
  if (!domain) return null;
  try {
    const reports = await Report.find({ domain, status: "published" }).lean();
    const total = reports.length;
    const scam = reports.filter((r) => r.type === "scam").length;
    const fp = reports.filter((r) => r.type === "false_positive").length;

    const raw = scam - fp;
    const score = clamp(50 + 15 * raw, 0, 100);
    const confidence = clamp(total / 5, 0, 1);

    const doc = await GlobalDomainReputation.findOneAndUpdate(
      { domain },
      {
        domain,
        reportCountTotal: total,
        reportCountScam: scam,
        reportCountFalsePositive: fp,
        score,
        confidence,
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    ).lean();

    return doc;
  } catch (err) {
    // safe to call frequently; swallow errors and return null
    console.error("recomputeDomainReputation error", err);
    return null;
  }
};
