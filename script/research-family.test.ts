import { test } from "node:test";
import assert from "node:assert/strict";
import { adjudicateResearchFamily } from "../server/calculation/researchFamily";
const spec = { model: "DCF", peer: "sector", target: "return" };
const endpoints = ["evaluation-r2", "signal-ic", "after-cost-long-short"];
const input = () => ({ protocolId: "b".repeat(64), specifications: [spec],
  results: endpoints.map(endpoint => ({ ...spec, endpoint, estimate: .1, improvement95: [.02, .2], oneSidedP: .01 })) });
test("entire family includes all three success hypotheses", () => {
  const p = input(), output = adjudicateResearchFamily(p);
  assert.equal(output.familySize, 3);
  assert.equal(output.specifications[0].supported, true);
  assert.ok(output.tests.every(t => t.holmP === .03));
  assert.equal(output.investmentEvidence, false);
});
test("unavailable tests remain in denominator and cannot earn support", () => {
  const p = input();
  p.specifications.push({ ...spec, model: "Gordon" });
  const r = adjudicateResearchFamily({ ...p, results: p.results.slice(0, 1) });
  assert.equal(r.familySize, 6);
  assert.equal(r.unavailableHypotheses, 5);
  assert.equal(r.tests.find(t => t.score)?.holmP, .06);
  assert.ok(r.specifications.every(s => !s.supported));
});
test("point improvements and p values cannot replace paired intervals", () => {
  const p = input(); p.results[0].improvement95 = [-.01, .2];
  assert.equal(adjudicateResearchFamily(p).specifications[0].supported, false);
  assert.throws(() => adjudicateResearchFamily({ ...p, results: [...p.results, p.results[0]] }), /Duplicate/);
  assert.throws(() => adjudicateResearchFamily({ ...p, results: [{ ...p.results[0], model: "undeclared" }] }), /outside/);
});
