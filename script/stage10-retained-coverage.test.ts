import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import express from "express";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { buildStage10Coverage, sevenStateIdentity, stage10EligibleCorpus, type Stage10Cell } from "../server/financialData/stage10Coverage";
import { retainedStatementCells, authenticateStage10RetainedVersion } from "../server/financialData/stage10Source";
import { snapshotId } from "../server/financialData/review";
import { contentHash } from "../server/calculation/analysisManifest";
import { stage10IdentityStates, stage10Fields, stage10CoverageSemantics, stage10JsonExportLeafBindings } from "../shared/stage10Coverage";
import { reassessRetainedMapping } from "../server/financialData/mappingDiagnostics";
import { lifecycleProfileEvidence } from "../server/financialData/stage10Lifecycle";
import { registerStage10CoverageRoutes } from "../server/stage10CoverageApi";
import { buildStage10Workbook, stage10ExportDocument } from "../server/financialData/stage10Export";
import { Stage10FinancialCoverage, stage10DownloadUrl, fetchStage10Coverage } from "../client/src/components/stage10-financial-coverage";
import { releaseSafety } from "../server/releaseSafety";
import { outputFieldSemantics } from "../shared/outputFieldSemantics";

/** Synthetic engineering identity/field examples only; no real approval/study. */
function fixture() {
  const isins = ["US0378331005", "US17275R1023", "US5949181045", "US4592001014", "US1912161007", "US0231351067", ""];
  const companies = isins.map((isin, i) => ({ id: i + 1, isin, sector: i === 6 ? null : "Engineering sector", geography: i === 5 ? null : "Engineering region" }));
  const payload = { identity: { companyId: 4, isin: isins[3], symbol: "PRIVATE_IDENTIFIER_NEVER_EXPORT",
    currency: "USD", exchange: "NYSE", shareClassFIGI: "PRIVATE_CLASS", issuerId: "PRIVATE_ISSUER",
    marketCapScope: "issuer", primaryListingEvidence: "https://example.org/engineering-only",
    issuerEvidence: "https://example.org/engineering-only", reviewedAt: "2021-03-01T00:00:00Z" },
    quote: { price: 10, marketCap: 1000, observedAt: "2021-03-01T00:00:00Z" },
    statement: { netIncome: 80, period: "2020-12-31", filingDate: "2021-02-20", currency: "USD" }, fetchedAt: "2021-03-01T00:00:00Z" };
  const reviews = [{ id: snapshotId(payload as any), status: "approved", payload, reviewed_at: "2021-03-02T00:00:00Z" }];
  const attempts = [2, 3, 5, 6].map((id, i) => ({ companyId: id, isin: isins[id - 1],
    status: ["error", "candidate-needs-issuer-review", "ambiguous", "unmatched"][i] }));
  const cell = (companyId: number, field: Stage10Cell["field"], more: Partial<Stage10Cell> = {}): Stage10Cell => ({
    companyId, isin: isins[companyId - 1], year: 2020, field, state: "present", value: 0,
    currency: "USD", filingDate: "2021-02-20", filingEvidence: "provider-unverified", restatement: "unknown",
    sourceHash: contentHash({ engineeringSource: true }), capturedAt: "2021-03-01T00:00:00Z", ...more,
  });
  return { workbookHash: contentHash({ engineeringWorkbook: true }), cutoff: "2021-07-31T00:00:00Z", years: [2020],
    companies, attempts, reviews, eligibleIds: [4], cells: [cell(3, "operatingCashFlow"), cell(3, "netIncome", { state: "explicitNull", value: null }),
      cell(4, "netIncome", { value: 80, restatement: "original", filingEvidence: "verified-original" }),
      cell(5, "netDebt", { value: 2, restatement: "restated" })],
    sourceIdentity: { engineeringOnly: true }, retainedVersions: 1, selectedVersions: 1,
    sourceGaps: ["Explicit synthetic engineering fixture; no real authorization"], cell };
}
const row = (r: ReturnType<typeof buildStage10Coverage>, key: string) => r.rows.find(x =>
  x.population === "full-workbook" && x.sector === "All sectors" && x.key === key)!;
