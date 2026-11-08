import test from "node:test";
import assert from "node:assert/strict";
import { cashFlowValue, reverseCashFlowGrowth } from "../server/calculation/cashFlowValuation";
const base = { baseCashFlow: 100, marketCap: 1000, discountRate: .1, terminalGrowth: 0,
  basis: "FCFE", discountBasis: "cost-of-equity", businessType: "non-financial",
  cashFlowCurrency: "USD", valuationCurrency: "USD" };
test("cash-flow DCF recovers a perpetuity and its known growth without a payout shortcut", () => {
  const value = cashFlowValue({ ...base, stageOneGrowth: 0 });
  assert.equal(value.status, "conditional-value");
  if ("equityValue" in value) assert.ok(Math.abs(value.equityValue - 1000) < 1e-8);
  const solution = reverseCashFlowGrowth({ ...base, minimumGrowth: -.5, maximumGrowth: .5 });
  assert.equal(solution.status, "conditional-solution");
  if ("growth" in solution) { assert.ok(Math.abs(solution.growth) < 1e-10); assert.ok(Math.abs(solution.relativeRepricingError) < 1e-10); }
});
test("FCFF enterprise/equity bridge is explicit and never applied to FCFE", () => {
  const input = { ...base, basis: "FCFF", discountBasis: "WACC", marketCap: 800,
    netDebt: 150, minorityInterest: 30, preferredEquity: 20, stageOneGrowth: 0 };
  const value = cashFlowValue(input);
  if ("equityValue" in value) assert.ok(Math.abs(value.equityValue - 800) < 1e-8); else assert.fail();
  assert.throws(() => cashFlowValue({ ...input, netDebt: undefined }));
  assert.throws(() => cashFlowValue({ ...input, discountBasis: "cost-of-equity" }));
  assert.throws(() => cashFlowValue({ ...input, valuationCurrency: "EUR" }));
});
test("loss-making, financial and unbracketed companies are not forced into a solution", () => {
  assert.equal(cashFlowValue({ ...base, baseCashFlow: -1, stageOneGrowth: 0 }).status, "not-modelled");
  assert.equal(cashFlowValue({ ...base, businessType: "financial", stageOneGrowth: 0 }).status, "not-modelled");
  assert.equal(reverseCashFlowGrowth({ ...base, marketCap: 1e12, minimumGrowth: -.1, maximumGrowth: .1 }).status, "not-modelled");
});
