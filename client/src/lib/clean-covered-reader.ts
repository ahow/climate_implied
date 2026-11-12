import { z } from "zod";
import { economicBridgeContracts, type EconomicBridgeDocument } from "@shared/economicBridgeSchema";
import { cleanCoveredSource as source } from "@shared/cleanCoveredSource";
import { apiRequest } from "@/lib/queryClient";
import { exactEconomicJson, readBoundEconomicExport } from "@/lib/economic-export-readback";

const text = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
function exactLiteral<T>(expected: T) {
  return z.custom<T>(value => {
    try { return exactEconomicJson(value) === exactEconomicJson(expected); }
    catch { return false; }
  });
}
const intensity = source.co2Tonnes / source.generationMWh;
const issuer = "PacifiCorp conditional equity-share source case";
const physicalSource = {
  hash: z.literal(source.sha256), publishedAt: z.null(),
  availableBy: z.literal(source.captureBound), availabilityBasis: z.literal("captured-upper-bound"),
  releaseDay: z.literal(source.releaseDay), year: z.literal(2023),
  periodStart: z.literal("2023-01-01"), periodEnd: z.literal("2023-12-31"),
  geography: z.literal(source.geography), kind: z.literal("observed"),
};
const activitySource = z.object({
  ...physicalSource, unit: z.literal("MWh"), locator: z.literal(source.locators.generatorMWh),
}).strict();
const intensitySource = z.object({
  ...physicalSource, kind:z.literal("derived-observation"), unit: z.literal("tonnes-CO2/MWh"), gas: z.literal("CO2"), scope: z.literal("1"),
  locator: z.literal(`Derived ratio ${source.locators.unitCO2}/${source.locators.generatorMWh}; not independent intensity measurement`),
}).strict();
const physicalRow = z.object({
  issuer: z.literal(issuer), unitId: z.literal("EPA6101/BW91"),
  year: z.literal(2023), geography: z.literal(source.geography), scope: z.literal("1"), gas: z.literal("CO2"),
  activity: z.literal(source.generationMWh), activityUnit: z.literal("MWh"),
  intensity: z.literal(intensity), intensityDenominator: z.literal("MWh"),
  intensityNumerator: z.literal("tonnes-native-gas"), ownership: z.literal(source.ownership.fraction),
  basis: z.literal("full-unit-before-ownership"), channel: z.literal("operational"),
  parentResultHash: hash, parentActivityPointer: z.literal("/activity"),
  parentYearPointer: z.literal("/year"), parentUnitPointer: z.literal("/unit"),
  activitySource, intensitySource,
  emissionsTonnes: z.literal(source.generationMWh * intensity * source.ownership.fraction),
  lineage: z.object({ activity: activitySource, intensity: intensitySource, parentResultHash: hash }).strict(),
  formula: z.literal("full-unit activity × compatible native-gas intensity × ownership (once)"),
}).strict().refine(row => row.parentResultHash === row.lineage.parentResultHash);
const assumptions = z.object({
  attribution: z.literal("80% equity-share only; not operational-control inventory"),
  ownershipSource: exactLiteral(source.ownership),
  period: z.literal("2023 calendar observed reconstruction"),
  universe: z.literal("One provisional source case, not the accepted workbook population"),
  selection: z.literal("One declared accounting case; not a statistical uncertainty interval"),
  unitJoin: z.literal("Same ORISPL6101; publisher reports one unit and one generator; source/unit IDs explicit, no capacity allocation"),
}).strict();
const totalKey = JSON.stringify([2023, source.geography, "1", "CO2", "operational"]);
const emissions = source.generationMWh * intensity * source.ownership.fraction;
const scenario = z.object({
  id: z.literal("declared-equity-share"), assumptions, assumptionHash: hash,
  status: z.literal("conditional"), reasons: z.array(z.never()).length(0),
  rows: z.array(physicalRow).length(1), totals: exactLiteral({ [totalKey]: emissions }),
}).strict();
const reportSchema = z.object({
  version: z.literal("clean-covered-public-1"),
  source: exactLiteral(source),
  observed: z.object({
    generationMWh: z.literal(1776490), co2Tonnes: z.literal(2215360.4693472),
  }).strict(),
  calculated: z.object({
    nativeIntensityTonnesPerMWh: z.literal(1.2470435912091822),
    conditionalEquityShareCO2Tonnes: z.literal(1772288.37547776),
    conditionalEquityShareMWh: z.literal(1421192),
    unitPlantCO2Difference: z.literal(0), generatorPlantMWhDifference: z.literal(0),
    reportedRateDifferenceKgPerMWh: z.literal(intensity * 1000 - source.reportedRateKgPerMWh),
    facilityMinusElectricityUnitCO2Tonnes: z.literal(source.comparison.facilityCo2Tonnes - source.co2Tonnes),
  }).strict(),
  covered: z.object({
    version: z.literal("covered-physical-paths-1"), inputHash: hash,
    population: z.array(z.literal(issuer)).length(1), years: z.array(z.literal(2023)).length(1),
    scenarios: z.array(scenario).length(1),
    ranges: z.array(z.object({
      key: z.literal(totalKey), missingScenarioIds: z.array(z.never()).length(0),
      min: z.literal(emissions), max: z.literal(emissions),
    }).strict()).length(1),
    expanded: z.null(), expansionReason: z.literal("No evidenced sector-region expansion model/denominator"),
    claim: z.literal("Conditional native-gas accounting; scopes/channels are not additive; no avoided-emissions or market inference"),
    stage7: z.object({
      status: z.literal("unavailable"), reason: text,
      warming2100: z.object({ median: z.null(), mean: z.null(), p10: z.null(), p90: z.null() }).strict(),
      netZeroYears: z.object({ ghg: z.null(), co2: z.null() }).strict(),
      probabilityNetZero2050: z.object({ ghg: z.null(), co2: z.null() }).strict(),
      reductionRates: z.object({ period2024_2030: z.null(), period2030_2050: z.null(), period2050_2100: z.null() }).strict(),
    }).strict(),
    scientificAcceptance: z.literal(false),
  }).strict(),
  manufacturing: z.object({
    status: z.literal("source-inputs-incomplete"), actualResult: z.null(),
    products: z.array(text), reason: text,
  }).strict(),
  claims: z.array(text).min(1), limitations: z.array(text).min(1),
}).strict();
const artifact = z.object({ id: hash, value: z.unknown() }).strict()
  .refine(value => Object.hasOwn(value, "value"));
