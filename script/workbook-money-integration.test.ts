import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import express from "express";
import XLSX from "xlsx";
import { registerWorkbookMoneyAuditApi } from "../server/workbookMoneyAuditApi";
import { workbookMoneyAuditHash, buildWorkbookMoneyAuditWorkbook } from "../server/financialData/workbookMoneyExport";
import { workbookMoneyAuditSchema, workbookMoneyReportPaths, workbookMoneySemantics, workbookMoneyRootPaths } from "../shared/workbookMoneyAudit";
import { requireOutputSemantic } from "../shared/outputFieldSemantics";
import { WorkbookMoneyAudit, fetchWorkbookMoneyAudit } from "../client/src/components/workbook-money-audit";
const hash = "a".repeat(64);
function fixture() {
  return { version: "workbook-money-audit-2", status: "pending-review", capturedAt: "2026-01-01T00:00:00.000Z",
    sourceHash: hash, sourceMetadataHash: hash, denominationReconciliationHash: hash,
    label: "Synthetic engineering only: unknown denomination/magnitude/dated FX; totals withheld,not zero",
    sourceCompanyCount: 6, approvedReviewCount: 1, exactAcceptedIdentityCount: 1, authorizedDatedFxCount: 0,
    convertedMoneyCells: 0, monetaryTotals: null, unresolvedDenominationOrMagnitude: true,
    sourceDatePolicy: "Actual Profit source day,not RI-day or nearest-day FX", sameMonthCrossDateRowPairs: 2, ambiguousProfitMonths: 0,
    sheets: ["MV", "Profit"].map(sheet => ({ sheet, columns: 6, dataRows: 2, numericCells: 10, trueZeros: 1,
      providerNA: 2, blank: 0, other: 0, explicitCurrencyCells: 0, explicitMagnitudeCells: 0, commentedCells: 0,
      numberFormatKinds: 1, firstActualSourceDate: sheet === "MV" ? "2025-01-22T00:00:00.000Z" : "2025-01-04T00:00:00.000Z",
      lastActualSourceDate: "2025-02-04T00:00:00.000Z", unqualifiedCompanyNameUnitTokenCells: 0 })),
    limitation: "No private values or identifiers; quote currencies are not source-cell units", approval: "Pending review; no real approval" };
}
const ssr = (state: React.ComponentProps<typeof WorkbookMoneyAudit>["readState"]) =>
  renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() },
    React.createElement(WorkbookMoneyAudit, { readState: state })));
