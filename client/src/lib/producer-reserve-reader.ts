import { z } from "zod";
import { economicBridgeContracts, type EconomicBridgeDocument } from "@shared/economicBridgeSchema";
import type { ProducerReserveReport } from "@shared/producerReserveSchema";
import { apiRequest } from "@/lib/queryClient";
import { exactEconomicJson, readBoundEconomicExport } from "@/lib/economic-export-readback";

export { exactEconomicJson } from "@/lib/economic-export-readback";

const number = z.number().finite();
const text = z.string().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const solve = z.object({
  status: z.enum(["unique-conditional-root", "no-root", "multiple-roots", "nonidentified", "unsupported-basis"]),
  decline: number.nullable(), residualUsdMillion: number.nullable(), roots: z.array(number),
  reason: text, iterations: number, domainHash: hash,
}).superRefine((value, ctx) => {
  if (value.status === "unique-conditional-root" &&
    (value.decline === null || value.residualUsdMillion === null || value.roots.length !== 1 || value.roots[0] !== value.decline) ||
    value.status !== "unique-conditional-root" && value.decline !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Inconsistent conditional solve result" });
  }
});
const reportSchema = z.object({
  schemaVersion: z.literal("producer-reserve-v1"), id: text, title: text, label: text,
  status: z.literal("conditional-diagnostic-only"), entity: text, valuationDate: text,
  calculationBasis: text, moneyUnit: z.literal("USD million"), physicalUnit: z.literal("million boe"),
  marketEquityTarget: z.null(), marketImpliedDecline: z.null(), fcfe: z.null(),
  ownerApproved: z.literal(false), scienceAccepted: z.literal(false), threeCaseAcceptance: z.literal(false),
  sourceRegister: z.array(z.object({
    id: text, entity: text, scope: text, period: text, unit: text, documentDate: text,
    documentDateBasis: text, retainedAt: text, url: text, pdfSha256: hash, textSha256: hash, locator: text,
  })),
  assumptionRegister: z.array(z.object({
    id: text, value: z.union([text, number, z.array(number)]),
    status: z.literal("conditional-not-observed"), justification: text,
  })),
  historical: z.record(z.unknown()), target: z.record(z.unknown()), baseResult: solve,
  annualRows: z.array(z.object({
    year: number, openingReserves: number, production: number, replacement: number,
    closingReserves: number, revenue: number, productionCostsIncludingAbandonment: number,
    developmentCapex: number, cashTaxes: number, deltaWorkingCapital: number,
    unleveredCashFlow: number, discountedCashFlow: number,
  })),
  sensitivityRows: z.array(z.object({
    id: text, discountRate: number, revenueMultiplier: number, costMultiplier: number,
    valueAtZeroDecline: number, valueAtMaximumDecline: number, result: solve,
  })),
  refusalRows: z.array(solve), reconciliation: z.record(z.unknown()), sourceGaps: z.array(text),
  hashes: z.object({ parent: hash, source: hash, material: hash, model: hash, domain: hash }),
  preservation: z.array(text), privateValidationRequired: z.array(text),
});
const artifact = z.object({ id: hash, value: z.unknown() });
const envelopeSchema = z.object({
  version: z.literal("supplemental-economic-calculation-1"), key: z.literal("producerReserve"),
  report: reportSchema,
  identity: z.object({
    version: z.literal("prospective-economic-identity-1"), key: z.literal("producerReserve"),
    claim: z.literal(economicBridgeContracts.producerReserve.claim),
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
export type ProducerReserveDocument = EconomicBridgeDocument & { key: "producerReserve"; report: ProducerReserveReport };
export const PRODUCER_RESERVE_ROUTE = economicBridgeContracts.producerReserve.route;

export function parseProducerReserveDocument(value: unknown): ProducerReserveDocument | null {
  if (value === null) return null;
  const parsed = envelopeSchema.safeParse(value);
  if (!parsed.success) throw new Error("Producer reserve result or prospective identity contract is invalid. No result substituted.");
  const report = parsed.data.report;
  const solves = [report.baseResult, ...report.sensitivityRows.map(row => row.result), ...report.refusalRows];
  if (solves.some(result => result.domainHash !== report.hashes.domain) ||
    report.baseResult.decline === null && report.annualRows.length > 0) {
    throw new Error("Producer reserve domain or annual path conflicts with the returned solve. No result substituted.");
  }
  exactEconomicJson(value);
  // Keep the exact response, including any additive fields, for export comparison.
  return value as ProducerReserveDocument;
}
export async function fetchProducerReserveDocument() {
  const response = await apiRequest("GET", PRODUCER_RESERVE_ROUTE);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Producer reserve read service did not return JSON.");
  return parseProducerReserveDocument(await response.json());
}

/** The server accepts NO query pins. Read its export and compare all literal
 * content against the consumed response before offering a download. */
export async function readBoundProducerReserveExport(document: ProducerReserveDocument, format: "json" | "xlsx"): Promise<Blob> {
  return readBoundEconomicExport(document, format, parseProducerReserveDocument);
}
