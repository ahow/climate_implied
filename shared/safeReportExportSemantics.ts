import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { producerDownloadSemantics } from "./producerDownloadSemantics";

/** New metadata definitions only. No original observations/cohort closure,
 * historical bytes, scientific validation or publication authority is added. */
const fields = [
  ["version", "Supplemental retained safe-report attachment contract", "Literal safe-report-export-lineage-1", "contract label"],
  ["kind", "Finite authenticated safe source-release family", "stage10-coverage, track-b-publication or workbook-money-audit", "enum"],
  ["derivation.version", "Exact existing custom writer projection version", "Literal safe-report-custom-projection-1", "contract label"],
  ["derivation.order", "Exact custom-sheet/document order policy", "Same writer as ordinary export; no sorting/deduplication/inference", "metadata text"],
  ["derivation.units", "Literal custom heading/field unit boundary", "Native units unchanged; unknown/null not zero; no monetary totals or inferred FX", "metadata text"],
  ["derivation.claim", "Safe report source/projection acceptance boundary", "Not original upstream bytes, study execution, source approval, private publication or scientific acceptance", "metadata text"],
  ["dataHash", "Actual exact JSON document or decoded workbook-cell identity", "SHA-256 canonical finite JSON; workbook arrays include worksheet names/index and literal header:1 raw cells with defval:null", "SHA-256"],
  ["sheets[]", "JSON attachment has no worksheet cell array", "Empty for JSON-only projection", "empty metadata array"],
  ["sheets[].name", "Exact actual custom worksheet name", "Original book.SheetNames[index], before optional transport metadata", "worksheet label"],
  ["sheets[].index", "Exact custom worksheet ordinal", "Original zero-based worksheet order", "zero-based index"],
  ["sheets[].literalCellsHash", "Actual literal worksheet cells", "SHA-256 canonical finite JSON of raw header:1 decoded cells with defval:null; formulas/links forbidden", "SHA-256"],
  ["scientificAcceptance", "New lineage does not validate science or issuer economics", "Literal false", "boolean"],
  ["originalHistoricalExport", "New projection does not recover original historical bytes", "Literal false", "boolean"],
] as const;
const context = {
  role: "Output" as const, dependencies: ["verified retained full safe source release", "actual custom attachment writer", "calculation-source-1 code/config/lock"],
  source: "server/snapshots/reportExportProducer.ts",
  period: "Exact retained safe report release and query-time/cutoff context; not original publication vintage",
  geography: "Exact retained report population; no inferred geography",
  status: "Supplemental engineering metadata, not source approval or scientific acceptance",
  missingness: "Explicit unknown/null retained; missing/corrupt claimed parents or changed literal cells refuse",
  uncertainty: "Engineering content identity only; no calibrated uncertainty, scientific acceptance or original-vintage inference",
  scope: "New prospective safe-report source/projection bindings only; no original cohort closure or private publication",
  asOfRule: "Query/export time is distinct from original information availability and source publication",
};
export const safeReportExportSemantics: OutputFieldSemantic[] = [
  ...fields.map(([path, meaning, formula, unit]) => ({ id: `safeReportExport.${path}`, meaning, formula, unit, ...context })),
  ...producerDownloadSemantics.map(field => {
    const path = `safeReportExport.parent.${field.id.replace(/^retainedProducer\./, "")}`;
    return { ...field, id: path, ...context };
  }),
];
