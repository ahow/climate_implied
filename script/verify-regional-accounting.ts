/** Real inventory + explicitly constant synthetic dynamics; not a forecast. */
import { readFile, writeFile } from "node:fs/promises";
import { constantScenario } from "../server/calculation/emissionsCandidate";
import { projectRegionalMember, REGIONS } from "../server/calculation/regionalEngine";
import { contentHash } from "../server/calculation/analysisManifest";
const inventory = JSON.parse(await readFile("generated-artifacts/regional-inventory/complete-inventory.json", "utf8"));
const scenarios = REGIONS.map(region => ({ region, scenario: { ...constantScenario } }));
const baseline = projectRegionalMember({ inventoryId: inventory.id, memberId: "constant-control",
  cells: inventory.cells, scenarios });
const maxAnnualDeviationGt = Math.max(...baseline.global.map(r => Math.abs(r.reportingGtCO2e - baseline.global[0].reportingGtCO2e)));
if (maxAnnualDeviationGt > 1e-9) throw new Error("Constant-control accounting drift");
const shocked = projectRegionalMember({ inventoryId: inventory.id, memberId: "constant-control",
  cells: inventory.cells, scenarios: scenarios.map(s => s.region === "US"
    ? { ...s, scenario: { ...s.scenario, annualActivityGrowth: .01 } } : s) });
const unaffected = baseline.regions.filter(r => r.region !== "US").every(region =>
  contentHash(region) === contentHash(shocked.regions.find(r => r.region === region.region)!));
if (!unaffected) throw new Error("Regional isolation failure");
const report = { inventoryId: inventory.id, baselineHash: baseline.inputHash, years: 77,
  global2024GtCO2e: baseline.global[0].reportingGtCO2e, maxAnnualDeviationGt, otherRegionsUnchanged: unaffected,
  signedLandSinks: baseline.regions.filter(r => r.trajectory[0].co2LandUseMt < 0).map(r => r.region),
  claim: "actual inventory accounting with synthetic constant and US-activity control dynamics; not a calibrated projection",
  productionEligible: false };
await writeFile("generated-artifacts/regional-inventory/engine-accounting.json", JSON.stringify(report, null, 2));
await writeFile("generated-artifacts/regional-inventory/constant-control-parameters.json", JSON.stringify({
  seed: 20261109, members: 2, parameterVersion: "synthetic-constant-control-not-calibration",
  evidence: ["Accounting control only: regional physical parameters are deliberately synthetic; never promote"],
  rows: [{ id: "constant-control", scenarios }],
}, null, 2));
console.log(JSON.stringify(report, null, 2));
