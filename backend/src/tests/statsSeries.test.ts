import assert from "node:assert/strict";
import { buildStatsSeries } from "../services/statsSeries";

const days = 3;
const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const day0 = new Date(today);
day0.setUTCDate(today.getUTCDate() - 2);
const day1 = new Date(today);
day1.setUTCDate(today.getUTCDate() - 1);
const day2 = new Date(today);

const assessments = [
  { createdAt: day0, riskScore: 90, domain: "a.com", userId: "user-a" },
  { createdAt: day1, riskScore: 85, domain: "b.com", userId: "user-b" },
  { createdAt: day2, riskScore: 95, domain: "c.com", userId: "user-b" }
];

const events = [];
const scans = [
  { createdAt: day0, domain: "a.com", userId: "user-a" },
  { createdAt: day1, domain: "b.com", userId: "user-b" },
  { createdAt: day2, domain: "c.com", userId: "user-b" }
];
const caches = [
  { checkedAt: day0, domain: "a.com" },
  { checkedAt: day1, domain: "b.com" },
  { checkedAt: day2, domain: "c.com" }
];

const run = () => {
  const globalSeries = buildStatsSeries({
    scope: "global",
    days,
    assessments,
    events,
    scans,
    caches
  });

  const userSeries = buildStatsSeries({
    scope: "user",
    days,
    userId: "user-a",
    assessments,
    events,
    scans,
    caches
  });

  const globalLast = globalSeries[globalSeries.length - 1];
  const userLast = userSeries[userSeries.length - 1];

  assert.ok(globalLast.cumulativeEvents! >= userLast.cumulativeEvents!);
  assert.equal(userLast.cumulativeEvents, 1);
  assert.equal(globalLast.cumulativeEvents, 3);

  let prev = -1;
  for (const entry of globalSeries) {
    assert.ok(entry.cumulativeEvents! >= prev);
    prev = entry.cumulativeEvents!;
  }
};

try {
  run();
  console.log("statsSeries.test.ts passed");
} catch (error) {
  console.error("statsSeries.test.ts failed", error);
  process.exit(1);
}
