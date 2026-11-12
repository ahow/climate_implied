import {
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getTemperatureStats,
  type IndicatorData,
} from "./forwardProjection";
import { historicalTrajectoryMetrics } from "./historicalMetrics";
import type { ThresholdDiagnostic } from "../../shared/thresholdDiagnostic";
import { selectedTrajectoryThresholdContext, type ThresholdContext } from "./thresholdDiagnostic";
import { calculationKey } from "./identity";
import { revisedHistoryType, type HistoricalTypeCode } from "../../shared/historicalTypes";
import { getAllHistoricalIndicators, getAllHistoricalIndicatorsWithNowcast, computeEmpiricalCarbonIntensityDeclineRate } from "./historicalIndicators";

export interface HistoricalTrendPoint {
  historicalTypeCode: HistoricalTypeCode;
  historicalTypeLabel: string;
  year: number;
  median: number;
  p10: number;
  p90: number;
  reductionRate: number;
  netZeroYear: number | null;
  thresholdDiagnostic: ThresholdDiagnostic;
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

export function getRecalculatedHistoricalTrend(
  thresholdContextForYear?: (year: number) => ThresholdContext | undefined,
): HistoricalTrendPoint[] {
  const allData = getAllHistoricalIndicatorsWithNowcast();

  return allData.map((data) => {
    const indicators = convertToIndicatorData(data);
    const trajectory = calculateEmissionsTrajectory(indicators, data.year, 2100, 1000);
    const tempDist = calculateTemperatureDistribution(trajectory, 1000);
    const tempStats = getTemperatureStats(tempDist, trajectory);

    const selected2024InputsPresent = allData.some(row => row.year === 2024 && !row.isNowcast);
    const selectedContext = thresholdContextForYear?.(data.year) ?? selectedTrajectoryThresholdContext(
      selected2024InputsPresent ? trajectory : [],
      calculationKey("selected-history-inputs", allData),
      calculationKey("selected-history-trajectory", indicators, { year: data.year, runs: 1000 }));
    const { reductionRate, netZeroYear, thresholdDiagnostic } = historicalTrajectoryMetrics(trajectory, selectedContext);

    return {
      ...revisedHistoryType,
      year: data.year,
      median: tempStats.median,
      p10: tempStats.p10,
      p90: tempStats.p90,
      reductionRate,
      netZeroYear,
      thresholdDiagnostic,
      isNowcast: (data as any).isNowcast || false,
    };
  });
}
