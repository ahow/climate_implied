import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFslrIssuerFiveYear } from "../server/calculation/issuerConditionalFiveYear";

const input = { sourceHash: "a".repeat(64), observedAt: "2026-11-10T12:00:00.000Z",
  frozenAt: "2026-11-10T12:00:00.000Z", firstYear: 2027 };
test("whole issuer paths reconcile cash/earnings, debt and single WC deduction", () => {
  const result = buildFslrIssuerFiveYear(input);
  for (const member of result.members) {
    assert.equal(member.years.length, 5);
    for (const row of member.years) {
      assert.ok(Math.abs(row.reconciliationResidual) < .00001);
      assert.equal(row.fcfe, row.operatingCashFlow - row.capex + row.netBorrowing);
      assert.equal(row.closingDebt, row.openingDebt + row.debtDraw - row.principalRepayment);
      assert.ok(Math.abs(row.customerCollections - (row.revenue - row.customerWorkingCapitalIncrease)) < .00001);
    }
  }
  assert.ok(result.stressMinusBaseFiveYearPv < 0);
  assert.equal(result.ownerApproved, false);
  assert.equal(result.productionEligible, false);
  assert.equal(result.definition.terminalValue, null);
});
test("credit removed once, working-capital shock occurs once, matched PV basis", () => {
  const { members: [base, stress] } = buildFslrIssuerFiveYear(input);
  assert.equal(base.years[0].grossProfit - stress.years[0].grossProfit, 1.0725e9);
  assert.ok(stress.years[0].customerWorkingCapitalIncrease > 0);
  assert.equal(stress.years[1].workingCapitalIncrease, 0);
  assert.equal(base.years[0].year, stress.years[0].year);
  assert.equal(base.years[4].year, 2031);
});
test("rejects future evidence, historical horizon and missing provenance", () => {
  assert.throws(() => buildFslrIssuerFiveYear({ ...input, frozenAt: "2026-11-09T12:00:00.000Z" }));
  assert.throws(() => buildFslrIssuerFiveYear({ ...input, firstYear: 2026 }));
  assert.throws(() => buildFslrIssuerFiveYear({ ...input, sourceHash: "" }));
});
