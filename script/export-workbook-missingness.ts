/**
 * Read-only engineering audit. No import, approval, database mutation or model
 * promotion. npx tsx script/export-workbook-missingness.ts input.xlsx output-dir --engineering-only
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAndPrepare, validateRequiredSheets, generateTimeSeriesStreaming } from "../server/climateValuation/dataProcessor";
import { packDataset, unpackDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext, type SnapshotHeader } from "../server/snapshots/store";
import { carryForwardEmissions } from "../server/climateValuation/emissionsCarryForward";
import { computeTercilesOnTheFly } from "../server/climateValuation/tercileCalculator";
import { exportWorkbookMissingness } from "../server/climateValuation/workbookMissingnessExport";
import type { CvCompany, CvTimeSeries } from "../shared/schema";

export async function exportWorkbookMissingnessAudit(path: string, output: string) {
  const context = await parseAndPrepare(path, validateRequiredSheets(path));
  try {
    const companies = context.companyData.companies.map((row, index) => ({ ...row, id: index + 1 })) as CvCompany[];
    const rows: CvTimeSeries[] = [];
    await generateTimeSeriesStreaming(context, path, new Map(companies.map(row => [row.isin, row.id])), 2000, async batch => {
      for (const row of batch) rows.push({ ...row, id: rows.length + 1 } as CvTimeSeries);
    });
    const packed = packDataset(companies, rows);
    const immutable = JSON.parse(JSON.stringify(packed));
    const original = unpackDataset(immutable.id, immutable.chunks).timeSeries;
    const header = { id: immutable.id, companyCount: companies.length, observationCount: rows.length } as SnapshotHeader;
    const calculation = await runWithReplayWorkbook(immutable, () =>
      snapshotContext.run(header, () => computeTercilesOnTheFly("absolute", false)));
    const exported = exportWorkbookMissingness({
      snapshotId: immutable.id, immutableInput: immutable, sourceId: context.sourceId,
      original, calculated: carryForwardEmissions(original), calculationRows: calculation.map(row => ({ ...row })),
    });
    await mkdir(output, { recursive: true });
    await writeFile(join(output, "immutable-input.json"), JSON.stringify(immutable, null, 2));
    await writeFile(join(output, "missingness.xlsx"), exported.bytes);
    const receipt = {
      criterion: "S03-008", sourceId: context.sourceId, immutableInputId: immutable.id,
      observations: rows.length, calculator: "computeTercilesOnTheFly",
      calculationRows: calculation.length, infilledCells: exported.infills,
      databaseWrites: 0, scientificAcceptance: false, issuerApproval: false,
    };
    await writeFile(join(output, "receipt.json"), JSON.stringify(receipt, null, 2));
    return receipt;
  } finally { context.releaseMemory(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output, flag] = process.argv.slice(2);
  if (process.env.NODE_ENV === "production" || !input || !output || flag !== "--engineering-only")
    throw new Error("Read-only development engineering audit requires input.xlsx output-dir --engineering-only");
  await exportWorkbookMissingnessAudit(input, output);
}
