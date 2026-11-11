import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as XLSX from "xlsx";
import { projectionResponseSchema, PROJECTION_RESPONSE_VERSION } from "../shared/projectionResponse";
import { thresholdDiagnosticSchema } from "../shared/thresholdDiagnosticSchema";
import { bindNestedOutput, bindExportColumns, outputFieldSemantics } from "../shared/outputFieldSemantics";
import { selectedTrajectoryThresholdContext } from "../server/calculation/thresholdDiagnostic";
import { historicalTrajectoryMetrics } from "../server/calculation/historicalMetrics";
import { calculationKey } from "../server/calculation/identity";
import { detachProjectionCacheResponse } from "../server/calculation/projectionCacheResponse";
import { legacyContext } from "../shared/calculationContract";
import * as forward from "../server/calculation/forwardProjection";
import * as history from "../server/calculation/historicalIndicators";
import { calculateAllCategoryProjections, calculateCategoryProjection, applyCategoryModifications } from "../server/calculation/categoryProjections";
import { getRecalculatedHistoricalTrend } from "../server/calculation/historicalRecalculation";
import { getCategoryHistoricalTrend } from "../server/calculation/categoryHistoricalTrend";
import { calculateRegionalFromInputs } from "../server/calculation/regionalProjections";
import { thresholdExportBindings, thresholdExportRow } from "../client/src/lib/threshold-export";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";

/**
 * Execute the ACTUAL route handler source with production calculators/schemas/
 * metadata. Only the DB-backed cache and HTTP transport are isolated in memory.
 * No app launch, DB write, scheduler, provider access or archive mutation.
 */
function projectionHandler() {
  const source = ts.createSourceFile("server/routes.ts", readFileSync("server/routes.ts", "utf8"),
    ts.ScriptTarget.Latest, true);
  let registration = "";
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.get" &&
        ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/projection")
      registration = node.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(registration, "actual GET /api/projection registration must exist");
  let handler: (req: unknown, res: unknown) => Promise<void>;
  const cache = new Map<string, unknown>(), writes: string[] = [];
  const sandbox = {
    ...forward, ...history, calculationKey, legacyContext, PROJECTION_RESPONSE_VERSION, detachProjectionCacheResponse,
    projectionResponseSchema, bindNestedOutput, historicalTrajectoryMetrics,
    selectedTrajectoryThresholdContext, applyCategoryModifications,
    projectionResultCache: null,
    validRouteCache: () => false, tagRouteCache: () => {},
    storage: {
      getProjectionCache: async (key: string) => cache.has(key) ? { resultData: cache.get(key) } : null,
      setProjectionCache: async (value: { cacheKey: string; resultData: unknown }) => {
        writes.push(value.cacheKey); cache.set(value.cacheKey, value.resultData);
      },
    },
    app: { get: (_path: string, fn: typeof handler) => { handler = fn; } }, console,
  };
  vm.runInNewContext(ts.transpile(registration, { target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS }), sandbox);
  return { call: async (category = "all", revision = "selected-input-fixture") => {
    let body: unknown, code = 200;
    const headers: Record<string, string> = {};
    const res = {
      locals: { calculationRevision: revision },
      set: (key: string, value: string) => { headers[key] = value; },
      status: (status: number) => { code = status; return res; },
      json: (value: unknown) => { body = value; return res; },
    };
    await handler!({ query: { category } }, res);
    assert.equal(code, 200, JSON.stringify(body));
    return { body: projectionResponseSchema.parse(body), headers };
  }, writes, cache };
}

test("actual main API handler withholds hardcoded-anchor2024 output; preserves basis, schema, semantics and versioned cache", async () => {
  const row = { ...history.HISTORICAL_INDICATORS.find(r => r.year === 2024)!, isNowcast: false };
  await runWithOverrideRows([], () => history.historicalInputContext.run([row], async () => {
    const api = projectionHandler();
    const first = await api.call();
    const d = first.body.metrics.thresholdDiagnostic;
    thresholdDiagnosticSchema.parse(d);
    assert.equal(first.body.emissionsTrajectory[0].year, 2024);
    assert.equal(d.status, "withheld", "A real selected indicator row does not source the engine's hardcoded emissions anchor");
    assert.equal(d.baselineValue, null);
    assert.equal(d.thresholdValue, null);
    assert.equal(d.basis!.selectionId, "selected-input-fixture");
    assert.equal(d.baselineEvidenceId, null, "No self-hash is promoted into source/captured-input evidence");
    assert.ok(first.headers["X-Field-Semantics"].includes("projection.metrics.thresholdDiagnostic.thresholdValue"));
    const again = await api.call();
    assert.deepEqual(again.body, first.body);
    assert.equal(api.writes.length, 1, "second actual handler request uses the versioned persistent cache");
    const oldKey = calculationKey("projection", "selected-input-fixture", { category: "all", runs: 10000 });
    assert.notEqual(api.writes[0], oldKey, "old response cache keys cannot serve this schema");
    assert.throws(() => projectionResponseSchema.parse({
      ...first.body, metrics: { ...first.body.metrics, thresholdDiagnostic: undefined },
    }));
    assert.throws(() => projectionResponseSchema.parse({
      ...first.body, metrics: { ...first.body.metrics, thresholdDiagnostic: { ...d, thresholdValue: 5 } },
    }));
  }));
});

