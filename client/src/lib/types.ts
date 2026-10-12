export interface IndicatorData {
  renewableCapacityGW: number;
  renewableGrowthRate: number;
  renewableAcceleration: number;
  evSalesShare: number;
  evGrowthRate: number;
  policyCoveragePercent: number;
  policyImplementationRate: number;
  netZeroTargetsCoverage: number;
  globalGDP: number;
  carbonIntensity: number;
  carbonIntensityDeclineRate: number;
  sbtiCompaniesPercent: number;
  corporateImplementationRate: number;
  cleanEnergyInvestmentTrn: number;
  fossilFuelInvestmentTrn: number;
  greenBondIssuanceBln: number;
  fossilCO2GtPerYear: number;
  atmosphericCO2ppm: number;
  co2GrowthRatePpm: number;
}

export interface ForwardProjection {
  year: number;
  emissions: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  cumulativeEmissions: number;
}

export interface TemperatureProjection {
  temperature: number;
  probability: number;
  cumulativeProbability: number;
}

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
  isNowcast?: boolean;

}

export interface ProjectionResult {
  emissionsTrajectory: ForwardProjection[];
  temperatureDistribution: {
    median: number;
    mean: number;
    p10: number;
    p90: number;
    pdf: TemperatureProjection[];
  };
  indicators: IndicatorData;
  metrics: {
    reductionRate: number;
    temperatureRise: number;
    netZeroYear: number | null;
    emissions2024: number;
    emissions2034: number;
    emissions2100: number;
  };
}

export interface HistoricalTrendPoint {
  year: number;
  median: number;
  p10: number;
  p90: number;
  reductionRate: number;
  netZeroYear: number | null;
  isNowcast?: boolean;
}

export interface CategoryProjectionResult {
  category: string;
  categoryName: string;
  temperatureRise: number;
  reductionRate: number;
  netZeroYear: number | null;
  trajectory: ForwardProjection[];
  temperatureDistribution: TemperatureProjection[];
}

export interface RegionalProjection {
  region: string;
  regionName: string;
  temperatureRise: number;
  reductionRate: number;
  netZeroYear: number | null;
  carbonIntensity: number;
}

export interface SensitivityResult {
  indicator: string;
  label: string;
  category: string;
  baselineTemperature: number;
  p10Temperature: number;
  p90Temperature: number;
  p10Value: number;
  p90Value: number;
  temperatureRange: number;
  direction: 'positive' | 'negative';
}

export interface CategoryMetrics {
  median: number;
  reductionRate: number;
  netZeroYear: number | null;
}

export interface CategoryHistoricalTrendPoint {
  year: number;
  all: CategoryMetrics;
  technology: CategoryMetrics;
  policy: CategoryMetrics;
  corporate: CategoryMetrics;
  socioeconomic: CategoryMetrics;
  financial: CategoryMetrics;
  emissions: CategoryMetrics;
  isNowcast?: boolean;
}

export type Category = 'all' | 'technology' | 'policy' | 'corporate' | 'socioeconomic' | 'financial' | 'emissions';
export type MetricView = 'temperature' | 'reductionRate' | 'netZero';
