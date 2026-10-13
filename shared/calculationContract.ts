/** Versioned definitions. Legacy constants are characterization, not validation. */
export const CALCULATION_VERSION = "foundations-1";
export const RNG_VERSION = "mulberry32-midpoint-v1";
export const LEGACY_CLIMATE = Object.freeze({
  version: "legacy-physical-v1", baselineYear: 2024, endYear: 2100,
  baselineEmissionsGt: 60.3, intensityNormalizer: 0.32,
  warmingOffsetC: 1.1, tcreCPerGt: 0.00045,
});
// Kept separate so future physical-model changes cannot silently validate finance heuristics.
export const LEGACY_FINANCE = Object.freeze({
  version: "legacy-finance-v1", baselineYear: 2024, endYear: 2100,
  annualEmissionsGt: 60.3, warmingOffsetC: 1.1, tcreCPerGt: 0.00045,
  carbonPriceHorizonYears: 6, nearZeroFraction: 0.05,
});

export type Quantity<Unit extends string> =
  | { status: "available"; value: number; unit: Unit }
  | { status: "unavailable"; value: null; unit: Unit; reason: string };

/** Future physical inputs cannot be confused with GWP-weighted reporting totals. */
export type NativeGasAnnualInput =
  | { year: number; species: "CO2"; emissions: Quantity<"GtCO2/year"> }
  | { year: number; species: "CH4"; emissions: Quantity<"MtCH4/year"> }
  | { year: number; species: "N2O"; emissions: Quantity<"MtN2O/year"> };
export interface GhgReportingTotal {
  year: number;
  emissions: Quantity<"GtCO2e/year">;
  gwpBasis: "AR6-GWP100" | "unspecified-legacy";
}
export interface FinancialInputMetadata {
  observationDate: string;
  informationAvailableAt: string | null;
  currency: string | null;
  monetaryScale: number | null;
  classificationAsOf: string | null;
  target: null | { baseYear: number; endYear: number; scope: string; type: "absolute" | "intensity" };
}

export function quantity<U extends string>(value: number | null | undefined, unit: U): Quantity<U> {
  if (value == null) return { status: "unavailable", value: null, unit, reason: "Not supplied" };
  if (!Number.isFinite(value)) throw new Error(`Non-finite quantity (${unit})`);
  return { status: "available", value, unit };
}

export interface CalculationContext {
  contractVersion: typeof CALCULATION_VERSION;
  engine: "legacy-physical" | "legacy-finance";
  assumptionVersion: string;
  observationYear: number | null;
  forecastStartYear: number | null;
  informationAvailableAt: string | null;
  endYear: number | null;
  scenario: string;
  seed: number | null;
  rngVersion: string | null;
  units: {
    emissions: "GtCO2e-legacy-unreconciled";
    nativeGasInputs: "not-yet-implemented";
    gwpBasis: "unspecified-legacy";
    gdpPriceBasis: "unverified";
    currency: string | null;
    currencyScale: string | null;
  };
  uncertainty: "conditional-legacy-not-validated";
  validation: "characterization-only";
}

export function legacyContext(startYear: number, scenario: string, seed = startYear * 12345): CalculationContext {
  return {
    contractVersion: CALCULATION_VERSION, engine: "legacy-physical",
    assumptionVersion: LEGACY_CLIMATE.version,
    // Mixed historical/nowcast inputs do not establish a common observed year or publication date.
    observationYear: null, forecastStartYear: startYear, informationAvailableAt: null,
    endYear: LEGACY_CLIMATE.endYear, scenario, seed, rngVersion: RNG_VERSION,
    units: { emissions: "GtCO2e-legacy-unreconciled", nativeGasInputs: "not-yet-implemented",
      gwpBasis: "unspecified-legacy", gdpPriceBasis: "unverified", currency: null, currencyScale: null },
    uncertainty: "conditional-legacy-not-validated", validation: "characterization-only",
  };
}

/** Stable row selection/reduction order, before imputation or aggregation. */
export function orderCalculationRows<T extends { companyId: number; date: Date; id?: number }>(rows: T[]): T[] {
  for (const row of rows) {
    if (!Number.isFinite(row.companyId) || !(row.date instanceof Date) || !Number.isFinite(row.date.getTime())) {
      throw new Error("Calculation row requires a valid company and date");
    }
  }
  return [...rows].sort((a, b) => a.companyId - b.companyId ||
    a.date.getTime() - b.date.getTime() || (a.id ?? 0) - (b.id ?? 0));
}
