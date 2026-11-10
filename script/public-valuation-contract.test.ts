import test from "node:test";
import assert from "node:assert/strict";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
test("public valuation contract removes unsupported values even from cached nested rows", () => {
  const input = { rows: [{ pe: 12, impliedTemperature: 2, impliedCarbonPrice: 20, impliedDecarbRate: 3, netZeroYear: 2060 }] };
  assert.deepEqual(publicValuationResult(input), { rows: [{ pe: 12 }] });
  assert.equal(input.rows[0].impliedTemperature, 2);
});
test("physical gap fields and their distribution cannot leak through descriptive endpoints", () => {
  assert.deepEqual(publicValuationResult({
    projectedRate: 3, gap: 1, medianImpliedRate: 2, meanImpliedRate: 2,
    p25ImpliedRate:1,p75ImpliedRate:4,
    distribution: [{ bucket: "physical gap", count: 5 }], pe: 12,
    nested: { gap: -1, impliedGrowth: .02 },
  }, true), { pe: 12, nested: { impliedGrowth: .02 } });
  assert.deepEqual(publicValuationResult({ distribution: [1, 2] }), { distribution: [1, 2] });
});
