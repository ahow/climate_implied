import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import XLSX from "xlsx";
import { workbookMoneyAuditSchema, workbookMoneySemantics, workbookMoneySheetBindings, workbookMoneyRootPaths } from "../../shared/workbookMoneyAudit";
import { bindExportColumns, requireOutputSemantic } from "../../shared/outputFieldSemantics";
export { workbookMoneyAuditSchema };
export function workbookMoneyAuditHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(workbookMoneyAuditSchema.parse(input))).digest("hex");
}
export async function readWorkbookMoneyAudit() {
  const dir = "generated-artifacts/workbook-money-audit-v1";
  const summary = workbookMoneyAuditSchema.parse(JSON.parse(await readFile(`${dir}/safe-summary-qualified.json`, "utf8")));
  const digest = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  if (digest(await readFile(`${dir}/private-audit.json`)) !== summary.sourceMetadataHash ||
    digest(await readFile(`${dir}/denomination-reconciliation.json`)) !== summary.denominationReconciliationHash)
    throw new Error("Retained monetary source metadata integrity failure");
  return summary;
}
export function buildWorkbookMoneyAuditWorkbook(input: unknown): Buffer {
  const report = workbookMoneyAuditSchema.parse(input), book = XLSX.utils.book_new();
  book.Props = { Title: "Workbook monetary audit — pending review; unknown monetary totals withheld" };
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(report.sheets), "Safe source counts");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(Object.entries(report).filter(([k]) => k !== "sheets")
    .map(([Field, v]) => ({ Field, "Value / JSON": v === null ? "null" : typeof v === "object" ? JSON.stringify(v) : v }))
    .concat([{ Field: "auditHash", "Value / JSON": workbookMoneyAuditHash(report) }])), "Qualification and dates");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(workbookMoneySemantics.map(row => ({
    ...row, dependencies: row.dependencies.join(", "),
  }))), "Field semantics");
  const notes = [...bindExportColumns(report.sheets, workbookMoneySheetBindings),
    ...[...workbookMoneyRootPaths, "auditHash"].map(path => ({
      Column: `Qualification and dates[${path}].Value / JSON`, FieldID: `workbookMoney.${path}`,
      Transformation: "Exact Field-selected scalar; null is literal text null; no conversion or monetary approval",
      ...requireOutputSemantic(`workbookMoney.${path}`),
    }))];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(notes
    .map(row => ({ ...row, dependencies: row.dependencies.join(", ") }))), "Column bindings");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx", compression: true });
}
