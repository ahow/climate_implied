/** Actual retained private input; read-only performance comparison, no database. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { unpackDataset } from "../server/snapshots/contract";
import { loadSnapshot, runWithReplayWorkbook } from "../server/snapshots/store";
if (process.env.NODE_ENV !== "development" || process.env.DATABASE_URL)
  throw new Error("Explicit DEV with DATABASE_URL removed required");
const captured = JSON.parse(readFileSync(process.argv[2], "utf8"));
const iterations = 2;
let started = performance.now();
let oldPopulation = 0;
for (let i = 0; i < iterations; i++) {
  const data = unpackDataset(captured.workbook.id, structuredClone(captured.workbook.chunks));
  oldPopulation = data.timeSeries.length;
}
const repeatedHashAndDecodeMs = Math.round(performance.now() - started);
started = performance.now();
await runWithReplayWorkbook(captured.workbook, async () => {
  const setupMs = Math.round(performance.now() - started);
  started = performance.now();
  for (let i = 0; i < iterations; i++) {
    const data = await loadSnapshot(captured.header);
    assert.equal(data.timeSeries.length, oldPopulation);
    assert.equal(data.companies.length, captured.header.companyCount);
  }
  console.log(JSON.stringify({
    input: process.argv[2], rows: oldPopulation, iterations,
    oldRepeatedHashAndDecodeMs: repeatedHashAndDecodeMs,
    newOneTimeValidationSetupMs: setupMs,
    newDetachedReadsMs: Math.round(performance.now() - started),
    meaning: "Same retained workbook/host. Former loadSnapshot cloned chunks and canonical-hashed the entire workbook on every calculator; new private scope validates once and returns detached rows/dates.",
    databaseQueries: 0, sourceWrites: 0,
  }));
});
