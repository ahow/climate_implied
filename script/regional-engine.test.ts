import assert from "node:assert/strict";
import test from "node:test";
import { candidateInventory, constantScenario } from "../server/calculation/emissionsCandidate";
import { projectRegionalMember, REGIONS } from "../server/calculation/regionalEngine";

function fixture() {
  return {
    inventoryId: "fixture", memberId: "m00000",
    cells: REGIONS.flatMap(region => candidateInventory().cells.map(c => ({
      region, gas: c.gas, sector: c.sector, nativeMt: c.nativeMt / 6,
    }))),
    scenarios: REGIONS.map(region => ({ region, scenario: { ...constantScenario } })),
  };
}
test("regional engine reconciles frozen native inventory and annual regional totals", () => {
  const x = fixture(), result = projectRegionalMember(x, 2026);
  for (const row of result.global) {
    const baseline = candidateInventory().cells.reduce((sum, c) => sum + c.nativeMt * c.gwp100 / 1000, 0);
    assert.ok(Math.abs(row.reportingGtCO2e - baseline) < 1e-9);
    assert.ok(Math.abs(result.regions.reduce((s, r) => s + r.trajectory[row.year - 2024].reportingGtCO2e, 0)
      - row.reportingGtCO2e) < 1e-10);
    assert.ok(Math.abs(row.nativeMt.CO2 - row.co2FossilMt - row.co2LandUseMt) < 1e-8);
  }
  assert.deepEqual(projectRegionalMember({ ...x, cells: [...x.cells].reverse(),
    scenarios: [...x.scenarios].reverse() }, 2026), result);
});
test("regional perturbation leaves other regions unchanged and preserves signed land sinks", () => {
  const x = fixture();
  const land = x.cells.filter(c => c.sector === "LULUCF");
  const china = land.find(c => c.region === "China")!, row = land.find(c => c.region === "Rest of World")!;
  row.nativeMt += china.nativeMt + 10;
  china.nativeMt = -10;
  const a = projectRegionalMember(x, 2030);
  const b = projectRegionalMember({ ...x, scenarios: x.scenarios.map(s => s.region === "US"
    ? { ...s, scenario: { ...s.scenario, annualActivityGrowth: .03 } } : s) }, 2030);
  assert.deepEqual(a.regions.filter(r => r.region !== "US"), b.regions.filter(r => r.region !== "US"));
  assert.notDeepEqual(a.global[6], b.global[6]);
  assert.equal(a.regions.find(r => r.region === "China")!.trajectory[6].co2LandUseMt, -10);
});
test("missing, duplicated or incompatible regional accounts are rejected rather than patched", () => {
  const x = fixture();
  assert.throws(() => projectRegionalMember({ ...x, cells: x.cells.slice(1) }, 2025));
  assert.throws(() => projectRegionalMember({ ...x, cells: [...x.cells, x.cells[0]] }, 2025));
  assert.throws(() => projectRegionalMember({ ...x, scenarios: x.scenarios.slice(1) }, 2025));
  assert.throws(() => projectRegionalMember({ ...x, scenarios: [...x.scenarios, x.scenarios[0]] }, 2025));
});
