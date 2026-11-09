import test from "node:test";
import assert from "node:assert/strict";
import { analyzeMemberEnsemble } from "../server/calculation/memberAnalysis";

function fixture(n: number) {
  return { manifestId: "fixture", emissionsToleranceGtCO2e: .1, ensemble: {
    baseline: "1850-1900", memberIds: Array.from({ length: n }, (_, i) => `m${String(i).padStart(5, "0")}`),
    years: Array.from({ length: 77 }, (_, i) => 2024 + i),
    temperature: Array.from({ length: 77 }, () => Array(n).fill(2)),
    ghgGtCO2e: Array.from({ length: 77 }, () => Array(n).fill(10)),
    co2Gt: Array.from({ length: 77 }, () => Array(n).fill(8)),
  } };
}
test("integrated metrics never label a small ensemble converged", () => {
  const result = analyzeMemberEnsemble(fixture(2));
  assert.equal(result.convergence.status, "unavailable");
  assert.equal(result.productionEligible, false);
  assert.throws(() => analyzeMemberEnsemble({ ...fixture(2), emissionsToleranceGtCO2e: 0 }));
  const missing = fixture(2);
  missing.ensemble.temperature.pop();
  assert.throws(() => analyzeMemberEnsemble(missing));
});
test("paired 10,000-member analysis detects failed convergence and is order invariant", () => {
  const x = fixture(10000);
  const a = analyzeMemberEnsemble(x);
  assert.equal(a.convergence.status, "evaluated");
  if (a.convergence.status === "evaluated") assert.equal(a.convergence.result.passed, true);
  x.ensemble.temperature[76].fill(3, 5000);
  const b = analyzeMemberEnsemble(x);
  if (b.convergence.status === "evaluated") assert.equal(b.convergence.result.passed, false);
  x.ensemble.memberIds.reverse();
  for (const matrix of [x.ensemble.temperature, x.ensemble.ghgGtCO2e, x.ensemble.co2Gt])
    matrix.forEach(row => row.reverse());
  assert.deepEqual(analyzeMemberEnsemble(x), b);
});