test("actual main handler with a later selected start withholds rather than borrowing selected/current2024", async () => {
  const rows = [
    { ...history.HISTORICAL_INDICATORS.find(r => r.year === 2024)!, isNowcast: false },
    { ...history.HISTORICAL_INDICATORS.find(r => r.year === 2024)!, year: 2026, isNowcast: true },
  ];
  await runWithOverrideRows([], () => history.historicalInputContext.run(rows, async () => {
    const { body } = await projectionHandler().call("all", "later-selected-input");
    assert.equal(body.emissionsTrajectory[0].year, 2026);
    assert.equal(body.metrics.thresholdDiagnostic.status, "withheld");
    assert.equal(body.metrics.thresholdDiagnostic.thresholdValue, null);
    assert.equal(body.metrics.thresholdDiagnostic.baselineEvidenceId, null);
  }));
});

test("legacy category/history/category-history/regional default-anchor diagnostics withhold with strict mapped metadata", () => {
  const row = { ...history.HISTORICAL_INDICATORS.find(r => r.year === 2024)!, isNowcast: false };
  runWithOverrideRows([], () => history.historicalInputContext.run([row], () => {
    const categories = calculateAllCategoryProjections();
    assert.ok(bindNestedOutput("category", categories).length > 0);
    for (const c of categories) {
      const d = thresholdDiagnosticSchema.parse(c.thresholdDiagnostic);
      assert.equal(d.status, "withheld");
      assert.equal(d.baselineValue, null);
      const metadata = bindExportColumns([thresholdExportRow(d, c.categoryName)], thresholdExportBindings);
      assert.equal(metadata.length, 19);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([thresholdExportRow(d, c.categoryName)]), "Diagnostic");
      const decoded = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
      const restored = XLSX.utils.sheet_to_json<Record<string, unknown>>(decoded.Sheets.Diagnostic, { defval: null })[0];
      assert.equal(restored["Threshold value"], d.thresholdValue);
      assert.equal(restored.Member, d.basis!.memberId);
      assert.equal(restored["Baseline evidence"], d.baselineEvidenceId);
      assert.equal(restored.Context, c.categoryName);
    }
    const historical = getRecalculatedHistoricalTrend();
    const categoryHistory = getCategoryHistoricalTrend();
    const intensities = { eu: { value: .18, source: "static" as const }, us: { value: .28, source: "static" as const },
      china: { value: .58, source: "static" as const }, india: { value: .72, source: "static" as const } };
    const regional = calculateRegionalFromInputs(forward.getCurrentIndicators(), intensities);
    for (const [prefix, rows] of [["historical", historical], ["categoryHistory", categoryHistory],
      ["regional", regional]] as const) assert.ok(bindNestedOutput(prefix, rows).length > 0);
    for (const result of [...historical, ...regional, ...Object.values(categoryHistory[0]).filter(
      (x): x is typeof categoryHistory[0]["all"] => typeof x === "object" && x !== null)]) {
      assert.equal(thresholdDiagnosticSchema.parse(result.thresholdDiagnostic).status, "withheld");
    }
    assert.equal(new Set(outputFieldSemantics.map(f => f.id)).size, outputFieldSemantics.length);
  }));
});

test("a missing selected2024 input cannot silently activate category fallback baseline evidence", () => {
  const row = { ...history.HISTORICAL_INDICATORS.find(r => r.year === 2023)!, isNowcast: false };
  runWithOverrideRows([], () => history.historicalInputContext.run([row], () => {
    const result = calculateCategoryProjection("technology");
    assert.equal(result.thresholdDiagnostic.status, "withheld");
    assert.equal(result.thresholdDiagnostic.thresholdValue, null);
  }));
});

test("global and both historical selectors with missing selected2024 inputs do not authenticate a manufactured2024 model row", async () => {
  const row = { ...history.HISTORICAL_INDICATORS.find(r => r.year === 2023)!, isNowcast: false };
  await runWithOverrideRows([], () => history.historicalInputContext.run([row], async () => {
    assert.equal(history.getAllHistoricalIndicators().some(r => r.year === 2024), false);
    const { body } = await projectionHandler().call("all", "selected-2023-no-2024-input");
    assert.ok(body.emissionsTrajectory.some(r => r.year === 2024), "Legacy engine manufactures the later2024 output from2023 assumptions");
    assert.equal(body.metrics.thresholdDiagnostic.status, "withheld");
    assert.equal(body.metrics.thresholdDiagnostic.baselineEvidenceId, null);
    const historical = getRecalculatedHistoricalTrend();
    assert.ok(historical.every(r => r.thresholdDiagnostic.status === "withheld"));
    const categoryHistory = getCategoryHistoricalTrend();
    for (const category of ["all", "technology", "policy", "corporate", "socioeconomic", "financial", "emissions"] as const)
      assert.equal(categoryHistory[0][category].thresholdDiagnostic.status, "withheld");
  }));
});

test("explicit valid selected baseline evidence remains usable; source-required fix is not unconditional withholding", () => {
  const row = { ...history.HISTORICAL_INDICATORS.find(r => r.year === 2024)!, isNowcast: false };
  runWithOverrideRows([], () => history.historicalInputContext.run([row], () => {
    const withoutEvidence = calculateCategoryProjection("technology");
    assert.equal(withoutEvidence.thresholdDiagnostic.status, "withheld");
    const basis = withoutEvidence.thresholdDiagnostic.basis!;
    const withEvidence = calculateCategoryProjection("technology", 2024, {
      basis, baseline2024: { ...basis, year: 2024, value: withoutEvidence.trajectory[0].p50,
        evidenceId: "engineering-explicit-selected-baseline-input-fixture-not-observational-data" },
    });
    assert.notEqual(withEvidence.thresholdDiagnostic.status, "withheld");
    assert.equal(withEvidence.thresholdDiagnostic.thresholdValue, 0.05 * withoutEvidence.trajectory[0].p50);
    assert.equal(withEvidence.thresholdDiagnostic.baselineEvidenceId,
      "engineering-explicit-selected-baseline-input-fixture-not-observational-data");
  }));
});
