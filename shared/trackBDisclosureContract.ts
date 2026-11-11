import { z } from "zod";
import type { OutputFieldSemantic } from "./outputFieldSemantics";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const TRACK_B_PUBLIC_PREREQUISITE = "An authorized workspace operator must review the exact CLI-derived allowlisted report and redistribution rights, retain a published disclosure binding its report/protocol/pipeline/corpus/period-domain hashes, and add the exact disclosure pin through a reviewed source change to server/trackBPublicCatalog.ts. Then run the catalog-gated offline publisher. No HTTP approval, private archive fallback or caller-supplied review is supported.";
export const trackBPublicPinSchema = z.object({
  protocolHash: hash, reportHash: hash, disclosureHash: hash, pipelineResultHash: hash, periodDomainHash: hash,
}).strict();
export type TrackBPublicPin = z.infer<typeof trackBPublicPinSchema>;
export const trackBDisclosureSchema = z.object({
  contract: z.literal("track-b-public-disclosure-1"),
  status: z.enum(["unpublished", "published"]),
  classification: z.enum(["retained-research", "engineering-fixture"]),
  protocolHash: hash, reportHash: hash, pipelineResultHash: hash, corpusHash: hash, periodDomainHash: hash,
  providerPayloadIncluded: z.literal(false),
  review: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("operator-public-disclosure"), reviewer: z.string().min(1),
      reviewedAt: z.string().datetime(), publicRightsStatement: z.string().min(1) }).strict(),
    z.object({ kind: z.literal("synthetic-development-only"), qualification: z.literal("Synthetic authorization for isolated DEV engineering only; no real approval") }).strict(),
    z.object({ kind: z.literal("not-reviewed") }).strict(),
  ]),
  scientificAcceptance: z.literal(false), investmentEvidence: z.literal(false),
}).strict();
export type TrackBDisclosure = z.infer<typeof trackBDisclosureSchema>;
export const trackBPublicCatalogSchema = z.object({
  contract: z.literal("track-b-public-catalog-1"), reports: z.array(trackBPublicPinSchema),
  availability: z.literal("Pinned publications; retained bytes validated on exact selection"),
  operatorPrerequisite: z.string().min(1),
  scientificAcceptance: z.literal(false), investmentEvidence: z.literal(false),
}).strict();
export const trackBPublicCatalogSemantics: OutputFieldSemantic[] = [
  ["contract", "Public disclosure catalog contract version", "literal track-b-public-catalog-1"],
  ["reports[]", "Finite source-pinned publication domain, possibly empty", "No entries means no authorized real public report, not a zero result"],
  ["reports[].protocolHash", "Exact frozen protocol selection", "Source-controlled disclosure pin; exact match only"],
  ["reports[].reportHash", "Exact allowlisted admission report identity", "SHA256(canonicalJson(strict admission report)); verified before display/download"],
  ["reports[].disclosureHash", "Exact reviewed publication authorization identity", "SHA256(canonicalJson(disclosure)); source-catalog authorization, not caller review or Stage9 authentication"],
  ["reports[].pipelineResultHash", "Exact retained pipeline parent result identity", "Offline publisher verifies full pipeline hash and its exact trackBAdmission hash before retaining public-only report"],
  ["reports[].periodDomainHash", "Exact ordered specification/origin/cutoff/execution/end domain", "SHA256(canonicalJson(report.periods.map exact5identity fields))); absent frozen periods retained"],
  ["availability", "Catalog pin does not claim runtime file availability", "Exact selected public files are validated on read; missing/corrupt/unpublished refuse"],
  ["operatorPrerequisite", "Real publication prerequisite, not an approval claim", "Authorized workspace review of exact report and redistribution rights, reviewed catalog pins, offline publication"],
  ["scientificAcceptance", "Publication is not scientific acceptance", "literal false"],
  ["investmentEvidence", "Publication is not investment efficacy", "literal false"],
].map(([path, meaning, formula]) => ({
  id: `trackBPublicCatalog.${path}`, meaning, formula, role: "Output",
  unit: path.endsWith("Hash") ? "SHA256" : path.endsWith("Evidence") || path.endsWith("Acceptance") ? "boolean" : "publication control metadata",
  dependencies: ["source-reviewed catalog", "strict report/disclosure schemas"],
  source: "server/trackBPublicCatalog.ts; server/trackBDisclosureStore.ts; offline catalog-gated publisher",
  period: "Exact frozen report origin/cutoff domain; review timestamp is not a filing/source vintage",
  geography: "Actual frozen report population only; no new issuer coverage claimed",
  status: "Read-only publication identity/rights boundary; no authenticated positive TrackB or model promotion",
  missingness: "Empty catalog explicit; unlisted/missing404,unpublished/unauthorized403,corrupt503,changed exact selection409; no private archive or latest-version fallback",
  uncertainty: "No numerical probability, parameter fit quality or historical efficacy implied by publication",
  scope: "Exact reviewed public report only; no original filing,licensed provider payload,private pipeline or caller approval",
  asOfRule: "Report retains actual source cutoff; source-controlled disclosure grants publication only, never retrospective vintage verification",
}));
