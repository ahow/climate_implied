import { getOverride, getOverrideYears } from "../dataIngestion/overrideStore";

export interface HistoricalIndicatorData {
  year: number;
  renewableCapacityGW: number;
  renewableGrowthRate: number;
  evSalesSharePct: number;
  evGrowthRate: number;
  policyCoveragePct: number;
  policyImplementationRate: number;
  gdpTrillionUSD: number;
  carbonIntensityKgPerGDP: number;
  corporateTargetsPct: number;
  corporateImplementationRate: number;
  climateConcernPct: number;
  policySupportPct: number;
  sacrificeWillingnessPct: number;
  humanCausationPct: number;
  cleanEnergyInvestmentTrn: number;
  fossilFuelInvestmentTrn: number;
  greenBondIssuanceBln: number;
  fossilDivestmentTrn: number;
  fossilCO2GtPerYear: number;
  atmosphericCO2ppm: number;
  co2GrowthRatePpm: number;
  remainingBudget15C_Gt: number;
}

export const HISTORICAL_INDICATORS: HistoricalIndicatorData[] = [
  {
    year: 2010,
    renewableCapacityGW: 1340,
    renewableGrowthRate: 0.085,
    evSalesSharePct: 0.01,
    evGrowthRate: 2.00,
    policyCoveragePct: 20,
    policyImplementationRate: 0.20,
    gdpTrillionUSD: 66.0,
    carbonIntensityKgPerGDP: 0.50,
    corporateTargetsPct: 0,
    corporateImplementationRate: 0.30,
    climateConcernPct: 28,
    policySupportPct: 72,
    sacrificeWillingnessPct: 60,
    humanCausationPct: 58,
    cleanEnergyInvestmentTrn: 0.27,
    fossilFuelInvestmentTrn: 0.70,
    greenBondIssuanceBln: 1.0,
    fossilDivestmentTrn: 0.0,
    fossilCO2GtPerYear: 31.7,
    atmosphericCO2ppm: 390.1,
    co2GrowthRatePpm: 2.42,
    remainingBudget15C_Gt: 570,
  },
  {
    year: 2011,
    renewableCapacityGW: 1455,
    renewableGrowthRate: 0.086,
    evSalesSharePct: 0.05,
    evGrowthRate: 1.50,
    policyCoveragePct: 22,
    policyImplementationRate: 0.22,
    gdpTrillionUSD: 73.3,
    carbonIntensityKgPerGDP: 0.49,
    corporateTargetsPct: 0,
    corporateImplementationRate: 0.32,
    climateConcernPct: 27,
    policySupportPct: 72,
    sacrificeWillingnessPct: 59,
    humanCausationPct: 57,
    cleanEnergyInvestmentTrn: 0.32,
    fossilFuelInvestmentTrn: 0.72,
    greenBondIssuanceBln: 2.0,
    fossilDivestmentTrn: 0.0,
    fossilCO2GtPerYear: 32.5,
    atmosphericCO2ppm: 391.9,
    co2GrowthRatePpm: 1.75,
    remainingBudget15C_Gt: 538,
  },
  {
    year: 2012,
    renewableCapacityGW: 1570,
    renewableGrowthRate: 0.079,
    evSalesSharePct: 0.12,
    evGrowthRate: 1.20,
    policyCoveragePct: 28,
    policyImplementationRate: 0.26,
    gdpTrillionUSD: 74.8,
    carbonIntensityKgPerGDP: 0.48,
    corporateTargetsPct: 0.5,
    corporateImplementationRate: 0.35,
    climateConcernPct: 27,
    policySupportPct: 73,
    sacrificeWillingnessPct: 60,
    humanCausationPct: 58,
    cleanEnergyInvestmentTrn: 0.33,
    fossilFuelInvestmentTrn: 0.74,
    greenBondIssuanceBln: 3.4,
    fossilDivestmentTrn: 0.0,
    fossilCO2GtPerYear: 33.1,
    atmosphericCO2ppm: 394.1,
    co2GrowthRatePpm: 2.21,
    remainingBudget15C_Gt: 505,
  },
  {
    year: 2013,
    renewableCapacityGW: 1690,
    renewableGrowthRate: 0.076,
    evSalesSharePct: 0.20,
    evGrowthRate: 0.90,
    policyCoveragePct: 35,
    policyImplementationRate: 0.30,
    gdpTrillionUSD: 75.6,
    carbonIntensityKgPerGDP: 0.47,
    corporateTargetsPct: 0.5,
    corporateImplementationRate: 0.38,
    climateConcernPct: 28,
    policySupportPct: 74,
    sacrificeWillingnessPct: 62,
    humanCausationPct: 59,
    cleanEnergyInvestmentTrn: 0.35,
    fossilFuelInvestmentTrn: 0.78,
    greenBondIssuanceBln: 11.0,
    fossilDivestmentTrn: 0.0,
    fossilCO2GtPerYear: 33.6,
    atmosphericCO2ppm: 396.7,
    co2GrowthRatePpm: 2.68,
    remainingBudget15C_Gt: 472,
  },
  {
    year: 2014,
    renewableCapacityGW: 1825,
    renewableGrowthRate: 0.080,
    evSalesSharePct: 0.35,
    evGrowthRate: 0.80,
    policyCoveragePct: 40,
    policyImplementationRate: 0.33,
    gdpTrillionUSD: 79.0,
    carbonIntensityKgPerGDP: 0.46,
    corporateTargetsPct: 1,
    corporateImplementationRate: 0.40,
    climateConcernPct: 30,
    policySupportPct: 74,
    sacrificeWillingnessPct: 63,
    humanCausationPct: 60,
    cleanEnergyInvestmentTrn: 0.40,
    fossilFuelInvestmentTrn: 0.85,
    greenBondIssuanceBln: 37.0,
    fossilDivestmentTrn: 0.05,
    fossilCO2GtPerYear: 33.9,
    atmosphericCO2ppm: 398.8,
    co2GrowthRatePpm: 2.07,
    remainingBudget15C_Gt: 438,
  },
  {
    year: 2015,
    renewableCapacityGW: 1985,
    renewableGrowthRate: 0.088,
    evSalesSharePct: 0.6,
    evGrowthRate: 0.70,
    policyCoveragePct: 45,
    policyImplementationRate: 0.35,
    gdpTrillionUSD: 75.8,
    carbonIntensityKgPerGDP: 0.45,
    corporateTargetsPct: 2,
    corporateImplementationRate: 0.45,
    climateConcernPct: 32,
    policySupportPct: 75,
    sacrificeWillingnessPct: 65,
    humanCausationPct: 62,
    cleanEnergyInvestmentTrn: 0.47,
    fossilFuelInvestmentTrn: 0.82,
    greenBondIssuanceBln: 42.0,
    fossilDivestmentTrn: 2.6,
    fossilCO2GtPerYear: 34.1,
    atmosphericCO2ppm: 401.0,
    co2GrowthRatePpm: 2.20,
    remainingBudget15C_Gt: 404,
  },
  {
    year: 2016,
    renewableCapacityGW: 2152,
    renewableGrowthRate: 0.084,
    evSalesSharePct: 0.8,
    evGrowthRate: 0.60,
    policyCoveragePct: 52,
    policyImplementationRate: 0.38,
    gdpTrillionUSD: 76.4,
    carbonIntensityKgPerGDP: 0.44,
    corporateTargetsPct: 4,
    corporateImplementationRate: 0.48,
    climateConcernPct: 37,
    policySupportPct: 76,
    sacrificeWillingnessPct: 66,
    humanCausationPct: 65,
    cleanEnergyInvestmentTrn: 0.50,
    fossilFuelInvestmentTrn: 0.80,
    greenBondIssuanceBln: 81.0,
    fossilDivestmentTrn: 3.4,
    fossilCO2GtPerYear: 34.1,
    atmosphericCO2ppm: 404.4,
    co2GrowthRatePpm: 3.40,
    remainingBudget15C_Gt: 370,
  },
  {
    year: 2017,
    renewableCapacityGW: 2295,
    renewableGrowthRate: 0.066,
    evSalesSharePct: 1.1,
    evGrowthRate: 0.54,
    policyCoveragePct: 58,
    policyImplementationRate: 0.42,
    gdpTrillionUSD: 81.0,
    carbonIntensityKgPerGDP: 0.43,
    corporateTargetsPct: 7,
    corporateImplementationRate: 0.52,
    climateConcernPct: 45,
    policySupportPct: 78,
    sacrificeWillingnessPct: 68,
    humanCausationPct: 68,
    cleanEnergyInvestmentTrn: 0.58,
    fossilFuelInvestmentTrn: 0.79,
    greenBondIssuanceBln: 160.0,
    fossilDivestmentTrn: 5.2,
    fossilCO2GtPerYear: 34.8,
    atmosphericCO2ppm: 406.8,
    co2GrowthRatePpm: 2.35,
    remainingBudget15C_Gt: 335,
  },
  {
    year: 2018,
    renewableCapacityGW: 2480,
    renewableGrowthRate: 0.081,
    evSalesSharePct: 2.1,
    evGrowthRate: 0.72,
    policyCoveragePct: 62,
    policyImplementationRate: 0.45,
    gdpTrillionUSD: 86.6,
    carbonIntensityKgPerGDP: 0.42,
    corporateTargetsPct: 11,
    corporateImplementationRate: 0.56,
    climateConcernPct: 44,
    policySupportPct: 79,
    sacrificeWillingnessPct: 69,
    humanCausationPct: 67,
    cleanEnergyInvestmentTrn: 0.65,
    fossilFuelInvestmentTrn: 0.80,
    greenBondIssuanceBln: 170.0,
    fossilDivestmentTrn: 6.2,
    fossilCO2GtPerYear: 37.1,
    atmosphericCO2ppm: 408.7,
    co2GrowthRatePpm: 1.96,
    remainingBudget15C_Gt: 298,
  },
  {
    year: 2019,
    renewableCapacityGW: 2659,
    renewableGrowthRate: 0.072,
    evSalesSharePct: 2.5,
    evGrowthRate: 0.40,
    policyCoveragePct: 67,
    policyImplementationRate: 0.48,
    gdpTrillionUSD: 87.8,
    carbonIntensityKgPerGDP: 0.41,
    corporateTargetsPct: 16,
    corporateImplementationRate: 0.60,
    climateConcernPct: 44,
    policySupportPct: 80,
    sacrificeWillingnessPct: 70,
    humanCausationPct: 66,
    cleanEnergyInvestmentTrn: 0.72,
    fossilFuelInvestmentTrn: 0.83,
    greenBondIssuanceBln: 258.0,
    fossilDivestmentTrn: 11.0,
    fossilCO2GtPerYear: 37.3,
    atmosphericCO2ppm: 411.7,
    co2GrowthRatePpm: 2.94,
    remainingBudget15C_Gt: 261,
  },
  {
    year: 2020,
    renewableCapacityGW: 2838,
    renewableGrowthRate: 0.067,
    evSalesSharePct: 4.2,
    evGrowthRate: 0.41,
    policyCoveragePct: 72,
    policyImplementationRate: 0.52,
    gdpTrillionUSD: 84.7,
    carbonIntensityKgPerGDP: 0.39,
    corporateTargetsPct: 22,
    corporateImplementationRate: 0.65,
    climateConcernPct: 43,
    policySupportPct: 81,
    sacrificeWillingnessPct: 71,
    humanCausationPct: 64,
    cleanEnergyInvestmentTrn: 0.78,
    fossilFuelInvestmentTrn: 0.68,
    greenBondIssuanceBln: 290.0,
    fossilDivestmentTrn: 14.1,
    fossilCO2GtPerYear: 35.0,
    atmosphericCO2ppm: 414.2,
    co2GrowthRatePpm: 2.58,
    remainingBudget15C_Gt: 226,
  },
  {
    year: 2021,
    renewableCapacityGW: 3087,
    renewableGrowthRate: 0.088,
    evSalesSharePct: 8.6,
    evGrowthRate: 1.08,
    policyCoveragePct: 78,
    policyImplementationRate: 0.58,
    gdpTrillionUSD: 96.1,
    carbonIntensityKgPerGDP: 0.40,
    corporateTargetsPct: 28,
    corporateImplementationRate: 0.70,
    climateConcernPct: 43,
    policySupportPct: 82,
    sacrificeWillingnessPct: 72,
    humanCausationPct: 64,
    cleanEnergyInvestmentTrn: 0.95,
    fossilFuelInvestmentTrn: 0.75,
    greenBondIssuanceBln: 633.0,
    fossilDivestmentTrn: 40.5,
    fossilCO2GtPerYear: 36.6,
    atmosphericCO2ppm: 416.5,
    co2GrowthRatePpm: 2.21,
    remainingBudget15C_Gt: 190,
  },
  {
    year: 2022,
    renewableCapacityGW: 3382,
    renewableGrowthRate: 0.096,
    evSalesSharePct: 13.8,
    evGrowthRate: 0.68,
    policyCoveragePct: 82,
    policyImplementationRate: 0.62,
    gdpTrillionUSD: 101.6,
    carbonIntensityKgPerGDP: 0.38,
    corporateTargetsPct: 32,
    corporateImplementationRate: 0.75,
    climateConcernPct: 42,
    policySupportPct: 83,
    sacrificeWillingnessPct: 73,
    humanCausationPct: 64,
    cleanEnergyInvestmentTrn: 1.15,
    fossilFuelInvestmentTrn: 0.90,
    greenBondIssuanceBln: 487.0,
    fossilDivestmentTrn: 40.5,
    fossilCO2GtPerYear: 37.2,
    atmosphericCO2ppm: 418.6,
    co2GrowthRatePpm: 2.11,
    remainingBudget15C_Gt: 153,
  },
  {
    year: 2023,
    renewableCapacityGW: 3870,
    renewableGrowthRate: 0.144,
    evSalesSharePct: 17.8,
    evGrowthRate: 0.35,
    policyCoveragePct: 85,
    policyImplementationRate: 0.65,
    gdpTrillionUSD: 105.0,
    carbonIntensityKgPerGDP: 0.37,
    corporateTargetsPct: 35,
    corporateImplementationRate: 0.79,
    climateConcernPct: 43,
    policySupportPct: 83,
    sacrificeWillingnessPct: 74,
    humanCausationPct: 64,
    cleanEnergyInvestmentTrn: 1.70,
    fossilFuelInvestmentTrn: 0.95,
    greenBondIssuanceBln: 620.0,
    fossilDivestmentTrn: 40.5,
    fossilCO2GtPerYear: 37.0,
    atmosphericCO2ppm: 421.1,
    co2GrowthRatePpm: 2.52,
    remainingBudget15C_Gt: 116,
  },
  {
    year: 2024,
    renewableCapacityGW: 4443,
    renewableGrowthRate: 0.151,
    evSalesSharePct: 20.5,
    evGrowthRate: 0.25,
    policyCoveragePct: 87,
    policyImplementationRate: 0.67,
    gdpTrillionUSD: 108.5,
    carbonIntensityKgPerGDP: 0.36,
    corporateTargetsPct: 38,
    corporateImplementationRate: 0.82,
    climateConcernPct: 42,
    policySupportPct: 84,
    sacrificeWillingnessPct: 75,
    humanCausationPct: 64,
    cleanEnergyInvestmentTrn: 2.00,
    fossilFuelInvestmentTrn: 1.00,
    greenBondIssuanceBln: 700.0,
    fossilDivestmentTrn: 40.6,
    fossilCO2GtPerYear: 37.6,
    atmosphericCO2ppm: 424.6,
    co2GrowthRatePpm: 3.53,
    remainingBudget15C_Gt: 78,
  },
  {
    year: 2025,
    renewableCapacityGW: 5800,
    renewableGrowthRate: 0.140,
    evSalesSharePct: 26.0,
    evGrowthRate: 0.27,
    policyCoveragePct: 77,
    policyImplementationRate: 0.67,
    gdpTrillionUSD: 117.2,
    carbonIntensityKgPerGDP: 0.35,
    corporateTargetsPct: 40,
    corporateImplementationRate: 0.82,
    climateConcernPct: 43,
    policySupportPct: 84,
    sacrificeWillingnessPct: 74,
    humanCausationPct: 64,
    cleanEnergyInvestmentTrn: 2.20,
    fossilFuelInvestmentTrn: 1.05,
    greenBondIssuanceBln: 750.0,
    fossilDivestmentTrn: 41.0,
    fossilCO2GtPerYear: 38.1,
    atmosphericCO2ppm: 427.0,
    co2GrowthRatePpm: 2.40,
    remainingBudget15C_Gt: 40,
  },
];

