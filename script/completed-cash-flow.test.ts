import { test } from "node:test";
import assert from "node:assert/strict";
import { completedCashFlowOutcomes } from "../server/financialData/completedCashFlow";
const row = (year: number) => ({ date: `${year}-12-31`, symbol: "TEST", period: "FY",
  reportedCurrency: "USD", operatingCashFlow: 120, capitalExpenditure: -30, netDebtIssuance: 10 });
test("completed FCFE outcomes use OCF without deducting working capital twice", () => {
  const result = completedCashFlowOutcomes([row(2020), { ...row(2023), operatingCashFlow: 353.1 }]);
  const first = result.results[0];
  assert.equal(first.status, "completed-outcome");
  if (first.status === "completed-outcome") {
    assert.equal(first.baseFcfe, 100);
    assert.ok(Math.abs(first.threeYearCagr - ((333.1 / 100) ** (1 / 3) - 1)) < 1e-12);
  }
  assert.equal(result.results[1].status, "unavailable");
});
test("outcomes reject duplicate, mixed issuer and wrong capex sign; preserve exclusions", () => {
  assert.throws(() => completedCashFlowOutcomes([row(2020), row(2020)]), /Duplicate/);
  assert.throws(() => completedCashFlowOutcomes([row(2020), { ...row(2023), symbol: "OTHER" }]), /Mixed/);
  assert.throws(() => completedCashFlowOutcomes([{ ...row(2020), capitalExpenditure: 30 }]));
  for (const end of [{ ...row(2023), reportedCurrency: "GBP" }, { ...row(2023), operatingCashFlow: 0 }]) {
    assert.equal(completedCashFlowOutcomes([row(2020), end]).results[0].status, "unavailable");
  }
});
