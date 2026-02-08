import { Router } from "express";
import { Report } from "../models/Report";
import { GlobalDomainReputation } from "../models/GlobalDomainReputation";
import { FlagEvent } from "../models/FlagEvent";
import { isDbReady } from "../db";
import { upsertScamIntel } from "../services/scamIntel";

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const computeScore = (counts: {
  total: number;
  scam: number;
  badExperience: number;
  falsePositive: number;
}) => {
  if (counts.total === 0) {
    return { aggregateRiskScore: 0, confidence: 0 };
  }

  const negative = counts.scam + counts.badExperience * 0.6;
  const positive = counts.falsePositive * 0.4;
  const netRatio = (negative - positive) / counts.total;
  const aggregateRiskScore = clamp(100 - netRatio * 70, 0, 100);
  const confidence = clamp(counts.total / 12, 0.1, 1);

  return { aggregateRiskScore, confidence };
};

const recomputeGlobalReputation = async (domain: string) => {
  const published = { $or: [{ publishStatus: "published" }, { status: "published" }] };
  const [total, scam, badExperience, falsePositive] = await Promise.all([
    Report.countDocuments({ domain, ...published }).catch(() => 0),
    Report.countDocuments({
      domain,
      ...published,
      $or: [{ reportType: "scam" }, { type: "scam" }]
    }).catch(() => 0),
    Report.countDocuments({
      domain,
      ...published,
      $or: [{ reportType: "bad_experience" }, { type: "bad_experience" }]
    }).catch(() => 0),
    Report.countDocuments({
      domain,
      ...published,
      $or: [{ reportType: "false_positive" }, { type: "false_positive" }]
    }).catch(() => 0)
  ]);

  const { aggregateRiskScore, confidence } = computeScore({
    total,
    scam,
    badExperience,
    falsePositive
  });

  const record = await GlobalDomainReputation.findOneAndUpdate(
    { domain },
    {
      domain,
      totalReports: total,
      scamReports: scam,
      falsePositiveReports: falsePositive,
      aggregateRiskScore,
      reportCountTotal: total,
      reportCountScam: scam,
      reportCountFalsePositive: falsePositive,
      score: aggregateRiskScore,
      confidence,
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  ).catch((err) => {
    console.error(err);
    return null;
  });

  return record;
};

export const reportsRouter = Router();

reportsRouter.post("/report", async (req, res) => {
  const {
    domain,
    reportType,
    type,
    category,
    title,
    body,
    userId,
    anonId
  } = req.body ?? {};

  const resolvedType = reportType ?? type;

  if (!domain || typeof domain !== "string") {
    return res.status(400).json({ error: "domain is required" });
  }
  if (!resolvedType || !["scam", "bad_experience", "false_positive"].includes(resolvedType)) {
    return res.status(400).json({ error: "reportType is required" });
  }
  if (!title || typeof title !== "string") {
    return res.status(400).json({ error: "title is required" });
  }
  if (!body || typeof body !== "string") {
    return res.status(400).json({ error: "body is required" });
  }

  if (!isDbReady()) {
    return res.status(503).json({ ok: false, stored: false, error: "Database unavailable" });
  }

  const report = await Report.create({
    domain,
    userId,
    anonId,
    reportType: resolvedType,
    type: resolvedType,
    category: typeof category === "string" ? category : "other",
    title,
    body,
    publishStatus: "published"
  }).catch((err) => {
    console.error(err);
    return null;
  });

  if (report) {
    FlagEvent.create({
      userId,
      anonId,
      domain,
      flagType: resolvedType
    }).catch(console.error);

    upsertScamIntel({
      domain,
      source: "report",
      evidenceIncrement: resolvedType === "scam" ? 2 : 1
    }).catch(console.error);
  }

  const reputation = await recomputeGlobalReputation(domain).catch((err) => {
    console.error(err);
    return null;
  });

  return res.json({
    ok: true,
    stored: Boolean(report),
    reportId: report?._id ?? null,
    reputation
  });
});

reportsRouter.get("/domain-reputation/:domain", async (req, res) => {
  const { domain } = req.params;

  if (!domain) {
    return res.status(400).json({ error: "domain is required" });
  }

  if (!isDbReady()) {
    return res.status(503).json({ error: "Database unavailable" });
  }

  const record = await GlobalDomainReputation.findOne({ domain }).lean().catch(() => null);
  if (!record) {
    return res.json({
      domain,
      totalReports: 0,
      scamReports: 0,
      falsePositiveReports: 0,
      aggregateRiskScore: 0,
      confidence: 0
    });
  }

  return res.json({
    domain: record.domain,
    totalReports: record.totalReports ?? record.reportCountTotal ?? 0,
    scamReports: record.scamReports ?? record.reportCountScam ?? 0,
    falsePositiveReports: record.falsePositiveReports ?? record.reportCountFalsePositive ?? 0,
    aggregateRiskScore: record.aggregateRiskScore ?? record.score ?? 0,
    confidence: record.confidence ?? 0,
    updatedAt: record.updatedAt
  });
});

reportsRouter.get("/reports/:domain", async (req, res) => {
  const { domain } = req.params;
  if (!domain) {
    return res.status(400).json({ error: "domain is required" });
  }

  if (!isDbReady()) {
    return res.json({ reports: [] });
  }

  const limit = clamp(Number(req.query?.limit ?? 100), 1, 500);

  const reports = await Report.find({
    domain,
    $or: [{ publishStatus: "published" }, { status: "published" }]
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()
    .catch(() => []);

  return res.json({ reports });
});
