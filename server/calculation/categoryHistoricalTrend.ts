import {
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getTemperatureStats,
  type IndicatorData,
  type ForwardProjection,
} from "./forwardProjection";
import { getAllHistoricalIndicatorsWithNowcast } from "./historicalIndicators";
import { applyCategoryModifications, type Category } from "./categoryProjections";

export interface CategoryHistoricalTrendPoint {
  year: number;
  all: { median: number; reductionRate: number; netZeroYear: number | null };
  technology: { median: number; reductionRate: number; netZeroYear: number | null };
  policy: { median: number; reductionRate: number; netZeroYear: number | null };
  corporate: { median: number; reductionRate: number; netZeroYear: number | null };
  socioeconomic: { median: number; reductionRate: number; netZeroYear: number | null };
  financial: { median: number; reductionRate: number; netZeroYear: number | null };
  emissions: { median: number; reductionRate: number; netZeroYear: number | null };
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
    carbonIntensityDeclineRate: 2.5,
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

function computeMetrics(indicators: IndicatorData, year: number, iterations: number) {
  const trajectory = calculateEmissionsTrajectory(indicators, year, 2100, iterations);
  const tempDist = calculateTemperatureDistribution(trajectory, iterations);
  const tempStats = getTemperatureStats(tempDist, trajectory);

  const emissionsStart = trajectory[0]?.emissions || 60;
  const emissionsDecadeLater = trajectory[10]?.emissions || 55;
  const reductionRate = -((Math.pow(emissionsDecadeLater / emissionsStart, 1 / 10) - 1) * 100);

  let netZeroYear: number | null = null;
  const netZeroPoint = trajectory.find((p: ForwardProjection) => p.p50 <= 5.0);
  if (netZeroPoint) {
    netZeroYear = netZeroPoint.year;
  } else if (trajectory.length > 0) {
    const finalPoint = trajectory[trajectory.length - 1];
    const firstPoint = trajectory[0];
    const yearsElapsed = finalPoint.year - firstPoint.year;
    const totalReduction = firstPoint.p50 - finalPoint.p50;
    const avgAnnualReduction = totalReduction / yearsElapsed;
    if (avgAnnualReduction > 0 && finalPoint.p50 > 5.0) {
      const yearsToNetZero = (finalPoint.p50 - 5.0) / avgAnnualReduction;
      netZeroYear = Math.round(finalPoint.year + yearsToNetZero);
    }
  }

  return { median: tempStats.median, reductionRate, netZeroYear };
}

const CATEGORIES: Category[] = ['technology', 'policy', 'corporate', 'socioeconomic', 'financial', 'emissions'];
const ITERATIONS = 500;

export function getCategoryHistoricalTrend(): CategoryHistoricalTrendPoint[] {
  const allData = getAllHistoricalIndicatorsWithNowcast();

  return allData.map((data) => {
    const baseIndicators = convertToIndicatorData(data);
    const year = data.year;

    const allMetrics = computeMetrics(baseIndicators, year, ITERATIONS);

    const categoryMetrics: Record<string, { median: number; reductionRate: number; netZeroYear: number | null }> = {};
    for (const cat of CATEGORIES) {
      const modified = applyCategoryModifications(baseIndicators, cat);
      categoryMetrics[cat] = computeMetrics(modified, year, ITERATIONS);
    }

    return {
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
