import { z } from "zod";
import { candidateInventory, projectInventoryEmissions, type EmissionsScenario } from "./emissionsCandidate";
import { reconcileRegionalInventory } from "./regionalInventory";
import { contentHash } from "./analysisManifest";

export const REGIONS = ["China", "EU27", "India", "International transport", "Rest of World", "US"] as const;
const schema = z.object({
  inventoryId: z.string().min(1), memberId: z.string().min(1),
  cells: z.array(z.object({
    region: z.enum(REGIONS), gas: z.string().min(1), sector: z.string().min(1),
    nativeMt: z.number().finite(),
  }).strict()).min(1).max(10000),
  scenarios: z.array(z.object({
    region: z.enum(REGIONS), scenario: z.record(z.unknown()),
  }).strict()).length(6),
}).strict();

/** Each region carries explicitly supplied parameters; no global proxy is
 * silently copied into regional drivers. This constructs emissions, not temperature.
 */
export function projectRegionalMember(input: unknown, endYear = 2100) {
  const x = schema.parse(input);
  const cells = [...x.cells].sort((a, b) =>
    [a.region, a.sector, a.gas].join("|").localeCompare([b.region, b.sector, b.gas].join("|")));
  const keys = cells.map(c => [c.region, c.sector, c.gas].join("|"));
  if (new Set(keys).size !== keys.length || new Set(cells.map(c => c.region)).size !== 6 ||
      new Set(x.scenarios.map(s => s.region)).size !== 6)
    throw new Error("Exactly six unique regional accounts and scenario definitions required");
  const inventory = candidateInventory();
  const reconciliation = reconcileRegionalInventory(cells, inventory.cells);
  if (!reconciliation.passed) throw new Error("Regional inventory does not reconcile to the frozen global inventory");
  const lookup = new Map(inventory.cells.map(c => [`${c.sector}|${c.gas}`, c.gwp100]));
  const scenarios = [...x.scenarios].sort((a, b) => a.region.localeCompare(b.region));
  const regions = scenarios.map(({ region, scenario }) => {
    const source = cells.filter(c => c.region === region).map(c => ({
      gas: c.gas, sector: c.sector, nativeMt: c.nativeMt, gwp100: lookup.get(`${c.sector}|${c.gas}`)!,
    }));
    const result = projectInventoryEmissions(scenario as unknown as EmissionsScenario, endYear, source, true);
    return { region, cells: source, trajectory: result.trajectory };
  });
  const global = regions[0].trajectory.map((row, i) => {
    const nativeMt: Record<string, number> = {}, sectorsGtCO2e: Record<string, number> = {};
    let reportingGtCO2e = 0, co2FossilMt = 0, co2LandUseMt = 0;
    for (const region of regions) {
      const r = region.trajectory[i];
      for (const [gas, mt] of Object.entries(r.nativeMt)) nativeMt[gas] = (nativeMt[gas] ?? 0) + mt;
      for (const [sector, gt] of Object.entries(r.sectorsGtCO2e)) sectorsGtCO2e[sector] = (sectorsGtCO2e[sector] ?? 0) + gt;
      reportingGtCO2e += r.reportingGtCO2e;
      co2FossilMt += r.co2FossilMt; co2LandUseMt += r.co2LandUseMt;
    }
    if (Math.abs(Object.values(sectorsGtCO2e).reduce((s, v) => s + v, 0) - reportingGtCO2e) >
        1e-9 * Math.max(Math.abs(reportingGtCO2e), 1e-12)) throw new Error("Global sector accounting failed");
    return { year: row.year, nativeMt, sectorsGtCO2e, reportingGtCO2e, co2FossilMt, co2LandUseMt };
  });
  return { version: "regional-native-member-1", inputHash: contentHash({ ...x, cells, scenarios, endYear }),
    inventoryId: x.inventoryId, memberId: x.memberId, regions, global,
    evidenceState: "Bounded/conditional estimate", claim: "conditional emissions scenario; not a validated forecast",
    temperature: null, productionEligible: false };
}
