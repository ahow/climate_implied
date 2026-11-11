import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ts from "typescript";
import * as XLSX from "xlsx";
import { Tooltip as RechartsTooltip } from "recharts";
import * as claims from "../client/src/lib/valuation-claims";
import * as finite from "../shared/finiteExportSchemas";
import ClimateValuation from "../client/src/pages/climate-valuation";
import DecarbSignal from "../client/src/pages/decarb-signal";
import DecarbGapSignal from "../client/src/pages/decarb-gap-signal";
import { COMPANY_CONDITIONAL_QUERY_KEY } from "../client/src/hooks/use-company-conditional-summaries";

(globalThis as any).React = React;
const signal = "client/src/pages/decarb-signal.tsx", gap = "client/src/pages/decarb-gap-signal.tsx";
function source(path: string) {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function walk(node: ts.Node, callback: (node: ts.Node) => void) { callback(node); ts.forEachChild(node, child => walk(child, callback)); }
/** Execute the actual checked-in pure initializer/useMemo callback, not a replica. */
function production(path: string, name: string, context: Record<string, unknown> = {}) {
  let expression = "";
  walk(source(path), node => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText().replace(/^export\s+/, "");
    if (ts.isVariableDeclaration(node) && node.name.getText() === name && node.initializer) {
      const init = node.initializer;
      expression = ts.isCallExpression(init) && init.expression.getText() === "useMemo"
        ? `(${init.arguments[0].getText()})()` : init.getText();
    }
  });
  assert.ok(expression, `Actual declaration ${path}#${name}`);
  const dependencies = { React, ...claims, ...finite, ...context };
  const js = ts.transpileModule(`const value=(${expression});`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return value;`)(...Object.values(dependencies));
}
const zeroGroup = (date: unknown) => ({ date, cleanPE: 20, dirtyPE: 20, bottomTercilePeRatio: 20, topTercilePeRatio: 20, bestTercilePE: 20, worstTercilePE: 20 });
const zeroReturn = (date: unknown) => ({ date, benchmarkCumulative: 1, portfolioCumulative: 1, activeReturn: 0, trackingError: null, overweightCount: 0, underweightCount: 0 });
const groupKey = ["/api/cv/sdg-growth", "all", 1];
function client(entries: [unknown[], unknown][] = []) {
  const result = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity } } });
  for (const [key, data] of [
    [["/api/cv/uploads"], [{ id: 1, status: "completed" }]],
    [["/api/cv/dimensions"], {}],
    [["/api/cv/summary"], { companiesCount: 0, dateRange: { recordCount: 1 } }],
    [["/api/cv/decarb-gap/summary", "sector_relative", "all", 1], { companyCount: 1 }],
    [COMPANY_CONDITIONAL_QUERY_KEY, { schemaVersion: "company-conditional-public-1", companies: [] }],
    ...entries,
  ] as [unknown[], unknown][]) result.setQueryData(key, data);
  return result;
}
function markup(Component: any, cache: QueryClient) {
  return renderToStaticMarkup(React.createElement(QueryClientProvider, { client: cache }, React.createElement(Component)));
}
function assertNoEnabledExport(html: string, id: string) {
  const button = html.match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))?.[0];
  assert.ok(!button || /\sdisabled=""/.test(button), `${id}: unavailable rows cannot enable download`);
}
test("date obligation: null/missing/invalid dates stay unavailable; explicitly supplied timestamp zero stays a real date", () => {
  for (const value of [null, undefined, "", "not-a-date", NaN, Number.MAX_VALUE]) assert.equal(claims.observationTimestamp(value), undefined);
  assert.equal(claims.observationTimestamp(0), 0);
  assert.equal(claims.observationTimestamp("2024-01"), Date.UTC(2024, 0, 1));
  const rows = [zeroGroup(null), zeroGroup("2024-01")];
  assert.equal(claims.datedObservations(rows).length, 1);
  assert.equal(claims.hasUndatedObservations(rows), true);
  assert.equal(rows.length, 2, "Original evidence is not rewritten");
});
test("actual three valuation sections reject null-date rows before chart/export, not convert them into 1970 observations", () => {
  const cache = client([
    [["/api/cv/carbon-price?uploadId=1&method=sector_relative&includeScope3=false&winsorize=true&inferenceMethod=carbon_intensity"], [zeroGroup(null)]],
    [["/api/cv/sdg-growth", 0.08, 1], [zeroGroup(null)]],
    [["/api/cv/decarb-terciles", "sector_relative", 0.08, 1], [zeroGroup(null)]],
  ]);
  try {
    const html = markup(ClimateValuation, cache);
    assert.equal((html.match(/No P\/E observations have a valid observation date/g) ?? []).length, 3);
    for (const id of ["carbon", "sdg", "ambition"]) assertNoEnabledExport(html, `button-download-${id}-pe`);
  } finally { cache.clear(); }
});
test("actual group comparison builders omit undated rows and do not backfill a latest unavailable group from an older valid month", () => {
  const carbonPriceData = [zeroGroup("2024-01"), zeroGroup(null)], sdgData = [zeroGroup("2024-01")];
  const formatDateLabel = production(signal, "formatDateLabel");
  const chartData = production(signal, "chartData", { carbonPriceData, sdgData, decarbTercileData: undefined, formatDateLabel });
  assert.equal(chartData.length, 1); assert.equal(chartData[0].date, Date.UTC(2024, 0, 1));
  const latest = production(signal, "latestValues", { chartData, carbonPriceData, sdgData, decarbTercileData: undefined });
  assert.equal(latest.carbonIntensity, null, "Undated selected carbon observation cannot establish latest carbon gap");
  assert.equal(latest.sdgExposure, 0, "Independently available dated SDG zero is preserved");
  const selectedMeasureData = [zeroGroup("2024-01"), zeroGroup(null)];
  assert.equal(production(gap, "latestImpliedRate", { selectedMeasureData, measure: "sdg_alignment" }), null);
  const gapRows = production(gap, "chartData", { selectedMeasureData, measure: "sdg_alignment", formatDateLabel: production(gap, "formatDateLabel") });
  assert.equal(gapRows.length, 1); assert.equal(gapRows[0].impliedRate, 0);
});
test("actual selected SDG gap cannot substitute present carbon or ambition fields when SDG fields are absent", () => {
  const row = { date: "2024-01", dirtyPE: 20, bottomTercilePeRatio: 20, topTercilePeRatio: 10, bestTercilePE: 20, worstTercilePE: 20 };
  const context = { selectedMeasureData: [row], measure: "sdg_alignment", formatDateLabel: production(gap, "formatDateLabel") };
  assert.equal(production(gap, "latestImpliedRate", context), null);
  const rows = production(gap, "chartData", context);
  assert.equal(rows[0].impliedRate, null);
  assert.equal(claims.selectedGroupGapPp(row, "carbon_intensity"), 5);
  assert.equal(claims.selectedGroupGapPp(row, "decarb_ambition"), 0);
  const exported = production(gap, "timeseriesDownloadRows", { chartData: rows, measure: "sdg_alignment", formatDateLabel: context.formatDateLabel });
  assert.equal(exported[0][finite.groupGapExportColumn("sdg_alignment")], null);
  const cache = client([[groupKey, [row]]]);
  try {
    const html = markup(DecarbGapSignal, cache);
    assert.ok(html.includes('data-testid="text-implied-rate">Unavailable</p>'));
    assert.ok(html.includes("Selected groups have missing or invalid P/E denominators."));
  } finally { cache.clear(); }
});
for (const [path, Component, download] of [
  [signal, DecarbSignal, "button-download-decarb-comparison"],
  [gap, DecarbGapSignal, "button-download-gap-timeseries"],
] as const) test(`${path} actual root names undated group reason and disables missing-date comparison export`, () => {
  const cache = client([[groupKey, [zeroGroup(null)]]]);
  try {
    const html = markup(Component, cache);
    assert.ok(html.includes("observation date unavailable"));
    assert.ok(html.includes("Observation date missing or invalid; the latest gap cannot be established."));
    assertNoEnabledExport(html, download);
  } finally { cache.clear(); }
});
for (const path of [signal, gap]) test(`${path} actual dated return/export builders omit undated rows; zero returns and nullable TE survive XLSX`, () => {
  const data = [zeroReturn(null), zeroReturn("2024-01")];
  const chartData = production(path, "backtestChartData", { backtestData: data, valuationBacktestData: undefined });
  assert.equal(chartData.length, 1); assert.equal(chartData[0].date, "2024-01");
  assert.equal(chartData[0].benchmark, 0); assert.equal(chartData[0].portfolio, 0);
  assert.equal(chartData[0].trackingError, undefined);
  if (path === signal) assert.equal(production(path, "backtestStats", { backtestData: data }), null);
  else assert.equal(production(path, "computeStats")(data), null);
  const rows = production(path, "activeReturnDownloadRows", { backtestChartData: chartData });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Actual rows");
  const decoded = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const roundtrip = XLSX.utils.sheet_to_json(decoded.Sheets["Actual rows"], { defval: null }) as Record<string, unknown>[];
  assert.equal(roundtrip.length, 1); assert.equal(roundtrip[0].Date, "2024-01");
  assert.equal(roundtrip[0]["Active Return (%)"], 0);
  const teColumn = Object.keys(roundtrip[0]).find(key => key.includes("Tracking Error"))!;
  assert.ok(teColumn); assert.equal(roundtrip[0][teColumn], null);
});
for (const [path, Component, backtestKey, download] of [
  [signal, DecarbSignal, ["/api/cv/backtest", "carbon_intensity", 2, "sector_relative", "all", 1], "button-download-backtest-cumulative"],
  [gap, DecarbGapSignal, ["/api/cv/backtest", "sdg_exposure", 2, "sector_relative", "all", 1], "button-download-cumulative-return"],
] as const) test(`${path} actual all-undated return root gives explicit reason with no period accounting or enabled export`, () => {
  const cache = client([[backtestKey as unknown as unknown[], { series: [zeroReturn(null)], summary: null }]]);
  try {
    const html = markup(Component, cache);
    assert.ok(html.includes("Backtest observation date unavailable"));
    assert.ok(html.includes("derived period accounting is withheld"));
    assertNoEnabledExport(html, download);
  } finally { cache.clear(); }
});
for (const path of [signal, gap]) test(`${path} actual tooltips retain missing series payload and show named absence rather than omit TE or SDG`, () => {
  const tooltipNames = path === signal ? ["CustomTooltip", "BacktestTooltip"] : ["TimeSeriesChartTooltip", "BacktestTooltip"];
  const formatDateLabel = production(path, "formatDateLabel");
  for (const name of tooltipNames) {
    const Component = production(path, name, { formatDateLabel });
    const missingField = name === "BacktestTooltip"
      ? { dataKey: "trackingError", name: "Tracking Error (ann.)" }
      : name === "CustomTooltip" ? { dataKey: "sdgExposure", name: "SDG Exposure" }
      : { dataKey: "impliedRate", name: "Earnings-yield gap (SDG Alignment)" };
    const html = renderToStaticMarkup(React.createElement(Component, {
      active: true, label: name === "BacktestTooltip" ? "2024-01" : Date.UTC(2024, 0, 1),
      payload: [{ ...missingField, value: null }],
    }));
    assert.ok(html.includes(`${missingField.name} not returned for this observation`));
    const zero = renderToStaticMarkup(React.createElement(Component, {
      active: true, label: name === "BacktestTooltip" ? "2024-01" : Date.UTC(2024, 0, 1),
      payload: [{ ...missingField, value: 0 }],
    }));
    assert.ok(zero.includes(name === "BacktestTooltip" ? "0.00%" : "0.00 pp"));
  }
  let tooltipCount = 0;
  walk(source(path), node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText() === "Tooltip") {
      const prop = node.attributes.properties.find(attr => ts.isJsxAttribute(attr) && attr.name.getText() === "filterNull");
      assert.ok(prop && ts.isJsxAttribute(prop) && prop.initializer?.getText() === "{false}", "Real Recharts must pass missing values to the actual tooltip");
      tooltipCount++;
    }
  });
  assert.equal(tooltipCount, 3, "Only the three real comparison/backtest tooltip consumers are enumerated");
});
for (const path of [signal, gap]) test(`${path} installed Recharts forwards null TE to the actual tooltip; default-filter negative control reproduces omission`, () => {
  const Component = production(path, "BacktestTooltip");
  const props = {
    active: true, label: "2024-01", coordinate: { x: 20, y: 20 }, viewBox: { x: 0, y: 0, width: 300, height: 200 },
    isAnimationActive: false, content: React.createElement(Component),
    payload: [{ dataKey: "trackingError", name: "Tracking Error (ann.)", value: null }, { dataKey: "activeReturn", name: "Active Return", value: 0 }],
  };
  const oldDefault = renderToStaticMarkup(React.createElement(RechartsTooltip, props));
  assert.ok(!oldDefault.includes("Tracking Error (ann.) not returned for this observation"), "Unchanged Recharts default reproduces the retained browser omission");
  const corrected = renderToStaticMarkup(React.createElement(RechartsTooltip, { ...props, filterNull: false }));
  assert.ok(corrected.includes("Tracking Error (ann.) not returned for this observation"));
  assert.ok(corrected.includes("0.00%"), "Actual zero is not removed with missing accounting");
});
for (const [Component, id, download] of [
  [DecarbSignal, "text-sdg-rate", "button-download-decarb-comparison"],
  [DecarbGapSignal, "text-implied-rate", "button-download-gap-timeseries"],
] as const) for (const state of ["pending", "error"] as const) test(`${Component.name}: current ${state} cannot borrow other geography or retained selected rows into a measure/export`, async () => {
  const cache = client([
    [groupKey, [zeroGroup("2024-01")]],
    [["/api/cv/sdg-growth", "US", 1], [{ ...zeroGroup("2099-01"), cleanPE: 1, dirtyPE: 2 }]],
  ]);
  let release: (() => void) | undefined, inFlight: Promise<unknown> | undefined;
  try {
    const ready = markup(Component, cache);
    assert.ok(ready.includes(`data-testid="${id}">0.00 pp</p>`));
    if (state === "pending") {
      const gate = new Promise<null>(resolve => { release = () => resolve(null); });
      inFlight = cache.fetchQuery({ queryKey: groupKey, staleTime: 0, queryFn: () => gate });
    } else await assert.rejects(cache.fetchQuery({ queryKey: groupKey, staleTime: 0, queryFn: async () => { throw Error("current-read-refused"); } }));
    const html = markup(Component, cache);
    assert.ok(html.includes(`data-testid="${id}">Unavailable</p>`));
    assert.ok(html.includes(state === "pending" ? "Loading the current selection" : "Read failed for the current selection"));
    assertNoEnabledExport(html, download);
  } finally { release?.(); await inFlight; cache.clear(); }
});
