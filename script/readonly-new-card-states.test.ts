import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { CarbonPassThroughReview } from "../client/src/components/carbon-pass-through-review";
import { QualifiedMissingnessReview } from "../client/src/components/qualified-missingness-review";
import { ReadonlyVersionDiff, VersionDiffResult, versionDiffExportRows, affectedAnalysisExportRows } from "../client/src/components/readonly-version-diff";
import { revisedHistoryType } from "../shared/historicalTypes";
import { carbonPassThroughEvidence, carbonPassThroughSources } from "../shared/carbonPassThroughEvidence";
(globalThis as any).React = React;
const sha = (char: string) => char.repeat(64);
function render(Component: React.ComponentType<any>, props = {}, cached?: unknown, state?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const key = ["/api/development/qualified-missingness"];
  if (cached !== undefined) client.setQueryData(key, cached);
  if (state) {
    const query = client.getQueryCache().find({ queryKey: key }) ??
      client.getQueryCache().build(client, { queryKey: key });
    query.setState(state);
  }
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
    React.createElement(Component, props)));
}
const emptyReview = {
  version: "qualified-development-view-1", classification: "development-only-not-scientific-approval",
  centralModelApplied: false, revision: null, sourceId: null, events: [], proposals: [], cells: [],
};
const readyReview = {
  ...emptyReview, revision: sha("a"), sourceId: sha("b"),
  events: [{ id: sha("a"), action: "approve", sequence: 1 }],
  cells: [
    { indicatorKey: "engineering-zero", year: 2020, unit: "engineering unit", state: "observed", value: 0,
      result: { value: 0, infilled: false, reason: "source observation", samples: [] } },
    { indicatorKey: "engineering-null", year: 2021, unit: "engineering unit", state: "unavailable", value: null, reason: "blank",
      result: { value: null, infilled: false, reason: "no extrapolation", samples: [] } },
    { indicatorKey: "engineering-bound", year: 2022, unit: "engineering unit", state: "below-threshold", value: null,
      operator: "<", limit: 0.1, reason: "Source bound", result: { value: null, infilled: false, reason: "bound is not measurement", samples: [] } },
  ],
};
const diff = {
  version: "readonly-diff-1", from: sha("a"), to: sha("b"), kind: "company-overlay",
  approvalState: "archived-reviewed-overlay",
  fields: [{ domain: "carbon", field: "scope1Emissions", added: 0, removed: 0, changed: 0, beforeHash: sha("c"), afterHash: sha("c") }],
  affectedAnalyses: [{ resultId: sha("d"), manifestId: sha("e"), scenario: "descriptive-valuation:/summary",
    recordedAt: "2026-01-01T00:00:00.000Z", ...revisedHistoryType, relation: "consumed-before-version" }],
  scannedResults: 1, nextCursor: null, disclosure: "Counts and identities only; no licensed raw values",
  historicalBasis: "Revised-history inputs; no original publication vintage established",
  affectedMeaning: "Exact archived dependency references on this page, not recomputed impacts or all possible consumers",
};
test("source-qualified carbon card renders actual pinned facts/strict bounds and never claims issuer admission", () => {
  const html = render(CarbonPassThroughReview);
  assert.match(html, /0 qualified cases/);
  assert.match(html, /not issuer profit or collected cash/);
  assert.match(html, /NO recovery ratio/);
  assert.match(html, /not95% CI/);
  for (const source of carbonPassThroughSources) {
    assert.ok(html.includes(source.sha256));
    assert.ok(html.includes(source.url.replace(/&/g, "&amp;")));
  }
  assert.ok(carbonPassThroughEvidence.some(e => e.reported.kind === "lower-bound-only"));
  assert.match(html, /&gt;100%/);
  assert.doesNotMatch(html, /<button|<input|<select/);
});
test("development review actual SSR loading/error/background-pending suppresses old source data and links", () => {
  assert.match(render(QualifiedMissingnessReview), /Loading development archive/);
  const error = render(QualifiedMissingnessReview, {}, readyReview,
    { status: "error", error: new Error("Explicit source access refusal"), fetchStatus: "idle" });
  assert.match(error, /Explicit source access refusal/);
  assert.doesNotMatch(error, /engineering-zero|Download selected review XLSX/);
  const pending = render(QualifiedMissingnessReview, {}, readyReview, { fetchStatus: "fetching" });
  assert.match(pending, /Loading development archive/);
  assert.doesNotMatch(pending, /engineering-zero|Download selected review XLSX/);
});
test("development review null/malformed/false-approval/unknown-state envelopes refuse all cells and downloads", () => {
  for (const value of [null, {}, { ...readyReview, centralModelApplied: true },
    { ...readyReview, classification: "scientifically-approved" }, { ...readyReview, revision: null },
    { ...readyReview, cells: [{ ...readyReview.cells[0], state: "invented-observation" }] },
    { ...readyReview, cells: [{ ...readyReview.cells[0], value: null }] },
    { ...readyReview, cells: [{ ...readyReview.cells[2], operator: ">" }] },
    { ...readyReview, cells: [{ ...readyReview.cells[2], result: { value: 0, infilled: true, reason: "fake bound imputation", samples: [] } }] },
    { ...readyReview, cells: [{ ...readyReview.cells[2], limit: undefined }] }]) {
    const html = render(QualifiedMissingnessReview, {}, value);
    assert.match(html, /Development review unavailable/);
    assert.doesNotMatch(html, /engineering-zero|Download selected review XLSX/);
  }
});
test("development review explicit empty differs from missing; zero, unavailable and strict bound survive ready SSR", () => {
  const empty = render(QualifiedMissingnessReview, {}, emptyReview);
  assert.match(empty, /No retained development reviews/);
  assert.match(empty, /No reviewed source cells/);
  assert.doesNotMatch(empty, /Download selected review XLSX/);
  const html = render(QualifiedMissingnessReview, {}, readyReview);
  assert.match(html, /engineering-zero/);
  assert.match(html, /0 \(observed\)/);
  assert.match(html, /No measured value/);
  assert.match(html, /Withheld/);
  assert.match(html, /&lt; 0.1 \(bound only\)/);
  assert.ok(html.includes(`/api/development/qualified-missingness/export?revision=${sha("a")}`));
  assert.match(html, /not scientific acceptance or central-model approval/);
  const source = readFileSync("client/src/pages/data-management.tsx", "utf8");
  assert.match(source, /import\.meta\.env\?\.DEV === true && <QualifiedMissingnessReview/);
});
test("actual idle diff controls require exact selection; missing/malformed/unknown-type supplied results refuse export", () => {
  const idle = render(ReadonlyVersionDiff);
  assert.match(idle, /Compare retained versions/);
  assert.match(idle, /disabled/);
  assert.doesNotMatch(idle, /Affected archived analyses|Download data/);
  for (const value of [undefined, null, {}, { ...diff, from: "current" },
    { ...diff, fields: [{ ...diff.fields[0], changed: null }] },
    { ...diff, affectedAnalyses: [{ ...diff.affectedAnalyses[0], historicalTypeLabel: "Actual archived forecast" }] },
    { ...diff, affectedAnalyses: [diff.affectedAnalyses[0], diff.affectedAnalyses[0]] }]) {
    const html = render(VersionDiffResult, { data: value, onNext() {} });
    assert.match(html, /Version diff unavailable/);
    assert.doesNotMatch(html, /Download data|descriptive-valuation/);
    assert.throws(() => versionDiffExportRows(value as any));
    assert.throws(() => affectedAnalysisExportRows(value as any));
  }
});
test("actual supplied diff ready/zero/empty/page states retain exact identities, no all-pages absence inference", () => {
  const html = render(VersionDiffResult, { data: diff, onNext() {} });
  assert.match(html, /carbon \/ scope1Emissions/);
  assert.ok(html.includes(sha("e")));
  assert.match(html, /Revised-history reconstruction/);
  assert.doesNotMatch(html, /Next affected-analysis page/);
  const page = render(VersionDiffResult, { data: { ...diff, nextCursor: sha("f") }, onNext() {} });
  assert.match(page, /Next affected-analysis page/);
  const empty = render(VersionDiffResult, {
    data: { ...diff, fields: [], affectedAnalyses: [], scannedResults: 0 }, onNext() {},
  });
  assert.match(empty, /Scanned 0 results/);
  assert.match(empty, /No comparable cells/);
  assert.match(empty, /does not establish absence elsewhere/);
  assert.equal(versionDiffExportRows(diff as any)[0].Changed, 0);
  assert.equal(affectedAnalysisExportRows(diff as any)[0]["Historical type code"], "REVISED_HISTORY_RECONSTRUCTION");
});
