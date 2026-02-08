import assert from "node:assert/strict";
import { computeScamWebsitesVisited } from "../services/metrics";

const run = () => {
  const result = computeScamWebsitesVisited([
    { domain: "a.com", urlHash: "h1", riskScore: 85 },
    { domain: "a.com", urlHash: "h2", riskScore: 90 },
    { domain: "b.com", urlHash: "h3", riskScore: 70 },
    { domain: "c.com", urlHash: "h4", riskScore: 95 }
  ]);

  assert.equal(result.scamWebsitesVisited, 2);
  assert.equal(result.highRiskUrlHashes.length, 3);
};

try {
  run();
  console.log("scamWebsitesVisited.test.ts passed");
} catch (error) {
  console.error("scamWebsitesVisited.test.ts failed", error);
  process.exit(1);
}