test("actual consumer SSR loading/error/absent/invalid/unidentified/ready; null money has precise reason,zero counts and pinned downloads", () => {
  const data = fixture(), auditHash = workbookMoneyAuditHash(data);
  const ready = ssr({ data, auditHash });
  assert.match(ready, /6 original source companies/); assert.match(ready, /20 numeric source cells/);
  assert.match(ready, /Withheld — unknown\/unconverted,not zero/);
  assert.match(ready, /Independently reported dimensionless P\/E is not a monetary total/);
  assert.ok(ready.includes(`expectedAuditHash=${auditHash}`));
  assert.ok(ready.includes("2025-01-04")); assert.ok(ready.includes("2025-01-22"));
  for (const id of new Set(Array.from(ready.matchAll(/data-field-id="([^"]+)"/g), m => m[1])))
    assert.ok(requireOutputSemantic(id));
  for (const state of [{ loading: true, data, auditHash }, { error: "Named retained catalog failure", data, auditHash },
    {}, { data: { ...data, monetaryTotals: 0 }, auditHash }, { data }]) {
    const html = ssr(state);
    assert.ok(!html.includes("Exact audit XLSX")); assert.ok(!html.includes("20 numeric source cells"));
    assert.ok(!html.includes(auditHash));
  }
});
test("actual GET API and XLSX preserve exact source dates/counts/reasons/disclosure identity; reject untrusted queries and changed pins", async () => {
  const raw = fixture(), report = workbookMoneyAuditSchema.parse(raw), auditHash = workbookMoneyAuditHash(report);
  const app = express(); registerWorkbookMoneyAuditApi(app, async () => raw);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/financial-data/workbook-money-audit`;
  try {
    const response = await fetch(base); assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Workbook-Money-Audit-SHA256"), auditHash);
    assert.deepEqual(await response.json(), report);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((input, init) => originalFetch(typeof input === "string" && input.startsWith("/") ?
      `http://127.0.0.1:${address.port}${input}` : input, init)) as typeof fetch;
    try {
      assert.deepEqual(await fetchWorkbookMoneyAudit(), { report, auditHash });
      globalThis.fetch = async () => new Response(JSON.stringify(report), {
        headers: { "X-Workbook-Money-Audit-SHA256": "b".repeat(64) },
      });
      await assert.rejects(fetchWorkbookMoneyAudit(), /identity mismatch/);
    } finally { globalThis.fetch = originalFetch; }
    const download = await fetch(`${base}.xlsx?expectedAuditHash=${auditHash}`); assert.equal(download.status, 200);
    assert.equal(download.headers.get("X-Workbook-Money-Audit-SHA256"), auditHash);
    const book = XLSX.read(Buffer.from(await download.arrayBuffer()), { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets["Safe source counts"]), report.sheets);
    const rows = XLSX.utils.sheet_to_json<any>(book.Sheets["Qualification and dates"]);
    for (const key of workbookMoneyRootPaths)
      assert.equal(rows.find(r => r.Field === key)["Value / JSON"], report[key] === null ? "null" : report[key]);
    assert.equal(rows.find(r => r.Field === "auditHash")["Value / JSON"], auditHash);
    assert.equal(XLSX.utils.sheet_to_json(book.Sheets["Field semantics"]).length, 36);
    const notes = XLSX.utils.sheet_to_json<any>(book.Sheets["Column bindings"]);
    assert.equal(notes.length, 35);
    for (const key of [...workbookMoneyRootPaths, "auditHash"])
      assert.equal(notes.find(n => n.Column === `Qualification and dates[${key}].Value / JSON`).FieldID, `workbookMoney.${key}`);
    for (const suffix of ["", ".xlsx"]) {
      for (const query of ["?path=/etc/passwd", "?currency=USD", "?refresh=true", "?expectedAuditHash=not-a-hash"])
        assert.equal((await fetch(`${base}${suffix}${query}`)).status, 400);
      const changed = await fetch(`${base}${suffix}?expectedAuditHash=${"b".repeat(64)}`);
      assert.equal(changed.status, 409); assert.equal(changed.headers.get("X-Workbook-Money-Audit-SHA256"), null);
    }
    assert.equal((await fetch(base, { method: "POST" })).status, 404);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test("precise metadata and complete finite source-cell partitions,not weak column-name tests or approval claims", () => {
  const report = workbookMoneyAuditSchema.parse(fixture()), paths = new Set<string>();
  function visit(v: unknown, path: string) {
    if (Array.isArray(v)) for (const item of v) visit(item, `${path}[]`);
    else if (v !== null && typeof v === "object") for (const [key, value] of Object.entries(v))
      visit(value, path ? `${path}.${key}` : key);
    else paths.add(path);
  }
  visit(report, "");
  assert.deepEqual([...paths].sort(), [...workbookMoneyReportPaths].sort());
  assert.equal(workbookMoneySemantics.length, 36);
  for (const semantic of workbookMoneySemantics) assert.deepEqual(requireOutputSemantic(semantic.id), semantic);
  for (const changed of [{ ...report, sheets: [report.sheets[0], report.sheets[0]] },
    { ...report, sheets: [{ ...report.sheets[0], numericCells: 11 }, report.sheets[1]] },
    { ...report, sourceCompanyCount: 7 }, { ...report, monetaryTotals: 0 }, { ...report, rawProviderValues: [123] }])
    assert.equal(workbookMoneyAuditSchema.safeParse(changed).success, false);
  assert.throws(() => buildWorkbookMoneyAuditWorkbook({ ...report, privateCompanyId: "NOT_ALLOWED" }));
  const index = readFileSync("server/index.ts", "utf8");
  assert.ok(index.indexOf("registerWorkbookMoneyAuditApi(app)") > index.indexOf("app.use(releaseSafety())"));
  for (const route of ["methodology", "climate-valuation"])
    assert.match(readFileSync(`client/src/pages/${route}.tsx`, "utf8"), /<WorkbookMoneyAudit\s*\/>/);
});
