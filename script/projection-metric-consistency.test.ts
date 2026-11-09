import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateAllCategoryProjections } from "../server/calculation/categoryProjections";
import { historicalTrajectoryMetrics } from "../server/calculation/historicalMetrics";

test("all category outputs use the same trajectory-based metrics as historical diagnostics", () => {
  for (const result of calculateAllCategoryProjections()) {
    const expected = historicalTrajectoryMetrics(result.trajectory);
    assert.equal(result.reductionRate, expected.reductionRate);
    assert.equal(result.netZeroYear, expected.netZeroYear);
    assert.ok(result.netZeroYear === null || result.netZeroYear <= 2100);
  }
});
test("main, category and regional outputs cannot restore fallback emissions or extrapolated milestones", () => {
  for (const file of ["server/routes.ts", "server/calculation/categoryProjections.ts",
    "server/calculation/regionalProjections.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /historicalTrajectoryMetrics\(/);
    assert.doesNotMatch(source, /yearsToNetZero|avgAnnualReduction|\?\.emissions \|\| (60|55|20)/);
  }
});
