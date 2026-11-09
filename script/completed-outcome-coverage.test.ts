import test from "node:test";
import assert from "node:assert/strict";
import { completedOutcomeCoverage } from "../server/financialData/completedCashFlow";
test("outcome coverage counts supplied issuers, completed observations and exclusions without claiming D8 readiness", () => {
  const report = completedOutcomeCoverage([
    { symbol: "A", results: [
      { origin: "2020-12-31", status: "completed-outcome" },
      { origin: "2021-12-31", status: "unavailable" },
    ] },
    { symbol: "B", results: [{ origin: "2020-06-30", status: "completed-outcome" }] },
  ]);
  assert.equal(report.issuers, 2);
  assert.equal(report.completed, 2);
  assert.equal(report.unavailable, 1);
  assert.deepEqual(report.byFiscalEndYear, [{ year: 2020, issuers: 2 }]);
  assert.match(report.interpretation, /not common valuation origins/);
});
test("multiple retained versions of one issuer cannot inflate coverage", () => {
  assert.throws(() => completedOutcomeCoverage([
    { symbol: "A", results: [] }, { symbol: "A", results: [] },
  ]), /Duplicate issuer/);
});
