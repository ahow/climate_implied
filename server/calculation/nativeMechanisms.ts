import type { EmissionsScenario, NativeInventoryCell, Sector } from "./emissionsCandidate";

/** Equation contracts, not parameter calibration or central-use admission. */
export const NATIVE_MECHANISM_VERSION = "native-mechanisms-1";
export function sectorOf(code: string): Sector {
  if (code === "LULUCF") return "land";
  if (code === "1.A.1.a") return "power";
  if (code.startsWith("1.A.3")) return "transport";
  if (["1.A.4.a", "1.A.4.b"].includes(code)) return "buildings";
  if (code.startsWith("3") || code === "1.A.4.c") return "agriculture";
  if (code.startsWith("2") || code.startsWith("1.A.2")) return "industry";
  return "other";
}
export function roadEligible(c: NativeInventoryCell) {
  return c.gas === "CO2" && c.sector.startsWith("1.A.3.b");
}
export function fossilEligible(c: NativeInventoryCell) {
  return c.gas === "CO2" && sectorOf(c.sector) !== "land";
}
export function powerEligible(c: NativeInventoryCell) {
  return c.gas === "CO2" && sectorOf(c.sector) === "power";
}
/** Aggregate aviation/marine codes do not establish domestic/international
 * coverage. Never infer generic policy or corporate coverage of either. A
 * source-bound exact-code measure can explicitly address those inventories. */
export function genericAbatementEligible(c: NativeInventoryCell) {
  return fossilEligible(c) && !powerEligible(c) &&
    !c.sector.startsWith("1.A.3.a") && !c.sector.startsWith("1.A.3.d");
}
export function laggedDelivery(elapsed: number, lag: number, timeConstant: number) {
  return 1 - Math.exp(-Math.max(0, elapsed - lag) / timeConstant);
}
export function completeOverlap(...reductions: number[]) {
  return Math.max(0, ...reductions);
}

type CellScope = "none" | "power-co2" | "road-and-power-co2" | "road-co2" |
  "activity-co2" | "generic-abatement-co2" | "sector" | "measure";
