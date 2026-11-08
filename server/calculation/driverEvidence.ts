import { INDICATORS, type IndicatorKey } from "../dataIngestion/indicatorRegistry";

const mechanisms = new Set<IndicatorKey>(["renewableCapacityGW", "renewableGrowthRate", "evSalesSharePct", "evGrowthRate",
  "gdpTrillionUSD", "carbonIntensityKgPerGDP"]);
const validation = new Set<IndicatorKey>(["fossilCO2GtPerYear", "atmosphericCO2ppm", "co2GrowthRatePpm"]);
export function driverEvidenceRegistry() {
  return INDICATORS.map(d => ({
    id: d.key, definition: d.label, publisher: d.source, rawUnit: d.unit,
    transformedUnit: d.unit, geography: "global", category: d.category,
    role: mechanisms.has(d.key) ? "candidate-mechanism-input" : validation.has(d.key) ? "validation-target" : "context",
    centralModelEligible: false,
    reason: mechanisms.has(d.key) ? "Mechanism exists but regional calibration and uncertainty evidence are incomplete"
      : validation.has(d.key) ? "Outcome check, not an independent abatement multiplier"
      : "No identified incremental causal coefficient; target coverage is not delivery",
    observationPeriod: null, informationAvailableAt: null, vintage: null,
    updateCadence: "existing-monthly-collection-review-approval",
    uncertainty: { status: "unavailable", reason: "Source-specific uncertainty distribution not established" },
    licence: { status: "review-required", publisher: d.source },
    overlapGroup: d.category, regionalApplicability: "not-established",
    missingData: "preserve-null; interior interpolation only when explicitly requested and labelled",
    evidenceState: "Unavailable",
  }));
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
