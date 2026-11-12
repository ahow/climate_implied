import { readFileSync } from "node:fs";
import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { constantScenario, projectInventoryEmissions, sectorOf, type EmissionsScenario } from "./emissionsCandidate";
import { exactMemberAttribution } from "./memberAttribution";
import { NATIVE_PRODUCER_SCENARIO } from "../../shared/nativeConsumer";
import { headlineDrilldownLabels, type HeadlineDrilldown, type HeadlineDrilldownMode } from "../../shared/headlineDrilldown";
import { verifiedProducer } from "../producerDownload";
import { verifyNativeCandidateMaterial } from "../snapshots/nativeCandidateProducer";
import { loadMaterialArchive } from "../snapshots/materialInputs";

export const headlineSelectionSchema = z.object({
  parent: z.string().regex(/^[a-f0-9]{64}$/),
  year: z.coerce.number().int().min(2024).max(2100),
  region: z.string().min(1).optional(),
  sector: z.string().min(1).optional(),
  gas: z.string().min(1).optional(),
  driver: z.string().min(1).optional(),
}).strict();
const driverGroups: Record<string, (keyof EmissionsScenario)[]> = {
  activity: ["annualActivityGrowth", "residualIntensityImprovement", "sectorPathways"],
  electricity: ["renewableCapacityGW", "renewableAdditionsGW", "renewableRetirement", "capacityFactor",
    "fossilGenerationTWh", "annualPowerDemandGrowth", "nuclearGenerationTWh"],
  road: ["evSalesShare", "evFleetShare", "evLogitGrowth", "reversal", "fleetTurnover",
    "passengerTransportFraction", "evTailpipeReduction", "fullElectricFleetDemandTWh"],
  policy: ["incrementalPolicyCoverage", "policyImplementation"],
  corporate: ["corporateCoverage", "corporateDelivery"],
  delivery: ["maximumAbatement", "deliveryLagYears", "deliveryTimeYears", "measures"],
};
const codeFiles = ["server/calculation/headlineDrilldown.ts", "server/calculation/memberAttribution.ts",
  "server/headlineDrilldownApi.ts", "shared/headlineDrilldown.ts"];
const codeHash = () => contentHash(Object.fromEntries(codeFiles.map(path => [path, readFileSync(path, "utf8")])));
const equivalent = (a: unknown, b: unknown) => contentHash(a ?? null) === contentHash(b ?? null);

/** Only the actual public native producer is supported. Verification replays its
 * retained inputs and exact engine bytes. No arbitrary submitted coalition,
 * ensemble, research report, private archive or lookalike result is admitted. */
