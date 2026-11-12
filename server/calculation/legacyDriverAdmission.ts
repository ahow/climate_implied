import { z } from "zod";
import { curatedDriverRole } from "../../shared/driverAdmission";

/** These equations are a retained comparator, not an alternate route around
 * native-registry admission. Roles describe use; they do not certify a fit. */
const fields = {
  renewableCapacityGW: "renewableCapacityGW", renewableGrowthRate: "renewableGrowthRate",
  renewableAcceleration: "renewableGrowthRate", evSalesShare: "evSalesSharePct",
  evGrowthRate: "evGrowthRate", policyCoveragePercent: "policyCoveragePct",
  policyImplementationRate: "policyImplementationRate", netZeroTargetsCoverage: "policyCoveragePct",
  globalGDP: "gdpTrillionUSD", carbonIntensity: "carbonIntensityKgPerGDP",
  carbonIntensityDeclineRate: "carbonIntensityKgPerGDP", sbtiCompaniesPercent: "corporateTargetsPct",
  corporateImplementationRate: "corporateImplementationRate",
  cleanEnergyInvestmentTrn: "cleanEnergyInvestmentTrn", fossilFuelInvestmentTrn: "fossilFuelInvestmentTrn",
  greenBondIssuanceBln: "greenBondIssuanceBln", fossilCO2GtPerYear: "fossilCO2GtPerYear",
  atmosphericCO2ppm: "atmosphericCO2ppm", co2GrowthRatePpm: "co2GrowthRatePpm",
} as const;

export const legacyComparatorUseSchema = z.object({
  mode: z.literal("legacy-diagnostic"),
}).strict();
export type LegacyComparatorUse = z.infer<typeof legacyComparatorUseSchema>;

export function assertLegacyComparatorUse(use: unknown) {
  const result = legacyComparatorUseSchema.safeParse(use);
  if (!result.success) throw new Error("Legacy coefficients are diagnostic-only; central or accepted sensitivity requires native registry admission");
}

export function legacyCoefficientAdmission() {
  return Object.entries(fields).map(([field, indicator]) => ({
    field, indicator, role: curatedDriverRole(indicator),
    permittedUse: "legacy-diagnostic" as const,
    centralModelEligible: false as const,
    reason: "Preserved comparator coefficient; no source-qualified calibrated causal admission",
  }));
}
