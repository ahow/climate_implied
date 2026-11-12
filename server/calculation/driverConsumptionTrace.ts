import type { IndicatorKey } from "../dataIngestion/indicatorRegistry";

/** These are actual legacy equation consumers, not declarations of eligibility.
 * Native Stage 5 only consumes explicitly bound regional registry parameters.
 * Survey/category scenarios are stylized shocks, not use of survey observations. */
const legacy: Record<IndicatorKey, { fields: string[]; mechanism: string }> = {
  renewableCapacityGW: { fields: ["renewableCapacityGW"], mechanism: "projectIndicator capacity buildout -> exponential fossil-power displacement" },
  renewableGrowthRate: { fields: ["renewableGrowthRate"], mechanism: "fraction/yr multiplied by 100 -> uncertain capacity growth" },
  evSalesSharePct: { fields: ["evSalesShare"], mechanism: "projectIndicator sales share -> 1/15 fleet-turnover EMA -> passenger transport displacement" },
  evGrowthRate: { fields: ["evGrowthRate"], mechanism: "fraction/yr multiplied by 100 -> uncertain sales growth -> fleet turnover" },
  policyCoveragePct: { fields: ["policyCoveragePercent", "netZeroTargetsCoverage"], mechanism: "coverage * uncertain implementation * elapsed-time heuristic; derived netZeroTargetsCoverage is validated but unused" },
  policyImplementationRate: { fields: ["policyImplementationRate"], mechanism: "normal mean -> coverage * implementation elapsed-time subtraction" },
  gdpTrillionUSD: { fields: ["globalGDP"], mechanism: "converted and finite-validated only; economic growth uses fixed sampled mean, not observed GDP" },
  carbonIntensityKgPerGDP: { fields: ["carbonIntensity"], mechanism: "baseline intensity scaling; historical intensity series also estimates decline rate" },
  climateConcernPct: { fields: [], mechanism: "no observation consumer in emissions; socioeconomic category uses fixed stylized shocks instead" },
  policySupportPct: { fields: [], mechanism: "no observation consumer in emissions; category labels are not survey calibration" },
  sacrificeWillingnessPct: { fields: [], mechanism: "no observation consumer in emissions" },
  humanCausationPct: { fields: [], mechanism: "no observation consumer in emissions" },
  corporateTargetsPct: { fields: ["sbtiCompaniesPercent"], mechanism: "coverage * corporate delivery * elapsed time -> all-sector heuristic reductions" },
  corporateImplementationRate: { fields: ["corporateImplementationRate"], mechanism: "coverage * corporate delivery * elapsed time -> all-sector heuristic reductions" },
  cleanEnergyInvestmentTrn: { fields: ["cleanEnergyInvestmentTrn"], mechanism: "clean/fossil investment ratio -> financial-flow heuristic reductions" },
  fossilFuelInvestmentTrn: { fields: ["fossilFuelInvestmentTrn"], mechanism: "denominator of clean/fossil ratio, floored at 0.1 -> financial-flow heuristic" },
  greenBondIssuanceBln: { fields: ["greenBondIssuanceBln"], mechanism: "bond momentum capped at 1 -> financial-flow heuristic reductions" },
  fossilDivestmentTrn: { fields: [], mechanism: "no observation consumer in emissions" },
  fossilCO2GtPerYear: { fields: ["fossilCO2GtPerYear"], mechanism: "emissionsValidationFactor -> fading stochastic emissions anchor; not independent abatement" },
  atmosphericCO2ppm: { fields: ["atmosphericCO2ppm"], mechanism: "converted and finite-validated only; no trajectory equation reads the value" },
  co2GrowthRatePpm: { fields: ["co2GrowthRatePpm"], mechanism: "threshold >2.5 -> temporary 0.5% emissions-acceleration heuristic" },
  remainingBudget15C_Gt: { fields: [], mechanism: "accounting/context only; no observation consumer in emissions" },
};

export function driverConsumerTrace(id: IndicatorKey) {
  return {
    legacy: {
      classification: "legacy-diagnostic-not-calibrated-central",
      consumer: "server/calculation/forwardProjection.ts:calculateEmissionsTrajectory",
      historicalAdapters: ["getCurrentIndicatorsFromHistorical", "categoryHistoricalTrend.convertToIndicatorData"],
      categoryConsumer: "server/calculation/categoryProjections.ts:applyCategoryModifications (stylized shocks)",
      ...legacy[id],
      registryGateEnforced: false,
      acceptedForecastUse: "refused-at-calculator-boundary",
      caveat: "Preserved comparator equations; explicit legacy-only use gate rejects central/accepted sensitivity. No native registry eligibility is transferred.",
    },
    stage5: {
      consumer: "consumeRegionalParameterRegistry -> projectRegionalMember -> projectInventoryEmissions",
      implicitCuratedIndicatorConsumption: false,
      gate: "Every actual scenario parameter leaf requires canonical mechanism-input role, permitted use, source-verified evidence and an exact region/path binding; central joint distribution and native inventory require pinned review",
      directCuratedDistribution: null,
      mechanismDeclarations: "server/calculation/nativeMechanisms.ts:nativeMechanismDeclaration",
      dependencyReceipt: "consumeRegionalParameterRegistry.consumption[].mechanism (exact bound path; not curated eligibility)",
      missingBridge: "No approved source-compatible mapping from this curated driver to native regional parameter distributions",
    },
  };
}
