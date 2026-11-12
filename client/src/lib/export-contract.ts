import { currentSelection, type AnalysisSelection } from "./analysis-selection";
import { captureDownloadSelection } from "./download-selection";
import { z } from "zod";
import { bindNestedOutput } from "@shared/outputFieldSemantics";
import { exportJsonIdentity } from "./export-identity";
import { exportContracts, type ExportKind } from "@shared/downloadClaims";
import { createDownloadManifest } from "@shared/downloadManifest";
import { scientificEvidenceExportNotes } from "@shared/scientificEvidence";
export { exportContracts, type ExportKind } from "@shared/downloadClaims";
/** Interpretation travels with downloaded data, rather than only with its page. */

export function exportNotes(kind: ExportKind, filename: string, exportedAt: string,
  selection: AnalysisSelection | null = captureDownloadSelection()) {
  const contract = exportContracts[kind];
  if (!contract) throw new Error("Unknown export interpretation");
  return [
    { Field: "Requested UI selection (not producer provenance)", Value: selection
      ? `Requested UI workbook ${selection.workbook}; indicators ${selection.indicators}; regional inputs ${selection.regional ?? "not selected"}; ordered company overlays ${selection.overlays?.join(",") ?? "none"}; cutoff ${selection.asOf ?? "not specified"}. NOT certified input/model/run identity and not proof these data were produced from that selection. Producer identity unavailable (null); no original-vintage evidence.`
      : "No archived UI selection requested. Producer input/model/run identity unavailable (null); no certified-current-input fallback or original-vintage claim." },
    { Field: "File", Value: filename },
    { Field: "Export time (not observation or publication date)", Value: exportedAt },
    { Field: "Evidence status", Value: contract.status },
    { Field: "Interpretation", Value: contract.interpretation },
    { Field: "Limitations", Value: contract.limitation },
    { Field: "Reproducibility", Value: "This is a view export, not an immutable analysis archive. An export timestamp does not identify the input vintage or model run." },
    { Field: "Units and missingness", Value: "Use the column headings for units. Empty cells mean missing or unavailable, not zero. Do not combine different growth definitions or horizons." },
    ...scientificEvidenceExportNotes(),
  ];
}

const count = z.number().int().nonnegative(), fraction = z.number().min(0).max(1).nullable();
const mapping = z.object({ count, share: fraction }).strict();
const weighted = z.object({ knownValue: z.number().finite().nonnegative().nullable(), shareOfKnownValue: fraction }).strict();
const metric = z.object({
  states: z.object({ present: count, null: count, missing: count, conflicted: count, invalid: count }).strict(),
  availableCount: count, availableShare: fraction, knownTotal: z.number().finite().nonnegative().nullable(),
  operatingGeography: weighted, headquartersFallback: weighted,
}).strict();
const population = z.object({
  denominator: count,
  mapping: z.object({ "operating-geography": mapping, "headquarters-fallback": mapping,
    unknown: mapping, missing: mapping, conflicted: mapping }).strict(),
  metrics: z.object({ marketCap: metric, scope1Emissions: metric, scope2Emissions: metric, scope3Emissions: metric }).strict(),
}).strict();
const coverageJsonSchema = z.object({
  version: z.literal("company-coverage-1"),
  sourceId: z.union([z.literal("current-workbook-unversioned"), z.string().regex(/^[a-f0-9]{64}$/)]),
  observationDate: z.string().date(), informationCutoff: z.string().datetime(),
  fullWorkbook: population, eligible: population, eligibleCompanyShare: fraction,
  eligibleKnownValueCoverage: z.object({ marketCap: fraction, scope1Emissions: fraction, scope2Emissions: fraction, scope3Emissions: fraction }).strict(),
  eligibilityConflicts: count, eligibilityRule: z.string().min(1),
  units: z.object({ marketCap: z.string().min(1), emissions: z.string().min(1) }).strict(),
  limitations: z.array(z.string().min(1)).min(1), scientificAcceptance: z.literal(false),
}).strict();
export function validateCompanyCoverageJson(payload: unknown) {
  const report = coverageJsonSchema.parse(payload);
  const selection = currentSelection();
  if (selection?.overlays?.length) throw new Error("Coverage JSON requires baseline workbook without overlays");
  if (selection && report.sourceId !== selection.workbook) throw new Error("Coverage JSON source conflicts with active workbook selection");
  if (report.observationDate > report.informationCutoff.slice(0, 10)) throw new Error("Coverage JSON observation after cutoff");
  // Validate all exact primitive semantic IDs, not only the top-level schema.
  bindNestedOutput("companyCoverage", report);
  return report;
}
/** Shared central-writer contract; data is retained exactly, metadata travels
 * beside it in an envelope, and SHA-256 identifies the lossless data member. */
export async function prepareQualifiedJsonExport(payload: unknown, kind: ExportKind, filename: string,
  exportedAt: string, validatePayload: (value: unknown) => unknown,
  requestedUiSelection: AnalysisSelection | null = captureDownloadSelection()) {
  const selection = structuredClone(requestedUiSelection), data = structuredClone(payload);
  validatePayload(data);
  const identity = await exportJsonIdentity(data);
  const manifest = createDownloadManifest({ filename, kind, exportedAt, dataHash: identity.hash,
    hashMethod: "UTF-8 JSON.stringify(data, null, 2); no normalization",
    selection, rows: Array.isArray(data) ? data : undefined });
  const envelope = { data, interpretation: exportNotes(kind, filename, exportedAt, selection),
    dataIdentity: { algorithm: "SHA-256", hash: identity.hash, serialization: "UTF-8 JSON.stringify(data, null, 2); no normalization" },
    manifest };
  return { text: JSON.stringify(envelope, null, 2), hash: identity.hash };
}
