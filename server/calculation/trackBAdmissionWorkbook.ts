import * as XLSX from "xlsx";
import { trackBAdmissionExportDocument, trackBAdmissionExportBindings, trackBAdmissionSemantics } from "../../shared/trackBAdmissionContract";
import { bindExportColumns } from "../../shared/outputFieldSemantics";
import { certifySupplementalSheetRows, supplementalSheetBindings } from "../../shared/supplementalSheetBindings";

const nullableColumns = ["Execution", "End", "Period manifest", "Track B result", "Company", "Referenced artifact"];
export const trackBWorkbookReasonBindings = Object.fromEntries(Object.entries(trackBAdmissionExportBindings).map(([column, path]) => [
  column, { id: `trackBAdmission.${path}`, transform: nullableColumns.includes(column)
    ? "JSON.stringify nullable source value: literal null is explicit unavailable, quoted strings retain their exact identity; never zero or blank"
    : "Identity; exact report value, one row per failed requirement per frozen period" },
]));
export const trackBWorkbookIdentityFields = ["contract", "protocolHash", "corpusHash", "corpusCutoff",
  "scientificAcceptance", "investmentEvidence", "authenticityVerified", "limitation"] as const;
export function trackBAdmissionWorkbookTables(input: unknown) {
  const document = trackBAdmissionExportDocument(input);
  const reasons = document.rows.map(row => Object.fromEntries(Object.entries(row).map(([column, value]) =>
    [column, nullableColumns.includes(column) ? JSON.stringify(value) : value])));
  const identity = trackBWorkbookIdentityFields.map(field => ({ Field: field, "JSON value": JSON.stringify(document.report[field]) }));
  const definitions = certifySupplementalSheetRows("Field semantics", trackBAdmissionSemantics.map(s => ({
    Field: s.id, Classification: s.role, Unit: s.unit, Formula: s.formula, Dependencies: s.dependencies.join(", "),
    Source: s.source, Vintage: s.source, AsOf: s.asOfRule, Meaning: s.meaning, Period: s.period,
    Geography: s.geography, Status: s.status, Missingness: s.missingness, Uncertainty: s.uncertainty,
  })));
  const bindings = certifySupplementalSheetRows("Column bindings", bindExportColumns(reasons, trackBWorkbookReasonBindings)
    .map(row => ({ ...row, dependencies: row.dependencies.join(", ") })));
  bindExportColumns(definitions, supplementalSheetBindings("Field semantics"));
  bindExportColumns(bindings, supplementalSheetBindings("Column bindings"));
  return { reasons, identity, definitions, bindings };
}
export function buildTrackBAdmissionWorkbook(input: unknown): Buffer {
  const tables = trackBAdmissionWorkbookTables(input);
  const book = XLSX.utils.book_new();
  // Deterministic document metadata; this is not an observation/source timestamp.
  book.Props = { Title: "Track B per-period reasons — unavailable; no efficacy",
    Subject: "Structural evidence checks only; no authenticated historical admission",
    CreatedDate: new Date("1970-01-01T00:00:00Z"), ModifiedDate: new Date("1970-01-01T00:00:00Z") };
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(tables.reasons), "Period reasons");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(tables.identity), "Assessment identity");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(tables.definitions), "Field semantics");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(tables.bindings), "Column bindings");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true });
}
