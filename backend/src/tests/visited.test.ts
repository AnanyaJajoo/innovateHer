import assert from "node:assert/strict";
import { filterVisited, sortVisited, VisitedSource } from "../routes/visited";

const run = () => {
  const entries: VisitedSource[] = [
    {
      userId: "u1",
      domain: "a.com",
      urlHash: "1",
      timestamp: new Date("2026-02-01T10:00:00Z")
    },
    {
      userId: "u2",
      domain: "b.com",
      urlHash: "2",
      timestamp: new Date("2026-02-01T11:00:00Z")
    },
    {
      userId: "u1",
      domain: "c.com",
      urlHash: "3",
      timestamp: new Date("2026-02-01T12:00:00Z")
    }
  ];

  const filtered = filterVisited(entries, "u1");
  assert.equal(filtered.length, 2);

  const sorted = sortVisited(filtered, 10);
  assert.equal(sorted[0].domain, "c.com");
  assert.equal(sorted[1].domain, "a.com");
};

try {
  run();
  console.log("visited.test.ts passed");
} catch (error) {
  console.error("visited.test.ts failed", error);
  process.exit(1);
}
