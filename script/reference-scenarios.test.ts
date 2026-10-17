import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import data from "../server/calculation/data/catReferences.json";

test("reference release is dated and distinct from dashboard/FaIR", () => {
  assert.equal(data.source.publishedAt, "2025-11-13");
  assert.equal(data.status, "published-external-reference");
  assert.match(data.climateModel, /MAGICC7/);
  assert.match(data.climateModel, /not.*FaIR/);
  assert.match(data.refreshPolicy, /manual/);
});
test("original CAT scenario names and source medians are retained", () => {
  const [policy, commitments] = data.scenarios;
  assert.equal(policy.publishedName, "Policies & action");
  assert.equal(policy.temperatureMedianC, 2.6);
  assert.equal(commitments.publishedName, "Optimistic scenario (net-zero pledges)");
  assert.equal(commitments.temperatureMedianC, 1.9);
  assert.match(commitments.definition, /not an equally likely/);
});
test("emissions distinguish a policy-pathway range from an optimistic point", () => {
  const [policy, commitments] = data.scenarios;
  assert.deepEqual(policy.emissions.map(r => r.year), [2030, 2035, 2050, 2100]);
  for (const row of policy.emissions) {
    assert.ok(Number.isFinite(row.low) && Number.isFinite(row.high) && row.low! <= row.high!);
    assert.equal(row.value, undefined);
  }
  for (const row of commitments.emissions) {
    assert.ok(Number.isFinite(row.value));
    assert.equal(row.low, undefined);
    assert.equal(row.high, undefined);
  }
  assert.ok(Math.abs(policy.emissions[0].low! - 55.944820063190974) < 1e-10);
  assert.ok(Math.abs(commitments.emissions[3].value! - 6.769671324194887) < 1e-10);
});
test("copyright and non-commercial terms accompany reference API data", () => {
  assert.match(data.source.copyright, /Climate Analytics and NewClimate Institute/);
  assert.match(data.source.licence, /Non-commercial/);
  assert.match(data.comparisonCaveat, /not rebased/);
  assert.match(data.comparisonCaveat, /not a probability interval/);
});
test("support roles do not assert that external references calibrate the engine", () => {
  assert.match(data.supportingSources[0].caveat, /no updated Announced Pledges/);
  assert.match(data.supportingSources[1].caveat, /March 2024/);
  for (const path of ["forwardProjection.ts", "emissionsCandidate.ts", "emissionsInputs.ts"]) {
    assert.doesNotMatch(readFileSync(`server/calculation/${path}`, "utf8"), /catReferences|reference-scenarios/);
  }
});
