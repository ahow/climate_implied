import { z } from "zod";
import { economicBridgeContracts, type EconomicBridgeDocument } from "@shared/economicBridgeSchema";
import type { LocationElectricityPublicReport } from "@shared/locationElectricityPublicTypes";
import { apiRequest } from "@/lib/queryClient";
import { exactEconomicJson, readBoundEconomicExport } from "@/lib/economic-export-readback";

const text = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().nonnegative();
const source = z.object({
  id: text, url: z.string().url(), sha256: hash, locator: text,
  observedAt: z.string().datetime(), availableAt: z.string().datetime().nullable(),
  historicalOriginClaim: z.literal(false),
});
const reportSchema = z.object({
  version: z.literal("location-electricity-public-source-report-1"),
  criterion: z.literal("S12-005"), status: z.literal("source-findings-with-unresolved-issuer-inputs"),
  cutoff: z.string().datetime(), freeze: z.object({ sha256: hash, protocol: z.literal("location-electricity-cash-bridge-1") }),
  sourceFacts: z.object({
    operatingLocations: z.array(z.object({
      companyId: z.literal("FSLR"), location: text, periodEnd: z.literal("2024-12-31"),
      operatingStatus: z.enum(["operating", "under-construction-not-operating-at-source-date"]),
      source, purchasedElectricityMWh: z.null(), supplier: z.null(), tariffEligibility: z.null(),
      customerRecoveryFraction: z.null(), supplierPaymentFraction: z.null(), customerCollectionFraction: z.null(),
      issuerCashBridgeExecutable: z.literal(false),
    })),
    contextualElectricityPrices: z.array(z.object({
      jurisdiction: z.literal("US-OH"), sector: z.literal("industrial"),
      year: z.number().int(), currency: z.literal("USD"),
      reportedValue: z.number().finite().nonnegative(), reportedUnit: z.literal("US cents/kWh"),
      nominalMajorCurrencyPerMWh: z.number().finite().nonnegative(), conversion: text,
      kind: z.literal("regional-context-only"), issuerTariff: z.literal(false),
      applicableToNamedIssuerSite: z.literal(false), source,
    })),
  }),
  actualIssuerResult: z.null(),
  counts: z.object({
    evidencedPropertyRows: count, operatingPropertyRows: count, constructionPropertyRows: count,
    regionalPriceRecords: count, applicableIssuerTariffs: z.literal(0), siteConsumptionRecords: z.literal(0),
    customerRecoveryRecords: z.literal(0), sourceQualifiedIssuerCashBridgeExecutions: z.literal(0),
  }),
  missingIssuerInputs: z.array(text).min(1), assumptionValuesAssignedToIssuers: z.literal(0),
  sourceQualifiedIssuerExecution: z.literal(false), productionEligible: z.literal(false),
  sourceApproval: z.literal(false), scientificAcceptance: z.literal(false), boundary: text,
});
const artifact = z.object({ id: hash, value: z.unknown() });
const envelopeSchema = z.object({
  version: z.literal("supplemental-economic-calculation-1"), key: z.literal("locationElectricity"),
  report: reportSchema,
  identity: z.object({
    version: z.literal("prospective-economic-identity-1"), key: z.literal("locationElectricity"),
    claim: z.literal(economicBridgeContracts.locationElectricity.claim),
    codeArtifact: z.object({
      id: hash, contract: z.literal("calculation-source-1"),
      files: z.array(z.object({ path: text, sha256: hash })).min(1),
    }),
    sourceArtifact: artifact, materialInputs: artifact, assumptions: artifact, model: artifact,
    parent: z.object({ kind: z.literal("public-prospective-inputs"), id: hash, retainedResultId: z.null() }),
    derivation: artifact, resultHash: hash, retainedExecution: z.literal(false),
    originalHistoricalExport: z.literal(false), sourceApproval: z.literal(false),
    scientificAcceptance: z.literal(false), id: hash,
  }),
});
export type LocationElectricityDocument = EconomicBridgeDocument & {
  key: "locationElectricity"; report: LocationElectricityPublicReport;
};
export const LOCATION_ELECTRICITY_ROUTE = economicBridgeContracts.locationElectricity.route;
export function parseLocationElectricityDocument(value: unknown): LocationElectricityDocument | null {
  if (value === null) return null;
  const parsed = envelopeSchema.safeParse(value);
  if (!parsed.success) throw new Error("Location electricity report or prospective identity contract is invalid. No result substituted.");
  const { sourceFacts: facts, counts } = parsed.data.report;
  if (counts.evidencedPropertyRows !== facts.operatingLocations.length ||
    counts.operatingPropertyRows !== facts.operatingLocations.filter(row => row.operatingStatus === "operating").length ||
    counts.constructionPropertyRows !== facts.operatingLocations.filter(row => row.operatingStatus !== "operating").length ||
    counts.regionalPriceRecords !== facts.contextualElectricityPrices.length ||
    facts.contextualElectricityPrices.some(row => row.nominalMajorCurrencyPerMWh !== row.reportedValue * 10)) {
    throw new Error("Location electricity counts or contextual unit conversion conflict with the source rows.");
  }
  exactEconomicJson(value);
  return value as LocationElectricityDocument;
}
export async function fetchLocationElectricityDocument() {
  const response = await apiRequest("GET", LOCATION_ELECTRICITY_ROUTE);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Location electricity read service did not return JSON.");
  return parseLocationElectricityDocument(await response.json());
}
export function readBoundLocationElectricityExport(document: LocationElectricityDocument, format: "json" | "xlsx") {
  return readBoundEconomicExport(document, format, parseLocationElectricityDocument);
}