export interface NativeMechanismDeclaration {
  path: string;
  mechanism: string;
  cellScope: CellScope;
  powerFields: string[];
  adoptionFields: string[];
  effect: "equation" | "permission-only" | "provenance-only";
  overlapGroup: string | null;
  coefficientStatus: "diagnostic-assumption-not-calibrated";
  centralEligibilityTransferred: false;
  timing: string;
  bounds: string;
  saturation: string;
  source: string;
}
const allGeneration = ["demandTWh", "utilizedNuclearTWh", "utilizedRenewableTWh", "fossilTWh"];
const electricLoad = [...allGeneration, "evDemandTWh", "totalEvTWh"];
const capacity = ["capacityGW", "renewableTWh", "utilizedRenewableTWh", "fossilTWh"];
type Spec = [string, CellScope, string[], string[]?];
const scalar: Record<string, Spec> = {
  annualActivityGrowth: ["activity-and-EV-load", "activity-co2", electricLoad],
  residualIntensityImprovement: ["residual-intensity", "activity-co2", []],
  evSalesShare: ["EV-sales-stock-power", "road-and-power-co2", electricLoad, ["evSalesShare", "evFleetShare"]],
  evFleetShare: ["EV-baseline-stock-power", "road-and-power-co2", electricLoad, ["evFleetShare"]],
  evLogitGrowth: ["EV-sales-stock-power", "road-and-power-co2", electricLoad, ["evSalesShare", "evFleetShare"]],
  fleetTurnover: ["EV-stock-power", "road-and-power-co2", electricLoad, ["evFleetShare"]],
  passengerTransportFraction: ["passenger-tailpipe", "road-co2", []],
  evTailpipeReduction: ["passenger-tailpipe", "road-co2", []],
  fullElectricFleetDemandTWh: ["EV-electricity-load", "power-co2", electricLoad],
  renewableCapacityGW: ["renewable-stock-displacement", "power-co2", [...capacity, "demandTWh", "utilizedNuclearTWh"]],
  renewableAdditionsGW: ["renewable-stock-displacement", "power-co2", capacity],
  renewableRetirement: ["renewable-stock-displacement", "power-co2", capacity],
  capacityFactor: ["renewable-generation", "power-co2", ["renewableTWh", ...allGeneration]],
  fossilGenerationTWh: ["fossil-generation-baseline", "power-co2", allGeneration],
  annualPowerDemandGrowth: ["non-EV-electricity-load", "power-co2", allGeneration],
  nuclearGenerationTWh: ["nuclear-generation", "power-co2", [...allGeneration, "nuclearTWh"]],
  incrementalPolicyCoverage: ["policy-delivery", "generic-abatement-co2", []],
  policyImplementation: ["policy-delivery", "generic-abatement-co2", []],
  corporateCoverage: ["corporate-sensitivity", "generic-abatement-co2", []],
  corporateDelivery: ["corporate-sensitivity", "generic-abatement-co2", []],
  maximumAbatement: ["policy-corporate-sensitivity", "generic-abatement-co2", []],
  deliveryLagYears: ["policy-corporate-delivery", "generic-abatement-co2", []],
  deliveryTimeYears: ["policy-corporate-delivery", "generic-abatement-co2", []],
};
export function nativeMechanismDeclaration(path: string): NativeMechanismDeclaration {
  let spec = scalar[path];
  let effect: NativeMechanismDeclaration["effect"] = "equation";
  if (path === "reversal") {
    spec = ["EV-reversal-permission", "none", []];
    effect = "permission-only";
  }
  const sector = path.match(/^sectorPathways\/(transport|industry|buildings|agriculture|other|land)\/(annualActivityGrowth|residualIntensityImprovement|trendEndYear)$/);
  if (sector) spec = ["explicit-sector-pathway", "sector",
    sector[1] === "transport" && sector[2] !== "residualIntensityImprovement" ? electricLoad : []];
  const measure = path.match(/^measures\/\d+\/(id|mechanism|evidence|sectorCodes\/\d+|gases\/\d+|coverage|implementation|maximumReduction|startYear|deliveryYears)$/);
  if (measure) {
    const metadata = ["id", "mechanism", "evidence"].includes(measure[1]);
    spec = [metadata ? "scoped-measure-provenance" : "scoped-native-abatement", metadata ? "none" : "measure", []];
    if (metadata) effect = "provenance-only";
  }
  if (!spec) throw new Error(`Unknown scenario parameter has no actual engine consumer/declaration: ${path}`);
  return { path, mechanism: spec[0], cellScope: spec[1], powerFields: [...spec[2]],
    adoptionFields: [...(spec[3] ?? [])], effect,
    overlapGroup: ["generic-abatement-co2", "measure", "road-co2", "road-and-power-co2"].includes(spec[1])
      ? "same-native-cell-complete-overlap" : null,
    coefficientStatus: "diagnostic-assumption-not-calibrated", centralEligibilityTransferred: false,
    timing: measure ? "Zero through startYear; 1-exp(-max(0,year-startYear)/deliveryYears)" :
      sector ? "Trend compounds through explicit trendEndYear, then freezes; power receives transport activity only, not intensity" :
      spec[1] === "generic-abatement-co2" ? "Zero through 2024+deliveryLagYears; exponential delivery thereafter" :
      path.startsWith("ev") || path === "fleetTurnover" ? "Sales at t-1 replace only fleetTurnover of the stock at t" :
      "Annual stock/balance equation; common baseline inventory at 2024; no dependence on requested horizon",
    bounds: "validate(): finite coefficients; fractions in [0,1]; positive time constants and fossil baseline; growth > -1; signed land never clamped to zero",
    saturation: "EV sales/fleet bounded [0,1]; fossil displacement stops at zero fossil generation; abatement fractions bounded [0,1]; no negative non-land native mass",
    source: "emissionsCandidate.ts:constantScenario and projectInventoryEmissions; inventory2024.json source hashes; equation contract only, not empirical calibration" };
}
/** Reachable native cells, including the explicitly declared EV -> power edge.
 * Aggregates are derived solely from these cells, never a second causal path. */
export function declaredCellDependency(path: string, s: EmissionsScenario, c: NativeInventoryCell) {
  const d = nativeMechanismDeclaration(path);
  switch (d.cellScope) {
    case "none": return false;
    case "power-co2": return powerEligible(c);
    case "road-co2": return roadEligible(c);
    case "road-and-power-co2": return roadEligible(c) || powerEligible(c);
    case "generic-abatement-co2": return genericAbatementEligible(c);
    case "activity-co2": return powerEligible(c)
      ? path === "annualActivityGrowth" && !s.sectorPathways?.transport
      : fossilEligible(c) && !s.sectorPathways?.[sectorOf(c.sector)];
    case "sector": {
      const sector = path.split("/")[1];
      return sectorOf(c.sector) === sector || sector === "transport" &&
        !path.endsWith("/residualIntensityImprovement") && powerEligible(c);
    }
    case "measure": {
      const m = s.measures?.[Number(path.split("/")[1])];
      return !!m && m.sectorCodes.includes(c.sector) && m.gases.includes(c.gas);
    }
  }
}
export function assertNativeMechanismDeclarations(s: EmissionsScenario) {
  function visit(v: unknown, path: string) {
    if (v !== null && typeof v === "object") {
      for (const [k, value] of Object.entries(v)) visit(value, path ? `${path}/${k}` : k);
    } else if (path !== "name") nativeMechanismDeclaration(path);
  }
  visit(s, "");
}
