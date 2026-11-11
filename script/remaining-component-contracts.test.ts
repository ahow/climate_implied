import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { Router } from "wouter";
import ts from "typescript";
import { AnalysisSelectionControl } from "../client/src/components/analysis-selection";
import { AnalysisSnapshotStatus, SnapshotDate, SummaryCount } from "../client/src/components/analysis-snapshot-status";
import { AppSidebar } from "../client/src/components/app-sidebar";
import { SidebarProvider } from "../client/src/components/ui/sidebar";
import { Skeleton } from "../client/src/components/ui/skeleton";
import { CategoryFilter } from "../client/src/components/category-filter";
import { MetricToggle } from "../client/src/components/metric-toggle";
import { CompanyCoverage } from "../client/src/components/company-coverage";
import { DownloadDataButton, DownloadJsonButton } from "../client/src/components/download-data-button";
import { DriverEvidenceDisclosure } from "../client/src/components/driver-evidence-disclosure";
import { EmissionsCandidateReview } from "../client/src/components/emissions-candidate-review";
import { EmissionsChart } from "../client/src/components/emissions-chart";
import { HistoricalTrendChart } from "../client/src/components/historical-trend-chart";
import { TemperatureHistogram } from "../client/src/components/temperature-histogram";
import { OperatorOnlyNotice } from "../client/src/components/operator-only-notice";
import { PublicationMethodologyNotes } from "../client/src/components/publication-methodology-notes";
import { PublishedScenarioReferences } from "../client/src/components/published-scenario-references";
import { QueryReadErrors } from "../client/src/components/query-read-errors";
import { TargetInputDisclosure } from "../client/src/components/target-input-disclosure";
import { ThemeProvider } from "../client/src/components/theme-provider";
import { ThemeToggle } from "../client/src/components/theme-toggle";
import { ThresholdDiagnosticDownload } from "../client/src/components/threshold-diagnostic-details";
import Dashboard, { LegacyDashboard } from "../client/src/pages/dashboard";
import DataManagement from "../client/src/pages/data-management";
import DecarbGapSignal from "../client/src/pages/decarb-gap-signal";
import DecarbSignal from "../client/src/pages/decarb-signal";
import Methodology from "../client/src/pages/methodology";
import NewsSentiment from "../client/src/pages/news-sentiment";
import { companyCoverage } from "../server/calculation/companyCoverage";
import { displayDiagnostic, backtestPercent, backtestDisplayStats, backtestDisplay } from "../client/src/lib/valuation-claims";
import { parseSelection, selectionKey, selectedRequest } from "../client/src/lib/analysis-selection";
import { indicatorFieldSpecs } from "../shared/indicatorFieldSemantics";
import { prepareQualifiedJsonExport } from "../client/src/lib/export-contract";
import { THRESHOLD_DIAGNOSTIC_VERSION, THRESHOLD_DIAGNOSTIC_LABEL } from "../shared/thresholdDiagnostic";
import { thresholdExportRow } from "../client/src/lib/threshold-export";

(globalThis as any).React = React;
const markup = (element: React.ReactElement) => renderToStaticMarkup(element);
const element = (component: any, props: any = {}) => React.createElement(component, props);
const wrap = (client: QueryClient, child: React.ReactElement) => element(QueryClientProvider, { client, children: child });
function clientWith(entries: [readonly unknown[], unknown][] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity } } });
  for (const [key, data] of entries) client.setQueryData(key, data);
  return client;
}
const seed: [readonly unknown[], unknown][] = [
  [["/api/analysis/snapshots", "workbook-baseline"], { pages: [{ status: "available", items: [], nextCursor: null }], pageParams: [null] }],
  [["/api/analysis/snapshot-status"], null], [["/api/data/indicators"], { indicators: [] }], [["/api/data/runs"], { runs: [] }],
  [["/api/cv/uploads"], []], [["/api/cv/dimensions"], {}], [["/api/calculation/company-coverage", ""], null],
  [["/api/research/driver-registry"], null], [["/api/emissions/candidate?scenario=constant"], null],
];
function render(component: any, entries: [readonly unknown[], unknown][] = [], props: any = {}) {
  const client = clientWith([...seed, ...entries]);
  try { return markup(wrap(client, element(Router, { ssrPath: "/", children: element(component, props) }))); } finally { client.clear(); }
}
/** Executes the checked-in nested component/handler body, not a test replica.
 * No module mocks: the required pure production formatter is extracted too. */
