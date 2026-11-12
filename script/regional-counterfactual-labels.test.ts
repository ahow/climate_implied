import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as XLSX from "xlsx";
import { RegionalComparison } from "../client/src/components/regional-comparison";
import { REGIONAL_COUNTERFACTUAL, regionalCounterfactualRows, regionalCounterfactualBindings, regionalCounterfactualExportNotes } from "../shared/regionalCounterfactual";
import { FIXED_5GT_DESCRIPTOR } from "../shared/quantityDescriptors";
import { bindExportColumns, bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { semanticRows } from "../shared/fieldSemantics";
import { deriveLegacyExport, legacyProducerScenario } from "../shared/legacyExportConsumer";
import { calculateRegionalFromInputs } from "../server/calculation/regionalProjections";
import { selectedTrajectoryThresholdContext } from "../server/calculation/thresholdDiagnostic";
import { calculationKey } from "../server/calculation/identity";
import { detachProjectionCacheResponse } from "../server/calculation/projectionCacheResponse";
import { PROJECTION_RESPONSE_VERSION } from "../shared/projectionResponse";
import { getCurrentIndicators } from "../server/calculation/forwardProjection";
import { getAllHistoricalIndicators, historicalInputContext, HISTORICAL_INDICATORS } from "../server/calculation/historicalIndicators";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "../client/src/lib/download-selection";
import { captureDerivedConsumer, derivedConsumerIdentity, bindProducerLegacyConsumer, retainProducerDownload } from "../client/src/lib/producer-download";
import { appendDerivedConsumerWorkbookLineage, verifyDerivedConsumerWorkbook } from "../client/src/lib/derived-consumer-workbook";
import { exportDataIdentity } from "../client/src/lib/export-identity";
import { exportNotes } from "../client/src/lib/export-contract";
import { certifySupplementalSheetRows } from "../shared/supplementalSheetBindings";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";
import { createManifest } from "../server/calculation/analysisManifest";
import { packAnalysisResult } from "../server/snapshots/resultContract";
import { verifiedProducer } from "../server/producerDownload";

(globalThis as any).React = React;
const intensities = {
  eu: { value: .18, source: "static" as const }, us: { value: .28, source: "owid" as const },
  china: { value: .58, source: "static" as const }, india: { value: .72, source: "owid" as const },
};
// Explicit engineering inputs only; no live provider, DB writes or app launch.
function evaluate(expression: string, dependencies: Record<string, unknown>) {
  const js = ts.transpileModule(`const value=(${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${js};return value;`)(...Object.values(dependencies));
}
function sourceFile(path: string) {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function initializer(path: string, name: string) {
  const file = sourceFile(path);
  let result = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) result = node.initializer!.getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file); assert.ok(result, `actual ${path}:${name} must exist`); return result;
}
async function actualApi(unavailable = false) {
  const file = sourceFile("server/routes.ts");
  let handlerExpression = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "app.get" &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/projection/regions")
      handlerExpression = node.arguments[1].getText(file);
    ts.forEachChild(node, visit);
  }
  visit(file); assert.ok(handlerExpression);
  let liveCalls = 0, status = 200, body: any;
  const headers: Record<string, string> = {};
  const handler = evaluate(handlerExpression, {
    calculateRegionalFromInputs, getCurrentIndicators, getAllHistoricalIndicators, calculationKey,
    selectedTrajectoryThresholdContext, bindNestedOutput, detachProjectionCacheResponse,
    PROJECTION_RESPONSE_VERSION, snapshotSelection: (id: string) => id,
    loadRegionalInputs: async () => { if (unavailable) throw new Error("Selected archive unavailable"); return intensities; },
    calculateRegionalProjections: async () => { liveCalls++; throw new Error("Unexpected live fallback"); },
    regionalCacheResult: [{ region: "must-not-use-current-cache" }], regionalCacheFetchedAt: Date.now(),
    REGIONAL_CACHE_TTL_MS: 86400000, validRouteCache: () => true, tagRouteCache() {},
    console: { error() {} },
  });
  const res = { locals: { calculationRevision: "engineering-selected-history" },
    set(key: string, value: string) { headers[key] = value; },
    status(code: number) { status = code; return res; }, json(value: any) { body = value; return res; } };
  await handler({ query: { regionalSnapshotId: "engineering-selected-regional-archive" } }, res);
  assert.equal(liveCalls, 0);
  return { body, headers, status };
}
function actualComponentProps(regions: any[]) {
  const path = "client/src/components/regional-comparison.tsx", file = sourceFile(path);
  const dependencies = { regions, REGIONAL_COUNTERFACTUAL, FIXED_5GT_DESCRIPTOR,
    regionalCounterfactualRows, regionalCounterfactualBindings, regionalCounterfactualExportNotes };
  const props: Record<string, any> = {
    rows: evaluate(initializer(path, "downloadRows"), dependencies),
  };
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(file) === "DownloadDataButton")
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || !attr.initializer) continue;
        const key = attr.name.getText(file);
        if (ts.isStringLiteral(attr.initializer)) props[key] = attr.initializer.text;
        else if (ts.isJsxExpression(attr.initializer) && attr.initializer.expression && key !== "rows")
          props[key] = evaluate(attr.initializer.expression.getText(file), dependencies);
      }
    ts.forEachChild(node, visit);
  }
  visit(file);
  bindProducerLegacyConsumer(regions, "regional", props.rows);
  return props;
}
async function actualWorkbook(props: Record<string, any>) {
  let bytes: Buffer | undefined;
  let expectedLineage: Awaited<ReturnType<typeof appendDerivedConsumerWorkbookLineage>>;
  const errors: unknown[] = [];
  const click = evaluate(initializer("client/src/components/download-data-button.tsx", "handleClick"), {
    ...props, requireDerivedParent: false,
    captureDownloadSelection, requireUnchangedDownloadSelection, captureDerivedConsumer, derivedConsumerIdentity,
    appendDerivedConsumerWorkbookLineage: async (...args: Parameters<typeof appendDerivedConsumerWorkbookLineage>) => {
      expectedLineage = await appendDerivedConsumerWorkbookLineage(...args);
      return expectedLineage;
    }, exportDataIdentity, exportNotes, semanticRows, requireOutputSemantic,
    bindExportColumns, certifySupplementalSheetRows, createDownloadManifest, downloadManifestRows,
    setBusy() {}, setError(error: unknown) { errors.push(error); }, console: { error() {} },
    loadExportWorkbook: async () => ({ ...XLSX, writeFile(book: XLSX.WorkBook) {
      bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    } }),
  });
  await click();
  return { errors, bytes, expectedLineage: expectedLineage!, book: bytes ? XLSX.read(bytes, { type: "buffer" }) : undefined };
}