export async function deriveHeadlineDrilldown(loaded: any, raw: unknown, mode: HeadlineDrilldownMode,
  load: typeof loadMaterialArchive = loadMaterialArchive): Promise<HeadlineDrilldown> {
  const selection = headlineSelectionSchema.parse(raw);
  if (!Object.hasOwn(headlineDrilldownLabels, mode) || loaded.manifest.scenario !== NATIVE_PRODUCER_SCENARIO)
    throw new Error("Selected headline has no supported retained public native drilldown material");
  const parent = verifiedProducer(selection.parent, loaded, loaded.result);
  await verifyNativeCandidateMaterial(parent.materialInputsId, loaded.manifest, loaded.result, load);
  const material = await load(parent.materialInputsId, "native-candidate-material");
  const input = await load(material.inputArchive, "native-candidate-inputs");
  if (selection.region && selection.region !== "Global")
    throw new Error("Regional drilldown unavailable: selected headline retains no country allocation or matched regional driver parents; international transport cannot be inferred from global sector totals");
  const scenario: EmissionsScenario = loaded.result.result.scenario;
  const uncovered = Object.keys(scenario).filter(key => key !== "name" &&
    !Object.values(driverGroups).flat().includes(key as keyof EmissionsScenario));
  if (uncovered.length) throw new Error(`Unassigned scenario driver fields: ${uncovered.join(", ")}`);
  const groups = Object.fromEntries(Object.entries(driverGroups).filter(([, keys]) =>
    keys.some(key => !equivalent(scenario[key], constantScenario[key]))));
  const names = Object.keys(groups).sort();
  const cells = input.inventory.cells;
  const runs = new Map<number, ReturnType<typeof projectInventoryEmissions>["trajectory"][number]>();
  for (let mask = 0; mask < 2 ** names.length; mask++) {
    const current: EmissionsScenario = structuredClone(constantScenario);
    current.name = "retained-headline-chosen-baseline-coalition-not-calibrated";
    names.forEach((group, index) => {
      if (mask & (1 << index)) for (const key of groups[group]) {
        if (scenario[key] === undefined) delete (current as any)[key];
        else (current as any)[key] = structuredClone(scenario[key]);
      }
    });
    const run = projectInventoryEmissions(current, selection.year, cells, true);
    runs.set(mask, run.trajectory.at(-1)!);
  }
  const fullMask = 2 ** names.length - 1;
  const baseline = runs.get(0)!, target = runs.get(fullMask)!;
  const parentPoint = loaded.result.result.trajectory.find((row: any) => row.year === selection.year);
  if (!parentPoint || !equivalent(target.nativeMt, parentPoint.nativeMt) ||
    !equivalent(target.reportingGtCO2e, parentPoint.reportingGtCO2e))
    throw new Error("Drilldown target does not reconcile exactly to selected headline");
  let reconciliationNativeMt = 0;
  const allRows = cells.flatMap((cell: any, cellIndex: number) => {
    const base = baseline.nativeCellsMt![cellIndex], end = target.nativeCellsMt![cellIndex];
    const result = names.length ? exactMemberAttribution({
      manifestId: parent.manifestId, baselineId: contentHash(constantScenario), targetId: parent.resultId,
      unit: "GtCO2e", memberIds: [material.memberId], groups: names,
      // The accounting kernel is unit-linear. Convert native Mt to the
      // supported GtCO2e unit for calculation, then convert back below.
      coalitions: Array.from(runs, ([mask, run]) => ({
        groups: names.filter((_, i) => mask & (1 << i)),
        values: [run.nativeCellsMt![cellIndex] * cell.gwp100 / 1000],
      })),
    }) : null;
    const contributions = result?.contributions ?? [{ group: "unchanged-control", values: [0] }];
    const sum = contributions.reduce((total, contribution) =>
      total + contribution.values[0] * 1000 / cell.gwp100, 0);
    reconciliationNativeMt = Math.max(reconciliationNativeMt, Math.abs(end - base - sum));
    return contributions.map(contribution => {
      const driverIndex = names.indexOf(contribution.group);
      const revertedDriverNativeMt = mode === "sensitivities" ?
        driverIndex < 0 ? end : runs.get(fullMask & ~(1 << driverIndex))!.nativeCellsMt![cellIndex] : null;
      const valueNativeMt = mode === "contributions" ? contribution.values[0] * 1000 / cell.gwp100 :
        end - revertedDriverNativeMt!;
      return { region: "Global", sector: sectorOf(cell.sector), sectorCode: cell.sector, gas: cell.gas,
        driver: contribution.group, year: selection.year, memberId: material.memberId,
        baselineNativeMt: base, targetNativeMt: end, revertedDriverNativeMt, valueNativeMt, gwp100: cell.gwp100,
        valueGtCO2e: valueNativeMt * cell.gwp100 / 1000 };
    });
  });
  if (!Number.isFinite(reconciliationNativeMt) || reconciliationNativeMt > 1e-8)
    throw new Error("Signed per-cell contribution reconciliation failed");
  for (const key of ["sector", "gas", "driver"] as const)
    if (selection[key] && !allRows.some((row: any) => row[key] === selection[key]))
      throw new Error(`Unknown or unavailable ${key} selection`);
  const rows = allRows.filter((row: any) =>
    (["sector", "gas", "driver"] as const).every(key => !selection[key] || row[key] === selection[key]));
  const derivationBase = {
    codeHash: codeHash(), method: mode === "contributions" ? "exact-Shapley" : "target-minus-single-driver-reversion",
    baseline: "constant-activity-control; explicit chosen diagnostic baseline, not a second retained headline",
    groups, reconciliationNativeMt, parentReportingGtCO2e: parentPoint.reportingGtCO2e,
    targetReportingGtCO2e: target.reportingGtCO2e,
    filters: "Exact region/sector/gas/driver equality after full signed cell accounting; no absolute-value shares, rounding, clipping, missing-to-zero, or native-gas summation",
  };
  const derivation = { id: contentHash({ parent, selection, mode, derivationBase, rows,
    memberId: material.memberId, seed: material.seed }), ...derivationBase };
  return {
    version: "headline-drilldown-1", mode, label: headlineDrilldownLabels[mode], parent,
    memberId: material.memberId, seed: material.seed, selection, derivation, rows,
    limitations: [
      "Conditional native emissions candidate, not an accepted ensemble, calibrated forecast, temperature or causal attribution.",
      "Global only: no retained country-level allocation, six-region members or international-transport split. None is invented or borrowed.",
      "Signed land cells remain signed. Native Mt values are comparable only within the same gas; GtCO2e is AR6 GWP100 reporting, not a temperature-model input.",
      "Land and international transport cannot be redistributed across regions. A sector label is not a country or bunker allocation.",
      "Baseline/target columns repeat per driver; never sum them over drivers. Contributions sum to target minus baseline per source cell; one-at-a-time sensitivities are nonadditive.",
      "Derived replay has its own code and content identity; parent identity describes the retained headline only. No new producer material or scientific acceptance is asserted.",
    ], scientificAcceptance: false,
  };
}
