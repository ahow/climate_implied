import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import * as XLSX from "xlsx";
import { registerWorkbookMoneyAuditApi } from "../server/workbookMoneyAuditApi";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { withDownloadManifest } from "../shared/serverDownloadRegistry";
import { scientificEvidenceStatuses } from "../shared/scientificEvidence";

test("monetary attachment manifests are additive while frozen source-qualification tests and null totals remain unchanged", async () => {
  // Isolated safe-count engineering fixture. No private workbook is opened and
  // no monetary currency/FX metadata, reviewer authorization or totals invented.
  const report = { version: "workbook-money-audit-2", status: "pending-review",
    capturedAt: "2026-01-01T00:00:00.000Z", sourceHash: "a".repeat(64), sourceMetadataHash: "a".repeat(64),
    denominationReconciliationHash: "a".repeat(64), label: "Unknown/unconverted monetary totals withheld, NOT zero",
    sourceCompanyCount: 6, approvedReviewCount: 1, exactAcceptedIdentityCount: 1, authorizedDatedFxCount: 0,
    convertedMoneyCells: 0, monetaryTotals: null, unresolvedDenominationOrMagnitude: true,
    sourceDatePolicy: "Actual Profit date, not aligned RI date; exact source-day FX only",
    sameMonthCrossDateRowPairs: 2, ambiguousProfitMonths: 0,
    sheets: ["MV", "Profit"].map(sheet => ({ sheet, columns: 6, dataRows: 2, numericCells: 10, trueZeros: 1,
      providerNA: 2, blank: 0, other: 0, explicitCurrencyCells: 0, explicitMagnitudeCells: 0, commentedCells: 0,
      numberFormatKinds: 1, firstActualSourceDate: "2025-01-04T00:00:00.000Z",
      lastActualSourceDate: "2025-02-04T00:00:00.000Z", unqualifiedCompanyNameUnitTokenCells: 0 })),
    limitation: "No provider/cell/identity values", approval: "Pending review only; not approved" };
  const app = express(); app.use(downloadManifestMiddleware());
  registerWorkbookMoneyAuditApi(app, async () => report);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number }, base = `http://127.0.0.1:${address.port}`;
  const path = "/api/financial-data/workbook-money-audit.xlsx";
  try {
    const plain = await fetch(base + path);
    assert.equal(plain.status, 200); assert.ok(plain.headers.get("X-Download-Manifest"));
    const original = XLSX.read(Buffer.from(await plain.arrayBuffer()), { type: "buffer" });
    const response = await fetch(base + withDownloadManifest(path));
    assert.equal(response.status, 200);
    const book = XLSX.read(Buffer.from(await response.arrayBuffer()), { type: "buffer" });
    assert.deepEqual(book.SheetNames, [...original.SheetNames, "Download manifest"]);
    for (const name of original.SheetNames)
      assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: null }),
        XLSX.utils.sheet_to_json(original.Sheets[name], { header: 1, defval: null }));
    const values = XLSX.utils.sheet_to_json<{ Field: string; "Value / JSON": unknown }>(book.Sheets["Qualification and dates"]);
    assert.equal(values.find(row => row.Field === "monetaryTotals")!["Value / JSON"], "null");
    const manifest = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Download manifest"])
      .map(row => [row.Field, JSON.parse(row.Value)]));
    assert.deepEqual(manifest.scientificEvidence, scientificEvidenceStatuses());
    assert.equal(manifest.scientificAcceptance, false);
    assert.equal((await fetch(base + withDownloadManifest(path) + "&currency=USD")).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
