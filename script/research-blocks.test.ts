import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSignal } from "../server/calculation/signalResearch";
function fixture() {
  return { frozenAt: "2026-11-06", splitDate: "2020-01-01", specificationCount: 1,
    minimumMseImprovement: .1, evidenceMode: "revised-history", uncertainty: "date-blocks", blockLength: 3,
    rows: Array.from({ length: 60 }, (_, i) => {
      const date = `${i < 30 ? 2015 : 2021}-${String(i % 12 + 1).padStart(2, "0")}-01`;
      return { date, publishedAt: null, outcomeAvailableAt: i < 30 ? "2016-01-01" : "2022-01-01",
        controls: [Math.sin(i)], signal: Math.cos(i), outcome: Math.sin(i) + 3 * Math.cos(i) };
    }) };
}
test("blocked bootstrap is reproducible and revised history cannot become validated", () => {
  const f = fixture(), a = evaluateSignal(f);
  assert.deepEqual(a, evaluateSignal(f));
  assert.equal(a.decision, "exploratory-positive-not-validated");
  assert.equal(a.holdoutDates, 12);
});
test("missing vintages and insufficient independent dates fail explicitly", () => {
  const f = fixture(); f.evidenceMode = "point-in-time"; assert.throws(() => evaluateSignal(f));
  f.evidenceMode = "revised-history"; f.rows.slice(30).forEach(r => r.date = "2021-01-01");
  assert.throws(() => evaluateSignal(f));
});
