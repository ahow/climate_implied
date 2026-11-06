import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCarbonIntensity, computeAnnualDecarbRate } from "../server/climateValuation/sharedUtils";
import { impliedGrowthFromPE } from "../server/climateValuation/decarbConversion";
test("missing emissions are unavailable, while observed zero emissions remain zero", () => {
  assert.equal(calculateCarbonIntensity(null, 2, null, 100, false), null);
  assert.equal(calculateCarbonIntensity(0, 0, null, 100, false), 0);
  assert.equal(calculateCarbonIntensity(1, 2, null, 100, true), null);
  assert.equal(calculateCarbonIntensity(1, 2, 3, 100, true), .06);
  assert.equal(calculateCarbonIntensity(1, 2, 3, Infinity, true), null);
});
test("target annualization requires a base year and preserves signed changes", () => {
  assert.equal(computeAnnualDecarbRate(-.5), null);
  assert.ok(Math.abs(computeAnnualDecarbRate(-.5, 2020)! - (1 - Math.pow(.5, 1 / 30)) * 100) < 1e-12);
  assert.ok(computeAnnualDecarbRate(.5, 2020)! < 0);
  assert.equal(computeAnnualDecarbRate(-1, 2020), null);
  assert.equal(computeAnnualDecarbRate(-.5, 2051), null);
});
test("invalid valuations never silently become zero-growth companies", () => {
  for (const pe of [0, -1, NaN, Infinity]) assert.throws(() => impliedGrowthFromPE(pe, .08));
  assert.equal(impliedGrowthFromPE(20, .08), .03);
});
