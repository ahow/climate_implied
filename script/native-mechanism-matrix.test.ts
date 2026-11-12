import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { candidateInventory, constantScenario, projectInventoryEmissions,
  type EmissionsScenario, type NativeInventoryCell } from "../server/calculation/emissionsCandidate";
import { declaredCellDependency, nativeMechanismDeclaration, sectorOf } from "../server/calculation/nativeMechanisms";
import { consumeRegionalParameterRegistry, scenarioParameterLeaves } from "../server/calculation/driverParameterRegistry";
import { REGIONS } from "../server/calculation/regionalEngine";

// Synthetic engineering probes, NOT empirical calibration or distribution acceptance.
const cells = candidateInventory().cells;
const endYear = 2060;
const active: EmissionsScenario = { ...constantScenario, name: "mechanism-matrix-engineering-only",
  annualActivityGrowth: .012, residualIntensityImprovement: .003,
  evSalesShare: .22, evLogitGrowth: .035, renewableAdditionsGW: 55,
  renewableRetirement: .012, annualPowerDemandGrowth: .015, nuclearGenerationTWh: 2800,
  incrementalPolicyCoverage: .5, policyImplementation: .8, maximumAbatement: .5 };
type Probe = { path: string; before: EmissionsScenario; after: EmissionsScenario };
function set(s: EmissionsScenario, path: string, value: unknown) {
  const result = structuredClone(s);
  const keys = path.split("/");
  let target: any = result;
  for (const k of keys.slice(0, -1)) target = target[k];
  target[keys.at(-1)!] = value;
  return result;
}
const changes: Record<string, unknown> = {
  annualActivityGrowth: .022, residualIntensityImprovement: .008,
  evSalesShare: .32, evFleetShare: .07, evLogitGrowth: .055, reversal: true,
  fleetTurnover: .1, passengerTransportFraction: .7, evTailpipeReduction: .8,
  fullElectricFleetDemandTWh: 3500, renewableCapacityGW: 5000, renewableAdditionsGW: 80,
  renewableRetirement: .02, capacityFactor: .4, fossilGenerationTWh: 20000,
  annualPowerDemandGrowth: .025, nuclearGenerationTWh: 3800,
  incrementalPolicyCoverage: .7, policyImplementation: .9,
  corporateCoverage: .7, corporateDelivery: .9, maximumAbatement: .7,
  deliveryLagYears: 5, deliveryTimeYears: 8,
};
const probes: Probe[] = Object.entries(changes).map(([path, value]) => {
  // Avoid complete-overlap masking: corporate probes require an independently
  // active corporate channel and no stronger policy/technical reduction.
  const before = path.startsWith("corporate") ? { ...active,
    incrementalPolicyCoverage: 0, corporateCoverage: .5, corporateDelivery: .8 } : active;
  return { path, before, after: set(before, path, value) };
});
for (const sector of ["transport", "industry", "buildings", "agriculture", "other", "land"] as const) {
  for (const [field, value] of Object.entries({
    annualActivityGrowth: .022, residualIntensityImprovement: .008, trendEndYear: 2045,
  })) {
    const before = { ...active, sectorPathways: { [sector]: {
      annualActivityGrowth: .01, residualIntensityImprovement: .002, trendEndYear: 2034,
    } } };
    const path = `sectorPathways/${sector}/${field}`;
    probes.push({ path, before, after: set(before, path, value) });
  }
}
const measure = { id: "engineering-scope", mechanism: "process" as const,
  sectorCodes: ["3.A.2"], gases: ["CH4"], coverage: .4, implementation: .6,
  maximumReduction: .3, startYear: 2027, deliveryYears: 12,
  evidence: "Synthetic scope probe; not scientific evidence" };