test("actual selected regional API/render/ordinary XLSX/readback share literal labels, inputs and claims", async () => {
  const row = { ...HISTORICAL_INDICATORS.find(r => r.year === 2024)!, isNowcast: false };
  await runWithOverrideRows([], () => historicalInputContext.run([row], async () => {
    const api = await actualApi();
    assert.equal(api.status, 200); assert.equal(api.body.length, 4);
    assert.equal(api.headers["X-Regional-Snapshot"], "engineering-selected-regional-archive");
    assert.ok(api.headers["X-Field-Semantics"].includes("regional.temperatureRise"));
    assert.equal(api.headers["Cache-Control"], "no-store");
    for (const r of api.body) {
      assert.equal(r.claim, REGIONAL_COUNTERFACTUAL.claim);
      assert.equal(r.milestoneDefinition, FIXED_5GT_DESCRIPTOR.description);
      assert.equal(r.carbonIntensity, intensities[r.region as keyof typeof intensities].value);
      assert.equal(r.thresholdDiagnostic.status, "withheld", "no invented observed regional allocation");
    }
    const props = actualComponentProps(api.body);
    assert.deepEqual(props.rows, deriveLegacyExport(api.body, "regional").rows);
    assert.equal(bindExportColumns(props.rows, props.fieldBindings).length, 8);
    assert.equal(requireOutputSemantic("regional.temperatureRise").meaning, REGIONAL_COUNTERFACTUAL.warmingLabel);
    const html = renderToStaticMarkup(React.createElement(RegionalComparison, { regions: api.body }));
    assert.ok(html.includes(REGIONAL_COUNTERFACTUAL.title));
    assert.ok(html.includes(REGIONAL_COUNTERFACTUAL.warmingLabel));
    assert.ok(html.includes(FIXED_5GT_DESCRIPTOR.label));
    assert.ok(html.includes(REGIONAL_COUNTERFACTUAL.claim));
    const result = await actualWorkbook(props);
    assert.deepEqual(result.errors, [null]); assert.ok(result.book);
    const restored = XLSX.utils.sheet_to_json(result.book.Sheets[props.sheetName], { defval: null });
    assert.deepEqual(restored, JSON.parse(JSON.stringify(props.rows)));
    const notes = XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(result.book.Sheets.Interpretation);
    assert.equal(notes.find(n => n.Field === "Claim")?.Value, api.body[0].claim);
    assert.equal(notes.find(n => n.Field === FIXED_5GT_DESCRIPTOR.label)?.Value, api.body[0].milestoneDefinition);
    assert.ok(notes.some(n => n.Value.includes("not observations")));
    assert.ok(!result.book.SheetNames.includes("Derived lineage"), "ordinary XLSX must remain available without retained parent");
  }));
});

