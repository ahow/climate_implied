import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCvQuery } from "../server/climateValuation/queryValidation";
import { buildBacktestResponse, type BacktestPoint } from "../shared/backtest";
import { impliedGrowthFromPE, convertAll } from "../server/climateValuation/decarbConversion";

test("TE accepts percentage points without heuristic conversion; omission is valid", () => {
  for (const trackingError of ["2", "0.02", "20", "2e-2"]) {
    assert.doesNotThrow(() => validateCvQuery("/backtest", { trackingError, trackingErrorUnit: "percent" }));
  }
  assert.doesNotThrow(() => validateCvQuery("/backtest", {}));
});

test("TE rejects malformed, ambiguous unit, duplicate and unsupported parameters", () => {
  for (const trackingError of ["", "NaN", "Infinity", "0", "-2", "20.1", "2junk", "2%", "0x02", ["2", "3"], {}]) {
    assert.throws(() => validateCvQuery("/backtest", { trackingError }));
  }
  for (const query of [
    { trackingErrorUnit: "decimal" }, { trackingErrorPct: "2" },
    { strategy: "valuation_aware" }, { costOfEquity: ".08" }, { format: "invalid" },
    { signal: "unknown" }, { signal: ["decarb_gap", "carbon_intensity"] },
  ]) assert.throws(() => validateCvQuery("/backtest", query));
  assert.throws(() => validateCvQuery("/BACKTEST/", { trackingError: "NaN" }));
  assert.throws(() => validateCvQuery("/decarb-gap/SUMMARY/", { costOfEquity: "0" }));
});

test("only gap backtests support peer-relative methods", () => {
  for (const signal of ["carbon_intensity", "sdg_exposure", "decarb_ambition"]) {
    assert.doesNotThrow(() => validateCvQuery("/backtest", { signal }));
    assert.doesNotThrow(() => validateCvQuery("/backtest", { signal, method: "absolute" }));
    for (const method of ["sector_relative", "sub_sector_relative", "industry_relative", "wrong"]) {
      assert.throws(() => validateCvQuery("/backtest", { signal, method }));
    }
  }
  for (const method of ["absolute", "sector_relative", "sub_sector_relative", "industry_relative"]) {
    assert.doesNotThrow(() => validateCvQuery("/backtest", { signal: "decarb_gap", method }));
  }
  assert.throws(() => validateCvQuery("/backtest", { signal: "decarb_gap", method: "wrong" }));
});

test("cost of equity and grouping validation is consistent", () => {
  for (const path of ["/sdg-growth", "/decarb-terciles", "/decarb-gap/summary", "/decarb-gap/timeseries"]) {
    for (const costOfEquity of ["0.07", "0.08", "0.09", "1"]) {
      assert.doesNotThrow(() => validateCvQuery(path, { costOfEquity }));
    }
    for (const costOfEquity of ["0", "-1", "1.1", "", "abc", "0.08bad", ["0.08", "0.09"]]) {
      assert.throws(() => validateCvQuery(path, { costOfEquity }));
    }
  }
  for (const path of ["/decarb-terciles", "/decarb-gap/summary", "/decarb-gap/timeseries"]) {
    assert.throws(() => validateCvQuery(path, { method: "invalid" }));
  }
  assert.throws(() => validateCvQuery("/decarb-bands", { costOfEquity: "0.08" }));
});

test("carbon-price requires a positive upload ID and explicit valid method", () => {
  const valid = { uploadId: "1", method: "sector_relative" };
  assert.doesNotThrow(() => validateCvQuery("/carbon-price", valid));
  for (const query of [
    {}, { uploadId: "1" }, { method: "absolute" },
    ...["1x", "0", "-1", "1.5", "NaN", "", ["1", "2"]].map(uploadId => ({ ...valid, uploadId })),
    { ...valid, method: "industry_relative" },
    { ...valid, winsorize: "yes" }, { ...valid, winsorizePercentile: "50" },
    { ...valid, includeScope3: "" }, { ...valid, inferenceMethod: "invalid" },
    { ...valid, geography: ["US", "EU"] },
  ]) assert.throws(() => validateCvQuery("/carbon-price", query));
});

const series: BacktestPoint[] = ["2020-01", "2020-02", "2020-03"].map(date => ({
  date, benchmarkReturn: 0, portfolioReturn: 0, benchmarkCumulative: 1,
  portfolioCumulative: 1, activeReturn: 0, trackingError: 0.0203,
  overweightCount: 1, underweightCount: 1,
}));

test("summary reports unrounded full-period TE, actual tilt and period without modifying series", () => {
  const result = buildBacktestResponse(series, 0.0203123456, 0.456, "carbon_intensity", "absolute", 2);
  assert.equal(result.series, series);
  assert.equal(result.summary.realizedTrackingErrorPct, 2.03123456);
  assert.equal(result.summary.tiltScale, 0.456);
  assert.equal(result.summary.calibrationStatus, "within_tolerance");
  assert.deepEqual(result.summary.calibrationPeriod, { start: "2020-01", end: "2020-03", months: 3 });
  assert.equal(result.summary.seriesTrackingErrorUnits, "decimal");
  assert.match(result.summary.warnings.join(" "), /not a point-in-time/);
  const small = buildBacktestResponse(series, 0.0002, 0.001, "decarb_gap", "sector_relative", 0.02);
  assert.equal(small.summary.targetTrackingErrorPct, 0.02);
  assert.equal(small.summary.realizedTrackingErrorPct, 0.02);
});

test("empty, short and zero-risk series do not claim successful calibration", () => {
  const empty = buildBacktestResponse([], 0, null, "decarb_gap", "sector_relative", 2);
  assert.equal(empty.summary.calibrationStatus, "insufficient_data");
  assert.equal(empty.summary.calibrationPeriod, null);
  assert.equal(empty.summary.realizedTrackingErrorPct, null);
  assert.equal(empty.summary.tiltScale, null);
  const short = buildBacktestResponse(series.slice(0, 2), 0, 1, "decarb_gap", "sector_relative", 2);
  assert.equal(short.summary.realizedTrackingErrorPct, null);
  const zero = buildBacktestResponse(series, 0, 1, "decarb_gap", "sector_relative", 2);
  assert.equal(zero.summary.calibrationStatus, "outside_tolerance");
});

test("uniform 7/8/9% cost of equity cancels from differential and conversion", () => {
  const diffs = [0.07, 0.08, 0.09].map(r => impliedGrowthFromPE(20, r) - impliedGrowthFromPE(10, r));
  for (const diff of diffs) assert.ok(Math.abs(diff - 0.05) < 1e-12);
  assert.deepEqual(convertAll(diffs[0] * 100), convertAll(diffs[2] * 100));
  assert.ok(impliedGrowthFromPE(2.54, 0.08) < impliedGrowthFromPE(20, 0.08));
});
