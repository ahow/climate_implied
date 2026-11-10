import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleReturnObservations, compareReturnObservation } from "../server/calculation/returnQuality";
const isin = "US0378331005";
const thresholds = { numericalAbsoluteReturn: .0001, materialAbsoluteReturn: .001 };
const sample = { isin, from: "2020-01-02", to: "2020-01-03", start: 100, end: 110 };
const day = (date: string, close: number, splitRatio = 1, cashDividend = 0) =>
  ({ date, close, splitRatio, cashDividend, shareBasis: "post-split-ex-date" as const });
test("full population draw is order-independent and keeps invalid observed levels", () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({ isin,
    date: new Date(Date.UTC(2010, i, 1)).toISOString().slice(0, 10), value: i % 3 === 0 ? -1 : i + 1 }));
  const a = sampleReturnObservations(rows, "2026-01-22", 50, 20261110);
  assert.equal(a.populationCount, 79); assert.equal(a.sample.length, 50);
  assert.deepEqual(a, sampleReturnObservations([...rows].reverse(), "2026-01-22", 50, 20261110));
  assert.ok(a.sample.some(s => s.start < 0 || s.end < 0));
  assert.throws(() => sampleReturnObservations([...rows, rows[0]], "2026-01-22", 50, 1), /Duplicate/);
});
test("split and raw dividend chain reconciles to reinvested unadjusted prices", () => {
  const r = compareReturnObservation(sample, [day(sample.from, 100), day(sample.to, 54, 2, 1)], thresholds);
  assert.equal(r.status, "computed"); if (r.status !== "computed") throw new Error("Expected computed");
  assert.ok(r.absoluteDifference < 1e-14); assert.equal(r.materialBreak, false);
  const bad = compareReturnObservation(sample, [day(sample.from, 100), day(sample.to, 54, 1, 0)], thresholds);
  assert.equal(bad.status, "computed"); if (bad.status === "computed") assert.equal(bad.materialBreak, true);
});
test("missing exact dates, unresolved units and invalid indices never become passes", () => {
  assert.equal(compareReturnObservation(sample, [day("2020-01-01", 100), day(sample.to, 110)], thresholds).status, "unavailable");
  assert.equal(compareReturnObservation(sample, [day(sample.from, 100), { ...day(sample.to, 54, 2, 1), shareBasis: "unknown" }], thresholds).status, "unavailable");
  assert.equal(compareReturnObservation({ ...sample, start: 0 }, [], thresholds).status, "invalid-index");
  assert.throws(() => compareReturnObservation(sample, [day(sample.from, 100), day(sample.from, 110), day(sample.to, 110)], thresholds), /unordered/);
});