function actualSourceValue(path: string, name: string, dependencies: Record<string, unknown> = {}) {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText(file).replace(/^export\s+/, "");
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name && node.initializer) expression = node.initializer.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file); assert.ok(expression, `${path}#${name} must be an actual declaration`);
  const js = ts.transpileModule(`const value=(${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, module: ts.ModuleKind.ESNext } }).outputText;
  const context = { React, ...dependencies };
  return new Function(...Object.keys(context), `${js}; return value;`)(...Object.values(context));
}
test("AnalysisSelectionControl current/invalid/archive presentation has explicit replay boundaries and no implicit regional fallback", () => {
  assert.ok(render(AnalysisSelectionControl, [[["analysis-selection-inventory"], []]]).includes("No archived inputs are provisioned"));
  assert.ok(render(AnalysisSelectionControl, [[["analysis-selection-inventory"], [{ id: "a".repeat(64), kind: "workbook-baseline" }]]]).includes("Created date not returned"));
  const previous = (globalThis as any).window;
  try {
    (globalThis as any).window = { sessionStorage: { getItem: () => "bad saved JSON" } };
    assert.ok(render(AnalysisSelectionControl).includes("Invalid saved selection — reset required"));
    const selected = parseSelection({ workbook: "a".repeat(64), indicators: "b".repeat(64) });
    (globalThis as any).window.sessionStorage.getItem = (key: string) => key === selectionKey ? JSON.stringify(selected) : null;
    const result = render(AnalysisSelectionControl, [[["analysis-selection-inventory"], []]]);
    assert.ok(result.includes("Archived workbook and indicators selected"));
    assert.ok(result.includes("Not selected — regional history unavailable"));
    assert.ok(result.includes("not original-vintage evidence"));
  } finally { if (previous === undefined) delete (globalThis as any).window; else (globalThis as any).window = previous; }
});
test("SummaryCount preserves zero; SnapshotDate distinguishes missing, invalid and actual supplied dates", () => {
  assert.equal(markup(element(SummaryCount, { value: 0 })), "0");
  for (const value of [null, undefined, NaN]) assert.equal(markup(element(SummaryCount, { value })), "Unavailable — not returned");
  assert.equal(markup(element(SnapshotDate, { value: null })), "Not supplied");
  assert.ok(markup(element(SnapshotDate, { value: "not-a-date" })).includes("Invalid created date"));
  assert.match(markup(element(SnapshotDate, { value: "2024-01-01T00:00:00Z" })), /date[Tt]ime="2024-01-01T00:00:00Z"/);
});
test("AnalysisSnapshotStatus missing counts/status/overlay flag never says No; partial inventory coverage does not crash", () => {
  const result = render(AnalysisSnapshotStatus, [
    [["/api/analysis/snapshot-status"], {}],
    [["/api/analysis/snapshots", "workbook-baseline"], { pages: [{ status: "available", items: [{ id: "a".repeat(64), kind: "workbook-baseline" }], nextCursor: null }], pageParams: [null] }],
  ]);
  for (const reason of ["Snapshot status not returned", "Unavailable — overlay application not returned", "Unavailable — not returned", "Select a workbook baseline to load"]) assert.ok(result.includes(reason), reason);
  const zero = render(AnalysisSnapshotStatus, [[["/api/analysis/snapshot-status"], { companyCount: 0, observationCount: 0, currentFinancialOverlaysApplied: false }]]);
  assert.ok(zero.includes(">0<")); assert.ok(zero.includes("<dd>No</dd>"));
  const invalid = render(AnalysisSnapshotStatus, [[["/api/analysis/snapshots", "workbook-baseline"], { pages: [{ status: "available" }], pageParams: [null] }]]);
  assert.ok(invalid.includes("snapshot inventory could not be loaded"));
});
test("AppSidebar consumes actual route selection; CategoryFilter/MetricToggle select only requested control", () => {
  const sidebar = markup(element(Router, { ssrPath: "/data-management", children: element(SidebarProvider, { children: element(AppSidebar) }) }));
  assert.match(sidebar, /data-active="true"[^>]*data-testid="link-sidebar-data management"|data-testid="link-sidebar-data management"[^>]*data-active="true"/);
  assert.ok(sidebar.includes('href="/decarb-gap"'));
  for (const category of ["all", "technology", "policy", "corporate", "socioeconomic", "financial", "emissions"]) {
    const result = markup(element(CategoryFilter, { activeCategory: category, onCategoryChange() {} }));
    assert.ok(result.includes(`data-testid="button-category-${category}"`));
    assert.equal((result.match(/data-testid="button-category-/g) ?? []).length, 7);
  }
  const metric = markup(element(MetricToggle, { activeMetric: "netZero", onMetricChange() {} }));
  assert.ok(metric.includes("Year emissions reach 5% of 2024")); assert.ok(!metric.includes("Net Zero"));
  const categories: string[] = [], metrics: string[] = [];
  const categoryControl = CategoryFilter({ activeCategory: "all", onCategoryChange: value => categories.push(value) });
  for (const button of categoryControl.props.children) button.props.onClick();
  assert.deepEqual(categories, ["all", "technology", "policy", "corporate", "socioeconomic", "financial", "emissions"]);
  const metricControl = MetricToggle({ activeMetric: "temperature", onMetricChange: value => metrics.push(value) });
  for (const button of metricControl.props.children) button.props.onClick();
  assert.deepEqual(metrics, ["temperature", "reductionRate", "netZero"]);
});
test("actual archive apply handler verifies workbook/indicator/overlay/regional headers before changing local selection", async () => {
  for (const mode of ["valid", "workbook-mismatch", "overlay-missing", "regional-mismatch"] as const) {
    const workbook = "a".repeat(64), indicators = "b".repeat(64), regional = mode === "regional-mismatch" ? "c".repeat(64) : "";
    const overlays = mode === "overlay-missing" ? "d".repeat(64) : "";
    const saved: string[] = [], errors: unknown[] = [], busy: boolean[] = [], reads: string[] = [];
    let reloads = 0;
    const apply = actualSourceValue("client/src/components/analysis-selection.tsx", "apply", {
      workbook, indicators, regional, overlays, asOf: "2024-01-01", parseSelection, selectedRequest, selectionKey,
      setBusy: (value: boolean) => busy.push(value), setError: (value: unknown) => errors.push(value),
      fetch: async (url: string) => {
        reads.push(url);
        return new Response("{}", { headers: {
          "X-Analysis-Snapshot": mode === "workbook-mismatch" ? "e".repeat(64) : workbook,
          "X-Indicator-Data-State": "archived-approved-indicators",
        } });
      },
      window: { sessionStorage: { setItem: (key: string, value: string) => { assert.equal(key, selectionKey); saved.push(value); } }, location: { reload: () => reloads++ } },
    });
    await apply(); assert.deepEqual(busy, [true, false]);
    assert.ok(reads.every(url => url.startsWith("/api/cv/summary?") || url.startsWith("/api/projection/regions?")));
    if (mode === "valid") {
      assert.equal(reloads, 1); assert.deepEqual(JSON.parse(saved[0]), { workbook, indicators });
    } else {
      assert.equal(reloads, 0); assert.equal(saved.length, 0);
      assert.ok(errors.some(value => typeof value === "string" && value.includes("could not be verified")));
    }
  }
});
test("CompanyCoverage partial nested report fails closed; actual report keeps null no-denominator separate from zero", () => {
  assert.ok(render(CompanyCoverage, [[["/api/calculation/company-coverage", ""], {}]]).includes("this is not zero coverage"));
  const report = companyCoverage({ companies: [], observations: [], reviews: [], observationDate: "2024-01-01", informationCutoff: "2024-01-02T00:00:00.000Z", sourceId: "current-workbook-unversioned" });
  const result = render(CompanyCoverage, [[["/api/calculation/company-coverage", ""], report]]);
  assert.ok(result.includes("Unavailable (no denominator)")); assert.ok(result.includes(">0<"));
  assert.ok(result.includes("Export complete coverage JSON"));
  const zeroReport = companyCoverage({ companies: [{ id: 1, isin: "ENGINEERING-IDENTITY" }], observations: [], reviews: [], observationDate: "2024-01-01", informationCutoff: "2024-01-02T00:00:00.000Z", sourceId: "current-workbook-unversioned" });
  assert.ok(render(CompanyCoverage, [[["/api/calculation/company-coverage", ""], zeroReport]]).includes('data-field-id="companyCoverage.eligibleCompanyShare">0.00%</span>'));
});
test("DownloadDataButton empty/explicit-disabled versus real zero rows; DownloadJsonButton metadata renders without serialization", () => {
  for (const props of [{ rows: [] }, { rows: [{ value: 0 }], disabled: true }]) assert.match(markup(element(DownloadDataButton, { kind: "legacy", filename: "engineering", ...props })), /<button[^>]* disabled=""/);
  const zero = markup(element(DownloadDataButton, { kind: "legacy", filename: "engineering", rows: [{ value: 0 }] }));
  assert.doesNotMatch(zero.match(/<button[^>]*>/)![0], /\sdisabled=/);
  assert.ok(markup(element(DownloadJsonButton, { kind: "coverage", filename: "engineering.json", payload: null, validatePayload() { throw Error("must not execute during rendering"); } })).includes("Download JSON"));
});
test("actual XLSX handler catches lazy builder refusal and empty rows, resets busy and never declares completed export", async () => {
  for (const rows of [() => { throw Error("engineering-row-builder-refused"); }, () => []]) {
    const busy: boolean[] = [], errors: unknown[] = [];
    const click = actualSourceValue("client/src/components/download-data-button.tsx", "handleClick", { rows, setBusy: (v: boolean) => busy.push(v), setError: (v: unknown) => errors.push(v) });
    await click(); assert.deepEqual(busy, [true, false]);
    assert.ok(errors.some(value => typeof value === "string" && value.includes("No completed download")));
  }
});
test("actual JSON handler validation failure has explicit refusal and does not allocate a download URL", async () => {
  const busy: boolean[] = [], errors: unknown[] = [];
  const download = actualSourceValue("client/src/components/download-data-button.tsx", "download", {
    setBusy: (v: boolean) => busy.push(v), setError: (v: unknown) => errors.push(v),
    payload: null, kind: "coverage", filename: "engineering",
    prepareQualifiedJsonExport, validatePayload: () => { throw new Error("engineering-invalid-report"); },
  });
  await download(); assert.deepEqual(busy, [true, false]);
  assert.ok(errors.some(value => typeof value === "string" && value.includes("No completed JSON download")));
});
test("DriverEvidenceDisclosure rejects missing/null records and names partial fields without claiming eligible admission", () => {
  for (const value of [{}, { indicators: [null] }]) assert.ok(render(DriverEvidenceDisclosure, [[["/api/research/driver-registry"], value]]).includes("could not be loaded"));
  const result = render(DriverEvidenceDisclosure, [[["/api/research/driver-registry"], { indicators: [{ id: "renewableCapacityGW" }] }]]);
  for (const reason of ["Registry status not returned", "Definition not supplied", "Not verified", "Not supplied", "all 22 indicators cannot be verified"]) assert.ok(result.includes(reason), reason);
  const unknown = render(DriverEvidenceDisclosure, [[["/api/research/driver-registry"], { indicators: indicatorFieldSpecs.map((_, i) => ({ id: `unknown-${i}` })) }]]);
  assert.ok(unknown.includes("all 22 indicators cannot be verified"));
});
test("EmissionsCandidateReview missing nested readiness/indicator fields and real zero reporting values are explicit", () => {
  const result = render(EmissionsCandidateReview, [[["/api/emissions/candidate?scenario=constant"], { inputs: { indicators: [{ key: "engineering", value: 0, year: 2024 }] }, result: { trajectory: [{ year: 2024, reportingGtCO2e: 0 }] } }]]);
  for (const reason of ["0.00", "No missing-requirement details", "No assumptions were supplied", "Not supplied", "unit not supplied", "This does not establish readiness"]) assert.ok(result.includes(reason), reason);
  assert.ok(render(EmissionsCandidateReview, [[["/api/emissions/candidate?scenario=constant"], { result: { trajectory: [null] } }]]).includes("Candidate emissions could not be loaded"));
});
test("EmissionsChart and HistoricalTrendChart empty/loading do not export; selected threshold missing is not legacy fixed-5gt", () => {
  assert.ok(markup(element(EmissionsChart, { trajectory: [] })).includes("No legacy emissions trajectory"));
  assert.ok(!markup(element(EmissionsChart, { trajectory: [{ year: 2024, p50: 0 }], isLoading: true })).includes("button-download"));
  const zero = markup(element(EmissionsChart, { trajectory: [{ year: 2024, p10: 0, p50: 0, p90: 0 }] }));
  assert.ok(zero.includes("fixed-5gt-v1")); assert.ok(zero.includes("not net zero"));
  assert.ok(markup(element(HistoricalTrendChart, { data: [], metricView: "temperature" })).includes("No legacy historical recalculation"));
  const partial = markup(element(HistoricalTrendChart, { data: [{ isNowcast: true, median: null, reductionRate: 0 }], metricView: "temperature" }));
  assert.ok(partial.includes("unavailable-unavailable")); assert.ok(!partial.includes("undefined-"));
  const threshold = markup(element(HistoricalTrendChart, { data: [{ year: 2024 }], metricView: "netZero" }));
  assert.ok(threshold.includes("baseline")); assert.ok(threshold.includes("withheld") || threshold.includes("Unavailable"));
});
test("TemperatureHistogram missing quantiles are individually unavailable and actual zero quantiles survive", () => {
  const pdf = [{ temperature: 0, probability: 0 }];
  const result = markup(element(TemperatureHistogram, { pdf }));
  for (const reason of ["P10 not returned", "median not returned", "P90 not returned"]) assert.ok(result.includes(reason), reason);
  assert.ok(markup(element(TemperatureHistogram, { pdf, median: 0, p10: 0, p90: 0 })).includes("0.00"));
  assert.ok(markup(element(TemperatureHistogram, { pdf: [] })).includes("No legacy temperature probability-density"));
});
test("legacy chart collection absence/null/malformed rows are explicit refusals, and partial fields are named, not invented", () => {
  for (const value of [undefined, null, {}, [null]]) {
    assert.ok(markup(element(EmissionsChart, { trajectory: value })).includes("Legacy trajectory record collection unavailable"));
    assert.ok(markup(element(HistoricalTrendChart, { data: value, metricView: "temperature" })).includes("Historical observation record collection unavailable"));
    assert.ok(markup(element(TemperatureHistogram, { pdf: value })).includes("Temperature density record collection unavailable"));
  }
  assert.ok(markup(element(EmissionsChart, { trajectory: [{ year: 2024, p50: 0 }] })).includes("Legacy trajectory fields unavailable: p10, p90"));
  assert.ok(markup(element(HistoricalTrendChart, { data: [{ year: 2024, reductionRate: null }], metricView: "reductionRate" })).includes("Historical observation fields unavailable: reductionRate"));
});
test("OperatorOnlyNotice, PublicationMethodologyNotes and ThresholdDiagnosticDownload expose actual read-only/export contracts", () => {
  assert.ok(markup(element(OperatorOnlyNotice)).includes("Public HTTP mutations are denied"));
  const notes = markup(element(PublicationMethodologyNotes));
  for (const text of ["trackingError=2", "costOfEquity", "Technology", "1.5 ppm/year"]) assert.ok(notes.includes(text), text);
  const empty = markup(element(ThresholdDiagnosticDownload, { diagnostics: [] }));
  assert.match(empty, /<button[^>]* disabled=""/);
  const withheld = {
    version: THRESHOLD_DIAGNOSTIC_VERSION, label: THRESHOLD_DIAGNOSTIC_LABEL,
    status: "withheld" as const, year: null, reason: "engineering-missing-selected-baseline",
    baselineYear: 2024 as const, baselineValue: null, baselineEvidenceId: null,
    thresholdFraction: 0.05 as const, thresholdValue: null, horizonYear: 2100, basis: null,
    crossingRule: "first annual value <= 0.05 * selected 2024 baseline; no interpolation or extrapolation" as const, notNetZero: true as const,
  };
  assert.doesNotMatch(markup(element(ThresholdDiagnosticDownload, { diagnostics: [withheld], contextLabels: ["Engineering selected trajectory"] })).match(/<button[^>]*>/)![0], /\sdisabled=/);
  const row = thresholdExportRow(withheld, "Engineering selected trajectory");
  assert.equal(row[THRESHOLD_DIAGNOSTIC_LABEL], null); assert.equal(row["Selected 2024 baseline"], null);
  assert.equal(row.Status, "withheld"); assert.equal(row.Reason, "engineering-missing-selected-baseline");
});
test("PublishedScenarioReferences partial provenance/scenario cells are refused; retained reference fields and exact zero render", () => {
  const reference = JSON.parse(readFileSync("server/calculation/data/catReferences.json", "utf8"));
  assert.ok(render(PublishedScenarioReferences, [[["/api/reference-scenarios"], reference]]).includes("Source publication"));
  for (const edit of [(r: any) => { r.source = null; }, (r: any) => { r.scenarios[0].emissions[0].low = null; }, (r: any) => { r.scenarios[0].temperatureMedianC = null; }]) {
    const partial = structuredClone(reference); edit(partial);
    assert.ok(render(PublishedScenarioReferences, [[["/api/reference-scenarios"], partial]]).includes("No complete, valid published reference"));
  }
  reference.scenarios[0].temperatureMedianC = 0;
  assert.ok(render(PublishedScenarioReferences, [[["/api/reference-scenarios"], reference]]).includes("0.0°C"));
});
test("TargetInputDisclosure missing arrays/IDs fail closed while partial definition fields receive field-specific reasons", () => {
  for (const payload of [{}, { qualifiedFields: [null] }, { qualifiedFields: [{}] }]) assert.ok(render(TargetInputDisclosure, [[["/api/calculation/field-semantics"], payload]]).includes("could not be loaded"));
  const result = render(TargetInputDisclosure, [[["/api/calculation/field-semantics"], { qualifiedFields: [{ id: "targetInput.value" }] }]]);
  for (const reason of ["Role not returned", "Unit not returned", "Meaning not returned", "Formula not returned", "Source: Not returned", "As of: Not returned", "Missingness: Not returned", "Uncertainty: Not returned"]) assert.ok(result.includes(reason), reason);
});
test("ThemeProvider and ThemeToggle default/invalid storage preserve presentation-only preference without data substitution", () => {
  assert.ok(markup(element(ThemeProvider, { children: element(ThemeToggle) })).includes("lucide-moon"));
  const oldWindow = (globalThis as any).window, oldStorage = (globalThis as any).localStorage;
  try {
    (globalThis as any).window = { matchMedia: () => ({ matches: true }) };
    (globalThis as any).localStorage = { getItem: () => "invalid-theme" };
    assert.ok(markup(element(ThemeProvider, { children: element(ThemeToggle) })).includes("lucide-sun"));
  } finally {
    if (oldWindow === undefined) delete (globalThis as any).window; else (globalThis as any).window = oldWindow;
    if (oldStorage === undefined) delete (globalThis as any).localStorage; else (globalThis as any).localStorage = oldStorage;
  }
});
test("QueryReadErrors only exposes active failed prefix, excluding stale inactive/unrelated errors and error bytes", async () => {
  const client = clientWith();
  await assert.rejects(client.fetchQuery({ queryKey: ["/api/focused/inactive"], queryFn: async () => { throw Error("PRIVATE_ERROR_SENTINEL"); } }));
  assert.equal(markup(wrap(client, element(QueryReadErrors, { prefix: "/api/focused" }))), "");
  const observer = new QueryObserver(client, { queryKey: ["/api/focused/active"], enabled: false });
  const unsubscribe = observer.subscribe(() => {});
  observer.setOptions({ queryKey: ["/api/focused/active"], enabled: true, staleTime: Infinity, queryFn: async () => { throw Error("PRIVATE_ERROR_SENTINEL"); }, retry: false });
  await new Promise(resolve => setImmediate(resolve));
  const result = markup(wrap(client, element(QueryReadErrors, { prefix: "/api/focused" })));
  assert.ok(result.includes("/api/focused/active")); assert.ok(!result.includes("/api/focused/inactive")); assert.ok(!result.includes("PRIVATE_ERROR_SENTINEL"));
  unsubscribe(); client.clear();
});
test("LoadingDetails actual component is accessible status rather than a missing-result number", () => {
  const LoadingDetails = actualSourceValue("client/src/components/financial-review.tsx", "LoadingDetails", { Skeleton });
  assert.ok(markup(element(LoadingDetails, { label: "Loading financial evidence" })).includes('aria-label="Loading financial evidence"'));
});
for (const [path, name, unit] of [
  ["client/src/pages/decarb-signal.tsx", "CustomTooltip", " pp"],
  ["client/src/pages/decarb-signal.tsx", "BacktestTooltip", "%"],
  ["client/src/pages/decarb-gap-signal.tsx", "TimeSeriesChartTooltip", " pp"],
  ["client/src/pages/decarb-gap-signal.tsx", "BacktestTooltip", "%"],
] as const) test(`${path}#${name} actual tooltip has inactive/absent/invalid-row/null/zero/date/series contracts`, () => {
  const formatDateLabel = actualSourceValue(path, "formatDateLabel");
  const Component = actualSourceValue(path, name, { displayDiagnostic, formatDateLabel });
  assert.equal(markup(element(Component, { active: false })), "");
  for (const payload of [undefined, [], [null]]) assert.ok(markup(element(Component, { active: true, payload })).includes("Tooltip series unavailable"));
  const missing = markup(element(Component, { active: true, payload: [{ value: null }] }));
  for (const text of ["Unavailable", "Observation date unavailable", "Series name unavailable"]) assert.ok(missing.includes(text), text);
  const zero = markup(element(Component, { active: true, label: name.includes("Backtest") ? "2024-01" : 0, payload: [{ dataKey: "engineering", name: "Engineering series", value: 0 }] }));
  assert.ok(zero.includes(`0.00${unit}`)); assert.ok(!zero.includes("1970") || name.includes("Backtest") === false);
});
test("sensitivity CustomTooltip actual nested values are unavailable individually, not .toFixed crashes or default 2.7", () => {
  const Component = actualSourceValue("client/src/components/sensitivity-chart.tsx", "CustomTooltip");
  assert.equal(markup(element(Component, { active: false })), "");
  assert.ok(markup(element(Component, { active: true })).includes("no payload returned"));
  const partial = markup(element(Component, { active: true, payload: [{ payload: { baseline: 0, low: null } }] }));
  for (const text of ["0.00°C", "Low scenario unavailable", "High scenario unavailable", "Impact range unavailable", "Sensitivity label not returned", "Category not returned"]) assert.ok(partial.includes(text), text);
});
test("Dashboard and LegacyDashboard actual roots keep absent evidence separate from zero and opt-in scientific claims", () => {
  const result = render(Dashboard, [[["/api/indicators/historical"], []], [["/api/reference-scenarios"], null]]);
  assert.ok(result.includes("Published climate scenarios")); assert.ok(result.includes("No candidate trajectory"));
  const legacy = render(LegacyDashboard, [[["/api/projection?category=all"], {}]]);
  assert.ok(legacy.includes("legacy") || legacy.includes("Legacy")); assert.ok(!legacy.includes("2.70"));
});
test("DataManagement actual initial root with explicit empty inventories does not invoke undefined closed-modal export key", () => {
  const result = render(DataManagement);
  assert.ok(result.includes("Reviewed indicators")); assert.ok(result.includes("No reviewed indicators were returned"));
  assert.ok(!result.includes('data-testid="button-download-timeseries"'));
});
test("DecarbSignal and DecarbGapSignal actual roots refuse dataset absence before group/return substitution", () => {
  for (const Component of [DecarbSignal, DecarbGapSignal]) {
    const result = render(Component);
    assert.ok(result.includes("No completed company dataset is available"));
    const downloads = [...result.matchAll(/<button[^>]*data-testid="button-download-(?:decarb-comparison|gap-timeseries)"[^>]*>/g)].map(match => match[0]);
    assert.ok(downloads.every(button => /\sdisabled=""/.test(button)), "Absent company dataset cannot have an enabled comparison export");
  }
});
test("Methodology actual root retains current/legacy separation with missing driver evidence", () => {
  const result = render(Methodology);
  assert.ok(result.includes("Archived legacy methodology")); assert.ok(result.includes("Driver evidence is unavailable"));
});
test("NewsSentiment actual root partial/zero/malformed observations never fabricates neutral sentiment", () => {
  const partial = render(NewsSentiment, [[["/api/news/climate", "12"], {}]]);
  assert.ok(partial.includes("No positive-count sentiment observations")); assert.ok(partial.includes("N/A"));
  const zero = render(NewsSentiment, [[["/api/news/climate", "12"], { totalArticles: 0, volume: [], sentiment: [], topicBreakdown: [], recentArticles: [] }]]);
  assert.ok(zero.includes(">0<"));
  assert.ok(render(NewsSentiment, [[["/api/news/climate", "12"], { sentiment: [null] }]]).includes("Unable to Load News Data"));
});
const readSurfaces = [
  { Component: AnalysisSelectionControl, key: ["analysis-selection-inventory"], old: [{ id: "PRIOR_SELECTION_SENTINEL", kind: "workbook-baseline" }], pending: "Loading archived inputs", error: "Snapshot inventory unavailable" },
  { Component: AnalysisSnapshotStatus, key: ["/api/analysis/snapshot-status"], old: { snapshotId: "PRIOR_SELECTION_SENTINEL" }, pending: "Loading snapshot status", error: "Snapshot status could not be loaded" },
  { Component: AnalysisSnapshotStatus, key: ["/api/analysis/snapshots", "workbook-baseline"], old: { pages: [{ status: "available", items: [{ id: "PRIOR_SELECTION_SENTINEL", kind: "workbook-baseline" }], nextCursor: null }], pageParams: [null] }, pending: "Loading snapshot inventory", error: "snapshot inventory could not be loaded" },
  { Component: DriverEvidenceDisclosure, key: ["/api/research/driver-registry"], old: { status: "PRIOR_SELECTION_SENTINEL", indicators: [] }, pending: "Loading driver evidence registry", error: "driver registry could not be loaded" },
  { Component: TargetInputDisclosure, key: ["/api/calculation/field-semantics"], old: { qualifiedFields: [{ id: "targetInput.value", source: "PRIOR_SELECTION_SENTINEL" }] }, pending: "Loading input definitions", error: "definitions could not be loaded" },
  { Component: CompanyCoverage, key: ["/api/calculation/company-coverage", ""], old: companyCoverage({ companies: [], observations: [], reviews: [], observationDate: "2024-01-01", informationCutoff: "2024-01-02T00:00:00.000Z", sourceId: "a".repeat(64) }), pending: "Loading full-workbook coverage", error: "this is not zero coverage" },
  { Component: EmissionsCandidateReview, key: ["/api/emissions/candidate?scenario=constant"], old: { inputs: { assumptions: ["PRIOR_SELECTION_SENTINEL"] } }, pending: "Loading candidate emissions", error: "Candidate emissions could not be loaded" },
  { Component: PublishedScenarioReferences, key: ["/api/reference-scenarios"], old: JSON.parse(readFileSync("server/calculation/data/catReferences.json", "utf8")), pending: "Loading published scenario references", error: "Published references could not be loaded" },
  { Component: NewsSentiment, key: ["/api/news/climate", "12"], old: { recentArticles: [{ title: "PRIOR_SELECTION_SENTINEL" }] }, pending: "Loading the current selection", error: "Unable to Load News Data" },
];
for (const surface of readSurfaces) for (const state of ["pending", "error"] as const) test(`${surface.Component.name} ${JSON.stringify(surface.key)} actual ${state} suppresses retained response`, async () => {
  const client = clientWith([...seed, [surface.key, surface.old]]);
  let release: (() => void) | undefined, pending: Promise<unknown> | undefined;
  if (state === "pending") {
    const gate = new Promise<null>(resolve => { release = () => resolve(null); });
    pending = client.fetchQuery({ queryKey: surface.key, staleTime: 0, queryFn: () => gate });
  } else await assert.rejects(client.fetchQuery({ queryKey: surface.key, staleTime: 0, queryFn: async () => { throw Error("PRIVATE_ERROR_SENTINEL"); } }));
  try {
    const result = markup(wrap(client, element(Router, { ssrPath: "/", children: element(surface.Component) })));
    assert.ok(result.includes(state === "pending" ? surface.pending : surface.error), `${surface.Component.name}: ${state} reason`);
    assert.ok(!result.includes("PRIOR_SELECTION_SENTINEL"));
    assert.ok(!result.includes("PRIVATE_ERROR_SENTINEL"));
    if (surface.Component === CompanyCoverage) assert.ok(!result.includes("a".repeat(64)));
    if (surface.Component === PublishedScenarioReferences) assert.ok(!result.includes("Source publication"));
  } finally { release?.(); await pending; client.clear(); }
});
test("backtest accounting exact fields preserve multiplier zero, omit null percentages and reject zero benchmark as active-return denominator", () => {
  assert.equal(backtestPercent(null, true), undefined); assert.equal(backtestPercent(undefined), undefined);
  assert.equal(backtestPercent(0, true), -100); assert.equal(backtestPercent(1, true), 0);
  assert.equal(backtestPercent(0), 0);
  const missing = backtestDisplayStats([{ benchmarkCumulative: null, portfolioCumulative: null, trackingError: null }])!;
  for (const key of ["benchmarkTotal", "portfolioTotal", "annualizedActive", "finalTE", "avgGreen", "avgBrown"] as const) assert.equal(missing[key], undefined, key);
  assert.equal(backtestDisplayStats([{ benchmarkCumulative: 0, portfolioCumulative: 1 }])?.annualizedActive, undefined);
  assert.equal(backtestDisplay(undefined), "Unavailable — accounting not returned");
  assert.equal(backtestDisplay(0, 1, true), "+0.0%");
  const ready = backtestDisplayStats([{ benchmarkCumulative: 1.023456, portfolioCumulative: 1.034567, trackingError: 0.012345 }])!;
  assert.equal(backtestDisplay(ready.portfolioTotal, 1, true), `+${((1.034567 - 1) * 100).toFixed(1)}%`);
  assert.equal(backtestDisplay(ready.finalTE), `${(0.012345 * 100).toFixed(2)}%`);
});
test("actual signal/gap backtest root fields: null return/TE/accounting not fabricated as -100%, 0.00% or NaN", () => {
  for (const Component of [DecarbSignal, DecarbGapSignal]) {
    const response = { series: [{ date: "2024-01", benchmarkCumulative: null, portfolioCumulative: null, activeReturn: null, trackingError: null }], summary: null };
    const result = render(Component, [
      [["/api/cv/uploads"], [{ id: 1, status: "completed" }]],
      [Component === DecarbSignal ? ["/api/cv/backtest", "carbon_intensity", 2, "sector_relative", "all", 1] : ["/api/cv/backtest", "sdg_exposure", 2, "sector_relative", "all", 1], response],
      ...(Component === DecarbGapSignal ? [[[ "/api/cv/backtest", "valuation", "decarb_gap", 2, "sector_relative", "all", 1], response] as [readonly unknown[], unknown]] : []),
    ]);
    const stats = [...result.matchAll(/data-testid="text-(?:portfolio-total|benchmark-total|active-return|tracking-error)">([\s\S]*?)<\/p>/g)].map(match => match[1]);
    assert.ok(stats.length >= 2, Component.name);
    assert.ok(stats.every(value => value === "Unavailable — accounting not returned"), Component.name);
  }
});
test("actual signal/gap backtest ready zero returns keep signed formatting and tracking-error zero", () => {
  for (const Component of [DecarbSignal, DecarbGapSignal]) {
    const response = { series: [{ date: "2024-01", benchmarkCumulative: 1, portfolioCumulative: 1, activeReturn: 0, trackingError: 0, overweightCount: 0, underweightCount: 0 }], summary: null };
    const result = render(Component, [
      [["/api/cv/uploads"], [{ id: 1, status: "completed" }]],
      [Component === DecarbSignal ? ["/api/cv/backtest", "carbon_intensity", 2, "sector_relative", "all", 1] : ["/api/cv/backtest", "sdg_exposure", 2, "sector_relative", "all", 1], response],
      ...(Component === DecarbGapSignal ? [[[ "/api/cv/backtest", "valuation", "decarb_gap", 2, "sector_relative", "all", 1], response] as [readonly unknown[], unknown]] : []),
    ]);
    for (const field of ["portfolio-total", "benchmark-total"]) assert.ok(result.includes(`data-testid="text-${field}">+0.0%</p>`), `${Component.name}:${field}`);
    if (Component === DecarbSignal) assert.ok(result.includes('data-testid="text-tracking-error">0.00%</p>'));
  }
});
