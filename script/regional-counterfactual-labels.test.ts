import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("regional legacy counterfactual is not exported as a regional forecast or net-zero result", () => {
  const source = readFileSync("client/src/components/regional-comparison.tsx", "utf8");
  assert.doesNotMatch(source, /"Net-Zero Year"|>Net-Zero:|Regional Projections|Temperature Rise/);
  assert.match(source, /Global intensity counterfactual/);
  assert.match(source, /Legacy 5 Gt milestone/);
  assert.match(source, /not a regional temperature forecast/);
  assert.match(source, /Claim: r.claim/);
  assert.match(source, /"Intensity basis": r.carbonIntensityBasis/);
  assert.match(source, /Legacy 5 Gt milestone \(fixed-5gt-v1\)/);
  assert.match(source, /not net zero or the 5%-of-2024 diagnostic/);
  assert.match(source, /not source-evidenced regional inventories/);
  assert.match(source, /"Legacy fixed-5gt-v1 year \(5 GtCO2e\)"/);
});
