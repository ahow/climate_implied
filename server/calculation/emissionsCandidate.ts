import inventory from "./data/inventory2024.json";
import { calculationKey } from "./identity";

export const EMISSIONS_ENGINE_VERSION = "native-emissions-candidate-2";
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
export interface SectorPathway {
  annualActivityGrowth: number;
  residualIntensityImprovement: number;
  /** Explicit end of the assumed trend, not the requested output horizon. */
  trendEndYear: number;
}
export interface AbatementMeasure {
  id: string;
  mechanism: "policy" | "corporate" | "process";
  sectorCodes: string[];
  gases: string[];
  coverage: number;
  implementation: number;
  maximumReduction: number;
  startYear: number;
  deliveryYears: number;
  evidence: string;
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
  sectorPathways?: Partial<Record<Sector, SectorPathway>>;
  measures?: AbatementMeasure[];
  /** Other low-carbon generation, kept separate from renewable capacity. */
  nuclearGenerationTWh?: number;
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
  if (!Number.isFinite(s.nuclearGenerationTWh ?? 0) || (s.nuclearGenerationTWh ?? 0) < 0)
    throw new Error("Invalid nuclear generation");
  for (const [sector, p] of Object.entries(s.sectorPathways ?? {})) {
    if (!["power", "transport", "industry", "buildings", "agriculture", "other", "land"].includes(sector) ||
      !p || !Number.isFinite(p.annualActivityGrowth) || p.annualActivityGrowth <= -1 ||
      !Number.isFinite(p.residualIntensityImprovement) || p.residualIntensityImprovement < 0 ||
      p.residualIntensityImprovement > 1 || !Number.isInteger(p.trendEndYear) ||
      p.trendEndYear < 2024 || p.trendEndYear > 2100)
      throw new Error(`Invalid sector pathway ${sector}`);
    if (sector === "power") throw new Error("Power activity must use the electricity balance");
  }
  const ids = new Set<string>();
  for (const m of s.measures ?? []) {
    if (!m.id || ids.has(m.id) || !m.evidence?.trim() ||
      !["policy", "corporate", "process"].includes(m.mechanism) ||
      !m.sectorCodes.length || !m.gases.length ||
      !Number.isInteger(m.startYear) || m.startYear < 2024 || m.startYear > 2100 ||
      !Number.isFinite(m.deliveryYears) || m.deliveryYears <= 0 ||
      [m.coverage, m.implementation, m.maximumReduction].some(v => !Number.isFinite(v) || v < 0 || v > 1))
      throw new Error("Invalid abatement measure");
    // Match exact source codes, never a broad label that accidentally includes
    // aviation, international bunkers, agriculture or land use.
    if (m.sectorCodes.some(code => !inventory.cells.some(c => c.sector === code)) ||
        m.gases.some(gas => !inventory.cells.some(c => c.gas === gas && m.sectorCodes.includes(c.sector))))
      throw new Error(`Unmatched measure scope ${m.id}`);
    if (m.sectorCodes.includes("1.A.1.a"))
      throw new Error("Power abatement requires an explicit fuel-mix or capture mechanism");
    ids.add(m.id);
  }
}
export function projectNativeEmissions(s: EmissionsScenario, endYear = 2100) {
  validate(s, endYear);
  let capacity = s.renewableCapacityGW, fleet = s.evFleetShare;
  const baseRenewableTWh = capacity * 8.76 * s.capacityFactor;
  const nuclearTWh = s.nuclearGenerationTWh ?? 0;
  // EV sales include plug-in hybrids. The coefficient is direct tailpipe
  // displacement, NOT a well-to-wheel factor; grid emissions are below.
  const roadDenominator = 1 - s.evFleetShare * s.evTailpipeReduction;
  if (s.passengerTransportFraction > 0 && roadDenominator <= 0)
    throw new Error("Fully electrified initial fleet has no addressable tailpipe baseline");
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
    const transportPath = s.sectorPathways?.transport;
    const transportYears = transportPath ? Math.min(t, transportPath.trendEndYear - 2024) : t;
    const transportActivity = Math.pow(1 + (transportPath?.annualActivityGrowth ?? s.annualActivityGrowth), transportYears);
    const powerGrowth = Math.pow(1 + s.annualPowerDemandGrowth, t);
    // Remove baseline passenger-EV load before growing other electricity use.
    // Add the entire future passenger-EV load, including activity growth, once.
    const baseDemandTWh = s.fossilGenerationTWh + baseRenewableTWh + nuclearTWh;
    const baseEvTWh = s.evFleetShare * s.fullElectricFleetDemandTWh;
    if (baseEvTWh > baseDemandTWh) throw new Error("EV load exceeds baseline electricity");
    const totalEvTWh = fleet * transportActivity * s.fullElectricFleetDemandTWh;
    const evDemandTWh = totalEvTWh - baseEvTWh;
    const demandTWh = (baseDemandTWh - baseEvTWh) * powerGrowth + totalEvTWh;
    if (!Number.isFinite(demandTWh) || demandTWh < 0) throw new Error("Invalid electricity demand");
    const utilizedNuclearTWh = Math.min(nuclearTWh, demandTWh);
    const utilizedRenewableTWh = Math.min(renewableTWh, Math.max(0, demandTWh - utilizedNuclearTWh));
    const fossilTWh = Math.max(0, demandTWh - utilizedRenewableTWh - utilizedNuclearTWh);
    const delivery = 1 - Math.exp(-Math.max(0, t - s.deliveryLagYears) / s.deliveryTimeYears);
    const policy = s.incrementalPolicyCoverage * s.policyImplementation * s.maximumAbatement * delivery;
    const corporate = s.corporateCoverage * s.corporateDelivery * s.maximumAbatement * delivery;
    const activity = Math.pow((1 + s.annualActivityGrowth) * (1 - s.residualIntensityImprovement), t);
    const nativeMt: Record<string, number> = {}, sectorsGtCO2e: Record<string, number> = {};
    let reportingGtCO2e = 0, co2FossilMt = 0, co2LandUseMt = 0;
    for (const c of inventory.cells) {
      const sector = sectorOf(c.sector);
      const pathway = s.sectorPathways?.[sector];
      const years = pathway ? Math.min(t, pathway.trendEndYear - 2024) : 0;
      // Explicit sector pathways apply in native mass. Without evidence, leave
      // non-CO2 and land at persistence rather than silently inventing a trend.
      const sectorActivity = pathway
        ? Math.pow((1 + pathway.annualActivityGrowth) * (1 - pathway.residualIntensityImprovement), years) : 1;
      let factor = sectorActivity;
      let technical = 0;
      if (c.gas === "CO2" && sector !== "land") {
        technical = sector === "power" ? 1 - fossilTWh / s.fossilGenerationTWh :
          c.sector.startsWith("1.A.3.b") ? (fleet - s.evFleetShare) / roadDenominator * s.passengerTransportFraction * s.evTailpipeReduction : 0;
        // Conservative complete-overlap rule: reductions target the same stock.
        // Do not add policy/corporate promises on top of delivered technology.
        // Generic diagnostic policy assumptions cannot decouple power CO2
        // from the calculated generation balance.
        factor = sector === "power" ? fossilTWh / s.fossilGenerationTWh :
          (1 - Math.max(Math.max(0, technical), policy, corporate) + Math.max(0, -technical)) *
          (pathway ? sectorActivity : activity);
      }
      const reduction = Math.max(0, ...(s.measures ?? [])
        .filter(m => m.sectorCodes.includes(c.sector) && m.gases.includes(c.gas))
        .map(m => m.coverage * m.implementation * m.maximumReduction *
          (1 - Math.exp(-Math.max(0, year - m.startYear) / m.deliveryYears))));
      if (reduction > 0) {
        const referenceActivity = c.gas === "CO2" && sector !== "land" && !pathway ? activity : sectorActivity;
        // Complete overlap: a scoped measure replaces a weaker reduction,
        // never multiplies another reduction against the same baseline.
        factor = Math.min(factor, referenceActivity * (1 - reduction + Math.max(0, -technical)));
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
      power: { capacityGW: capacity, renewableTWh, utilizedRenewableTWh, nuclearTWh,
        utilizedNuclearTWh, fossilTWh, demandTWh, evDemandTWh, totalEvTWh } });
  }
  return { version: EMISSIONS_ENGINE_VERSION, key: calculationKey("native-emissions", inventory, { scenario: s, endYear }, EMISSIONS_ENGINE_VERSION),
    validation: "mechanism-tests-only", temperature: null, inventoryYear: 2024, scenario: s, trajectory };
}
export function candidateInventory() { return inventory; }
