import test from "node:test";
import assert from "node:assert/strict";
import { adjudicateResearchFamily } from "../server/calculation/researchFamily";

const spec = { model: "engineering-label-fixture", peer: "sector", target: "next-month" };
const endpoints = ["evaluation-r2", "signal-ic", "after-cost-long-short"];
function adjudicate(passes: number, incomplete = false) {
  const results = endpoints.map((endpoint, index) => ({
    ...spec, endpoint, estimate: index < passes ? .1 : -.1,
    improvement95: index < passes ? [.02, .2] : [-.2, -.02],
    oneSidedP: index < passes ? .001 : .8,
  }));
  return adjudicateResearchFamily({
    protocolId: "c".repeat(64), specifications: [spec],
    results: incomplete ? results.slice(0, 2) : results,
  });
}

for (const [passes, expected] of [
  [3, "supported"], [2, "supported for further research"],
  [1, "no demonstrated improvement"], [0, "no demonstrated improvement"],
] as const) {
  test(`${passes} corrected hypotheses: ${expected}, not investment evidence`, () => {
    const result = adjudicate(passes), decision = result.specifications[0];
    assert.equal(decision.decision, expected);
    assert.equal(decision.passedHypotheses, passes);
    assert.equal(decision.supported, passes === 3);
    assert.match(decision.label, /locked retrospective revised-history research/);
    assert.equal(result.investmentEvidence, false);
    assert.equal(result.automaticPromotionAllowed, false);
  });
}

test("two passing supplied tests plus one missing test remain incomplete", () => {
  const result = adjudicate(3, true);
  assert.equal(result.familySize, 3);
  assert.equal(result.unavailableHypotheses, 1);
  assert.equal(result.specifications[0].decision, "incomplete evidence");
  assert.equal(result.specifications[0].supported, false);
});
