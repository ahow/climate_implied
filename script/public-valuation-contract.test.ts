import test from "node:test";
import assert from "node:assert/strict";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
test("public valuation contract removes unsupported values even from cached nested rows", () => {
  const input = { rows: [{ pe: 12, impliedTemperature: 2, impliedCarbonPrice: 20, impliedDecarbRate: 3, netZeroYear: 2060 }] };
  assert.deepEqual(publicValuationResult(input), { rows: [{ pe: 12 }] });
  assert.equal(input.rows[0].impliedTemperature, 2);
});
