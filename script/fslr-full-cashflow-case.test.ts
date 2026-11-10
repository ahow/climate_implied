import assert from "node:assert/strict";
import { freezeFslrFullCashflowAssumptions, calculateFslrFrozenFullCashflow } from "../server/calculation/fslrFullCashflowCase";
import { calculateCompanyFullCashflowCase } from "../server/calculation/companyFullCashflowCase";

// Source-independent engineering tests; private primary-byte/row checks live in the runner/validator.
const freeze = freezeFslrFullCashflowAssumptions({ sourceHash: "a".repeat(64),
  sourceCapturedAt: "2026-11-10T06:00:00.000Z", policySourceHash: "b".repeat(64),
  policyCapturedAt: "2026-11-10T07:00:00.000Z", frozenAt: "2026-11-10T10:00:00.000Z", firstYear: 2027 });
const report = calculateFslrFrozenFullCashflow(freeze);
assert.equal(report.cashSchedulesExecuted, 10);
assert.equal(report.annualRowsExecuted, 50);
for (const c of report.cases) {
  assert.equal(c.ledger.years.length, 5);
  assert.equal(c.ledger.terminalModelStatus, "withheld-no-justified-terminal-basis");
  for (let i = 0; i < 5; i++) {
    const y = c.ledger.years[i], d = c.diagnostics[i];
    assert.ok(Math.abs(c.reconciliations[i].residual) < 1e-5);
    assert.equal(y.fcfe, y.operatingCashFlow - y.capitalSpend + y.debtProceeds - y.debtRepayments);
    assert.ok(Math.abs(d.closingDebt - (d.openingDebt + y.debtProceeds - y.debtRepayments)) < 1e-6);
    assert.ok(Math.abs(d.grossCreditCash - (y.recognizedPolicyCredit - d.creditWorkingCapitalIncrease)) < 1e-6);
    assert.equal(y.increaseOtherOperatingWorkingCapital, d.inventoryWorkingCapitalIncrease);
    assert.ok(Math.abs(y.collections - (y.revenue - y.receivablesIncrease)) < 1e-6);
  }
}
const [base, stress] = report.cases;
assert.ok(stress.cumulativeFiveYearFcfe < base.cumulativeFiveYearFcfe);
assert.ok(stress.ledger.years[0].fcfe < 0, "Initial stressed loss retained, not forced positive");
assert.equal(stress.ledger.years[1].receivablesIncrease, 0);
assert.equal(stress.ledger.years[1].increaseOtherOperatingWorkingCapital, 0);
assert.equal(stress.diagnostics[3].closingDebt, 0);
assert.equal(report.terminalValue, null);
assert.equal(report.actualMarketPairs, 0);
assert.equal(report.completeApprovedIssuerCases, 0);
assert.deepEqual(base.diagnostics.map(d => d.statutoryCreditPhaseDown), [1, 1, 1, .75, .5]);
assert.equal(base.ledger.years[3].recognizedPolicyCredit, freeze.annualNominalAnchor.recognizedCredit * .75);
assert.equal(stress.ledger.years[4].recognizedPolicyCredit, freeze.annualNominalAnchor.recognizedCredit * .5 * .5);
assert.throws(() => calculateFslrFrozenFullCashflow({ ...freeze, base: { ...freeze.base, cashTaxRate: .01 } }), /differs/);
assert.throws(() => calculateFslrFrozenFullCashflow({ ...freeze, scenarios: freeze.scenarios.map((s, i) =>
  i === 0 ? { ...s, cashCreditHaircut: .01 } : s) }), /differs/);
assert.throws(() => freezeFslrFullCashflowAssumptions({ ...freeze.provenance, firstYear: 2026 }), /greater than or equal to 2027/);
assert.throws(() => freezeFslrFullCashflowAssumptions({ ...freeze.provenance, frozenAt: "2027-01-01T00:00:00.000Z", firstYear: 2027 }), /Prospective/);
const partialTerminal = { ...base.engineInput, discountRate: .08 };
assert.throws(() => calculateCompanyFullCashflowCase(partialTerminal), /all justified terminal/);
console.log("FSLR technical case: ten frozen scenario schedules/50 annual rows, cash/earnings/debt/collections/credit-WC reconciliations, negative stress preservation and terminal withholding passed; no private inputs/skips.");
