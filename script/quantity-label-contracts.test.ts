import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Building2 } from "lucide-react";
import * as XLSX from "xlsx";
import ts from "typescript";
import express from "express";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import Methodology from "../client/src/pages/methodology";
import { FIXED_5GT_DESCRIPTOR as fixed, SELECTED_FIVE_PERCENT_DESCRIPTOR as selected,
  RETIRED_FINANCE_RESIDUAL_DESCRIPTOR as retired, GORDON_DEFINITION, residualQuantityExportNotes } from "../shared/quantityDescriptors";
import { gordonBaselineMetadata } from "../server/calculation/publicValuationContract";
import { gordonBaselineLabel, gordonExportNotes } from "../client/src/lib/valuation-claims";
import { AnalysisSection } from "../client/src/pages/climate-valuation";
import { CategoryComparison } from "../client/src/components/category-comparison";
import { requireHistoricalType, revisedHistoryType } from "../shared/historicalTypes";
import { RegionalComparison } from "../client/src/components/regional-comparison";
import { TemperatureGauge } from "../client/src/components/temperature-gauge";
import { MetricToggle } from "../client/src/components/metric-toggle";
import { ThresholdDiagnosticDetails } from "../client/src/components/threshold-diagnostic-details";
import { thresholdExportRow, thresholdExportBindings } from "../client/src/lib/threshold-export";
import { calculateThresholdDiagnostic } from "../server/calculation/thresholdDiagnostic";
import { requireOutputSemantic, bindExportColumns } from "../shared/outputFieldSemantics";
import { describeQuantityResponse, quantityDescriptionMiddleware } from "../server/quantityDescriptionApi";
import { residualLabelScan, classifyResidualText, residualTextExceptions, residualTextExceptionIndex } from "./residual-label-scan";
import { LEGACY_CLIMATE, LEGACY_FINANCE } from "../shared/calculationContract";

(globalThis as any).React = React;
const read = (file: string) => readFileSync(file, "utf8");
const html = (type: React.ElementType, props: object) => renderToStaticMarkup(React.createElement(type, props));
const basis = { selectionId: "engineering-selected", trajectoryId: "engineering-trajectory", memberId: "annual-p50",
  gasBasis: "engineering-aggregate", unit: "GtCO2e" };
