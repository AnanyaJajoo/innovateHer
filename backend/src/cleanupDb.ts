import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "./db.js";
import { Event } from "./models/Event.js";
import { GlobalDomainReputation } from "./models/GlobalDomainReputation.js";
import { Report } from "./models/Report.js";
import { Scan } from "./models/Scan.js";
import { SiteRiskCache } from "./models/SiteRiskCache.js";
import { ScanEvent } from "./models/ScanEvent.js";
import { RiskAssessment } from "./models/RiskAssessment.js";
import { FlagEvent } from "./models/FlagEvent.js";
import { ScamIntel } from "./models/ScamIntel.js";

dotenv.config();

const cleanup = async () => {
  try {
    await connectDb();
    await Promise.all([
      Event.deleteMany({}),
      GlobalDomainReputation.deleteMany({}),
      Report.deleteMany({}),
      Scan.deleteMany({}),
      SiteRiskCache.deleteMany({}),
      ScanEvent.deleteMany({}),
      RiskAssessment.deleteMany({}),
      FlagEvent.deleteMany({}),
      ScamIntel.deleteMany({})
    ]);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("cleanup error", error);
    process.exit(1);
  }
};

cleanup();