test("exact S10-002/006/014 original criteria retain seven states,all fields and sector×region provenance", () => {
  const ledger = readFileSync("docs/WORKPLAN_COMPLETION_LEDGER.md", "utf8");
  assert.match(ledger, /Keep identity-review states distinct: not queried, provider error, candidate awaiting review, accepted, ambiguous, unmatched, out of scope/);
  assert.match(ledger, /Record each value's filing date, and flag whether it is the original or a restated value/);
  assert.match(ledger, /share of values flagged as restated, are reported by sector and region/);
});
test("all seven actual identity states remain distinct; provider error cannot become approval,unmatched or unqueried", () => {
  const f = fixture(), report = buildStage10Coverage(f);
  assert.deepEqual(report.rows.filter(r => r.population === "full-workbook" && r.sector === "All sectors" &&
    r.dimension === "identity").map(r => [r.key, r.present]), stage10IdentityStates.map(s => [s, 1]));
  assert.equal(sevenStateIdentity(f.companies[3], [{ companyId: 4, isin: f.companies[3].isin, status: "error" }], f.reviews, f.cutoff), "provider-error");
  assert.throws(() => sevenStateIdentity(f.companies[0], [{ companyId: 1, isin: f.companies[0].isin, status: "NEW_UNKNOWN" }], [], f.cutoff), /Unknown retained/);
  assert.equal(report.fullWorkbookCompanies, 7); assert.equal(report.verifiedEligibleCompanies, 1);
  assert.equal(reassessRetainedMapping({ status: "error" }).identityReviewState, "provider-error");
  assert.equal(reassessRetainedMapping({ status: "not-queried" }).identityReviewState, "not-queried");
  assert.throws(() => reassessRetainedMapping({ status: "unmatched" }), /evidence missing/);
});
test("full and verified-eligible fixed domains keep missing/null/observed0/conflicts and unknown categories without survivor filtering", () => {
  const f = fixture(), before = contentHash(f.sourceIdentity), r = buildStage10Coverage(f);
  assert.equal(row(r, "operatingCashFlow").present, 1);
  assert.equal(row(r, "operatingCashFlow").missing, 6);
  assert.equal(row(r, "netIncome").explicitNull, 1);
  assert.equal(row(r, "netIncome").present, 1);
  assert.equal(row(r, "segments").missing, 7);
  assert.ok(r.rows.some(x => x.region === "Unknown")); assert.ok(r.rows.some(x => x.sector === "Unknown"));
  for (const x of r.rows.filter(x => x.dimension === "financial-field" && !x.suppressed))
    assert.equal(x.present! + x.missing! + x.explicitNull! + x.invalid! + x.conflicted!, x.expectedSlots);
  for (const x of r.rows.filter(x => x.population === "verified-eligible" && x.companies === 1)) {
    assert.equal(x.suppressed, true); assert.equal(x.present, null); assert.equal(x.availableShare, null);
  }
  assert.equal(contentHash(f.sourceIdentity), before);
  const conflict = buildStage10Coverage({ ...f, cells: [...f.cells, f.cells[0]] });
  assert.equal(row(conflict, "operatingCashFlow").conflicted, 1); assert.equal(row(conflict, "operatingCashFlow").present, 0);
});
test("unknown restatement is never0%not-restated; known denominator,unknown share and filing date classes reconcile", () => {
  const r = buildStage10Coverage(fixture()), ocf = row(r, "operatingCashFlow"), debt = row(r, "netDebt");
  assert.equal(ocf.restatementUnknown, 1); assert.equal(ocf.restatementKnownDenominator, 0);
  assert.equal(ocf.restatedShareOfKnownProvenance, null); assert.equal(ocf.restatementUnknownShareOfPresent, 1);
  assert.equal(ocf.explicitRestatedFlagShareOfPresent, 0, "No explicit true flags is not a claim of no restatements; unknown share remains1 and known rate null");
  assert.equal(debt.restatedShareOfKnownProvenance, 1);
  for (const x of r.rows.filter(x => x.dimension === "financial-field" && !x.suppressed)) {
    assert.equal(x.original! + x.restated! + x.restatementUnknown!, x.present);
    assert.equal(x.originalFilingDateVerified! + x.providerFilingDateUnverified! + x.filingDateMissing!, x.present);
  }
});
test("retained field adapter preserves each filing date,unknown false flags,negative debt/earnings and correct FCFE/WC/shares classifications", () => {
  const f = fixture(), base = { date: "2020-12-31", period: "FY", filingDate: "2021-02-20", reportedCurrency: "USD", isRestated: false };
  const cells = retainedStatementCells({ companyId: 1, isin: f.companies[0].isin,
    sourceHash: contentHash({ engineering: true }), capturedAt: "2021-03-01T00:00:00Z", statements: {
      "income-statement": [{ ...base, revenue: 0, ebitda: -2, netIncome: -1, weightedAverageShsOut: 4 }],
      "cash-flow-statement": [{ ...base, operatingCashFlow: 100, capitalExpenditure: -20, netDebtIssuance: 5, changeInWorkingCapital: -80 }],
      "balance-sheet-statement": [{ ...base, totalDebt: 10, cashAndCashEquivalents: 20, totalCurrentAssets: 30, totalCurrentLiabilities: 30 }],
    } }, f.cutoff);
  assert.equal(cells.find(c => c.field === "fcfe")?.value, 85);
  assert.equal(cells.find(c => c.field === "workingCapital")?.value, 0);
  assert.equal(cells.find(c => c.field === "netDebt")?.value, -10);
  assert.equal(cells.find(c => c.field === "shares")?.value, 4);
  assert.ok(cells.every(c => c.filingDate === "2021-02-20" && c.filingEvidence === "provider-unverified" && c.restatement === "unknown"));
  const bad = retainedStatementCells({ companyId: 1, isin: f.companies[0].isin, sourceHash: contentHash({ x: 1 }),
    capturedAt: "2021-03-01T00:00:00Z", statements: { "cash-flow-statement": [{ ...base, operatingCashFlow: 100, capitalExpenditure: 20, netDebtIssuance: 5 }] } }, f.cutoff);
  assert.ok(bad.filter(c => ["fcfe", "capitalExpenditure"].includes(c.field)).every(c => c.state === "invalid"));
});
test("only genuine original dated exact-identity cells can advance11–15; proxies,future sources and duplicates refuse", () => {
  const f = fixture();
  assert.equal(stage10EligibleCorpus(f.companies, new Set([4]), f.cells, f.cutoff).length, 1);
  assert.equal(stage10EligibleCorpus(f.companies, new Set([4]), f.cells, "2020-01-01T00:00:00Z").length, 0);
  const original = f.cells[2];
  for (const more of [{ filingEvidence: "provider-unverified" }, { restatement: "unknown" }, { capturedAt: "2022-01-01T00:00:00Z" }])
    assert.equal(stage10EligibleCorpus(f.companies, new Set([4]), [{ ...original, ...more } as Stage10Cell], f.cutoff).length, 0);
  assert.equal(stage10EligibleCorpus(f.companies, new Set([4]), [original, original], f.cutoff).length, 0);
  assert.throws(() => buildStage10Coverage({ ...f, cells: [{ ...original, isin: f.companies[0].isin }] }), /identity mismatch/);
});
test("actual retained-version authenticator rejects corrupt hash/identity/security/endpoint without provider refresh or source writes", () => {
  const f = fixture();
  const payload = { company: f.companies[0], profile: { isin: f.companies[0].isin, symbol: "ENGINEERING" },
    selection: { isin: f.companies[0].isin, symbol: "ENGINEERING" }, statements: { "income-statement": [] } };
  const source = { payload, inputHash: contentHash(payload), fetchedAt: "2021-03-01T00:00:00Z" };
  assert.equal(authenticateStage10RetainedVersion(source, `ENGINEERING-${source.inputHash}.json`).sourceEnvelopeHash, contentHash(source));
  assert.throws(() => authenticateStage10RetainedVersion({ ...source, inputHash: "0".repeat(64) }, `ENGINEERING-${source.inputHash}.json`), /integrity failure/);
  for (const changed of [
    { ...payload, profile: { ...payload.profile, isin: f.companies[1].isin } },
    { ...payload, statements: { "income-statement": [{ symbol: "ANOTHER_ISSUER" }] } },
    { ...payload, statements: { "unknown-endpoint": [] } },
  ]) {
    const inputHash = contentHash(changed);
    assert.throws(() => authenticateStage10RetainedVersion({ ...source, payload: changed, inputHash }, `ENGINEERING-${inputHash}.json`),
      /binding failed|scope mismatch|Unknown retained/);
  }
});
test("actual aggregate API/JSON/XLSX use same input hash,dates,denominators,nulls; no private identifiers/values/public writes", async () => {
  const source = fixture(), company = source.companies[2];
  const lifecycleEvidence = lifecycleProfileEvidence(company, { isin: company.isin, symbol: "ENGINEERING_PRIVATE",
    exchange: "ENGINEERING", isActivelyTrading: true }, "2021-03-01T00:00:00Z", source.workbookHash, "retained-worked-profile");
  const report = buildStage10Coverage({ ...source, lifecycleEvidence, years: Array.from({ length: 11 }, (_, i) => 2015 + i) }), document = stage10ExportDocument(report), app = express();
  let unavailable = false;
  app.use(releaseSafety()); registerStage10CoverageRoutes(app, async () => {
    if (unavailable) throw new Error("Source failure; never expose raw provider/private error bytes");
    return report;
  });
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(base + stage10DownloadUrl(report, ""));
    assert.deepEqual(await response.json(), report); assert.equal(response.headers.get("x-stage10-input-sha256"), report.inputHash);
    assert.deepEqual(await (await fetch(base + stage10DownloadUrl(report, "/export.json"))).json(), document);
    const binary = await fetch(base + stage10DownloadUrl(report, "/export.xlsx"));
    assert.equal(binary.headers.get("x-stage10-input-sha256"), report.inputHash);
    const book = XLSX.read(Buffer.from(await binary.arrayBuffer()), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<any>(book.Sheets["Aggregate coverage"]);
    const lifecycleAudit = XLSX.utils.sheet_to_json<any>(book.Sheets["Lifecycle source audit"]);
    assert.equal(lifecycleAudit.length, 2);
    assert.deepEqual(lifecycleAudit[0], report.lifecycleEvidenceAudit[0]);
    assert.equal(rows.find(r => r.population === "full-workbook" && r.key === "listed|candidate-awaiting-review").present, 1);
    assert.equal(rows.length, report.rows.length); assert.equal(rows.find(r => r.population === "verified-eligible").present, "null");
    const text = JSON.stringify(document) + JSON.stringify(rows);
    for (const secret of ["PRIVATE_IDENTIFIER", "PRIVATE_CLASS", "PRIVATE_ISSUER", "US4592001014", "ENGINEERING_PRIVATE"]) assert.ok(!text.includes(secret));
    assert.ok(!("cells" in report)); assert.ok(!("reviews" in report));
    assert.equal((await fetch(`${base}/api/research/stage10-coverage?expectedInputHash=${"0".repeat(64)}`)).status, 409);
    assert.equal((await fetch(`${base}/api/research/stage10-coverage?path=/etc/passwd`)).status, 400);
    assert.equal((await fetch(`${base}/api/research/stage10-coverage?lifecycle=listed`)).status, 400);
    assert.equal((await fetch(`${base}/api/research/stage10-coverage`, { method: "POST" })).status, 403);
    const nativeFetch = globalThis.fetch;
    try {
      globalThis.fetch = (input, init) => nativeFetch(typeof input === "string" ? new URL(input, base) : input, init);
      const browserReport = await fetchStage10Coverage();
      assert.equal(browserReport.inputHash, report.inputHash);
      unavailable = true;
      const failed = await fetch(`${base}/api/research/stage10-coverage`);
      assert.equal(failed.status, 503);
      assert.match(String((await failed.json()).error), /no zero\/restatement\/unqueried fallback/);
      await assert.rejects(fetchStage10Coverage(), /unavailable/);
    } finally { globalThis.fetch = nativeFetch; }
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
  assert.ok(buildStage10Workbook(report).length > 1000);
});
test("exact JSON leaf serialization and51 definitions include independent lifecycle audit metadata", () => {
  const document = stage10ExportDocument(buildStage10Coverage(fixture()));
  const paths = new Set<string>();
  function walk(value: unknown, path: string) {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}${path === "fieldSemantics" || path.startsWith("fieldSemantics[") ? `[${i}]` : "[]"}`));
    else if (value !== null && typeof value === "object") for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
    else paths.add(path);
  }
  walk(document, "");
  const bindings = stage10JsonExportLeafBindings();
  assert.equal(Object.keys(bindings).length, 953);
  assert.deepEqual(Array.from(paths).sort(), Object.keys(bindings).sort());
  for (const binding of Object.values(bindings)) assert.ok(stage10CoverageSemantics.some(s => s.id === binding.id));
});
test("actual new UI SSR hides stale error/loading/invalid inputs and exposes same safe input/download identity without original approval", () => {
  const report = buildStage10Coverage(fixture());
  const render = (readState: { loading?: boolean; error?: string; data?: unknown }) => renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client: new QueryClient() }, React.createElement(Stage10FinancialCoverage, { readState })));
  for (const state of [{ loading: true, data: report }, { error: "source unavailable", data: report }, {}, { data: { ...report, inputHash: null } }]) {
    const html = render(state); assert.doesNotMatch(html, /Exact aggregate JSON|Exact aggregate XLSX/);
  }
  const html = render({ data: report });
  assert.ok(html.includes(report.inputHash)); assert.match(html, /Full workbook: 7/); assert.match(html, /Verified eligible: 1/);
  for (const state of stage10IdentityStates) assert.ok(html.includes(state));
  assert.ok(html.includes(stage10DownloadUrl(report, "/export.xlsx").replaceAll("&", "&amp;")));
  assert.match(html, /no historical point-in-time/);
  assert.equal(stage10CoverageSemantics.length, 51);
  for (const s of stage10CoverageSemantics) assert.deepEqual(outputFieldSemantics.filter(v => v.id === s.id), [s]);
  assert.equal(stage10Fields.length, 10);
});
