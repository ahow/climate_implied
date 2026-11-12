import type { OutputFieldSemantic } from "./outputFieldSemantics";

const context = {
  source: "compareReadonlyArchives in server/snapshots/readonlyDiffContract.ts and exact-reference archived result scan; client versionDiffExportRows/affectedAnalysisExportRows validate diffViewSchema",
  period: "Two explicitly selected retained versions; archived analysis recordedAt is not original publication or cutoff-only parameter availability",
  geography: "Selected workbook/overlay population or effective indicator history; no inferred operating geography",
  status: "Read-only counts/content identities and exact retained references; no raw provider rows, causal efficacy or original-vintage certification",
  missingness: "Missing/invalid/mismatched identities and historical type refuse view/export; empty population disables download; zero count is a true empty comparison, not source-value imputation",
  uncertainty: "Deterministic observed archive-cell comparison, not statistical confidence or forecast evidence; paginated affected scan is not exhaustive absence proof",
  scope: "Supplemental new version-diff and affected-analysis spreadsheet fields only; no original1001 cohort closure credit or mutation/approval authority",
  asOfRule: "Archive retrieval verifies selected SHA256 identity; recordedAt indicates retained analysis recording time, never source publication vintage",
};
const fields: [string, string, string, string][] = [
  ["from", "Exact selected before-version source identity", "data.from; diffViewSchema validates64hex and API matches requested before archive", "SHA-256"],
  ["to", "Exact selected after-version source identity", "data.to; diffViewSchema validates64hex and API matches requested after archive", "SHA-256"],
  ["kind", "Selected immutable archive domain being compared", "workbook-baseline/company-overlay/indicator-overrides/material-inputs; no current-data fallback", "archive-kind enum"],
  ["domain", "Economic data category of compared archive cells", "workbook SDG/carbon/financial; overlay entry.kind; indicator/material driver", "domain key"],
  ["field", "Exact source field whose keyed cells are compared", "compareReadonlyArchives groups cells by domain:field; no row values disclosed", "source field key"],
  ["added", "Keys present only in after-version for this domain/field", "count(right group cells with key absent from before keyed map)", "cells"],
  ["removed", "Keys present only in before-version for this domain/field", "count(left group cells with key absent from after keyed map)", "cells"],
  ["changed", "Shared keys whose canonical source values differ", "count(right group cells whose key is present before and canonicalJson(afterValue) !== canonicalJson(beforeValue))", "cells"],
  ["beforeHash", "Content hash of sorted before cells for this domain/field", "contentHash(before cells sorted by key, including domain/field/key/value); not raw value export", "SHA-256"],
  ["afterHash", "Content hash of sorted after cells for this domain/field", "contentHash(after cells sorted by key, including domain/field/key/value); not raw value export", "SHA-256"],
  ["approvalState", "Archive-kind review classification, not a newly granted approval", "company-overlay => archived-reviewed-overlay; indicator-overrides => archived-approved-indicators; otherwise not-established-by-archive", "archive review enum"],
  ["historicalBasis", "Archive time does not establish original source publication vintage", "literal Revised-history inputs; archive time is not original publication vintage", "historical-evidence caveat"],
  ["resultId", "Content identity of an exactly referencing retained analysis result", "affectedAnalyses[].resultId; exact source-reference scan, not hypothetical recalculation", "SHA-256"],
  ["manifestId", "Manifest identity attached to that retained analysis result", "affectedAnalyses[].manifestId; not a new manifest or rerun", "SHA-256"],
  ["scenario", "Recorded scenario of the exactly referencing archived analysis", "affectedAnalyses[].scenario; retained scenario name, not scenario probability", "scenario label"],
  ["recordedAt", "Actual retained analysis recording timestamp", "affectedAnalyses[].recordedAt; ISO datetime; not issuer publication or historic forecast issuance", "UTC timestamp"],
  ["relation", "Which selected retained version was consumed by the archived result", "consumed-before-version/consumed-after-version/consumed-both-versions from exact references", "reference-relation enum"],
  ["historicalTypeCode", "Validated historical evidence class of the archived result", "requireHistoricalType(affectedAnalysis); code must match exact S09-001 label or export refuses", "historical type code"],
  ["historicalTypeLabel", "Exact S09-001 historical evidence label of the archived result", "requireHistoricalType(affectedAnalysis) exact matching label; no fallback vintage label", "historical type label"],
  ["affectedMeaning", "Scope and limitations of paginated exact-reference result scan", "data.affectedMeaning; no references on one page does not establish absence elsewhere or causal impact", "scan-scope caveat"],
];
export const readonlyDiffSemantics: OutputFieldSemantic[] = fields.map(([field, meaning, formula, unit]) => ({
  id: `readonlyDiff.${field}`, meaning, formula, unit, role: "Output", dependencies: [formula], ...context,
}));
