import inventory from "./data/inventory2024.json";
import { calculationKey } from "./identity";

export const EMISSIONS_ENGINE_VERSION = "native-emissions-candidate-1";
export type Sector = "power" | "transport" | "industry" | "buildings" | "agriculture" | "other" | "land";
export function sectorOf(code: string): Sector {
  if (code === "LULUCF") return "land";
  if (code === "1.A.1.a") return "power";
  if (code.startsWith("1.A.3")) return "transport";
  if (["1.A.4.a", "1.A.4.b"].includes(code)) return "buildings";
  if (code.startsWith("3") || code === "1.A.4.c") return "agriculture";
  if (code.startsWith("2") || code.startsWith("1.A.2")) return "industry";
  return "other";
}
export interface EmissionsScenario {
  name: string;
  annualActivityGrowth: number;
  residualIntensityImprovement: number;
  evSalesShare: number;
  evFleetShare: number;
  evLogitGrowth: number;
  reversal: boolean;
  fleetTurnover: number;
  passengerTransportFraction: number;
  evTailpipeReduction: number;
  fullElectricFleetDemandTWh: number;
  renewableCapacityGW: number;
  renewableAdditionsGW: number;
  renewableRetirement: number;
  capacityFactor: number;
  fossilGenerationTWh: number;
  annualPowerDemandGrowth: number;
  incrementalPolicyCoverage: number;
  policyImplementation: number;
  corporateCoverage: number;
  corporateDelivery: number;
  maximumAbatement: number;
  deliveryLagYears: number;
  deliveryTimeYears: number;
}
// Diagnostic counterfactual, NOT a central forecast or a calibrated scenario.
export const constantScenario: EmissionsScenario = {
  name: "constant-activity-control", annualActivityGrowth: 0, residualIntensityImprovement: 0,
  evSalesShare: .04, evFleetShare: .04, evLogitGrowth: 0, reversal: false, fleetTurnover: 1 / 15,
  passengerTransportFraction: .5, evTailpipeReduction: 1, fullElectricFleetDemandTWh: 2500,
  renewableCapacityGW: 4443, renewableAdditionsGW: 0, renewableRetirement: 0,
  capacityFactor: .3, fossilGenerationTWh: 18000, annualPowerDemandGrowth: 0,
  incrementalPolicyCoverage: 0, policyImplementation: 0, corporateCoverage: 0,
  corporateDelivery: 0, maximumAbatement: 0, deliveryLagYears: 2, deliveryTimeYears: 15,
};
export const illustrativeScenario: EmissionsScenario = {
  ...constantScenario, name: "illustrative-transition-not-calibrated",
  evSalesShare: .2, evLogitGrowth: .06, renewableAdditionsGW: 300, renewableRetirement: .02,
  incrementalPolicyCoverage: .2, policyImplementation: .6, corporateCoverage: .2,
  corporateDelivery: .6, maximumAbatement: .3,
};
function validate(s: EmissionsScenario, endYear: number) {
  if (!s.name || !Number.isInteger(endYear) || endYear < 2024 || endYear > 2100) throw new Error("Invalid scenario/horizon");
  for (const [key, template] of Object.entries(constantScenario)) {
    const value = s[key as keyof EmissionsScenario];
    if (typeof template === "number" && (typeof value !== "number" || !Number.isFinite(value)))
      throw new Error(`Non-finite or missing ${key}`);
  }
  if (typeof s.reversal !== "boolean") throw new Error("Reversal must be explicit");
  const fractions: (keyof EmissionsScenario)[] = ["residualIntensityImprovement", "evSalesShare", "evFleetShare",
    "fleetTurnover", "passengerTransportFraction", "evTailpipeReduction", "renewableRetirement", "capacityFactor",
    "incrementalPolicyCoverage", "policyImplementation", "corporateCoverage", "corporateDelivery", "maximumAbatement"];
  for (const key of fractions) if (typeof s[key] !== "number" || Number(s[key]) < 0 || Number(s[key]) > 1) throw new Error(`Invalid fraction ${key}`);
  if (s.evLogitGrowth < 0 && !s.reversal) throw new Error("Declining EV adoption requires an explicit reversal scenario");
  if (s.evSalesShare < s.evFleetShare && !s.reversal) throw new Error("Sales below the initial fleet share require an explicit reversal scenario");
  if (s.annualActivityGrowth <= -1 || s.annualPowerDemandGrowth <= -1 || s.fossilGenerationTWh <= 0 ||
      s.deliveryTimeYears <= 0 || s.deliveryLagYears < 0 || s.renewableCapacityGW < 0 ||
      s.renewableAdditionsGW < 0 || s.fullElectricFleetDemandTWh < 0) throw new Error("Invalid physical scenario parameter");
}
export function projectNativeEmissions(s: EmissionsScenario, endYear = 2100) {
  validate(s, endYear);
  let capacity = s.renewableCapacityGW, fleet = s.evFleetShare;
  const baseRenewableTWh = capacity * 8.76 * s.capacityFactor;
  const basePassengerShare = Math.max(1e-12, 1 - s.evFleetShare);
  const trajectory = [];
  for (let year = 2024; year <= endYear; year++) {
    const t = year - 2024;
    const sales = s.evSalesShare === 0 || s.evSalesShare === 1 ? s.evSalesShare :
      1 / (1 + (1 / s.evSalesShare - 1) * Math.exp(-s.evLogitGrowth * t));
    if (t > 0) {
      const previousSales = s.evSalesShare === 0 || s.evSalesShare === 1 ? s.evSalesShare :
        1 / (1 + (1 / s.evSalesShare - 1) * Math.exp(-s.evLogitGrowth * (t - 1)));
      fleet += (previousSales - fleet) * s.fleetTurnover;
      capacity = capacity * (1 - s.renewableRetirement) + s.renewableAdditionsGW;
    }
    const renewableTWh = capacity * 8.76 * s.capacityFactor;
    const evDemandTWh = (fleet - s.evFleetShare) * s.fullElectricFleetDemandTWh;
    const demandTWh = (s.fossilGenerationTWh + baseRenewableTWh) * Math.pow(1 + s.annualPowerDemandGrowth, t) + evDemandTWh;
    if (!Number.isFinite(demandTWh) || demandTWh < 0) throw new Error("Invalid electricity demand");
    const utilizedRenewableTWh = Math.min(renewableTWh, Math.max(0, demandTWh));
    const fossilTWh = Math.max(0, demandTWh - utilizedRenewableTWh);
    const delivery = 1 - Math.exp(-Math.max(0, t - s.deliveryLagYears) / s.deliveryTimeYears);
    const policy = s.incrementalPolicyCoverage * s.policyImplementation * s.maximumAbatement * delivery;
    const corporate = s.corporateCoverage * s.corporateDelivery * s.maximumAbatement * delivery;
    const activity = Math.pow((1 + s.annualActivityGrowth) * (1 - s.residualIntensityImprovement), t);
    const nativeMt: Record<string, number> = {}, sectorsGtCO2e: Record<string, number> = {};
    let reportingGtCO2e = 0, co2FossilMt = 0, co2LandUseMt = 0;
    for (const c of inventory.cells) {
      const sector = sectorOf(c.sector);
      // Land-use and non-CO2 remain explicit constant pathways until their own
      // activity/process assumptions are supplied; no aggregate CO2e decay.
      let factor = 1;
      if (c.gas === "CO2" && sector !== "land") {
        const technical = sector === "power" ? Math.max(0, 1 - fossilTWh / s.fossilGenerationTWh) :
          c.sector.startsWith("1.A.3.b") ? Math.max(0, (fleet - s.evFleetShare) / basePassengerShare) * s.passengerTransportFraction * s.evTailpipeReduction : 0;
        // Conservative complete-overlap rule: reductions target the same stock.
        // Do not add policy/corporate promises on top of delivered technology.
        factor = 1 - Math.max(technical, policy, corporate);
        if (sector === "power") factor += Math.max(0, fossilTWh / s.fossilGenerationTWh - 1);
        else factor *= activity;
        if (c.sector.startsWith("1.A.3.b") && s.reversal && fleet < s.evFleetShare)
          factor += (s.evFleetShare - fleet) * s.passengerTransportFraction * s.evTailpipeReduction;
      }
      const mt = c.nativeMt * factor;
      if (!Number.isFinite(mt) || mt < 0) throw new Error("Invalid native inventory output");
      nativeMt[c.gas] = (nativeMt[c.gas] ?? 0) + mt;
      if (c.gas === "CO2") {
        if (sector === "land") co2LandUseMt += mt;
        else co2FossilMt += mt;
      }
      const co2e = mt * c.gwp100 / 1000;
      sectorsGtCO2e[sector] = (sectorsGtCO2e[sector] ?? 0) + co2e;
      reportingGtCO2e += co2e;
    }
    trajectory.push({ year, status: t === 0 ? "inventory" : "scenario-not-observation", nativeMt,
      reportingGtCO2e, sectorsGtCO2e, co2FossilMt, co2LandUseMt, evSalesShare: sales, evFleetShare: fleet,
      power: { capacityGW: capacity, renewableTWh, utilizedRenewableTWh, fossilTWh, demandTWh } });
  }
  return { version: EMISSIONS_ENGINE_VERSION, key: calculationKey("native-emissions", inventory, { scenario: s, endYear }, EMISSIONS_ENGINE_VERSION),
    validation: "mechanism-tests-only", temperature: null, inventoryYear: 2024, scenario: s, trajectory };
}
export function candidateInventory() { return inventory; }
