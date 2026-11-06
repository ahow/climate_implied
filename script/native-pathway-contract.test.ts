import { test } from "node:test";
import assert from "node:assert/strict";
import { validateNativePair, nativeInventory } from "../server/calculation/nativePathwayContract";
function fixture() {
  return ["implemented-policies", "announced-commitments"].map(scenario => ({
    scenario, source: { url: "https://example.org/synthetic", revision: "fixture",
      policyCutoff: "2026-01", includesLongTermPledges: true, processingStage: "raw" },
    unit: "Mt gas/year", years: Array.from({ length: 77 }, (_, i) => 2024 + i),
    gases: { "CO2-LULUCF": [100, ...Array(76).fill(-10)], CH4: Array(77).fill(2) },
  }));
}
const baseline = { "CO2-LULUCF": 100, CH4: 2 };
test("matched inventory, signed CO2 removals and cumulative future years reconcile", () => {
  const r = validateNativePair(fixture(), baseline);
  assert.equal(r.scenarios[0].cumulative2025Through2100Mt["CO2-LULUCF"], -760);
  assert.equal(r.scenarios[0].cumulative2025Through2100Mt.CH4, 152);
  assert.ok(Object.keys(nativeInventory()).length > 20);
});
test("missing gas, wrong units, horizon gaps, inventory mismatches and negative methane fail", () => {
  for (const mutate of [
    (x: any) => delete x[0].gases.CH4,
    (x: any) => { x[0].unit = "GtCO2e"; },
    (x: any) => { x[0].years[5] = 2050; },
    (x: any) => { x[0].gases.CH4[0] = 3; },
    (x: any) => { x[0].gases.CH4[2] = -1; },
  ]) { const x = fixture(); mutate(x); assert.throws(() => validateNativePair(x, baseline)); }
});
test("NDC-only is rejected as all commitments, and duplicate scenarios fail", () => {
  const x = fixture(); x[1].source.includesLongTermPledges = false;
  assert.throws(() => validateNativePair(x, baseline));
  x[1] = x[0]; assert.throws(() => validateNativePair(x, baseline));
});
