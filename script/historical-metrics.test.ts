import { test } from "node:test";
import assert from "node:assert/strict";
import { historicalTrajectoryMetrics } from "../server/calculation/historicalMetrics";
import { computeEmpiricalCarbonIntensityDeclineRate } from "../server/calculation/historicalIndicators";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
test("historical reduction uses annual CAGR and preserves threshold censoring", () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({ year: 2020 + i, p50: 100 * .98 ** i }));
  const result = historicalTrajectoryMetrics(rows);
  assert.ok(Math.abs(result.reductionRate - 2) < 1e-10);
  assert.equal(result.netZeroYear, null);
  rows[10].p50 = 0;
  assert.equal(historicalTrajectoryMetrics(rows).netZeroYear, 2030);
  assert.equal(historicalTrajectoryMetrics(rows).reductionRate, 100);
});
test("historical metrics reject missing/invalid trajectory instead of fallback numbers", () => {
  assert.throws(() => historicalTrajectoryMetrics([]));
  assert.throws(() => historicalTrajectoryMetrics(Array.from({ length: 11 }, (_, i) => ({ year: 2020 + i, p50: NaN }))));
});
test("future approved intensity observations cannot alter an earlier fitted rate", () => {
  const original = runWithOverrideRows([], () => computeEmpiricalCarbonIntensityDeclineRate(undefined, 2015));
  const changed = runWithOverrideRows([{ indicatorKey: "carbonIntensityKgPerGDP", year: 2024,
    value: .001, source: "fixture", method: "manual" }],
    () => computeEmpiricalCarbonIntensityDeclineRate(undefined, 2015));
  assert.equal(original, changed);
});
