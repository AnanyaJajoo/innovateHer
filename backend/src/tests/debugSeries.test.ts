import assert from "node:assert/strict";
import { buildDebugSeries } from "../services/debugSeries";

const run = () => {
  const seriesA = buildDebugSeries({ days: 31, points: 2000, seed: "test-seed" });
  const seriesB = buildDebugSeries({ days: 31, points: 2000, seed: "test-seed" });

  assert.ok(seriesA.length >= 2000);
  assert.equal(seriesA.length, seriesB.length);
  assert.deepEqual(seriesA.slice(0, 3), seriesB.slice(0, 3));
};

try {
  run();
  console.log("debugSeries.test.ts passed");
} catch (error) {
  console.error("debugSeries.test.ts failed", error);
  process.exit(1);
}
