import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { registerReadonlyDiffApi } from "../server/readonlyDiffApi";
import { compareReadonlyArchives, type DiffArchive } from "../server/snapshots/readonlyDiffContract";
import { packOverlay } from "../server/snapshots/overlayContract";
import { packIndicators } from "../server/snapshots/indicatorContract";
import { packAnalysisResult } from "../server/snapshots/resultContract";
import { createManifest, contentHash } from "../server/calculation/analysisManifest";
import { packDataset } from "../server/snapshots/contract";
import { HISTORICAL_TYPES, requireHistoricalType, revisedHistoryType } from "../shared/historicalTypes";
import { VersionDiffResult, versionDiffExportRows, affectedAnalysisExportRows } from "../client/src/components/readonly-version-diff";
import { HistoricalTrendChart } from "../client/src/components/historical-trend-chart";
import { CategoryTrendChart } from "../client/src/components/category-trend-chart";
import { certifyFiniteExport, categoryExportNames } from "../shared/finiteExportSchemas";
(globalThis as any).React = React;

// Isolated, synthetic engineering fixtures only: not issuer/source/vintage certification.
const entry = { companyId: 1, observationDate: "2020-01-01", availableAt: "2020-02-01",
  historyBasis: "revised-history" as const, source: "PRIVATE SOURCE TEXT MUST NOT LEAK",
  approvalEvidence: "PRIVATE FILING EXCERPT MUST NOT LEAK" };
function overlay(value: number): DiffArchive {
  const packed = packOverlay([
    { ...entry, field: "scope1Emissions", kind: "carbon", unit: "tCO2e", value },
    { ...entry, field: "sdgAlignmentScore", kind: "sdg", unit: "score", value },
    { ...entry, field: "marketCap", kind: "financial", unit: "USD million", value },
  ]);
  return { id: packed.id, kind: "company-overlay", chunks: [packed.payload], companyCount: 1, observationCount: 3 };
}
const a = overlay(1), b = overlay(2);
const query = { from: a.id, to: b.id, kind: a.kind };

