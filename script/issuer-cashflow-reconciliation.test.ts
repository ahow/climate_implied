import assert from "node:assert/strict";
import test from "node:test";
import { calculateIssuerFundingConstraints, reviewIssuerActivityPolicy,
  type IssuerReconciliation } from "../server/calculation/issuerCashflowReconciliation";

// Engineering-only source-shape fixture. Authentic issuer lines are checked by
// validate-issuer-cashflow-reconciliation-private.ts, never substituted by this.
const fixture = (symbol: string): IssuerReconciliation => ({
  identity: { symbol, cik: "0000000001", security: "Synthetic common", fiscalEnd: "2024-12-31" },
  normalized: { operatingProfit: 80, depreciation: 20, otherCash: 2, interest: 5, claims: 7,
    corporateCapex: 1, fundNet: 2, otherInvesting: 1, reinvestment: 30, cashTax: 10,
    affiliateCash: 2, historicalOtherWcIncrease: -3, cashAndSecurities: 40, operatingCashReserve: 40,
    excessCash: 0, debt: 60, legacyGrant: 4, noncurrentGrantReceivable: 2 },
  capitalBudgets: [150, 140, 130, 120, 110], allocation: [], rows: [], residuals: {},
  historical: { cfo: 0, cfi: 0, cff: 0, fx: 0, cashOpen: 0, cashClose: 0, cashChange: 0,
    unrestrictedCash: 0, operatingReconciliation: [], investingReconciliation: [], financingReconciliation: [] },
  sourceAuthentication: "Synthetic engineering fixture only",
});

test("Source-approved budgets produce explicit funding deficits, never an invented project-return recovery", () => {
  const constraints = calculateIssuerFundingConstraints(fixture("NEE"));
  assert.ok("budgetYears" in constraints);
  assert.equal(constraints.annualBeforeTaxCashRunRateBeforeNewInvestment, 90);
  assert.equal(constraints.budgetYears![0].budgetLessBeforeTaxRunRate, 64);
  assert.deepEqual(constraints.requiredTerminalGrowthRange, [.025, .04]);
  assert.match(constraints.terminalAssessment, /WITHHELD/);
  assert.equal("forwardWholeEquity" in constraints, false);
});

test("Positive reconciled common cash does not qualify original growth or create a CCS tariff", () => {
  const constraints = calculateIssuerFundingConstraints(fixture("XOM"));
  assert.equal(constraints.annualSourceLevelCommonCashBeforeGrowth, 50);
  assert.match(constraints.terminalAssessment, /WITHHELD/);
  const activity = reviewIssuerActivityPolicy("Engineering fixture: 6.7; 900 miles; Gulf Coast; pipeline tariff.",
    fixture("XOM").identity);
  assert.ok("tariffUsdPerTonne" in activity.channels[0]);
  assert.equal(activity.channels[0].tariffUsdPerTonne, null);
  assert.equal(activity.qualifiedOriginalMarketPairs, 0);
});

test("Cash reserve remains conditional and FCFE does not receive a second net-debt deduction", () => {
  const constraints = calculateIssuerFundingConstraints(fixture("FSLR"));
  assert.ok("conditionalCashReserve" in constraints);
  assert.equal(constraints.conditionalCashReserve!.observedExcessCash, null);
  assert.equal(constraints.debt!.secondNetDebtSubtraction, 0);
  assert.equal(constraints.debt!.futureRolloverAvailabilityVerified, false);
  assert.match(constraints.terminalAssessment, /2.5–4%/);
});

test("Policy review fails on absent primary topic locators instead of asserting automatic climate attribution", () => {
  assert.throws(() => reviewIssuerActivityPolicy("Engineering unrelated disclosure", fixture("NEE").identity),
    /locator missing/);
  assert.throws(() => reviewIssuerActivityPolicy("Engineering unrelated disclosure", fixture("XOM").identity),
    /locator missing/);
});
