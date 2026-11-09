import assert from "node:assert/strict";
import test from "node:test";
import { sampleRegionalDrivers } from "../server/calculation/regionalSampling";

test("joint-row bootstrap preserves cross-region dependence and deterministic member identity", () => {
  const input = { seed: 20261109, members: 10000, parameterVersion: "fixture-v1",
    evidence: ["fixture-not-calibration"], rows: [
      { id: "low", scenarios: [{ region: "US", scenario: { annualActivityGrowth: .01 } }, { region: "China", scenario: { annualActivityGrowth: .02 } }] },
      { id: "high", scenarios: [{ region: "US", scenario: { annualActivityGrowth: .03 } }, { region: "China", scenario: { annualActivityGrowth: .06 } }] },
    ] };
  const a = sampleRegionalDrivers(input);
  assert.equal(a.members.length, 10000);
  assert.deepEqual(sampleRegionalDrivers({ ...input, rows: [...input.rows].reverse() }), a);
  assert.deepEqual(sampleRegionalDrivers({ ...input, members: 5000 }).members, a.members.slice(0, 5000));
  for (const m of a.members) {
    const row = input.rows.find(r => r.id === m.parameterRowId)!;
    assert.equal(row.scenarios[1].scenario.annualActivityGrowth, 2 * row.scenarios[0].scenario.annualActivityGrowth);
  }
  assert.equal(a.productionEligible, false);
  assert.throws(() => sampleRegionalDrivers({ ...input, rows: [input.rows[0], input.rows[0]] }));
  assert.throws(() => sampleRegionalDrivers({ ...input, members: 10001 }));
  assert.throws(() => sampleRegionalDrivers({ ...input, evidence: [] }));
});
