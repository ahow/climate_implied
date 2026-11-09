import test from "node:test";
import assert from "node:assert/strict";
import { reconcileCompanyBaseline } from "../server/financialData/companyBaseline";
const common = { symbol: "TEST", date: "2024-12-31", period: "FY", reportedCurrency: "USD" };
const income = { ...common, revenue: 1000, operatingIncome: 200, incomeBeforeTax: 190,
  incomeTaxExpense: 38, interestExpense: 20, netIncome: 155 };
const cash = { ...common, netIncome: 152, depreciationAndAmortization: 30,
  operatingCashFlow: 180, capitalExpenditure: -50, netDebtIssuance: 10, changeInWorkingCapital: -12 };
test("baseline bridge preserves other income and cash adjustments without double-counting working capital", () => {
  const x = reconcileCompanyBaseline(income, cash);
  assert.equal(x.nonOperatingIncome, 10);
  assert.equal(x.increaseWorkingCapital, 12);
  assert.equal(x.otherCashAdjustments, 10);
  assert.equal(x.baseFcfe, 140);
  assert.equal(x.statementNetIncomeDifference, 3);
  assert.equal(x.cashFlowReconciliationResidual, 0);
  assert.equal(x.productionEligible, false);
  assert.equal(reconcileCompanyBaseline(income, { ...cash, changeInWorkingCapital: 12 }).baseFcfe, 140);
  assert.equal(reconcileCompanyBaseline(income, { ...cash, netDebtIssuance: -1000 }).positiveFcfe, false);
});
test("statement mismatches and missing components fail rather than substitute zero", () => {
  for (const override of [{ symbol: "OTHER" }, { date: "2023-12-31" }, { reportedCurrency: "EUR" },
    { period: "Q4" }, { netDebtIssuance: undefined }, { capitalExpenditure: 50 }])
    assert.throws(() => reconcileCompanyBaseline(income, { ...cash, ...override }));
});
