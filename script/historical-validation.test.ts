import { test } from "node:test";
import assert from "node:assert/strict";
import { historicalValidation } from "../server/calculation/historicalValidation";
const fixture = () => ({
  ensemble: { baseline: "1850-1900", memberIds: ["a", "b"], years: [2018, 2019], temperature: [[1, 2], [2, 3]] },
  simulationKind: "total", reference: { kind: "total", baseline: "1850-1900", startYear: 2018, endYear: 2019,
    lower: 1, upper: 2.1, source: "https://www.ipcc.ch/report/ar6/wg1/" },
});
test("historical window averages members before calculating ensemble median", () => {
  const r = historicalValidation(fixture());
  assert.equal(r.median, 2); assert.equal(r.fractionWithinReferenceRange, .5);
  assert.equal(r.medianWithinReferenceRange, true);
});
test("historical validation rejects wrong attribution, missing years and inverted ranges", () => {
  const f = fixture(); f.reference.kind = "anthropogenic"; assert.throws(() => historicalValidation(f));
  f.reference.kind = "total"; f.reference.startYear = 2017; assert.throws(() => historicalValidation(f));
  f.reference.startYear = 2018; f.reference.upper = .5; assert.throws(() => historicalValidation(f));
});
