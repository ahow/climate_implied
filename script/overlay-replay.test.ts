import test from "node:test";
import assert from "node:assert/strict";
import { applyOverlays, packOverlay } from "../server/snapshots/overlayContract";
import { historicalRequestPolicy } from "../server/snapshots/requestContract";
const baseline = { companies: [{ id: 1, sdgAlignmentScore: null }], timeSeries: [
  { companyId: 1, date: new Date("2020-01-31"), marketCap: 10, scope1Emissions: null },
] } as any;
const entry = (field: string, value: number | null, kind: string) => ({
  companyId: 1, observationDate: "2020-01-31", availableAt: "2020-02-15",
  field, value, kind, unit: kind === "financial" ? "USD million" : kind === "carbon" ? "tCO2e" : "score",
  source: "synthetic development fixture", approvalEvidence: "synthetic-only-not-real-approval",
  historyBasis: "revised-history",
});
test("ordered overlays preserve originals, zero and cutoff, reject orphan and wrong units", () => {
  const a = packOverlay([entry("marketCap", 20, "financial")]);
  const b = packOverlay([entry("marketCap", 30, "financial"), entry("scope1Emissions", 0, "carbon")]);
  const result = applyOverlays(baseline, [a.payload, b.payload], "2020-03-01");
  assert.equal(result.timeSeries[0].marketCap, 30);
  assert.equal(result.timeSeries[0].scope1Emissions, 0);
  assert.equal(baseline.timeSeries[0].marketCap, 10);
  assert.throws(() => applyOverlays(baseline, [a.payload], "2020-02-01"), /cutoff/);
  assert.throws(() => applyOverlays(baseline, [packOverlay([{ ...entry("marketCap", 1, "financial"), companyId: 9 }]).payload], "2021-01-01"));
  assert.throws(() => packOverlay([{ ...entry("marketCap", 1, "financial"), unit: "GBP" }]));
});
test("all three material company overlay types and null remain explicit", () => {
  const packed = packOverlay([entry("marketCap", null, "financial"),
    entry("scope1Emissions", 0, "carbon"), entry("sdgAlignmentScore", 3, "sdg")]);
  const result = applyOverlays(baseline, [packed.payload], "2020-03-01");
  assert.equal(result.timeSeries[0].marketCap, null);
  assert.equal(result.companies[0].sdgAlignmentScore, 3);
  assert.equal(packOverlay([...packed.payload.entries].reverse()).id, packed.id);
  assert.throws(() => packOverlay([entry("marketCap", 1, "financial"), entry("marketCap", 2, "financial")]));
});
test("unavailable or unsupported overlay selectors cannot fall through to current data", () => {
  const id = "a".repeat(64);
  assert.throws(() => historicalRequestPolicy("/projection", { overlaySnapshotIds: id, asOf: "2020-01-01" }));
  assert.throws(() => historicalRequestPolicy("/cv/summary", { snapshotId: id, overlaySnapshotIds: id }));
  assert.throws(() => historicalRequestPolicy("/cv/summary", { snapshotId: id, overlaySnapshotIds: id, asOf: "2020-02-31" }));
  assert.throws(() => historicalRequestPolicy("/analysis/results/x", { overlaySnapshotIds: id, asOf: "2020-01-01" }));
  assert.equal(historicalRequestPolicy("/cv/summary", {
    snapshotId: id, overlaySnapshotIds: id, asOf: "2020-01-01",
  }).readsWorkbook, true);
});
