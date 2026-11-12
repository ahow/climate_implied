/** Synthetic engineering files, never actual issuer data or production sources.
 * Exercise the unchanged fixed-root authenticating readers in a temporary CWD;
 * no private workspace/generated file, provider or database is consulted. */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { contentHash } from "../../server/calculation/analysisManifest";
import { readStage10RetainedFiles } from "../../server/financialData/stage10Source";
import { readWorkbookMoneyExportRelease } from "../../server/financialData/workbookMoneyExportRelease";

export async function isolatedRetainedReportInputs() {
  const previous = process.cwd(), root = mkdtempSync(join(tmpdir(), "synthetic-retained-reports-"));
  const capturedAt = "2026-11-01T00:00:00.000Z";
  const write = (path: string, value: unknown) => {
    const bytes = JSON.stringify(value);
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), bytes);
    return createHash("sha256").update(bytes).digest("hex");
  };
  try {
    const results = Array.from({ length: 100 }, (_, index) => ({
      companyId: index + 1, isin: `SYNTHETIC-ENGINEERING-${index + 1}`,
      status: index < 50 ? "unmatched" : "ambiguous",
    }));
    write("generated-artifacts/financial-data/mapping-audit.json", {
      engineeringFixture: true, createdAt: capturedAt, universe: 100, attempted: 100, notAttempted: 0, results,
    });
    const selected = ["unmatched", "ambiguous"].flatMap(status => results.filter(row => row.status === status)
      .sort((a, b) => contentHash({ isin: a.isin, seed: "audit-20261108" })
        .localeCompare(contentHash({ isin: b.isin, seed: "audit-20261108" }))).slice(0, 50));
    write("generated-artifacts/financial-data/root-cause-audit.json", {
      engineeringFixture: true, sourceAuditHash: contentHash(results),
      selectionHash: contentHash(selected.map(({ companyId, isin, status }) => ({ companyId, isin, status }))),
      rows: selected.map(row => ({ companyId: row.companyId, isin: row.isin, originalStatus: row.status,
        status: "unmatched", collectedAt: capturedAt, profiles: [] })),
    });
    for (const row of results.slice(0, 2)) {
      const symbol = `SYNTHETIC${row.companyId}`;
      const payload = { company: { id: row.companyId, isin: row.isin },
        selection: { isin: row.isin, symbol }, profile: { isin: row.isin, symbol },
        statements: { "income-statement": [{ symbol, period: "FY", date: "2024-12-31",
          reportedCurrency: "USD", revenue: 17, netIncome: 0 }] } };
      const inputHash = contentHash(payload);
      write(`generated-artifacts/company-worked-inputs/synthetic-${row.companyId}-${inputHash}.json`,
        { engineeringFixture: true, payload, inputHash, fetchedAt: capturedAt });
    }
    const moneyRoot = "generated-artifacts/workbook-money-audit-v1";
    const sourceMetadataHash = write(`${moneyRoot}/private-audit.json`,
      { engineeringFixture: true, source: "SYNTHETIC ENGINEERING ONLY", observations: [17, 0] });
    const denominationReconciliationHash = write(`${moneyRoot}/denomination-reconciliation.json`,
      { engineeringFixture: true, authorizedDatedFx: 0, convertedMoneyCells: 0 });
    write(`${moneyRoot}/safe-summary-qualified.json`, {
      version: "workbook-money-audit-2", status: "pending-review", capturedAt,
      sourceHash: contentHash({ engineeringFixture: true, originalWorkbook: "not a production workbook" }),
      sourceMetadataHash, denominationReconciliationHash, label: "SYNTHETIC ENGINEERING ONLY; unknown money withheld",
      sourceCompanyCount: 2, approvedReviewCount: 0, exactAcceptedIdentityCount: 0,
      authorizedDatedFxCount: 0, convertedMoneyCells: 0, monetaryTotals: null,
      unresolvedDenominationOrMagnitude: true, sourceDatePolicy: "Synthetic engineering source dates; not publication",
      sameMonthCrossDateRowPairs: 0, ambiguousProfitMonths: 0,
      sheets: ["MV", "Profit"].map(sheet => ({ sheet, columns: 2, dataRows: 1, numericCells: 2,
        trueZeros: 1, providerNA: 0, blank: 0, other: 0, explicitCurrencyCells: 0, explicitMagnitudeCells: 0,
        commentedCells: 0, numberFormatKinds: 1, firstActualSourceDate: capturedAt,
        lastActualSourceDate: capturedAt, unqualifiedCompanyNameUnitTokenCells: 0 })),
      limitation: "Synthetic fixture authenticates hashes and safe projection, never actual monetary qualification",
      approval: "No approval, source acquisition or private publication",
    });
    process.chdir(root);
    return { files: await readStage10RetainedFiles(), money: await readWorkbookMoneyExportRelease() };
  } finally {
    process.chdir(previous);
    rmSync(root, { recursive: true, force: true });
  }
}