test("retained regional custom projection preserves exact lineage and completed XLSX verification", async () => {
  const row = { ...HISTORICAL_INDICATORS.find(r => r.year === 2024)!, isNowcast: false };
  await runWithOverrideRows([], () => historicalInputContext.run([row], async () => {
    const { body } = await actualApi();
    const manifest = createManifest({ codeVersion: "a".repeat(64), modelVersion: "engineering-only",
      snapshotHashes: ["b".repeat(64)], scenario: legacyProducerScenario("/api/projection/regions"),
      settings: { materialInputsId: "c".repeat(64) } });
    const packed = packAnalysisResult(manifest, body);
    const retained = { ...packed.payload, id: packed.id, materialReplayState: "referenced-material-archives-verified" };
    const proof = verifiedProducer(retained.id, retained, body);
    const consumed = await retainProducerDownload(new Response(JSON.stringify(body), {
      headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") },
    })).json();
    const props = actualComponentProps(consumed), result = await actualWorkbook(props);
    assert.deepEqual(result.errors, [null]); assert.ok(result.bytes);
    assert.ok(result.book!.SheetNames.includes("Derived lineage"));
    assert.ok(result.expectedLineage);
    const verified = await verifyDerivedConsumerWorkbook(XLSX, result.bytes, result.expectedLineage);
    assert.ok(verified);
  }));
});

test("unavailable selected regional inputs do not use live/cache defaults or offer a completed empty workbook", async () => {
  const api = await actualApi(true);
  assert.equal(api.status, 422);
  assert.match(api.body.error, /requested inputs may be unavailable/);
  const html = renderToStaticMarkup(React.createElement(RegionalComparison, { regions: [] }));
  assert.ok(html.includes(REGIONAL_COUNTERFACTUAL.unavailable));
  assert.ok(!html.includes("button-download-regional"));
  const result = await actualWorkbook(actualComponentProps([]));
  assert.equal(result.bytes, undefined);
  assert.ok(result.errors.some(e => typeof e === "string" && e.includes("no rows returned")));
  assert.throws(() => calculateRegionalFromInputs(getCurrentIndicators(), {}), /Missing or invalid captured regional intensity/);
});

test("selected history without 2024 never manufactures regional baseline evidence; null/zero cells stay distinct", async () => {
  const row = { ...HISTORICAL_INDICATORS.find(r => r.year === 2023)!, isNowcast: false };
  await runWithOverrideRows([], () => historicalInputContext.run([row], async () => {
    const api = await actualApi();
    assert.equal(api.status, 200);
    assert.ok(api.body.every((r: any) => r.thresholdDiagnostic.status === "withheld" && r.thresholdDiagnostic.baselineEvidenceId === null));
    // Engineering-only missing-cell branch, not a regional allocation.
    const partial = [{ ...api.body[0], temperatureRise: undefined, reductionRate: 0, netZeroYear: undefined,
      carbonIntensity: undefined, carbonIntensityBasis: undefined, claim: undefined, milestoneDefinition: undefined },
      { ...api.body[1], netZeroYear: null }];
    const props = actualComponentProps(partial), result = await actualWorkbook(props);
    assert.deepEqual(result.errors, [null]);
    const restored = XLSX.utils.sheet_to_json<any>(result.book!.Sheets[props.sheetName], { defval: null });
    assert.equal(restored[0][REGIONAL_COUNTERFACTUAL.warmingLabel], null);
    assert.equal(restored[0][REGIONAL_COUNTERFACTUAL.reductionLabel], 0);
    assert.equal(restored[0].Claim, null);
    assert.equal(restored[1][FIXED_5GT_DESCRIPTOR.label], null);
    const html = renderToStaticMarkup(React.createElement(RegionalComparison, { regions: partial }));
    assert.ok(html.includes("Unavailable — not returned"));
    assert.ok(html.includes("Not reached by 2100"));
  }));
});
