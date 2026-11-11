import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCarbonIntensity, computeAnnualDecarbRate } from "../server/climateValuation/sharedUtils";
import { impliedGrowthFromPE } from "../server/climateValuation/decarbConversion";
import { verifiedSyntheticPE as positivePE } from "./fixtures/verifiedSyntheticMoney";
import { reverseCashFlowGrowth } from "../server/calculation/cashFlowValuation";
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
test("S11-040 positive earnings Gordon fixture executes actual solver at the actual r", () => {
  const pe = positivePE({ priceEarnings: null, marketCap: 1000, netProfit: 50 });
  assert.equal(pe, 20);
  for (const r of [.08, .095, .12])
    assert.equal(impliedGrowthFromPE(pe!, r), r - 50 / 1000);
});
for (const [name, earnings] of [["negative", -50], ["zero", 0], ["missing", null]] as const) {
  test(`S11-040 ${name} earnings Gordon fixture never becomes zero earnings or a growth result`, () => {
    const pe = positivePE({ priceEarnings: null, marketCap: 1000, netProfit: earnings });
    assert.equal(pe, null);
    // Execute the actual solver, not just the preceding P/E validator.
    assert.throws(() => impliedGrowthFromPE(pe as unknown as number, .095), /positive|finite/i);
    if (name === "missing")
      assert.throws(() => impliedGrowthFromPE(undefined as unknown as number, .095), /positive|finite/i);
  });
}
test("S11-040 financial-sector method fixture explicitly refuses an unvalidated model", () => {
  const result = reverseCashFlowGrowth({ baseCashFlow: 100, marketCap: 1000,
    discountRate: .095, terminalGrowth: .03, basis: "FCFE", discountBasis: "cost-of-equity",
    businessType: "financial", cashFlowCurrency: "USD", valuationCurrency: "USD",
    minimumGrowth: -.5, maximumGrowth: .5 });
  assert.equal(result.status, "not-modelled");
  assert.match(result.reason!, /Financial institutions.*separately validated residual-income model/);
  assert.ok(!("growth" in result), "Permitted refusal must not manufacture a financial-sector Gordon/DCF result");
});
