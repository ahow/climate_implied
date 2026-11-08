/**
 * Authorized local operator import: validates the entire workbook and creates
 * a new immutable baseline atomically. Never deletes/replaces historical rows.
 * Usage: npx tsx script/import-approved-workbook.ts <file.xlsx> --approved
 */
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { db } from "../server/db";
import { cvCompanies, type CvCompany, type CvTimeSeries } from "../shared/schema";
import { validateRequiredSheets, parseAndPrepare, generateTimeSeriesStreaming } from "../server/climateValuation/dataProcessor";
import { saveImportedWorkbook } from "../server/snapshots/store";
async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Development-only importer until managed production schema is provisioned");
  const path = process.argv[2];
  if (!path || !/\.xlsx?$/i.test(path) || process.argv[3] !== "--approved")
    throw new Error("Supply an explicitly approved workbook");
  const info = await stat(path);
  if (!info.isFile() || info.size > 250 * 1024 * 1024) throw new Error("Invalid or oversized workbook");
  const context = await parseAndPrepare(path, validateRequiredSheets(path));
  try {
    const existing = await db.select({ id: cvCompanies.id, isin: cvCompanies.isin }).from(cvCompanies);
    const ids = new Map(existing.map(c => [c.isin, c.id]));
    let nextId = existing.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    const companies: CvCompany[] = context.companyData.companies.sort((a, b) => a.isin.localeCompare(b.isin)).map(c => {
      if (!ids.has(c.isin)) ids.set(c.isin, nextId++);
      return { ...c, id: ids.get(c.isin)!,
        geography: c.geography ?? null, sector: c.sector ?? null, subSector: c.subSector ?? null,
        industry: c.industry ?? null, sdgAlignmentScore: c.sdgAlignmentScore ?? null,
        emissionTarget2050: c.emissionTarget2050 ?? null };
    });
    const rows: CvTimeSeries[] = [];
    await generateTimeSeriesStreaming(context, path, ids, 2000, async batch => {
      for (const row of batch) rows.push({
        ...row, id: rows.length + 1, date: new Date(row.date),
        totalReturnIndex: row.totalReturnIndex ?? null, marketCap: row.marketCap ?? null,
        priceEarnings: row.priceEarnings ?? null, netProfit: row.netProfit ?? null,
        scope1Emissions: row.scope1Emissions ?? null, scope2Emissions: row.scope2Emissions ?? null,
        scope3Emissions: row.scope3Emissions ?? null,
      });
    });
    if (!companies.length || !rows.length) throw new Error("Empty import rejected");
    console.log(JSON.stringify(await saveImportedWorkbook(companies, rows,
      `Operator-approved workbook ${basename(path)}; parsed numeric precision; revised history; publication vintages unavailable`)));
  } finally { context.releaseMemory(); }
}
main().then(() => process.exit(0)).catch(() => {
  console.error("Import failed; no previous dataset replaced. Check workbook, schema and approval argument.");
  process.exit(1);
});
