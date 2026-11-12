import type { OutputFieldSemantic } from "./outputFieldSemantics";

const fields = [
  ["version", "Retained producer proof contract", "literal retained-producer-binding-v1", "contract label"],
  ["resultId", "Content-addressed completed response identity, not unique execution time", "contentHash(analysis-result-1 payload including analytical manifest and retained result)", "SHA-256"],
  ["resultHash", "Exact native retained result identity, not original HTTP byte identity", "contentHash(retained result): canonical finite JSON, sorted object keys and preserved array order", "SHA-256"],
  ["manifestId", "Analytical manifest identity excluding administrative creation time", "createManifest analytical id; unpackAnalysisResult recomputes before binding", "SHA-256"],
  ["materialInputsId", "Verified referenced consumed-material archive identity", "manifest.settings.materialInputsId; loadAnalysisResult verifies referenced material bundle", "SHA-256"],
  ["codeArchiveId", "Verified retained source/config/dependency-lock bundle identity", "manifest.codeVersion equals verified material.sourceArchive; not a running executable attestation", "SHA-256"],
  ["modelVersion", "Declared model contract version in completed producer manifest", "manifest.modelVersion, authenticated as retained content, not model acceptance", "version label"],
  ["orderedSnapshotHashes[]", "Valuation workbook/ordered overlays/indicators, or readonly comparison from/to archives", "manifest.snapshotHashes retained in order; valuation additionally matches resolved server context; readonly matches both exact verified source archive IDs", "ordered SHA-256 identities"],
  ["scenario", "Exact allowlisted retained producer identity", "manifest.scenario; descriptive-valuation actual captured producer route or source-backed:readonly-diff-1 with private retained material and safe report replay", "producer route label"],
  ["meaning", "Explicit stored-output and acceptance limitation", "fixed server explanation: retained completed response is not recalculation, original vintage or scientific acceptance", "text"],
  ["scientificAcceptance", "Producer identity does not establish scientific acceptance", "literal false", "boolean"],
] as const;
export const producerDownloadSemantics: OutputFieldSemantic[] = fields.map(([path, meaning, formula, unit]) => ({
  id: `retainedProducer.${path}`, role: "Output", meaning, formula, unit,
  dependencies: ["verified retained analysis-result-1", "referenced material-inputs/source/workbook/overlay archives or readonly-diff-material/source/from/to/scanned-result archives"],
  source: "server/producerDownload.ts verifiedProducer and response-private WeakMap; server archive reader only",
  period: "Completed retained response; no original publication vintage or unique wall-clock execution identity",
  geography: "Selected retained workbook population; no inferred operating geography",
  status: "Bounded server-produced provenance metadata, not scientific approval",
  missingness: "Unretained/current/legacy-without-material responses remain unbound; corrupt or conflicting producer/export refuses; no caller attestation or current fallback",
  uncertainty: "Content and retained-reference identity only; no independent recalculation, container attestation or causal validation",
  scope: "Supplemental response header and exact-result JSON manifest metadata; no original cohort closure or derived chart-row certification",
  asOfRule: "Archive references do not authenticate original information availability; export timestamp is not publication time",
}));
export const producerDownloadFieldBindings = Object.fromEntries(fields.map(([path]) => [path, {
  id: `retainedProducer.${path}`, transform: "Exact server-verified proof field; no UI selection substitution",
}]));
