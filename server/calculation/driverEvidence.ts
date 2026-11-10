import { INDICATORS, type IndicatorKey } from "../dataIngestion/indicatorRegistry";
import { HISTORICAL_INDICATORS } from "./historicalIndicators";
import { contentHash } from "./analysisManifest";
import { driverConsumerTrace } from "./driverConsumptionTrace";

const mechanisms = new Set<IndicatorKey>(["renewableCapacityGW", "renewableGrowthRate", "evSalesSharePct", "evGrowthRate",
  "gdpTrillionUSD", "carbonIntensityKgPerGDP"]);
const validation = new Set<IndicatorKey>(["fossilCO2GtPerYear", "atmosphericCO2ppm", "co2GrowthRatePpm"]);
export function driverEvidenceRegistry() {
  return INDICATORS.map(d => {
    const retained = HISTORICAL_INDICATORS.map(r=>({year:r.year,value:r[d.key]}));
    const years = retained.map(r=>r.year);
    const hash = contentHash(retained);
    const derived: Record<string,{formula:string;dependencies:string[]}> = {
      renewableGrowthRate:{formula:"(capacity_t / capacity_t-1) - 1",dependencies:["renewableCapacityGW"]},
      evGrowthRate:{formula:"(salesShare_t / salesShare_t-1) - 1; growth of share, not fleet stock",dependencies:["evSalesSharePct"]},
      carbonIntensityKgPerGDP:{formula:"fossilCO2GtPerYear / gdpTrillionUSD; Gt/tn USD = kg/USD",dependencies:["fossilCO2GtPerYear","gdpTrillionUSD"]},
    };
    const studies: Record<string,string[]> = {
      evSalesSharePct:["docs/EV_Calibration_Protocol.md","docs/EV_and_Cost_Calibration_Results.md"],
      evGrowthRate:["docs/EV_Calibration_Protocol.md","docs/EV_and_Cost_Calibration_Results.md"],
      renewableCapacityGW:["docs/Driver_Calibration_Protocol.md"],
      renewableGrowthRate:["docs/Driver_Calibration_Protocol.md"],
    };
    return ({
    id: d.key, definition: d.label, publisher: d.source, rawUnit: d.unit,
    transformedUnit: d.unit, geography: "global", category: d.category,
    role: mechanisms.has(d.key) ? "candidate-mechanism-input" : validation.has(d.key) ? "validation-target" : "context",
    centralModelEligible: false,
    actualConsumers: driverConsumerTrace(d.key),
    parameterDistribution: {
      status: "unavailable",
      registryVersion: "stage4-source-linked-1",
      loader: "retainedAdoptionParameterRegistry",
      reason: "Retained solar/wind generation-share bootstrap distributions are separately sensitivity-only; not distributions for this curated indicator",
    },
    reason: mechanisms.has(d.key) ? "Mechanism exists but regional calibration and uncertainty evidence are incomplete"
      : validation.has(d.key) ? "Outcome check, not an independent abatement multiplier"
      : "No identified incremental causal coefficient; target coverage is not delivery",
    observationPeriod: { firstYear:Math.min(...years),lastYear:Math.max(...years),
      meaning:"Retained curated row periods; mixed revised observations/estimates, not verification of original observations" },
    informationAvailableAt: null,
    vintage: `retained-curated-history:${hash}`,
    sourceProvenance: {
      retainedInputHash:hash,recordCount:retained.length,
      sourceFile:"server/calculation/historicalIndicators.ts",
      originalPublicationArchive:"unavailable",
      publicationDateMeaning:"Unknown original release date; neither file time nor fetch time substitutes",
      derivation:derived[d.key] ?? {formula:"Retained supplied series, no additional causal coefficient inferred",dependencies:[]},
      frozenStudies:studies[d.key] ?? [],
      calibrationDecision:studies[d.key] ? "Existing frozen evidence retained; not central promotion" :
        "No source-compatible frozen causal calibration; context or validation role retained",
    },
    updateCadence: "existing-monthly-collection-review-approval",
    uncertainty: { status: "unavailable", reason: "Source-specific uncertainty distribution not established" },
    licence: { status: "review-required", publisher: d.source },
    overlapGroup: d.category, regionalApplicability: "not-established",
    missingData: "preserve-null; interior interpolation only when explicitly requested and labelled",
    evidenceState: "Unavailable",
  }); });
}
export function interpolateInterior(points: { year: number; value: number | null }[], year: number) {
  if (!Number.isInteger(year)) throw new Error("Integer year required");
  const sorted = [...points].sort((a, b) => a.year - b.year);
  if (new Set(sorted.map(p => p.year)).size !== sorted.length ||
      sorted.some(p => !Number.isInteger(p.year) || p.value !== null && !Number.isFinite(p.value)))
    throw new Error("Unique years and finite values or explicit null required");
  const exact = sorted.find(p => p.year === year);
  if (exact?.value !== undefined && exact.value !== null) return { value: exact.value, method: "observed", infilled: false };
  const valid = sorted.filter((p): p is { year: number; value: number } => p.value !== null);
  const left = [...valid].reverse().find(p => p.year < year), right = valid.find(p => p.year > year);
  if (!left || !right) return { value: null, method: "unavailable-no-extrapolation", infilled: false };
  return { value: left.value + (right.value - left.value) * (year - left.year) / (right.year - left.year),
    method: "linear-interior-diagnostic", infilled: true, originalValue: exact?.value ?? null,
    sourceYears: [left.year, right.year], uncertainty: "not-quantified" };
}