for (const [field, value] of Object.entries({
  id: "renamed", mechanism: "corporate", evidence: "Different synthetic reference",
  "sectorCodes/0": "3.A.1", "gases/0": "N2O", coverage: .6,
  implementation: .8, maximumReduction: .5, startYear: 2030, deliveryYears: 6,
})) {
  const before = { ...active, measures: [measure] };
  const path = `measures/0/${field}`;
  probes.push({ path, before, after: set(before, path, value) });
}
function close(a: number, b: number) {
  return Math.abs(a - b) <= 1e-10 + 1e-12 * Math.max(Math.abs(a), Math.abs(b));
}
function numericLeaves(value: any, prefix = ""): [string, number][] {
  if (typeof value === "number") return [[prefix, value]];
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => numericLeaves(v, prefix ? `${prefix}/${k}` : k));
  return [];
}
function allowed(probe: Probe, path: string) {
  const eligible = cells.filter(c => declaredCellDependency(probe.path, probe.before, c) ||
    declaredCellDependency(probe.path, probe.after, c));
  const d = nativeMechanismDeclaration(probe.path);
  if (path.startsWith("nativeCellsMt/")) {
    const c = cells[Number(path.split("/")[1])];
    return eligible.includes(c);
  }
  if (path.startsWith("nativeMt/")) return eligible.some(c => c.gas === path.split("/")[1]);
  if (path.startsWith("sectorsGtCO2e/")) return eligible.some(c => sectorOf(c.sector) === path.split("/")[1]);
  if (path === "co2FossilMt") return eligible.some(c => c.gas === "CO2" && c.sector !== "LULUCF");
  if (path === "co2LandUseMt") return eligible.some(c => c.gas === "CO2" && c.sector === "LULUCF");
  if (path === "reportingGtCO2e") return eligible.length > 0;
  if (path.startsWith("power/")) return d.powerFields.includes(path.split("/")[1]);
  return d.adoptionFields.includes(path);
}
function reconcile(row: ReturnType<typeof projectInventoryEmissions>["trajectory"][number], inventory: NativeInventoryCell[]) {
  const native: Record<string, number> = {}, sectors: Record<string, number> = {};
  let fossil = 0, land = 0, total = 0;
  inventory.forEach((c, i) => {
    const value = row.nativeCellsMt![i], co2e = value * c.gwp100 / 1000;
    native[c.gas] = (native[c.gas] ?? 0) + value;
    sectors[sectorOf(c.sector)] = (sectors[sectorOf(c.sector)] ?? 0) + co2e;
    total += co2e;
    if (c.gas === "CO2") { if (c.sector === "LULUCF") land += value; else fossil += value; }
  });
  assert.deepEqual(row.nativeMt, native);
  assert.deepEqual(row.sectorsGtCO2e, sectors);
  assert.equal(row.co2FossilMt, fossil); assert.equal(row.co2LandUseMt, land);
  assert.equal(row.reportingGtCO2e, total);
  assert.ok(close(row.power.demandTWh, row.power.fossilTWh +
    row.power.utilizedRenewableTWh + row.power.utilizedNuclearTWh));
}
test("every supported scalar, sector and scoped-measure leaf has a perturbation probe", () => {
  const paths = new Set(probes.map(p => p.path));
  const scenario = { ...active, measures: [measure], sectorPathways: Object.fromEntries(
    ["transport", "industry", "buildings", "agriculture", "other", "land"].map(s =>
      [s, { annualActivityGrowth: .01, residualIntensityImprovement: .002, trendEndYear: 2034 }])) };
  assert.deepEqual([...paths].sort(), scenarioParameterLeaves(scenario));
  assert.equal(paths.size, 52);
});
for (const probe of probes) {
  test(`actual native perturbation: ${probe.path}; no undeclared numeric output movement`, t => {
    const a = projectInventoryEmissions(probe.before, endYear, cells, true);
    const b = projectInventoryEmissions(probe.after, endYear, cells, true);
    let moved = 0, numericComparisons = 0;
    a.trajectory.forEach((row, i) => {
      reconcile(row, cells); reconcile(b.trajectory[i], cells);
      const other = new Map(numericLeaves(b.trajectory[i]));
      for (const [path, value] of numericLeaves(row)) {
        numericComparisons++;
        assert.ok(other.has(path), `Missing output ${path}`);
        if (!close(value, other.get(path)!)) {
          moved++;
          assert.ok(allowed(probe, path), `${probe.path} moved undeclared ${row.year}/${path}`);
        }
      }
      assert.equal(other.size, numericLeaves(row).length);
    });
    const d = nativeMechanismDeclaration(probe.path);
    const hasInventoryScope = cells.some(c => declaredCellDependency(probe.path, probe.before, c) ||
      declaredCellDependency(probe.path, probe.after, c));
    if (d.effect === "equation" && hasInventoryScope) assert.ok(moved > 0, `Masked/unused driver ${probe.path}`);
    else assert.equal(moved, 0, `Metadata/permission changed a numerical equation: ${probe.path}`);
    assert.notEqual(a.key, b.key);
    assert.deepEqual(projectInventoryEmissions(probe.after, 2030, cells, true).trajectory,
      b.trajectory.slice(0, 7));
    t.diagnostic(JSON.stringify({ driver: probe.path, years: a.trajectory.length,
      numericComparisons, movedNumericOutputs: moved, undeclaredMovements: 0,
      effect: d.effect, retainedInventoryScope: hasInventoryScope }));
  });
}
test("every supported leaf passes through actual source-bound regional consumption and isolates the changed region", async () => {
  const source = { path: "script/native-mechanism-matrix.test.ts",
    sha256: createHash("sha256").update(readFileSync("script/native-mechanism-matrix.test.ts")).digest("hex") };
  for (const probe of probes) {
    async function consume(s: EmissionsScenario) {
      const scenarios = REGIONS.map(region => ({ region, scenario: region === "US" ? s : probe.before }));
      const paths = scenarioParameterLeaves(s);
      const evidence = REGIONS.map(region => ({
        id: region, geography: region, version: "engineering-only", role: "mechanism-input",
        status: "sensitivity-only", definition: "Synthetic perturbation probe; not accepted central calibration",
        unit: "explicit scenario units", sources: [source], consumerPaths: paths,
      }));
      return consumeRegionalParameterRegistry({ registry: {
        version: "mechanism-matrix-engineering-only", evidence,
        bindings: REGIONS.flatMap(region => paths.map(path => ({ region, path, evidenceId: region }))),
        rows: [{ id: "probe", scenarios }],
      }, use: "sensitivity", seed: 71, members: 2, endYear: 2050, inventoryId: "engineering-only",
      cells: REGIONS.flatMap(region => cells.map(c => ({
        region, gas: c.gas, sector: c.sector, nativeMt: c.nativeMt / REGIONS.length,
      }))) });
    }
    const a = await consume(probe.before), b = await consume(probe.after);
    assert.equal(b.distributionAdmission, "sensitivity-only");
    assert.ok(b.consumption.every(c => c.mechanism.path === c.path &&
      c.mechanism.centralEligibilityTransferred === false));
    for (let i = 0; i < a.members.length; i++) {
      assert.deepEqual(a.members[i].result.regions.filter(r => r.region !== "US"),
        b.members[i].result.regions.filter(r => r.region !== "US"), probe.path);
      const before = a.members[i].result.regions.find(r => r.region === "US")!.trajectory;
      const after = b.members[i].result.regions.find(r => r.region === "US")!.trajectory;
      if (nativeMechanismDeclaration(probe.path).effect === "equation" &&
        cells.some(c => declaredCellDependency(probe.path, probe.before, c) ||
          declaredCellDependency(probe.path, probe.after, c)))
        assert.notDeepEqual(before, after, `No actual regional effect: ${probe.path}`);
      else assert.deepEqual(before, after, probe.path);
    }
  }
});
test("building subcode pathways move only explicitly disaggregated source cells, never the unsplit 1.A.4 inventory", () => {
  // These explicit synthetic cells check a supported engine scope; they do not
  // fabricate a building/agriculture split for the retained global inventory.
  const disaggregated = [
    { gas: "CO2", sector: "1.A.4.a", nativeMt: 100, gwp100: 1 },
    { gas: "CH4", sector: "1.A.4.b", nativeMt: 2, gwp100: 27.9 },
    { gas: "CO2", sector: "1.A.4", nativeMt: 300, gwp100: 1 },
  ];
  for (const probe of probes.filter(p => p.path.startsWith("sectorPathways/buildings/"))) {
    const a = projectInventoryEmissions(probe.before, 2060, disaggregated, true);
    const b = projectInventoryEmissions(probe.after, 2060, disaggregated, true);
    assert.notEqual(a.trajectory[36].nativeCellsMt![0], b.trajectory[36].nativeCellsMt![0]);
    assert.notEqual(a.trajectory[36].nativeCellsMt![1], b.trajectory[36].nativeCellsMt![1]);
    for (let i = 0; i < a.trajectory.length; i++) {
      assert.equal(a.trajectory[i].nativeCellsMt![2], b.trajectory[i].nativeCellsMt![2]);
      assert.deepEqual(a.trajectory[i].power, b.trajectory[i].power);
      reconcile(a.trajectory[i], disaggregated); reconcile(b.trajectory[i], disaggregated);
    }
  }
});
test("signed land persistence/pathways retain sign; fractional reduction cannot weaken a sink", () => {
  const signed = cells.map(c => c.sector === "LULUCF" ? { ...c, nativeMt: -10 } : c);
  const p = projectInventoryEmissions(active, 2030, signed, true);
  assert.ok(p.trajectory.every(r => r.co2LandUseMt === -10));
  const land = projectInventoryEmissions({ ...active, sectorPathways: { land: {
    annualActivityGrowth: .01, residualIntensityImprovement: 0, trendEndYear: 2027,
  } } }, 2030, signed, true);
  assert.ok(close(land.trajectory[6].co2LandUseMt, -10 * 1.01 ** 3));
  assert.throws(() => projectInventoryEmissions({ ...active, measures: [{
    ...measure, sectorCodes: ["LULUCF"], gases: ["CO2"],
  }] }, 2030, signed), /Signed land sink requires a flux-specific mechanism/);
});
test("aviation/marine including international transport never inherit EV or generic policy coverage", () => {
  const baseline = projectInventoryEmissions(constantScenario, 2050, cells, true);
  const changed = projectInventoryEmissions({ ...constantScenario, evSalesShare: 1,
    incrementalPolicyCoverage: 1, policyImplementation: 1, corporateCoverage: 1,
    corporateDelivery: 1, maximumAbatement: 1, deliveryLagYears: 0 }, 2050, cells, true);
  cells.forEach((c, i) => {
    if (["1.A.3.a", "1.A.3.d"].includes(c.sector))
      assert.equal(changed.trajectory[26].nativeCellsMt![i], baseline.trajectory[26].nativeCellsMt![i]);
  });
  const explicit = projectInventoryEmissions({ ...constantScenario, measures: [{
    ...measure, sectorCodes: ["1.A.3.a", "1.A.3.d"], gases: ["CO2"],
  }] }, 2050, cells, true);
  assert.ok(explicit.trajectory[26].co2FossilMt < baseline.trajectory[26].co2FossilMt);
});
test("lags, saturation, complete overlap and zero-addressable road remain finite", () => {
  const p = projectInventoryEmissions({ ...active, measures: [measure] }, 2060, cells, true);
  const duplicate = projectInventoryEmissions({ ...active, measures: [measure, {
    ...measure, id: "same-stock", mechanism: "corporate",
  }] }, 2060, cells, true);
  assert.deepEqual(p.trajectory, duplicate.trajectory);
  const scopedCell = cells.findIndex(c => c.gas === "CH4" && c.sector === "3.A.2");
  assert.equal(p.trajectory[3].nativeCellsMt![scopedCell], cells[scopedCell].nativeMt);
  assert.ok(p.trajectory[4].nativeCellsMt![scopedCell] < cells[scopedCell].nativeMt);
  const zero = projectInventoryEmissions({ ...constantScenario, passengerTransportFraction: 0,
    evFleetShare: 1, evSalesShare: 1 }, 2026, cells, true);
  assert.ok(zero.trajectory.every(r => Number.isFinite(r.reportingGtCO2e)));
  const saturated = projectInventoryEmissions({ ...active, renewableAdditionsGW: 100000 }, 2030, cells, true);
  assert.ok(saturated.trajectory.slice(1).every(r => r.power.fossilTWh === 0));
});