test("carbon/SDG/financial changes preserve source identities without private values/text", () => {
  const result = compareReadonlyArchives(query, a, b);
  assert.deepEqual(result.fields.map(f => [f.domain, f.changed]).sort(), [["carbon", 1], ["financial", 1], ["sdg", 1]]);
  assert.equal(result.from, a.id);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|approvalEvidence|companyId|sourceExcerpt/);
});
test("driver overrides and consumed effective drivers use actual retained payload identities", () => {
  const mk = (value: number) => {
    const packed = packIndicators([{ indicatorKey: "fixture", year: 2020, value, source: "Synthetic fixture", method: "manual" }]);
    return { id: packed.id, kind: "indicator-overrides" as const, chunks: [packed.payload], companyCount: 0, observationCount: 1 };
  };
  const x = mk(0), y = mk(3);
  assert.equal(compareReadonlyArchives({ from: x.id, to: y.id, kind: x.kind }, x, y).fields[0].changed, 1);
  const mat = (value: number) => {
    const payload = { version: "material-inputs-1", readsIndicators: true, effectiveHistoricalIndicators: [{ year: 2020, testDriver: value }] };
    return { id: contentHash(payload), kind: "material-inputs" as const, chunks: [payload], companyCount: 0, observationCount: 1 };
  };
  const m = mat(1), n = mat(2);
  assert.equal(compareReadonlyArchives({ from: m.id, to: n.id, kind: m.kind }, m, n).fields[0].changed, 1);
});
test("workbook diff authenticates the packed workbook and counts added/removed/null cells without exposing rows", () => {
  const mk = (companyId: number, value: number | null) => {
    const packed = packDataset([{ id: companyId, isin: `FIXTURE${companyId}`, name: "PRIVATE LICENSED NAME",
      geography: null, sector: null, subSector: null, industry: null, sdgAlignmentScore: value, emissionTarget2050: null }],
    [{ id: companyId, companyId, date: new Date("2020-01-01"), totalReturnIndex: value, marketCap: value,
      priceEarnings: value, scope1Emissions: value, scope2Emissions: null, scope3Emissions: null, netProfit: value }]);
    return { id: packed.id, kind: "workbook-baseline" as const, chunks: packed.chunks,
      companyCount: packed.companyCount, observationCount: packed.observationCount };
  };
  const before = mk(1, null), after = mk(2, 0);
  const diff = compareReadonlyArchives({ from: before.id, to: after.id, kind: before.kind }, before, after);
  assert.equal(diff.fields.length, 8);
  assert.ok(diff.fields.every(f => f.added === 1 && f.removed === 1 && f.changed === 0));
  assert.doesNotMatch(JSON.stringify(diff), /PRIVATE LICENSED NAME|FIXTURE|companyId/);
});
test("identity/kind/content/version/count mismatch refuses rather than current fallback", () => {
  for (const broken of [
    { ...b, id: a.id }, { ...b, kind: "indicator-overrides" as const }, { ...b, observationCount: 4 },
    { ...b, chunks: [] }, { ...b, chunks: [{ ...(b.chunks[0] as object), version: "company-overlay-99" }] },
  ]) assert.throws(() => compareReadonlyArchives(query, a, broken));
});
test("actual GET API diffs verify archived analysis references, pages and errors", async () => {
  const manifest = createManifest({ codeVersion: "synthetic-engineering-only", modelVersion: "fixture",
    snapshotHashes: [a.id], scenario: "descriptive-valuation:/summary", settings: {} });
  const packed = packAnalysisResult(manifest, { privateValue: 12345 });
  const app = express();
  registerReadonlyDiffApi(app, {
    load: async (id, kind) => {
      const value = [a, b].find(x => x.id === id && x.kind === kind);
      if (!value) throw new Error("Missing fixture archive");
      return value;
    },
    results: async after => ({ items: after ? [] : [{ id: packed.id, payload: packed.payload, recordedAt: "2026-01-01T00:00:00.000Z" }],
      nextCursor: after ? null : packed.id }),
  });
  app.get("/api/cv/summary", (_req, res) => res.json({ retainedNumericalValue: 17 }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as import("node:net").AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const actualRun = await fetch(`${base}/api/cv/summary`);
    assert.equal(actualRun.headers.get("X-Historical-Type-Code"), "REVISED_HISTORY_RECONSTRUCTION");
    assert.deepEqual(await actualRun.json(), { retainedNumericalValue: 17 });
    const response = await fetch(`${base}/api/data/version-diff?${new URLSearchParams(query)}`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.affectedAnalyses[0].manifestId, manifest.id);
    assert.equal(body.affectedAnalyses[0].historicalTypeCode, revisedHistoryType.historicalTypeCode);
    assert.equal(body.nextCursor, packed.id);
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE|privateValue|12345/);
    for (const suffix of ["", "?from=current", `?${new URLSearchParams({ ...query, from: "f".repeat(64) })}`,
      `?${new URLSearchParams({ ...query, unknown: "reject" })}`])
      assert.equal((await fetch(`${base}/api/data/version-diff${suffix}`)).status, 422);
    assert.equal((await fetch(`${base}/api/data/version-diff`, { method: "POST" })).status, 404);
    const types = await (await fetch(`${base}/api/data/history-types`)).json();
    assert.equal(types.types.length, 3);
    const data = { ...body, nextCursor: null };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const markup = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(VersionDiffResult, { data, onNext() {} })));
    assert.match(markup, /Affected archived analyses/);
    assert.match(markup, new RegExp(manifest.id));
    assert.doesNotMatch(markup, /PRIVATE|privateValue/);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(versionDiffExportRows(data)), "Diff");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(affectedAnalysisExportRows(data)), "Affected");
    const reread = XLSX.read(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
    const rows = XLSX.utils.sheet_to_json(reread.Sheets.Diff);
    assert.equal((rows[0] as any).From, a.id);
    assert.equal((rows[0] as any).Changed, body.fields[0].changed);
    assert.equal((XLSX.utils.sheet_to_json(reread.Sheets.Affected)[0] as any)["Manifest ID"], manifest.id);
    assert.equal((XLSX.utils.sheet_to_json(reread.Sheets.Affected)[0] as any)["Historical type code"], "REVISED_HISTORY_RECONSTRUCTION");
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
test("exact three original labels; unknown/inconsistent history never becomes a fake vintage", () => {
  assert.deepEqual(Object.values(HISTORICAL_TYPES), ["Actual archived forecast",
    "Retrospective simulation on verified past inputs", "Revised-history reconstruction"]);
  assert.throws(() => requireHistoricalType({}));
  assert.throws(() => requireHistoricalType({ ...revisedHistoryType, historicalTypeLabel: "Actual archived forecast" }));
  for (const Component of [HistoricalTrendChart, CategoryTrendChart]) {
    const html = renderToStaticMarkup(React.createElement(Component as any, { data: [{ year: 2020 }], metricView: "temperature" }));
    assert.match(html, /Historical type missing or inconsistent/);
    assert.doesNotMatch(html, /Download data/);
  }
});
test("historical XLSX carries exact code and label per category row", () => {
  const row = { Year: 2020, Estimated: "no", ...requireHistoricalType(revisedHistoryType),
    ...Object.fromEntries(Object.values(categoryExportNames).map(key => [key, 1])) };
  const rows = certifyFiniteExport("categoryTrend", [row], { metric: "median" });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "History");
  const read = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  assert.equal((XLSX.utils.sheet_to_json(read.Sheets.History)[0] as any)["Historical type code"],
    "REVISED_HISTORY_RECONSTRUCTION");
});
