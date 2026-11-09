import { test } from "node:test";
import assert from "node:assert/strict";
import { shortHorizonEmissions } from "../server/calculation/shortHorizonEmissions";
const fixture = () => Array.from({ length: 16 }, (_, i) => ({ year: 2010 + i, value: 30 * 1.02 ** i }));
test("short-horizon replay is deterministic, ordered and explicitly non-promoting", () => {
  const result = shortHorizonEmissions(fixture());
  assert.deepEqual(result, shortHorizonEmissions(fixture().reverse()));
  assert.equal(result.predictions.length, 24);
  assert.ok(result.horizons.every(h => h.candidate.mae < 1e-10));
  assert.equal(result.productionEligible, false);
  assert.equal(result.validates2100Warming, false);
});
test("future observations do not enter earlier forecast fits", () => {
  const a = shortHorizonEmissions(fixture());
  const b = shortHorizonEmissions(fixture().map(r => r.year > 2015 ? { ...r, value: r.value * 2 } : r));
  for (let horizon = 1; horizon <= 3; horizon++) {
    assert.equal(a.predictions.find(p => p.origin === 2015 && p.horizon === horizon)!.candidate,
      b.predictions.find(p => p.origin === 2015 && p.horizon === horizon)!.candidate);
  }
});
test("short-horizon evaluation rejects gaps, duplicate years and invalid emissions", () => {
  assert.throws(() => shortHorizonEmissions(fixture().slice(1)), /Missing/);
  assert.throws(() => shortHorizonEmissions([...fixture(), fixture()[0]]), /Duplicate/);
  assert.throws(() => shortHorizonEmissions(fixture().map(r => ({ ...r, value: 0 }))));
});
