import {
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getCurrentIndicators,
  getTemperatureStats,
  type IndicatorData,
  type ForwardProjection,
} from "./forwardProjection";

export type Category = 'technology' | 'policy' | 'corporate' | 'socioeconomic' | 'financial' | 'emissions';

export interface CategoryProjectionResult {
  category: Category;
  categoryName: string;
  temperatureRise: number;
  reductionRate: number;
  netZeroYear: number | null;
  trajectory: ForwardProjection[];
  temperatureDistribution: Array<{ temperature: number; probability: number }>;
}

function calculateReductionRate(emissions2024: number, emissions2034: number): number {
  const cagr = (Math.pow(emissions2034 / emissions2024, 1 / 10) - 1) * 100;
  return -cagr;
}

function findNetZeroYear(trajectory: ForwardProjection[]): number | null {
  for (const point of trajectory) {
    if (point.p50 <= 5.0) return point.year;
  }
  if (trajectory.length > 0) {
    const finalPoint = trajectory[trajectory.length - 1];
    const firstPoint = trajectory[0];
    const yearsElapsed = finalPoint.year - firstPoint.year;
    const totalReduction = firstPoint.p50 - finalPoint.p50;
    const avgAnnualReduction = totalReduction / yearsElapsed;
    if (avgAnnualReduction > 0 && finalPoint.p50 > 5.0) {
      const yearsToNetZero = (finalPoint.p50 - 5.0) / avgAnnualReduction;
      return Math.round(finalPoint.year + yearsToNetZero);
    }
  }
  return null;
}

/**
 * Applies a stylized "what-if" scenario shock for a single category, holding all
 * other indicators at their current observed values. The multipliers/targets below
 * are deliberately illustrative levers (e.g. renewables pushed to an ambitious
 * 5000 GW, fossil investment cut to 30%) chosen to isolate the directional impact
 * of each category — they are NOT empirical forecasts or calibrated pathways.
 * Treat the resulting temperatures as scenario sensitivities, not predictions.
 */
export function applyCategoryModifications(indicators: IndicatorData, category: Category): IndicatorData {
  return {
    ...indicators,
    renewableCapacityGW: category === 'technology' ? 5000 : indicators.renewableCapacityGW,
    evSalesShare: category === 'technology' ? 50 : indicators.evSalesShare,
    policyCoveragePercent: category === 'policy' ? 100 : (category === 'socioeconomic' ? indicators.policyCoveragePercent * 1.3 : indicators.policyCoveragePercent),
    policyImplementationRate: category === 'policy' ? 1.0 : (category === 'socioeconomic' ? indicators.policyImplementationRate * 1.3 : indicators.policyImplementationRate),
    sbtiCompaniesPercent: category === 'corporate' ? 80 : indicators.sbtiCompaniesPercent,
    corporateImplementationRate: category === 'corporate' ? 1.0 : (category === 'socioeconomic' ? indicators.corporateImplementationRate * 1.2 : indicators.corporateImplementationRate),
    carbonIntensity: category === 'socioeconomic' ? indicators.carbonIntensity * 0.85 : indicators.carbonIntensity,
    cleanEnergyInvestmentTrn: category === 'financial' ? indicators.cleanEnergyInvestmentTrn * 2.5 : indicators.cleanEnergyInvestmentTrn,
    fossilFuelInvestmentTrn: category === 'financial' ? indicators.fossilFuelInvestmentTrn * 0.3 : indicators.fossilFuelInvestmentTrn,
    greenBondIssuanceBln: category === 'financial' ? indicators.greenBondIssuanceBln * 3 : indicators.greenBondIssuanceBln,
    fossilCO2GtPerYear: category === 'emissions' ? indicators.fossilCO2GtPerYear * 0.85 : indicators.fossilCO2GtPerYear,
    co2GrowthRatePpm: category === 'emissions' ? 1.5 : indicators.co2GrowthRatePpm,
  };
}

export function calculateCategoryProjection(
  category: Category,
  year: number = 2024
): CategoryProjectionResult {
  const indicators = getCurrentIndicators();
  const modifiedIndicators = applyCategoryModifications(indicators, category);

  const projections = calculateEmissionsTrajectory(modifiedIndicators, year, 2100, 1000);
  const temperatureDistribution = calculateTemperatureDistribution(projections, 1000);
  const tempStats = getTemperatureStats(temperatureDistribution, projections);

  const emissions2024 = projections[0]?.emissions || 60;
  const emissions2034 = projections[10]?.emissions || 55;

  const categoryNames: Record<Category, string> = {
    technology: 'Technology',
    policy: 'Policy',
    corporate: 'Corporate',
    socioeconomic: 'Socioeconomic',
    financial: 'Financial Flows',
    emissions: 'Emissions Outcomes',
  };

  return {
    category,
    categoryName: categoryNames[category],
    temperatureRise: tempStats.median,
    reductionRate: calculateReductionRate(emissions2024, emissions2034),
    netZeroYear: findNetZeroYear(projections),
    trajectory: projections,
    temperatureDistribution: temperatureDistribution.map(t => ({
      temperature: t.temperature,
      probability: t.probability,
    })),
  };
}

export function calculateAllCategoryProjections(year: number = 2024): CategoryProjectionResult[] {
  const categories: Category[] = ['technology', 'policy', 'corporate', 'socioeconomic', 'financial', 'emissions'];
  return categories.map(category => calculateCategoryProjection(category, year));
}
