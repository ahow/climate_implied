import * as XLSX from "xlsx";
import { stage10CoverageSchema, stage10ExportBindings, stage10CoverageSemantics } from "../../shared/stage10Coverage";
import { bindExportColumns } from "../../shared/outputFieldSemantics";
import { certifySupplementalSheetRows } from "../../shared/supplementalSheetBindings";
export function stage10ExportDocument(input: unknown) {
  const report = stage10CoverageSchema.parse(input);
  return { report, rows: report.rows, fieldSemantics: stage10CoverageSemantics,
    columnBindings: stage10ExportBindings, qualification: "Safe aggregate counts only; all rows use the same exact inputHash; null is explicit suppression/unavailable,not zero" };
}
export function buildStage10Workbook(input: unknown): Buffer {
  const document = stage10ExportDocument(input), book = XLSX.utils.book_new();
  const rows = document.rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v === null ? "null" : v])));
  bindExportColumns(rows, stage10ExportBindings);
  book.Props = { Title: "Stage10 retained financial coverage — no model approval" };
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Aggregate coverage");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(Object.entries(document.report).filter(([k]) => k !== "rows")
    .map(([field, value]) => ({ Field: field, "JSON value": JSON.stringify(value) }))), "Exact input identity");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(certifySupplementalSheetRows("Field semantics", stage10CoverageSemantics.map(s => ({
    Field: s.id, Classification: s.role, Unit: s.unit, Formula: s.formula, Dependencies: s.dependencies.join(", "),
    Source: s.source, Vintage: s.source, AsOf: s.asOfRule, Meaning: s.meaning, Period: s.period,
    Geography: s.geography, Status: s.status, Missingness: s.missingness, Uncertainty: s.uncertainty,
  })))), "Field semantics");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(certifySupplementalSheetRows("Column bindings",
    bindExportColumns(rows, stage10ExportBindings).map(row => ({ ...row, dependencies: row.dependencies.join(", "),
      Transformation: `${row.Transformation}; XLSX null→literal text null,never blank or0` })))), "Column bindings");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true });
}
