import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStatementHistory } from "../server/financialData/statementHistory";
const base = { symbol: "FIX", date: "2024-12-31", filingDate: "2025-03-01", period: "FY", reportedCurrency: "USD" };
const cash = { ...base, operatingCashFlow: 100, capitalExpenditure: -30, netDebtIssuance: 10, changeInWorkingCapital: -20 };
const balance = { ...base, totalDebt: 80, cashAndCashEquivalents: 10, netDebt: 70, totalStockholdersEquity: 100 };
test("annual cash-flow history avoids double working-capital deduction and reconciles debt", () => {
  const [row] = normalizeStatementHistory([cash], [balance], "FIX", "USD");
  assert.equal(row.fcfe, 80); assert.equal(row.netDebt, 70);
  assert.equal(row.status, "components-reconciled-not-approved");
  assert.equal(row.pointInTimeEligible, false);
});
test("unknown components, currency mismatch, sign errors and publication proxies remain explicit", () => {
  const [missing] = normalizeStatementHistory([{ ...cash, netDebtIssuance: null, filingDate: base.date }], [balance], "FIX", "EUR");
  assert.equal(missing.fcfe, null); assert.equal(missing.valuationEligible, false);
  assert.match(missing.publicationStatus, /proxy/);
  const [sign] = normalizeStatementHistory([{ ...cash, capitalExpenditure: 30 }], [balance], "FIX", "USD");
  assert.equal(sign.fcfe, null);
  assert.throws(() => normalizeStatementHistory([cash, cash], [balance], "FIX", "USD"));
});
