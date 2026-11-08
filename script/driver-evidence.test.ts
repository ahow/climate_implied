import test from "node:test";
import assert from "node:assert/strict";
import { driverEvidenceRegistry, interpolateInterior } from "../server/calculation/driverEvidence";
test("driver registry accounts for all indicators without inventing calibration", () => {
  const rows = driverEvidenceRegistry();
  assert.equal(rows.length, 22);
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length);
  assert.ok(rows.every(r => r.reason && r.publisher && r.rawUnit && !r.centralModelEligible));
  assert.equal(rows.find(r => r.id === "policyImplementationRate")?.role, "context");
});
test("missingness interpolation preserves observed zeros and refuses extrapolation", () => {
  const rows = [{ year: 2020, value: 0 }, { year: 2021, value: null }, { year: 2022, value: 4 }];
  assert.equal(interpolateInterior(rows, 2020).value, 0);
  assert.equal(interpolateInterior(rows, 2021).value, 2);
  assert.equal(interpolateInterior(rows, 2021).infilled, true);
  assert.equal(interpolateInterior(rows, 2019).value, null);
  assert.throws(() => interpolateInterior([{ year: 2020, value: NaN }], 2020));
});
