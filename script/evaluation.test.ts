import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateHoldout, promotionDecision, PROMOTION_REQUIREMENTS } from "../server/calculation/evaluation";
const protocol = { frozenAt: "2014-01-01", trainingEnd: "2013-12-31", holdoutStart: "2015-01-01",
  baseline: "persistence", maxDeteriorationFraction: 0, nominalCoverage: .8, coverageTolerance: .05 };
const rows = Array.from({ length: 5 }, (_, i) => ({ origin: `${2015 + i}-01-01`,
  inputsAvailableThrough: `${2014 + i}-12-31`, targetYear: 2016 + i,
  actual: 10, candidate: 10.1, persistence: 12, trend: 11, lower: 9, upper: i === 4 ? 9.5 : 11, revisedHistory: false }));
test("predeclared holdout measures bias, MAE, baseline and coverage", () => {
  const r = evaluateHoldout(protocol, rows);
  assert.ok(Math.abs(r.mae - .1) < 1e-10); assert.equal(r.coverage, .8); assert.equal(r.passed, true);
  assert.equal(evaluateHoldout(protocol, rows.map(r => ({ ...r, candidate: 20 }))).passed, false);
});
test("future input leakage, late training and reconstructed history cannot pass", () => {
  assert.throws(() => evaluateHoldout({ ...protocol, trainingEnd: "2016-01-01" }, rows));
  assert.throws(() => evaluateHoldout(protocol, rows.map(r => ({ ...r, inputsAvailableThrough: "2030-01-01" }))));
  assert.equal(evaluateHoldout(protocol, rows.map(r => ({ ...r, revisedHistory: true }))).passed, false);
});
test("every promotion prerequisite must be explicitly evidenced", () => {
  assert.equal(promotionDecision({}).canPromote, false);
  const evidence = Object.fromEntries(PROMOTION_REQUIREMENTS.map(id => [id, true]));
  assert.equal(promotionDecision(evidence).canPromote, true);
  delete evidence.holdout; assert.equal(promotionDecision(evidence).canPromote, false);
});