/**
 * Empirical carbon-intensity decline rate (% per year), derived from the observed
 * carbonIntensityKgPerGDP series rather than a hardcoded assumption. Computed as the
 * CAGR of carbon intensity over the available window (optionally trailing N years).
 * Falls back to a conservative 2.0% if data is insufficient.
 */
export function computeEmpiricalCarbonIntensityDeclineRate(trailingYears?: number): number {
  const data = resolveSeries();
  if (data.length < 2) return 2.0;
  const series = trailingYears && trailingYears < data.length ? data.slice(-trailingYears) : data;
  const first = series[0].carbonIntensityKgPerGDP;
  const last = series[series.length - 1].carbonIntensityKgPerGDP;
  const years = series[series.length - 1].year - series[0].year;
  if (first <= 0 || last <= 0 || years <= 0) return 2.0;
  const cagr = Math.pow(last / first, 1 / years) - 1;
  return Math.max(0, -cagr * 100);
}

// Indicator field keys (everything except `year`). Used by the resolver and the
// nowcast extrapolation so both stay in sync with the data interface.
const INDICATOR_FIELD_KEYS: (keyof HistoricalIndicatorData)[] = [
  "renewableCapacityGW", "renewableGrowthRate", "evSalesSharePct", "evGrowthRate",
  "policyCoveragePct", "policyImplementationRate", "gdpTrillionUSD", "carbonIntensityKgPerGDP",
  "corporateTargetsPct", "corporateImplementationRate", "climateConcernPct",
  "policySupportPct", "sacrificeWillingnessPct", "humanCausationPct",
  "cleanEnergyInvestmentTrn", "fossilFuelInvestmentTrn", "greenBondIssuanceBln",
  "fossilDivestmentTrn", "fossilCO2GtPerYear", "atmosphericCO2ppm",
  "co2GrowthRatePpm", "remainingBudget15C_Gt",
];

