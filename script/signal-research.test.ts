import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSignal } from "../server/calculation/signalResearch";
function fixture() {
  return { frozenAt: "2010-01-01", splitDate: "2020-01-01", minimumMseImprovement: .1, specificationCount: 1,
    rows: Array.from({ length: 40 }, (_, i) => ({ date: i < 25 ? "2015-01-01" : "2021-01-01",
      publishedAt: "2014-01-01", outcomeAvailableAt: i < 25 ? "2016-01-01" : "2022-01-01",
      controls: [Math.sin(i)], signal: Math.cos(i), outcome: Math.sin(i) + 3 * Math.cos(i) })) };
}
test("distinct synthetic signal passes while duplicated value signal does not", () => {
  assert.equal(evaluateSignal(fixture()).decision, "go-for-further-validation");
  const f = fixture(); f.rows.forEach(r => { r.signal = r.controls[0]; });
  assert.equal(evaluateSignal(f).decision, "no-go-for-this-specification");
});
test("holdout outcomes never affect fitted coefficients and future publications fail", () => {
  const f = fixture(), initial = evaluateSignal(f);
  f.rows.slice(25).forEach(r => { r.outcome += 100; });
  assert.deepEqual(evaluateSignal(f).coefficients, initial.coefficients);
  f.rows[0].publishedAt = "2030-01-01"; assert.throws(() => evaluateSignal(f));
});
