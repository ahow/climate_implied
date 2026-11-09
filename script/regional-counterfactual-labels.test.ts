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
});
