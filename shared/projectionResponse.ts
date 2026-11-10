import {z} from "zod";
import {CALCULATION_VERSION} from "./calculationContract";
import { thresholdDiagnosticSchema } from "./thresholdDiagnosticSchema";
export const PROJECTION_RESPONSE_VERSION = "selected-2024-five-percent-response-v2";
const n=z.number().finite(),year=n.int();
const indicatorShape={
 renewableCapacityGW:n,renewableGrowthRate:n,renewableAcceleration:n,evSalesShare:n,evGrowthRate:n,
 policyCoveragePercent:n,policyImplementationRate:n,netZeroTargetsCoverage:n,globalGDP:n,carbonIntensity:n,
 carbonIntensityDeclineRate:n,sbtiCompaniesPercent:n,corporateImplementationRate:n,cleanEnergyInvestmentTrn:n,
 fossilFuelInvestmentTrn:n,greenBondIssuanceBln:n,fossilCO2GtPerYear:n,atmosphericCO2ppm:n,co2GrowthRatePpm:n,
};
/** Validate cached JSON rather than casting unknown data or filling absent fields. */
export const projectionResponseSchema=z.object({
 calculation:z.object({
  contractVersion:z.literal(CALCULATION_VERSION),engine:z.enum(["legacy-physical","legacy-finance"]),
  assumptionVersion:z.string(),observationYear:year.nullable(),forecastStartYear:year.nullable(),
  informationAvailableAt:z.string().nullable(),endYear:year.nullable(),scenario:z.string(),seed:n.nullable(),
  rngVersion:z.string().nullable(),units:z.object({
   emissions:z.literal("GtCO2e-legacy-unreconciled"),nativeGasInputs:z.literal("not-yet-implemented"),
   gwpBasis:z.literal("unspecified-legacy"),gdpPriceBasis:z.literal("unverified"),
   currency:z.string().nullable(),currencyScale:z.string().nullable(),
  }).strict(),uncertainty:z.literal("conditional-legacy-not-validated"),validation:z.literal("characterization-only"),
  inputHash:z.string().min(1),inputRevision:z.string().min(1),runs:n.int().positive(),
  seeds:z.object({emissions:n,temperaturePdf:n,temperatureSummary:n}).strict(),warnings:z.array(z.string()),
 }).strict(),
 emissionsTrajectory:z.array(z.object({year,emissions:n,p10:n,p25:n,p50:n,p75:n,p90:n,cumulativeEmissions:n}).strict()).min(11),
 temperatureDistribution:z.object({median:n,mean:n,p10:n,p90:n,
  pdf:z.array(z.object({temperature:n,probability:n,cumulativeProbability:n}).strict()).min(1)}).strict(),
 indicators:z.object(indicatorShape).strict(),
 metrics:z.object({reductionRate:n,temperatureRise:n,netZeroYear:year.nullable(),
  legacyFixed5Gt:z.object({version:z.literal("fixed-5gt-v1"),year:year.nullable(),
   thresholdValue:z.literal(5),unit:z.literal("GtCO2e"),notNetZero:z.literal(true)}).strict(),
  thresholdDiagnostic:thresholdDiagnosticSchema,emissionsStart:n,emissionsDecadeLater:n,emissions2100:n}).strict(),
}).strict();
export type ProjectionResponse=z.infer<typeof projectionResponseSchema>;
