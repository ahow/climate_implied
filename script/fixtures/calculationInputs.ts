import type { IndicatorData } from "../../server/calculation/forwardProjection";
import type { CvCompany, CvTimeSeries } from "../../shared/schema";

// Synthetic/public-number characterization fixture. No uploaded company data.
export const inputs: IndicatorData = {
  renewableCapacityGW: 4443, renewableGrowthRate: 15.1, renewableAcceleration: 1,
  evSalesShare: 20.5, evGrowthRate: 25, policyCoveragePercent: 60,
  policyImplementationRate: 0.5, netZeroTargetsCoverage: 54,
  globalGDP: 110, carbonIntensity: 0.36, carbonIntensityDeclineRate: 1.5,
  sbtiCompaniesPercent: 38, corporateImplementationRate: 0.5,
  cleanEnergyInvestmentTrn: 2, fossilFuelInvestmentTrn: 1,
  greenBondIssuanceBln: 700, fossilCO2GtPerYear: 37.6,
  atmosphericCO2ppm: 424.6, co2GrowthRatePpm: 3.53,
};
export const companies = [1, 2, 3].map(id => ({
  id, name: `Synthetic ${id}`, sector: "Synthetic sector", subSector: null,
  industry: null, sdgAlignmentScore: id - 2, emissionTarget2050: -50,
})) as CvCompany[];
export const rows = companies.flatMap(company => [0, 1, 2].map(month => ({
  id: company.id * 10 + month, companyId: company.id,
  date: new Date(Date.UTC(2024, month, 28)), marketCap: 100,
  netProfit: company.id * 5, peRatio: 20 / company.id,
  totalReturnIndex: 100 * Math.pow(1 + company.id / 100, month),
  scope1Emissions: company.id * 10, scope2Emissions: 2, scope3Emissions: null,
}))) as CvTimeSeries[];
export const backtestSettings = {
  signal: "decarb_gap", scoringMethod: "sector_relative",
  trackingErrorPercent: 2, costOfEquity: 0.08,
  projectedRatePercent: 2.5, lag: "legacy-one-quarter",
  status: "characterization-only; not point-in-time validation",
};