/**
 * Resolve the curated baseline against any APPROVED overrides held in the
 * in-memory override store, for years WITHIN the curated range only. With zero
 * approved overrides this returns a faithful copy of the curated array (identical
 * values), so model output is unchanged. Approved values replace individual
 * (indicator, year) cells.
 *
 * Approved years BEYOND the curated range are intentionally NOT appended here:
 * doing so would clone every (non-overridden) indicator into an authoritative
 * future row and suppress nowcast extrapolation for the other indicators. Those
 * future-year overrides are overlaid per-cell onto the nowcast rows instead (see
 * getAllHistoricalIndicatorsWithNowcast).
 */
function resolveSeries(): HistoricalIndicatorData[] {
  const rows: HistoricalIndicatorData[] = HISTORICAL_INDICATORS.map((r) => ({ ...r }));
  for (const row of rows) {
    for (const key of INDICATOR_FIELD_KEYS) {
      const o = getOverride(key as string, row.year);
      if (o !== undefined) (row as any)[key] = o;
    }
  }
  return rows;
}

export function getHistoricalIndicators(year: number): HistoricalIndicatorData | null {
  return resolveSeries().find((d) => d.year === year) || null;
}

export function getAllHistoricalIndicators(): HistoricalIndicatorData[] {
  return resolveSeries();
}

