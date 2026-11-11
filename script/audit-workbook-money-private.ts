import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import XLSX from "xlsx";
import { Pool } from "pg";
import { monetaryQualificationLabel } from "../server/financialData/workbookMoney";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private retained-workbook/read-only-journal audit only");
const dir = "generated-artifacts/workbook-money-audit-v1", workbook = "attached_assets/CarbonData2301a_(1)_1770595242257.xlsx";
mkdirSync(dir, { recursive: true });
if (existsSync(`${dir}/private-audit.json`)) throw new Error("Audit already captured; private validator only or separately version new capture");
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const sourceId = hash(workbook);
const dateValue = (v: unknown) => {
  if (typeof v !== "number") return null;
  const d = XLSX.SSF.parse_date_code(v); return d ? new Date(Date.UTC(d.y, d.m - 1, d.d)).toISOString() : null;
};
async function main() {
  const capturedAt = new Date().toISOString(), sheets: any[] = [], sourceDates: Record<string, string[]> = {};
  const d = XLSX.readFile(workbook, { sheets: ["Descriptive"] }).Sheets.Descriptive;
  const descriptive = XLSX.utils.sheet_to_json<Record<string, unknown>>(d), workbookIsins = new Set(descriptive.map(r => String(r.Type)));
  for (const name of ["MV", "Profit"]) {
    const sheet = XLSX.readFile(workbook, { sheets: [name], cellNF: true, cellStyles: true }).Sheets[name];
    if (!sheet?.["!ref"]) throw new Error(`Actual required money sheet absent: ${name}`);
    const range = XLSX.utils.decode_range(sheet["!ref"]), stats: any = { sheet: name, columns: range.e.c, dataRows: range.e.r,
      numericCells: 0, trueZeros: 0, providerNA: 0, blank: 0, other: 0, explicitCurrencyCells: 0, explicitMagnitudeCells: 0, commentedCells: 0,
      numberFormats: {}, dates: [], sampleSourceCellMetadata: [] };
    for (let r = 1; r <= range.e.r; r++) {
      const sourceDate = dateValue(sheet[XLSX.utils.encode_cell({ r, c: 0 })]?.v);
      if (!sourceDate) throw new Error("Unknown actual sheet source date; cannot infer from RI");
      stats.dates.push(sourceDate);
      for (let c = 1; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c }), cell = sheet[address], header = sheet[XLSX.utils.encode_cell({ r: 0, c })]?.v;
        if (!cell || cell.v === undefined || cell.v === null || cell.v === "") stats.blank++;
        else if (typeof cell.v === "number" && Number.isFinite(cell.v)) { stats.numericCells++; if (cell.v === 0) stats.trueZeros++; }
        else if (cell.v === "NA" || cell.v === "N/A") stats.providerNA++; else stats.other++;
        const format = cell?.z ?? "(absent)"; stats.numberFormats[format] = (stats.numberFormats[format] ?? 0) + 1;
        if (cell?.c?.length) stats.commentedCells++;
        const declarations = `${typeof header === "string" ? header : ""} ${format} ${(cell?.c ?? []).map((x: any) => x.t).join(" ")}`;
        if (/\b(?:USD|EUR|GBP|GBp|ZAc|ZAR|ILA|ILS|JPY|CAD|AUD|CHF|CNY|HKD)\b/.test(declarations)) stats.explicitCurrencyCells++;
        if (/\b(?:thousands|millions|billions|units)\b/i.test(declarations)) stats.explicitMagnitudeCells++;
        if (r === 1 && c <= 3) stats.sampleSourceCellMetadata.push({ sourceId, sheet: name, cell: address, header,
          sourceObservationDate: sourceDate, type: cell?.t ?? null, numberFormat: cell?.z ?? null, nativeValue: cell?.v ?? null,
          nativeCurrency: null, magnitude: null, denominationProvenance: "not-declared-in-inspected-cell/header/format/comment" });
      }
    }
    sourceDates[name] = stats.dates; sheets.push(stats);
  }
  // This query is SELECT-only; do not call lifecycle APIs or approve any identity.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let reviews;
  try {
    reviews = (await pool.query(`SELECT r.id,r.status,r.payload,r.created_at,r.reviewed_at,c.isin AS workbook_isin
      FROM financial_reviews r LEFT JOIN cv_companies c ON c.id=(r.payload->'identity'->>'companyId')::integer ORDER BY r.id`)).rows;
  } finally { await pool.end(); }
  const approved = reviews.filter(r => r.status === "approved");
  const exactAccepted = approved.filter(r => r.payload?.identity?.isin === r.workbook_isin && workbookIsins.has(r.workbook_isin) &&
    typeof r.payload.identity.reviewedAt === "string" && Date.parse(r.payload.identity.reviewedAt) <= Date.parse(capturedAt));
  const alignment = sourceDates.MV.map(mvDate => {
    const matches = sourceDates.Profit.filter(p => p.slice(0, 7) === mvDate.slice(0, 7));
    return { mvDate, profitDate: matches.length === 1 ? matches[0] : null, ambiguous: matches.length > 1 };
  });
  const privateAudit = { version: "workbook-money-audit-1", capturedAt, sourceId, workbook, sourceBytesSha256After: hash(workbook),
    sheets, journal: { capturedAt, rows: reviews, exactAccepted }, alignment,
    authorizedDatedFxReceipts: [], fxReceiptScope: "No authorized dated FX receipt registry/records supplied to this unit; missing, not invented from profile/listing geography or nearest date.",
    pendingReviewOnly: true, originalCurrencyMagnitudeNotAssumed: true };
  if (sourceId !== privateAudit.sourceBytesSha256After) throw new Error("Workbook changed during source-cell audit");
  writeFileSync(`${dir}/private-audit.json`, JSON.stringify(privateAudit, null, 2) + "\n", { flag: "wx" });
  const summary = { version: "workbook-money-audit-1", status: "pending-review", capturedAt, sourceHash: sourceId,
    sourceMetadataHash: hash(`${dir}/private-audit.json`), label: monetaryQualificationLabel,
    sourceCompanyCount: workbookIsins.size, approvedReviewCount: approved.length, exactAcceptedIdentityCount: exactAccepted.length,
    authorizedDatedFxCount: 0, convertedMoneyCells: 0, monetaryTotals: null,
    unresolvedDenominationOrMagnitude: true, sourceDatePolicy: "Unique-same-calendar-month Profit alignment retains ACTUAL Profit source dates; source-day FX only, never RI-day/nearestday substitution.",
    sameMonthCrossDateRowPairs: alignment.filter(p => p.profitDate && p.profitDate !== p.mvDate).length,
    ambiguousProfitMonths: alignment.filter(p => p.ambiguous).length,
    sheets: sheets.map(s => ({ sheet: s.sheet, columns: s.columns, dataRows: s.dataRows, numericCells: s.numericCells,
      trueZeros: s.trueZeros, providerNA: s.providerNA, blank: s.blank, other: s.other,
      explicitCurrencyCells: s.explicitCurrencyCells, explicitMagnitudeCells: s.explicitMagnitudeCells,
      commentedCells: s.commentedCells, numberFormatKinds: Object.keys(s.numberFormats).length,
      firstActualSourceDate: s.dates[0], lastActualSourceDate: s.dates.at(-1) })),
    limitation: "No raw company/cell/provider monetary values, identifiers or source formats exported. Quote/statement currencies are NOT workbook cell denominations. Unknown denomination/magnitude prevents determining valid FX pairs; no same-currency assumption or zero monetary total.",
    approval: "Pending review only; no approval, historical availability or workplan completion asserted." };
  writeFileSync(`${dir}/safe-summary.json`, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify(summary));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
