import { z } from "zod";
import { economicBridgeContracts, type EconomicBridgeDocument } from "@shared/economicBridgeSchema";
import { buildRetirementAssociationPublic } from "@shared/retirementAssociationPublic";
import { apiRequest } from "@/lib/queryClient";
import { exactEconomicJson, readBoundEconomicExport } from "@/lib/economic-export-readback";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const artifact = z.object({ id: hash, value: z.unknown() }).refine(value => Object.hasOwn(value, "value"));
const envelope = z.object({
  version: z.literal("supplemental-economic-calculation-1"), key: z.literal("retirementAssociation"),
  report: z.unknown(),
  identity: z.object({
    version: z.literal("prospective-economic-identity-1"), key: z.literal("retirementAssociation"),
    claim: z.literal(economicBridgeContracts.retirementAssociation.claim),
    codeArtifact: z.object({
      id: hash, contract: z.literal("calculation-source-1"),
      files: z.array(z.object({ path: z.string().min(1), sha256: hash })).min(1),
    }),
    sourceArtifact: artifact, materialInputs: artifact, assumptions: artifact, model: artifact,
    parent: z.object({ kind: z.literal("public-prospective-inputs"), id: hash, retainedResultId: z.null() }),
    derivation: artifact, resultHash: hash, retainedExecution: z.literal(false),
    originalHistoricalExport: z.literal(false), sourceApproval: z.literal(false),
    scientificAcceptance: z.literal(false), id: hash,
  }),
});
export type RetirementAssociationDocument = EconomicBridgeDocument & {
  key: "retirementAssociation"; report: ReturnType<typeof buildRetirementAssociationPublic>;
};
export const RETIREMENT_ASSOCIATION_ROUTE = economicBridgeContracts.retirementAssociation.route;
export function parseRetirementAssociationDocument(value: unknown): RetirementAssociationDocument | null {
  if (value === null) return null;
  const parsed = envelope.safeParse(value);
  if (!parsed.success) throw new Error("Retirement/association report or prospective identity contract is invalid. No result substituted.");
  // This public contract admits only the exact source facts, book arithmetic,
  // formulas and unexecuted methods. No issuer rows, valuations or estimates.
  if (exactEconomicJson(parsed.data.report) !== exactEconomicJson(buildRetirementAssociationPublic()))
    throw new Error("Retirement/association public source contract is invalid. No issuer calculation accepted.");
  exactEconomicJson(value);
  return value as RetirementAssociationDocument;
}
export async function fetchRetirementAssociationDocument() {
  const response = await apiRequest("GET", RETIREMENT_ASSOCIATION_ROUTE);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error("Retirement/association read service did not return JSON.");
  return parseRetirementAssociationDocument(await response.json());
}
export function readBoundRetirementAssociationExport(document: RetirementAssociationDocument, format: "json" | "xlsx") {
  return readBoundEconomicExport(document, format, parseRetirementAssociationDocument);
}
