import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import XLSX from "xlsx";
import { registerWorkbookMoneyAuditApi } from "../server/workbookMoneyAuditApi";
const sha = "a".repeat(64);
function syntheticSafeSummary() {
  return { version: "workbook-money-audit-2", status: "pending-review", capturedAt: "2026-01-01T00:00:00.000Z",
    sourceHash: sha, sourceMetadataHash: sha, denominationReconciliationHash: sha, label: "Unknown/unconverted monetary totals withheld, NOT zero",
    sourceCompanyCount: 6, approvedReviewCount: 1, exactAcceptedIdentityCount: 1, authorizedDatedFxCount: 0,
    convertedMoneyCells: 0, monetaryTotals: null, unresolvedDenominationOrMagnitude: true,
    sourceDatePolicy: "Actual Profit date, not aligned RI date; exact source-day FX only", sameMonthCrossDateRowPairs: 2, ambiguousProfitMonths: 0,
    sheets: ["MV", "Profit"].map(sheet => ({ sheet, columns: 6, dataRows: 2, numericCells: 10, trueZeros: 1, providerNA: 2,
      blank: 0, other: 0, explicitCurrencyCells: 0, explicitMagnitudeCells: 0, commentedCells: 0, numberFormatKinds: 1,
      firstActualSourceDate: "2025-01-04T00:00:00.000Z", lastActualSourceDate: "2025-02-04T00:00:00.000Z", unqualifiedCompanyNameUnitTokenCells: 0 })),
    limitation: "No provider/cell/identity values", approval: "Pending review only; not approved" };
}
async function withServer(reader: () => Promise<unknown>, check: (base: string) => Promise<void>) {
  const app = express(); registerWorkbookMoneyAuditApi(app, reader);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(r => server.once("listening", r));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try { await check(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((r, e) => server.close(err => err ? e(err) : r())); }
}
test("Actual read-only API/XLSX binary readback contains only safe counts, original dates, pending label and literal null money", async () => {
  const summary = syntheticSafeSummary();
  await withServer(async () => summary, async base => {
    const r = await fetch(`${base}/api/financial-data/workbook-money-audit`); assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), summary); assert.equal(r.headers.get("cache-control"), "no-store");
    const x = await fetch(`${base}/api/financial-data/workbook-money-audit.xlsx`); assert.equal(x.status, 200);
    const book = XLSX.read(Buffer.from(await x.arrayBuffer()), { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets["Safe source counts"]), summary.sheets);
    const fields = XLSX.utils.sheet_to_json<any>(book.Sheets["Qualification and dates"]);
    assert.equal(fields.find(r => r.Field === "monetaryTotals")["Value / JSON"], "null");
    assert.equal(fields.find(r => r.Field === "status")["Value / JSON"], "pending-review");
  });
});
test("Unknown/provider/private fields or missing audit fail explicit503, never accidental raw export or default monetary zero", async () => {
  for (const reader of [async () => ({ ...syntheticSafeSummary(), rawProviderValues: [123] }), async () => { throw new Error("missing private evidence"); }])
    await withServer(reader, async base => {
      for (const suffix of ["", ".xlsx"]) {
        const r = await fetch(`${base}/api/financial-data/workbook-money-audit${suffix}`); assert.equal(r.status, 503);
        const body = await r.json() as any; assert.equal(body.monetaryTotals, null); assert.equal(body.status, "pending-review");
        assert.equal("rawProviderValues" in body, false);
      }
    });
});
