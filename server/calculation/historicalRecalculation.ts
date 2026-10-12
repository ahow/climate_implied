import {
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getTemperatureStats,
  type IndicatorData,
  type ForwardProjection,
} from "./forwardProjection";
import { getAllHistoricalIndicators, getAllHistoricalIndicatorsWithNowcast, computeEmpiricalCarbonIntensityDeclineRate } from "./historicalIndicators";

export interface HistoricalTrendPoint {
  year: number;
  median: number;
  p10: number;
  p90: number;
  reductionRate: number;
  netZeroYear: number | null;
  isNowcast?: boolean;
}

function convertToIndicatorData(hist: ReturnType<typeof getAllHistoricalIndicators>[number]): IndicatorData {
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
    carbonIntensityDeclineRate: computeEmpiricalCarbonIntensityDeclineRate(),
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

export function getRecalculatedHistoricalTrend(): HistoricalTrendPoint[] {
  const allData = getAllHistoricalIndicatorsWithNowcast();

  return allData.map((data) => {
    const indicators = convertToIndicatorData(data);
    const trajectory = calculateEmissionsTrajectory(indicators, data.year, 2100, 1000);
    const tempDist = calculateTemperatureDistribution(trajectory, 1000);
    const tempStats = getTemperatureStats(tempDist, trajectory);

    const emissionsStart = trajectory[0]?.emissions || 60;
    const emissionsEnd = trajectory[10]?.emissions || 55;
    const reductionRate = ((emissionsStart - emissionsEnd) / emissionsStart) * 10;

    let netZeroYear: number | null = null;
    const netZeroPoint = trajectory.find((p: ForwardProjection) => p.emissions <= 5.0);
    if (netZeroPoint) {
      netZeroYear = netZeroPoint.year;
    } else if (trajectory.length > 0) {
      const finalEmissions = trajectory[trajectory.length - 1].emissions;
      const firstEmissions = trajectory[0].emissions;
      const yearsElapsed = trajectory[trajectory.length - 1].year - trajectory[0].year;
      const avgAnnualReduction = (firstEmissions - finalEmissions) / yearsElapsed;
      if (avgAnnualReduction > 0 && finalEmissions > 5.0) {
        const yearsToNetZero = (finalEmissions - 5.0) / avgAnnualReduction;
        netZeroYear = Math.round(trajectory[trajectory.length - 1].year + yearsToNetZero);
      }
    }

    return {
      year: data.year,
      median: tempStats.median,
      p10: tempStats.p10,
      p90: tempStats.p90,
      reductionRate,
      netZeroYear,
      isNowcast: (data as any).isNowcast || false,
    };
  });
}