const envelope = z.object({
  version: z.literal("supplemental-economic-calculation-1"), key: z.literal("cleanCovered"),
  report: reportSchema,
  identity: z.object({
    version: z.literal("prospective-economic-identity-1"), key: z.literal("cleanCovered"),
    claim: z.literal(economicBridgeContracts.cleanCovered.claim),
    codeArtifact: z.object({
      id: hash, contract: z.literal("calculation-source-1"),
      files: z.array(z.object({ path: text, sha256: hash }).strict()).min(1),
    }).strict(),
    sourceArtifact: artifact, materialInputs: artifact, assumptions: artifact, model: artifact,
    parent: z.object({ kind: z.literal("public-prospective-inputs"), id: hash, retainedResultId: z.null() }).strict(),
    derivation: artifact, resultHash: hash, retainedExecution: z.literal(false),
    originalHistoricalExport: z.literal(false), sourceApproval: z.literal(false),
    scientificAcceptance: z.literal(false), id: hash,
  }).strict(),
}).strict();

export type CleanCoveredDocument = EconomicBridgeDocument & {
  key: "cleanCovered"; report: z.infer<typeof reportSchema>;
};
export const CLEAN_COVERED_ROUTE = economicBridgeContracts.cleanCovered.route;
export function parseCleanCoveredDocument(value: unknown): CleanCoveredDocument | null {
  if (value === null) return null;
  const parsed = envelope.safeParse(value);
  if (!parsed.success) throw new Error("Clean/covered report or prospective identity contract is invalid. No result substituted.");
  exactEconomicJson(value);
  return value as CleanCoveredDocument;
}
export async function fetchCleanCoveredDocument() {
  const response = await apiRequest("GET", CLEAN_COVERED_ROUTE);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Clean/covered read service did not return JSON.");
  return parseCleanCoveredDocument(await response.json());
}
export function readBoundCleanCoveredExport(document: CleanCoveredDocument, format: "json" | "xlsx") {
  return readBoundEconomicExport(document, format, parseCleanCoveredDocument);
}
