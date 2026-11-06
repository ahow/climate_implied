import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeEnsemble, compareEnsembles } from "../server/calculation/ensemble";
const e = { baseline: "1850-1900", memberIds: ["a", "b", "c", "d", "e"], years: [2100], temperature: [[-1, 1, 2, 3, 6]] };
test("one unclipped ensemble produces consistent headline, intervals, density and probabilities", () => {
  const s = summarizeEnsemble(e);
  assert.equal(s.headline.median, 2);
  assert.ok(Math.abs(s.headline.p10 + .2) < 1e-12);
  assert.ok(Math.abs(s.headline.p90 - 4.8) < 1e-12);
  assert.equal(s.headline.probabilityAbove2, .4);
  assert.equal(s.density.reduce((sum, b) => sum + b.count, 0), 5);
  assert.equal(s.density.at(-1)!.count, 1);
});
test("independent comparisons align member IDs and fail above declared tolerance", () => {
  const b = { ...e, memberIds: [...e.memberIds].reverse(), temperature: [[6, 3, 2, 1, -1]] };
  assert.equal(compareEnsembles(e, b).passed, true);
  b.temperature[0][0] += .011;
  assert.equal(compareEnsembles(e, b).passed, false);
  assert.throws(() => compareEnsembles(e, b, 1));
});
test("malformed ensembles fail rather than falling back to legacy values", () => {
  assert.throws(() => summarizeEnsemble({ ...e, temperature: [[NaN]] }));
  assert.throws(() => summarizeEnsemble({ ...e, memberIds: ["a", "a"] }));
});