export interface NowcastIndicatorData extends HistoricalIndicatorData {
  isNowcast: boolean;
}

function momentumDecayExtrapolate(points: number[], yearsAhead: number, decayRate: number = 0.5): number {
  const n = points.length;
  if (n < 2) return points[n - 1] ?? 0;
  const lastValue = points[n - 1];
  const xMean = (n - 1) / 2;
  const yMean = points.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (points[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  const slope = den !== 0 ? num / den : 0;
  let cumulative = 0;
  for (let y = 1; y <= yearsAhead; y++) {
    cumulative += slope * Math.pow(1 - decayRate, y);
  }
  return lastValue + cumulative;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getAllHistoricalIndicatorsWithNowcast(): NowcastIndicatorData[] {
  const currentYear = new Date().getFullYear();
  const resolved = resolveSeries();
  const lastDataYear = resolved[resolved.length - 1].year;

  const base: NowcastIndicatorData[] = resolved.map((d) => ({ ...d, isNowcast: false }));

  // Extend the nowcast horizon to cover any approved future-year overrides so a
  // value approved for a year beyond the curated range still appears (and feeds
  // the model) without cloning a whole authoritative row in resolveSeries.
  const overrideYears = getOverrideYears();
  const maxOverrideYear = overrideYears.length ? Math.max(...overrideYears) : lastDataYear;
  const targetYear = Math.max(currentYear, maxOverrideYear);

  if (targetYear <= lastDataYear) return base;

  const fitWindow = 3;
  const recentData = resolved.slice(-fitWindow);

  const keys: (keyof HistoricalIndicatorData)[] = INDICATOR_FIELD_KEYS;

  const bounds: Record<string, [number, number]> = {
    renewableGrowthRate: [0, 0.5],
    evGrowthRate: [-0.5, 2],
    policyCoveragePct: [0, 100],
    policyImplementationRate: [0, 1],
    carbonIntensityKgPerGDP: [0.05, 1],
    corporateTargetsPct: [0, 100],
    corporateImplementationRate: [0, 1],
    climateConcernPct: [0, 100],
    policySupportPct: [0, 100],
    sacrificeWillingnessPct: [0, 100],
    humanCausationPct: [0, 100],
    evSalesSharePct: [0, 100],
    renewableCapacityGW: [0, 50000],
    gdpTrillionUSD: [0, 500],
    cleanEnergyInvestmentTrn: [0, 20],
    fossilFuelInvestmentTrn: [0, 10],
    greenBondIssuanceBln: [0, 5000],
    fossilDivestmentTrn: [0, 200],
    fossilCO2GtPerYear: [20, 60],
    atmosphericCO2ppm: [350, 600],
    co2GrowthRatePpm: [0, 10],
    remainingBudget15C_Gt: [0, 1000],
  };

  for (let yr = lastDataYear + 1; yr <= targetYear; yr++) {
    const yearsAhead = yr - lastDataYear;
    const nowcast: any = { year: yr, isNowcast: true };

    for (const key of keys) {
      // An approved override for this future cell is authoritative — use it
      // directly instead of the extrapolated estimate. Non-overridden indicators
      // are still nowcast-extrapolated from the curated window.
      const override = getOverride(key as string, yr);
      if (override !== undefined) {
        nowcast[key] = override;
        continue;
      }
      const series = recentData.map((d) => d[key] as number);
      let projected = momentumDecayExtrapolate(series, yearsAhead);
      const [lo, hi] = bounds[key] || [-Infinity, Infinity];
      projected = clamp(projected, lo, hi);
      nowcast[key] = Math.round(projected * 1000) / 1000;
    }

    base.push(nowcast as NowcastIndicatorData);
  }

  return base;
}
