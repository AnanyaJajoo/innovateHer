import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "./db.js";
import { Event } from "./models/Event.js";
import { FlagEvent } from "./models/FlagEvent.js";
import { GlobalDomainReputation } from "./models/GlobalDomainReputation.js";
import { Report } from "./models/Report.js";
import { RiskAssessment } from "./models/RiskAssessment.js";
import { Scan } from "./models/Scan.js";
import { ScanEvent } from "./models/ScanEvent.js";
import { ScamIntel } from "./models/ScamIntel.js";
import { SiteRiskCache } from "./models/SiteRiskCache.js";
import { hashUrl } from "./utils/hash.js";
import { normalizeUrl } from "./utils/normalizeUrl.js";

dotenv.config();

const seed = async () => {
  try {
    await connectDb();

    const existingSeed = await Report.countDocuments({ userId: "seed-global" });
    if (existingSeed > 0) {
      console.log("Seed skipped: sample data already present.");
      await mongoose.connection.close();
      return;
    }

    await ScamIntel.collection.dropIndex("domains_1_vendors_1").catch(() => {});

    const samples = [
      {
        url: "http://luxury-deals-outlet.shop/checkout",
        riskScore: 88,
        reasons: ["Suspicious top-level domain", "URL contains high-risk keywords"]
      },
      {
        url: "http://clearance-electronics-depot.xyz/verify",
        riskScore: 82,
        reasons: ["Domain format looks risky", "Site is not using HTTPS"]
      },
      {
        url: "http://designer-bags-flashsale.top/login",
        riskScore: 90,
        reasons: ["Suspicious top-level domain", "URL contains high-risk keywords"]
      },
      {
        url: "http://mega-sneaker-drops.zip/confirm",
        riskScore: 86,
        reasons: ["Suspicious top-level domain", "URL contains high-risk keywords"]
      },
      {
        url: "http://limited-homegoods-deals.click/verify",
        riskScore: 84,
        reasons: ["Suspicious top-level domain", "Site is not using HTTPS"]
      }
    ];

    const now = new Date();
    const userId = "seed-global";

    for (const sample of samples) {
      const parsed = normalizeUrl(sample.url);
      const urlHash = hashUrl(parsed.normalizedUrl);

      await SiteRiskCache.create({
        domain: parsed.domain,
        normalizedUrl: parsed.normalizedUrl,
        urlHash,
        riskScore: sample.riskScore,
        reasons: sample.reasons,
        checkedAt: now
      });

      await Scan.create({
        userId,
        domain: parsed.domain,
        urlHash,
        riskScore: sample.riskScore,
        confidence: 0.8,
        reasons: sample.reasons
      });

      await ScanEvent.create({
        userId,
        domain: parsed.domain,
        urlHash,
        timestamp: now
      });

      await RiskAssessment.create({
        userId,
        domain: parsed.domain,
        urlHash,
        riskScore: sample.riskScore,
        confidence: 0.8,
        detectionSignals: ["seed_sample"]
      });

      await Report.create({
        domain: parsed.domain,
        userId,
        reportType: "scam",
        type: "scam",
        category: "shopping",
        title: "Suspicious checkout flow",
        body: "Multiple red flags during checkout and payment.",
        publishStatus: "published"
      });

      await FlagEvent.create({
        userId,
        domain: parsed.domain,
        urlHash,
        flagType: "reported"
      });
    }

    await GlobalDomainReputation.create({
      domain: "luxury-deals-outlet.shop",
      totalReports: 3,
      scamReports: 3,
      falsePositiveReports: 0,
      aggregateRiskScore: 85,
      reportCountTotal: 3,
      reportCountScam: 3,
      reportCountFalsePositive: 0,
      score: 85,
      confidence: 0.7,
      updatedAt: now
    });

    await ScamIntel.create({
      domains: ["luxury-deals-outlet.shop", "clearance-electronics-depot.xyz"],
      vendors: ["unknown-seller-1"],
      aiGeneratedPatterns: ["template-urgent-discount"],
      duplicateReviewHashes: ["review-hash-a1", "review-hash-b2"],
      repeatedImageHashes: ["img-hash-1", "img-hash-2"],
      evidenceCount: 5,
      sources: ["seed"],
      lastSeenAt: now,
      updatedAt: now
    });

    await Event.create({
      userId,
      domain: "luxury-deals-outlet.shop",
      riskScoreBucket: "80-100",
      actionTaken: "reported",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });

    await mongoose.connection.close();
    console.log("Seeded shopping scam samples.");
  } catch (error) {
    console.error("Seed error", error);
    process.exit(1);
  }
};

seed();