const diagnostic = calculateThresholdDiagnostic([{ year: 2024, p50: 100 }, { year: 2025, p50: 5 }], {
  basis, baseline2024: { ...basis, year: 2024, value: 100, evidenceId: "explicit-engineering-test-input-not-observation" },
});
function roundtrip(rows: Record<string, unknown>[]) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Data");
  const restored = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  return XLSX.utils.sheet_to_json(restored.Sheets.Data, { defval: null });
}
function evaluate(expression: string, context: Record<string, unknown>) {
  const js = ts.transpileModule(`const value=(${expression});`, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None,
  } }).outputText;
  return new Function(...Object.keys(context), `${js};return value;`)(...Object.values(context));
}
function productionRows(file: string, context: Record<string, unknown>) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let rows = "", bindings = "", notes = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "downloadRows")
      rows = node.initializer!.getText(source);
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(source) === "DownloadDataButton")
      for (const attr of node.attributes.properties) if (ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)) {
        if (attr.name.getText(source) === "fieldBindings") bindings = attr.initializer.expression!.getText(source);
        if (attr.name.getText(source) === "interpretationNotes") notes = attr.initializer.expression!.getText(source);
      }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(rows && bindings && notes, file);
  const env = { ...context, FIXED_5GT_DESCRIPTOR: fixed, THRESHOLD_DIAGNOSTIC_LABEL: selected.label, residualQuantityExportNotes, requireHistoricalType };
  return { rows: evaluate(rows, env), bindings: evaluate(bindings, env), notes: evaluate(notes, env) };
}
test("exact original S01-014/S01-016 criteria remain the assessment, not descriptor presence alone", () => {
  const ledger = read("docs/WORKPLAN_COMPLETION_LEDGER.md");
  assert.match(ledger, /### S01-014[^\n]*\nEach renamed label is identical across UI, API descriptions and exports\./);
  assert.match(ledger, /### S01-016[^\n]*\nA text scan finds no positive residual threshold labelled “net zero”\./);
  assert.equal(selected.label, "Year emissions reach 5% of 2024");
  assert.equal(fixed.label, "Legacy fixed-5gt-v1 year (5 GtCO2e)");
  assert.notEqual(fixed.label, fixed.thresholdLabel, "Crossing year is not an annual mass threshold");
  assert.notEqual(retired.label, selected.label, "Archived extrapolated finance formula is not selected evidence-based diagnostic");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const rendered = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(Router, { ssrPath: "/methodology" }, React.createElement(Methodology))));
    assert.equal((rendered.match(new RegExp(retired.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length, 3);
    assert.ok(rendered.includes(retired.description));
    assert.ok(!rendered.includes(">Net Zero Year<"));
    for (const retained of ["~2172", "~2122", "~2082", "~2065", "~2052", "~2042"])
      assert.ok(rendered.includes(retained), `Archived numeric assignment retained ${retained}`);
  } finally { client.clear(); }
});
test("actual variable-r UI, API metadata and workbook descriptors are identical at every tested r", () => {
  for (const percent of [3, 7.5, 8, 12.345678901234]) {
    const api = gordonBaselineMetadata(percent / 100);
    const rendered = html(AnalysisSection, { icon: Building2, title: "Engineering equality", description: "Descriptive P/E",
      costOfEquityPct: percent, gordonSemanticPrefix: "sdg", chartData: [], isLoading: false,
      formatChartDate: String, formatTooltipDate: String, testIdPrefix: "sdg",
      peChart: { highKey: "high", lowKey: "low", highLabel: "High", lowLabel: "Low", tooltip: () => null } });
    assert.ok(rendered.includes(gordonBaselineLabel(percent)));
    assert.ok(rendered.includes(`title="${GORDON_DEFINITION}"`));
    assert.equal(api.gordonBaselineLabel, gordonBaselineLabel(percent));
    assert.equal(api.gordonDefinition, GORDON_DEFINITION);
    const notes = gordonExportNotes(percent, "sdg");
    assert.equal(notes.find(n => n.Field === "Valuation baseline")!.Value, api.gordonBaselineLabel);
    assert.equal(notes.find(n => n.Field === "Gordon definition")!.Value, api.gordonDefinition);
    assert.deepEqual(roundtrip(notes), notes);
    assert.equal(api.costOfEquity, percent / 100);
  }
});
test("actual fixed-year UI and three production XLSX row/binding/note builders preserve exact labels, values and nulls", () => {
  const common = { temperatureRise: 2, reductionRate: 0, netZeroYear: 2097, thresholdDiagnostic: diagnostic };
  const category = { ...common, category: "technology", categoryName: "Technology" };
  const region = { ...common, region: "EU", regionName: "Europe", carbonIntensity: 0.1,
    carbonIntensityBasis: "engineering-native-basis", milestoneDefinition: fixed.description,
    claim: "Legacy global intensity counterfactual; not a regional temperature forecast" };
  for (const [component, props] of [[CategoryComparison, { categories: [category] }], [RegionalComparison, { regions: [region] }],
    [TemperatureGauge, { temperature: 2, p10: 1.5, p90: 2.5, reductionRate: 0, netZeroYear: 2097,
      thresholdDiagnostic: diagnostic, metricView: "netZero" }]] as const) {
    const rendered = html(component, props);
    assert.ok(rendered.includes(fixed.label));
    assert.ok(rendered.includes(fixed.description.replace(/</g, "&lt;")));
    assert.ok(rendered.includes("2097"));
    assert.ok(rendered.includes(selected.label));
  }
  const cases = [
    ["category-comparison", { categories: [category, { ...category, netZeroYear: null }] }],
    ["regional-comparison", { regions: [region, { ...region, netZeroYear: null }] }],
    ["historical-trend-chart", { data: [{ ...revisedHistoryType, year: 2024, median: 2, p10: 1.5, p90: 2.5, reductionRate: 0,
      netZeroYear: 2097, thresholdDiagnostic: diagnostic, isNowcast: false },
      { ...revisedHistoryType, year: 2023, median: 2, p10: 1.5, p90: 2.5, reductionRate: 0, netZeroYear: null, isNowcast: false }] }],
  ] as const;
  for (const [name, context] of cases) {
    const built = productionRows(`client/src/components/${name}.tsx`, context);
    assert.equal(built.rows[0][fixed.label], 2097);
    assert.equal(built.rows[1][fixed.label], null);
    assert.equal(built.rows[0]["Reduction Rate (%/yr)"], 0);
    if (name === "regional-comparison") {
      assert.ok(!Object.hasOwn(built.rows[0], selected.label), "Regional selected diagnostic has its own separate production download");
      assert.equal(built.rows[0]["Milestone definition"], fixed.description);
    } else assert.equal(built.rows[0][selected.label], 2025);
    assert.deepEqual(roundtrip(built.rows), built.rows);
    assert.deepEqual(built.notes, residualQuantityExportNotes());
    const bound = bindExportColumns(built.rows, built.bindings);
    assert.equal(requireOutputSemantic(built.bindings[fixed.label].id).meaning, fixed.label);
    if (name !== "regional-comparison") assert.equal(requireOutputSemantic(built.bindings[selected.label].id).meaning, selected.label);
    assert.equal(bound.length, Object.keys(built.rows[0]).length);
  }
});
test("selected5% API calculation, actual UI control/details and production export label are equal, never relabelled fixed5Gt", () => {
  assert.equal(diagnostic.label, selected.label);
  assert.equal(diagnostic.thresholdValue, 5);
  assert.equal(diagnostic.year, 2025);
  assert.ok(html(MetricToggle, { activeMetric: "netZero", onMetricChange: () => {} }).includes(selected.label));
  assert.ok(html(ThresholdDiagnosticDetails, { diagnostic }).includes(selected.description.replace(/</g, "&lt;")));
  const row = thresholdExportRow(diagnostic);
  assert.equal(row.Diagnostic, selected.label);
  assert.equal(row[selected.label], diagnostic.year);
  assert.equal(row["Not net zero"], true);
  assert.deepEqual(roundtrip([row]), [row]);
  assert.equal(requireOutputSemantic(thresholdExportBindings[selected.label].id).meaning, selected.label);
  assert.ok(!Object.hasOwn(row, fixed.label));
});
test("GET API description boundary normalizes only reviewed text; every numeric/key assignment remains unchanged", async () => {
  // Literal receipts are checked against real protected source, not assumed.
  const oldPhysical = "Legacy 5 Gt annual residual (not net zero)";
  const oldRegional = "Legacy 5 Gt milestone; not net zero; null means not reached by 2100";
  assert.ok(read("server/routes.ts").includes(`physicalResidualThreshold: "${oldPhysical}"`));
  assert.ok(read("server/calculation/regionalProjections.ts").includes(`milestoneDefinition: "${oldRegional}"`));
  const oldFinanceResidual = "Legacy 5% of starting annual emissions (not net zero)";
  const oldFinanceGrowth = "Legacy r - E/P; not a calibrated emissions-decline inference";
  assert.ok(read("server/routes.ts").includes(`financeResidualThreshold: "${oldFinanceResidual}"`));
  assert.ok(read("server/routes.ts").includes(`financeGrowth: "${oldFinanceGrowth}"`));
  const payload = { metricDefinitions: { physicalResidualThreshold: oldPhysical,
    financeResidualThreshold: oldFinanceResidual, financeGrowth: oldFinanceGrowth }, value: 5 };
  const regions = [{ netZeroYear: 2097, reductionRate: 0, thresholdDiagnostic: diagnostic, milestoneDefinition: oldRegional },
    { netZeroYear: null, reductionRate: 0, milestoneDefinition: oldRegional }];
  const described = describeQuantityResponse("/api/projection/regions", regions) as typeof regions;
  assert.equal(described[0].milestoneDefinition, fixed.description);
  assert.deepEqual(described.map(({ milestoneDefinition, ...rest }) => rest), regions.map(({ milestoneDefinition, ...rest }) => rest));
  assert.equal((describeQuantityResponse("/api/calculation-contract", payload) as typeof payload).metricDefinitions.physicalResidualThreshold, fixed.thresholdLabel);
  assert.equal((describeQuantityResponse("/api/calculation-contract", payload) as typeof payload).metricDefinitions.financeResidualThreshold, retired.description);
  assert.equal((describeQuantityResponse("/api/calculation-contract", payload) as typeof payload).metricDefinitions.financeGrowth, GORDON_DEFINITION);
  assert.equal(payload.metricDefinitions.physicalResidualThreshold, oldPhysical, "No input mutation");
  assert.throws(() => describeQuantityResponse("/api/calculation-contract", { metricDefinitions: { physicalResidualThreshold: "Net zero at5Gt" } }), /Unreviewed/);
  assert.throws(() => describeQuantityResponse("/api/projection/regions", [{ milestoneDefinition: "unreviewed" }]), /Unreviewed/);
  assert.equal(describeQuantityResponse("/api/other", payload), payload);
  const index = read("server/index.ts");
  assert.ok(index.indexOf("app.use(quantityDescriptionMiddleware())") > index.indexOf("app.use(releaseSafety())"));
  assert.ok(index.indexOf("app.use(quantityDescriptionMiddleware())") < index.indexOf("await registerRoutes(httpServer, app)"));
  const app = express();
  app.use(quantityDescriptionMiddleware());
  app.get("/api/calculation-contract", (_req, res) => res.json(payload));
  app.get("/api/projection/regions", (_req, res) => res.json(regions));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const base = `http://127.0.0.1:${address.port}`;
    const apiContract = await (await fetch(`${base}/api/calculation-contract`)).json();
    assert.equal(apiContract.metricDefinitions.physicalResidualThreshold, fixed.thresholdLabel);
    assert.equal(apiContract.metricDefinitions.financeResidualThreshold, retired.description);
    assert.equal(apiContract.metricDefinitions.financeGrowth, GORDON_DEFINITION);
    assert.deepEqual(await (await fetch(`${base}/api/projection/regions`)).json(), described);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
test("all runtime source routes/exports/legacy descriptions scan with individual exceptions, no broad whitelist", () => {
  const scan = residualLabelScan();
  assert.ok(scan.sourceFiles.includes("server/routes.ts") && scan.sourceFiles.includes("client/src/pages/methodology.tsx"));
  assert.ok(scan.sourceFiles.includes("client/src/lib/threshold-export.ts"));
  assert.ok(scan.surfaceInventory.routes.some(r => r.pathExpression === '"/api/calculation-contract"'));
  assert.ok(scan.surfaceInventory.exports.some(e => e.file === "client/src/components/historical-trend-chart.tsx"));
  assert.equal(scan.counts.violation, 0);
  assert.equal(scan.counts.unknown, 0);
  const policy = /policy: "([^"]*R16-EXTRAPOLATION-001[^"]*)"/.exec(read("client/src/lib/ui-claim-register.ts"))?.[1];
  assert.ok(policy);
  assert.match(policy, /not 5% of 2024 and not net zero/);
  assert.equal(classifyResidualText(policy).classification, "local-negation",
    "The legacy warning uses explicit negation, not a new exception");
  const cat = JSON.parse(read("server/calculation/data/catReferences.json")).scenarios[1];
  for (const text of [cat.publishedName, cat.definition]) {
    const occurrences = scan.occurrences.filter(entry => entry.file === "shared/referenceScenarioLabels.ts" && entry.text === text);
    assert.equal(occurrences.length, 1, "Exact original CAT quote, not a generic source-file exception");
    assert.equal(occurrences[0].classification, "reviewed-exception");
  }
  assert.deepEqual(scan.unusedExceptions, []);
  assert.equal(new Set(residualTextExceptions.map(e => `${e.file}|${e.text}`)).size, residualTextExceptions.length);
  for (const entry of scan.occurrences) assert.ok(entry.context && entry.reason.length > 20);
  assert.equal(classifyResidualText("Net zero year", false, "Threshold5Gt/year").classification, "violation");
  assert.equal(classifyResidualText("5% of baseline is net zero").classification, "violation");
  assert.equal(classifyResidualText("Not net zero; the next5Gt year is net zero").classification, "violation");
  assert.equal(classifyResidualText("Not net zero. 5Gt is net zero. Other output unavailable.").classification, "violation");
  assert.equal(classifyResidualText("5Gt net zero year is not unavailable").classification, "violation");
  assert.equal(classifyResidualText("5Gt net zero year. An unrelated result is unavailable.").classification, "violation");
  assert.equal(classifyResidualText("Net zero year").classification, "unknown");
  assert.equal(classifyResidualText("5% residual, not net zero").classification, "local-negation");
  assert.ok(!read("client/src/pages/methodology.tsx").includes(">Net Zero Year<"));
});
test("CAT source-document identifiers, original URLs and target-category finding have exact property-scoped review only", () => {
  const file = "server/calculation/indicatorSourceMetadata.ts";
  const reviewed = residualTextExceptions.filter(e => e.file === file && e.sourceProperties);
  assert.equal(reviewed.length, 4);
  const scan = residualLabelScan();
  const occurrences = scan.occurrences.filter(e => e.file === file && reviewed.some(r => r.text === e.text));
  assert.equal(occurrences.length, 8, "Five exact document-id references, two source URLs and one category finding");
  assert.ok(occurrences.every(e => e.classification === "reviewed-exception"));
  assert.equal(occurrences.filter(e => e.text === "cat-netzero").length, 5);
  for (const entry of reviewed) {
    for (const property of entry.sourceProperties!) {
      assert.ok(residualTextExceptionIndex(file, entry.text, property) >= 0);
      assert.equal(residualTextExceptionIndex("server/calculation/other.ts", entry.text, property), -1);
      assert.equal(residualTextExceptionIndex(file, `${entry.text} 5Gt is net zero`, property), -1);
      assert.equal(residualTextExceptionIndex(file, `${entry.text} changed`, property), -1);
    }
    for (const property of ["label", "quantityLabel", "threshold", "year", ""]) {
      assert.equal(residualTextExceptionIndex(file, entry.text, property), -1,
        "A copied source category/locator in an analytical quantity property is not exempt");
    }
    assert.equal(classifyResidualText(entry.text).classification, "unknown",
      "Lexical classification remains strict; only exact file/text/AST-property review resolves these cases");
  }
  assert.equal(residualTextExceptionIndex(file, "cat-netzero", "finding"), -1);
  assert.equal(residualTextExceptionIndex(file, reviewed.find(e => e.sourceProperties!.includes("finding"))!.text, "url"), -1);
  assert.equal(classifyResidualText("5Gt is net zero", false, file).classification, "violation");
});
test("original1000/1001 and all legacy numerical constant assignments remain frozen", () => {
  assert.deepEqual(LEGACY_CLIMATE, { version: "legacy-physical-v1", baselineYear: 2024, endYear: 2100,
    baselineEmissionsGt: 60.3, intensityNormalizer: 0.32, warmingOffsetC: 1.1, tcreCPerGt: 0.00045 });
  assert.deepEqual(LEGACY_FINANCE, { version: "legacy-finance-v1", baselineYear: 2024, endYear: 2100,
    annualEmissionsGt: 60.3, warmingOffsetC: 1.1, tcreCPerGt: 0.00045, carbonPriceHorizonYears: 6, nearZeroFraction: 0.05 });
  const census = JSON.parse(read("docs/field_semantics_census.json"));
  assert.equal(census.originalGapReconciliation.originalPublicSlots, 1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields, 1000);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots, 1);
});
