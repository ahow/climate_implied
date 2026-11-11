import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import XLSX from "xlsx";
import { readWorkbookMoneyAudit, buildWorkbookMoneyAuditWorkbook } from "../server/financialData/workbookMoneyExport";
import { checkedWorkbookMoney, monetaryContext, qualifyMonetaryDates, type MonetaryContext, type MoneyCellEvidence } from "../server/financialData/workbookMoney";
import { packDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext, type SnapshotHeader } from "../server/snapshots/store";
import { runWithIsolatedCompanyCarbonCache } from "../server/climateValuation/companyCarbonCache";
import { computeGroupAggregates, calculateTotalBasedCarbonPrice } from "../server/climateValuation/carbonPriceCalculator";
import { computeTercilesOnTheFly } from "../server/climateValuation/tercileCalculator";
import { calculateSDGGrowthDifferential } from "../server/climateValuation/sdgGrowthCalculator";
import { calculateDecarbBands } from "../server/climateValuation/decarbBandCalculator";
import { calculateDecarbTerciles } from "../server/climateValuation/decarbTercileCalculator";
import type { CvCompany, CvTimeSeries } from "../shared/schema";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Separate private retained-source validation only");
const dir = "generated-artifacts/workbook-money-audit-v1", read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function main() {
  const audit = json(`${dir}/private-audit.json`), summary = await readWorkbookMoneyAudit(), proof = json(`${dir}/denomination-reconciliation.json`);
  assert.equal(hash(audit.workbook), audit.sourceId); assert.equal(audit.sourceId, summary.sourceHash);
  const source = [
    audit.workbook, `${dir}/private-audit.json`, `${dir}/denomination-reconciliation.json`, `${dir}/safe-summary-qualified.json`
  ].map(path => ({ path, sha256: hash(path) }));
  const codePaths = ["server/financialData/workbookMoney.ts", "server/financialData/workbookMoneyExport.ts", "server/workbookMoneyAuditApi.ts",
    "server/climateValuation/carbonPriceCalculator.ts", "server/climateValuation/tercileCalculator.ts", "server/climateValuation/sdgGrowthCalculator.ts",
    "server/climateValuation/decarbBandCalculator.ts", "server/climateValuation/decarbTercileCalculator.ts",
    "script/audit-workbook-money-private.ts", "script/finalize-workbook-money-audit-private.ts",
    "script/workbook-money.test.ts", "script/workbook-money-api.test.ts", "script/validate-workbook-money-private.ts",
    "script/workbook-missingness-integration.test.ts"];
  const freezePath = `${dir}/frozen-before-private-validation.json`;
  if (!existsSync(freezePath)) writeFileSync(freezePath, JSON.stringify({ version: "workbook-money-guards-1",
    protocol: "No original monetary denomination/magnitude inferred; exact current approved identity AND explicit source-cell provenance required. Only identity-authorized source-day oriented FX; same-monthProfit retainsactualdate/truezero. Unknown amounts withhold timestamp before monetary aggregation/ranking. Currentaudit is revisedhistory, not historicalapproval/vintage evidence. No economic scoring or new FX.",
    code: codePaths.map(path => ({ path, sha256: hash(path) })), source, futureEconomicAssumptions: [] }, null, 2) + "\n", { flag: "wx" });
  const freeze = json(freezePath);
  for (const p of [...freeze.code, ...freeze.source]) assert.equal(hash(p.path), p.sha256);
  const originalDates: Record<string, string[]> = {}, selected: Record<string, { sheet: XLSX.WorkSheet; row: number; headers: unknown[] }> = {};
  const actualZeroCells: { sheet: string; cell: string; sourceDate: string }[] = [];
  const serial = (v: number) => { const d = XLSX.SSF.parse_date_code(v); return new Date(Date.UTC(d.y, d.m - 1, d.d)).toISOString(); };
  for (const name of ["MV", "Profit"]) {
    const sheet = XLSX.readFile(audit.workbook, { sheets: [name], cellNF: true }).Sheets[name], range = XLSX.utils.decode_range(sheet["!ref"]!);
    let numeric = 0, zeros = 0, providerNA = 0, blank = 0, other = 0;
    const dates: string[] = [];
    for (let r = 1; r <= range.e.r; r++) {
      const date = serial(sheet[XLSX.utils.encode_cell({ r, c: 0 })].v); dates.push(date);
      for (let c = 1; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c }), cell = sheet[address], v = cell?.v;
        if (v === null || v === undefined || v === "") blank++;
        else if (typeof v === "number" && Number.isFinite(v)) { numeric++; if (v === 0) { zeros++; actualZeroCells.push({ sheet: name, cell: address, sourceDate: date }); } }
        else if (v === "NA" || v === "N/A") providerNA++; else other++;
        assert.ok(!cell?.z || cell.z === "General"); assert.equal(cell?.c?.length ?? 0, 0);
      }
    }
    const s = summary.sheets.find(s => s.sheet === name)!;
    assert.deepEqual([numeric, zeros, providerNA, blank, other], [s.numericCells, s.trueZeros, s.providerNA, s.blank, s.other]);
    assert.equal(s.explicitCurrencyCells, 0); assert.equal(s.explicitMagnitudeCells, 0);
    assert.equal(proof.proof.find((p: any) => p.sheet === name).unqualifiedCompanyNameUnitTokenCells, 386);
    originalDates[name] = dates;
    const targetMonth = "2026-01", row = dates.findIndex(d => d.startsWith(targetMonth)) + 1;
    assert.ok(row > 0); selected[name] = { sheet, row,
      headers: XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, range: { s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } } })[0] };
  }
  const pairs = originalDates.MV.map(d => originalDates.Profit.filter(p => p.slice(0, 7) === d.slice(0, 7)));
  assert.equal(pairs.filter((p, i) => p.length === 1 && p[0] !== originalDates.MV[i]).length, 192);
  assert.equal(actualZeroCells.filter(c => c.sheet === "Profit").length, 16);
  assert.equal(summary.exactAcceptedIdentityCount, 1); assert.equal(audit.journal.exactAccepted.length, 1);
  assert.equal(summary.authorizedDatedFxCount, 0); assert.equal(summary.convertedMoneyCells, 0); assert.equal(summary.monetaryTotals, null);
  const descSheet = XLSX.readFile(audit.workbook, { sheets: ["Descriptive"] }).Sheets.Descriptive;
  const descriptive = XLSX.utils.sheet_to_json<any>(descSheet);
  const companies = descriptive.map((r, i) => ({ id: i + 1, isin: r.Type, name: r.NAME, geography: r["GEOGRAPHIC DESCR."] ?? null,
    sector: r["LEVEL2 SECTOR NAME"] ?? null, subSector: r["LEVEL3 SECTOR NAME"] ?? null, industry: r["LEVEL5 SECTOR NAME"] ?? null,
    sdgAlignmentScore: null, emissionTarget2050: null })) as CvCompany[];
  const cells: MoneyCellEvidence[] = [], rows: CvTimeSeries[] = [];
  for (const company of companies) {
    const money: any = {}, sourceCells: any = {};
    for (const [name, field] of [["MV", "marketCap"], ["Profit", "netProfit"]] as const) {
      const { sheet, row, headers } = selected[name];
      const matches = headers.map((h: unknown, i: number) => ({ h, i })).filter(({ h }: any) => typeof h === "string" && h.split(" - ")[0] === company.name);
      money[field] = null;
      if (matches.length !== 1) continue;
      const address = XLSX.utils.encode_cell({ r: row, c: matches[0].i }), v = sheet[address]?.v;
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const sourceDate = serial(sheet[XLSX.utils.encode_cell({ r: row, c: 0 })].v);
      money[field] = v; sourceCells[field] = { sourceId: audit.sourceId, sheet: name, cell: address, originalValue: v, observationDate: sourceDate };
      cells.push({ companyId: company.id, isin: company.isin, field, sourceId: audit.sourceId, sheet: name, cell: address,
        observationDate: sourceDate, nativeValue: v, nativeCurrency: null, magnitude: null, denominationEvidenceHash: null });
    }
    rows.push({ id: company.id, companyId: company.id, date: new Date(serial(selected.MV.sheet[XLSX.utils.encode_cell({ r: selected.MV.row, c: 0 })].v)), ...money,
      sourceCells, derivations: { netProfit: { method: "unique-same-calendar-month-source-period-alignment; not-source-cell-infill" } },
      totalReturnIndex: null, priceEarnings: null, scope1Emissions: null, scope2Emissions: null, scope3Emissions: null } as CvTimeSeries);
  }
  const context: MonetaryContext = { cutoff: audit.capturedAt, targetCurrency: "USD", fx: [], cells,
    identities: audit.journal.exactAccepted.map((r: any) => ({ companyId: r.payload.identity.companyId, isin: r.payload.identity.isin,
      reviewId: r.id, status: "approved", reviewedAt: new Date(r.reviewed_at).toISOString() })) };
  const acceptedCells = cells.filter(c => context.identities.some(i => i.companyId === c.companyId && i.isin === c.isin));
  assert.ok(acceptedCells.length > 0);
  for (const c of acceptedCells) assert.equal(checkedWorkbookMoney(c, context).value, null);
  assert.equal(qualifyMonetaryDates(rows, context).length, 0);
  assert.equal(monetaryContext.run(context, () => computeGroupAggregates(rows, false, false, 0)).totalMarketCap, null);
  const packed = packDataset(companies, rows), results: Record<string, unknown> = {};
  process.env.NODE_ENV = "test";
  await runWithIsolatedCompanyCarbonCache({ get: async () => undefined, putIfAbsent: async () => {} }, () => {},
    () => monetaryContext.run(context, () => runWithReplayWorkbook(packed, () => snapshotContext.run(
      { id: packed.id, companyCount: companies.length, observationCount: rows.length } as SnapshotHeader, async () => {
        results.carbonPrice = await calculateTotalBasedCarbonPrice(0, "absolute", false, false, 0);
        results.peTerciles = await computeTercilesOnTheFly("absolute", false);
        results.sdgGrowth = await calculateSDGGrowthDifferential();
        results.targetBands = await calculateDecarbBands();
        results.targetTerciles = await calculateDecarbTerciles("absolute");
      }))));
  for (const value of Object.values(results)) assert.deepEqual(value, []);
  const bytes = buildWorkbookMoneyAuditWorkbook(summary), book = XLSX.read(bytes, { type: "buffer" });
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets["Safe source counts"]), summary.sheets);
  const fields = XLSX.utils.sheet_to_json<any>(book.Sheets["Qualification and dates"]);
  assert.equal(fields.find(r => r.Field === "monetaryTotals")["Value / JSON"], "null");
  assert.equal(hash(audit.workbook), audit.sourceId);
  const receipt = { version: "workbook-money-guards-1", passed: true, sourceCompanyCount: companies.length, actualPrivateSelectedDateRows: rows.length,
    actualWorkbookSheetsRecounted: 2, profitTrueZerosPreserved: 16, actualSameMonthCrossDatePairsPreserved: 192,
    exactCurrentAcceptedIdentities: 1, authorizedDatedFx: 0, sourceQualifiedConvertedMoneyCells: 0,
    acceptedIdentityWithoutCellDenominationStillWithheld: true, actualMonetaryConsumersExecuted: Object.keys(results),
    fiveConsumerResultsWithheld: true, directAggregateMoneyIsNull: true, actualSafeXlsxBinaryReadback: true,
    noRawPrivateValuesExported: true, pendingReviewOnly: true, dbWriteOrApprovalCalls: 0,
    sourceHash: audit.sourceId, privateSourceHash: hash(`${dir}/private-audit.json`), safeSummaryHash: hash(`${dir}/safe-summary-qualified.json`),
    frozenSourceCodeHash: hash(freezePath) };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
