import {
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getTemperatureStats,
  type IndicatorData,
} from "./forwardProjection";
import { getAllHistoricalIndicatorsWithNowcast, computeEmpiricalCarbonIntensityDeclineRate } from "./historicalIndicators";
import { historicalTrajectoryMetrics } from "./historicalMetrics";
import { applyCategoryModifications, type Category } from "./categoryProjections";
import type { ThresholdDiagnostic } from "../../shared/thresholdDiagnostic";
import { selectedTrajectoryThresholdContext, type ThresholdContext } from "./thresholdDiagnostic";
import { calculationKey } from "./identity";
import { revisedHistoryType, type HistoricalTypeCode } from "../../shared/historicalTypes";

interface CategoryMetrics {
  median: number;
  reductionRate: number;
  netZeroYear: number | null;
  thresholdDiagnostic: ThresholdDiagnostic;
}

export interface CategoryHistoricalTrendPoint {
  historicalTypeCode: HistoricalTypeCode;
  historicalTypeLabel: string;
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

function convertToIndicatorData(hist: any): IndicatorData {
  return {
    renewableCapacityGW: hist.renewableCapacityGW,
    renewableGrowthRate: hist.renewableGrowthRate * 100,
    renewableAcceleration: 1.0,
    evSalesShare: hist.evSalesSharePct,
    evGrowthRate: hist.evGrowthRate * 100,
    policyCoveragePercent: hist.policyCoveragePct,
    policyImplementationRate: hist.policyImplementationRate,
    netZeroTargetsCoverage: hist.policyCoveragePct * 0.9,
    globalGDP: hist.gdpTrillionUSD,
    carbonIntensity: hist.carbonIntensityKgPerGDP,
    carbonIntensityDeclineRate: computeEmpiricalCarbonIntensityDeclineRate(undefined, hist.year),
    sbtiCompaniesPercent: hist.corporateTargetsPct,
    corporateImplementationRate: hist.corporateImplementationRate,
    cleanEnergyInvestmentTrn: hist.cleanEnergyInvestmentTrn ?? 0.27,
    fossilFuelInvestmentTrn: hist.fossilFuelInvestmentTrn ?? 0.9,
    greenBondIssuanceBln: hist.greenBondIssuanceBln ?? 3.4,
    fossilCO2GtPerYear: hist.fossilCO2GtPerYear ?? 33.4,
    atmosphericCO2ppm: hist.atmosphericCO2ppm ?? 390,
    co2GrowthRatePpm: hist.co2GrowthRatePpm ?? 2.0,
  };
}

function computeMetrics(indicators: IndicatorData, year: number, iterations: number, thresholdContext?: ThresholdContext,
  selected2024InputsPresent = false) {
  const trajectory = calculateEmissionsTrajectory(indicators, year, 2100, iterations);
  const tempDist = calculateTemperatureDistribution(trajectory, iterations);
  const tempStats = getTemperatureStats(tempDist, trajectory);

  const selectedContext = thresholdContext ?? selectedTrajectoryThresholdContext(selected2024InputsPresent ? trajectory : [],
    calculationKey("selected-category-history-inputs", indicators, { year }),
    calculationKey("selected-category-history-trajectory", indicators, { year, iterations }));
  const { reductionRate, netZeroYear, thresholdDiagnostic } = historicalTrajectoryMetrics(trajectory, selectedContext);

  return { median: tempStats.median, reductionRate, netZeroYear, thresholdDiagnostic };
}

const CATEGORIES: Category[] = ['technology', 'policy', 'corporate', 'socioeconomic', 'financial', 'emissions'];
const ITERATIONS = 500;

export function getCategoryHistoricalTrend(
  thresholdContextForCase?: (year: number, category: Category | "all") => ThresholdContext | undefined,
): CategoryHistoricalTrendPoint[] {
  const allData = getAllHistoricalIndicatorsWithNowcast();

  return allData.map((data) => {
    const baseIndicators = convertToIndicatorData(data);
    const year = data.year;
    const selected2024InputsPresent = allData.some(row => row.year === 2024 && !row.isNowcast);

    const allMetrics = computeMetrics(baseIndicators, year, ITERATIONS, thresholdContextForCase?.(year, "all"), selected2024InputsPresent);

    const categoryMetrics: Record<string, CategoryMetrics> = {};
    for (const cat of CATEGORIES) {
      const modified = applyCategoryModifications(baseIndicators, cat);
      categoryMetrics[cat] = computeMetrics(modified, year, ITERATIONS, thresholdContextForCase?.(year, cat), selected2024InputsPresent);
    }

    return {
      ...revisedHistoryType,
      year,
      all: allMetrics,
      technology: categoryMetrics.technology,
      policy: categoryMetrics.policy,
      corporate: categoryMetrics.corporate,
      socioeconomic: categoryMetrics.socioeconomic,
      financial: categoryMetrics.financial,
      emissions: categoryMetrics.emissions,
      isNowcast: (data as any).isNowcast || false,
    };
  });
}
