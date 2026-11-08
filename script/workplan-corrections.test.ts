import test from "node:test";
import assert from "node:assert/strict";
import { fcfeFromOperatingCashFlow, fcfeFromEarnings, pairedGrowthGap,
  summarizeNetZeroYears, valuationScenarioEligibility } from "../server/calculation/researchCorrections";

test("reported OCF never deducts working capital twice", () => {
  assert.equal(fcfeFromOperatingCashFlow({ operatingCashFlow: 100, capex: 30, netBorrowing: 10 }), 80);
  assert.equal(fcfeFromEarnings({ netIncome: 90, nonCashCharges: 30,
    increaseWorkingCapital: 20, capex: 30, netBorrowing: 10 }), 80);
  assert.throws(() => fcfeFromOperatingCashFlow({ operatingCashFlow: NaN, capex: 0, netBorrowing: 0 }));
});
test("net-zero quantiles never turn censored members into 2100 events", () => {
  const r = summarizeNetZeroYears([2040, 2050, null, null, null], 2100);
  assert.equal(r.median, null);
  assert.equal(r.probabilityBy2050, .4);
  assert.equal(r.neverReachedShare, .6);
  assert.equal(r.conditionalOnReaching.median, 2040);
  assert.equal(summarizeNetZeroYears([null, null], 2100).conditionalOnReaching.median, null);
  assert.throws(() => summarizeNetZeroYears([2101], 2100));
  assert.throws(() => summarizeNetZeroYears([], 2100));
});
test("paired gap is not a difference of marginal medians", () => {
  const definition = { basis: "fcfe", horizonYears: 5, currency: "USD", nominal: true };
  const r = pairedGrowthGap(
    [{ id: "a", value: 0 }, { id: "b", value: 10 }, { id: "c", value: 11 }],
    [{ id: "c", value: 0 }, { id: "a", value: 0 }, { id: "b", value: 100 }],
    definition, definition);
  assert.equal(r.median, 0);
  assert.deepEqual(r.members.map(x => x.value), [0, -90, 11]);
  assert.throws(() => pairedGrowthGap([{ id: "a", value: 1 }], [{ id: "b", value: 1 }], definition, definition));
  assert.throws(() => pairedGrowthGap([{ id: "a", value: 1 }], [{ id: "a", value: 1 }],
    definition, { ...definition, horizonYears: 15 }));
});
test("robustness does not manufacture identification or a global scenario", () => {
  assert.equal(valuationScenarioEligibility({ mappingEvidence: [], expansionEvidence: [], identificationEvidence: [] }).tier1, "unavailable");
  const r = valuationScenarioEligibility({ mappingEvidence: ["reviewed mapping"], expansionEvidence: [], identificationEvidence: [] });
  assert.equal(r.tier1, "conditional-covered-universe");
  assert.equal(r.globalExpansion, "unavailable");
  assert.equal(r.marketExpectationClaim, false);
  assert.equal(valuationScenarioEligibility({ mappingEvidence: ["m"], expansionEvidence: ["e"], identificationEvidence: ["declared evidence"] }).marketExpectationClaim, false);
});
