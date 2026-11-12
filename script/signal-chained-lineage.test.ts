import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as XLSX from "xlsx";
import { createManifest, contentHash } from "../server/calculation/analysisManifest";
import { packAnalysisResult } from "../server/snapshots/resultContract";
import { producerDownloadMiddleware, registerProducerDownloadRoutes, verifiedProducer } from "../server/producerDownload";
import { releaseSafety } from "../server/releaseSafety";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { deriveSignalConsumer, consumerCanonicalJson, valuationPEDerivations,
  type SignalConsumerKey, type SignalConsumerSelection } from "../shared/derivedConsumer";
import { retainProducerDownload, deriveProducerSignalConsumer, captureDerivedConsumer,
  derivedConsumerIdentity } from "../client/src/lib/producer-download";
import { analysisFetch, selectionKey } from "../client/src/lib/analysis-selection";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "../client/src/lib/download-selection";
import { exportDataIdentity } from "../client/src/lib/export-identity";
import { exportNotes, prepareQualifiedJsonExport } from "../client/src/lib/export-contract";
import { gordonExportNotes } from "../client/src/lib/valuation-claims";
import { appendDerivedConsumerWorkbookLineage, verifyDerivedConsumerWorkbook } from "../client/src/lib/derived-consumer-workbook";
import { bindNestedOutput, bindExportColumns } from "../shared/outputFieldSemantics";
import { semanticRows, requireOutputSemantic } from "../shared/fieldSemantics";
import { certifySupplementalSheetRows } from "../shared/supplementalSheetBindings";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";
import { finiteExportBindings, certifyFiniteExport } from "../shared/finiteExportSchemas";

/** Nonempty, isolated engineering fixtures only. No production dataset mutation,
 * invented original export identity, scientific acceptance or source admission. */
function fixture(path: string, seed: number, signal = "carbon_intensity") {
  const peKey = path === "carbon-price" ? "carbon" : path === "sdg-growth" ? "sdg" : "ambition";
  const spec = valuationPEDerivations[peKey];
  const result = path === "backtest" ? {
    series: [
      { date: "2025-03", benchmarkCumulative: 1.02, portfolioCumulative: 1 + seed / 10,
        activeReturn: 0.00125, trackingError: 0.02005 },
      { date: null, benchmarkCumulative: 1, portfolioCumulative: 1, activeReturn: 0, trackingError: 0 },
      { date: signal === "decarb_gap" ? "2025-02" : "2025-01", benchmarkCumulative: 1,
        portfolioCumulative: 0.95, activeReturn: null, trackingError: 0 },
      { date: "2025-03", benchmarkCumulative: null, portfolioCumulative: 1.15,
        activeReturn: 0, trackingError: null },
    ],
    summary: { signal, method: signal === "decarb_gap" ? "sector_relative" : "absolute",
      targetTrackingErrorPct: 2, seriesTrackingErrorUnits: "decimal" },
  } : [
    { date: "2025-03-31", [spec.high]: 20 + seed, [spec.low]: 10 },
    { date: null, [spec.high]: 10, [spec.low]: 20 },
    { date: "2025-01-31", [spec.high]: null, [spec.low]: 10 },
    { date: "2025-03-31", [spec.high]: 40, [spec.low]: 20 },
  ];
  const manifest = createManifest({ codeVersion: "a".repeat(64), modelVersion: "engineering-signal-lineage",
    snapshotHashes: [String(seed).repeat(64), "b".repeat(64), "c".repeat(64)],
    scenario: `descriptive-valuation:/${path}`, settings: { materialInputsId: "d".repeat(64), signal } });
  const packed = packAnalysisResult(manifest, result);
  return { ...packed.payload, id: packed.id, materialReplayState: "referenced-material-archives-verified" };
}
async function consume(stored: ReturnType<typeof fixture>, withProof = true) {
  return retainProducerDownload(new Response(JSON.stringify(stored.result), {
    headers: withProof ? { "X-Producer-Identity": Buffer.from(JSON.stringify(
      verifiedProducer(stored.id, stored, stored.result))).toString("base64url") } : {},
  })).json();
}
const keys: SignalConsumerKey[] = ["signal-comparison", "group-gap", "signal-cumulative",
  "signal-active", "gap-cumulative", "gap-active"];
function selection(key: SignalConsumerKey): SignalConsumerSelection {
  return key === "group-gap" || key.startsWith("gap-") ? "sdg_alignment" : "carbon_intensity";
}
function paths(key: SignalConsumerKey) {
  return key === "signal-comparison" ? ["carbon-price", "sdg-growth", "decarb-terciles"]
    : key === "group-gap" ? ["sdg-growth"] : key.startsWith("gap-") ? ["backtest", "backtest"] : ["backtest"];
}
async function parents(key: SignalConsumerKey, seed = 1) {
  return Promise.all(paths(key).map((path, index) => consume(fixture(path, seed,
    index === 1 ? "decarb_gap" : key.startsWith("gap-") ? "sdg_exposure" : "carbon_intensity"))));
}
function derive(key: SignalConsumerKey, inputs: unknown[]) {
  return deriveProducerSignalConsumer(inputs, key, selection(key));
}

/** Evaluate actual checked-in JSX attributes, not a parallel test-only set of
 * column bindings, then execute the actual central click handler AST. */
function actualProps(key: SignalConsumerKey, rows: unknown[]) {
  const page = key === "signal-comparison" || key.startsWith("signal-")
    ? "client/src/pages/decarb-signal.tsx" : "client/src/pages/decarb-gap-signal.tsx";
  const rowName = key === "signal-comparison" ? "comparisonDownloadRows" : key === "group-gap"
    ? "timeseriesDownloadRows" : key.endsWith("cumulative") ? "cumulativeReturnDownloadRows" : "activeReturnDownloadRows";
  const source = ts.createSourceFile(page, readFileSync(page, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let attributes: ts.JsxAttributes | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "DownloadDataButton" &&
      node.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === "rows" &&
        attr.initializer?.getText(source) === `{${rowName}}`)) attributes = node.attributes;
    node.forEachChild(visit);
  }
  visit(source); assert.ok(attributes, `${key} real page download consumer exists`);
  const environment: Record<string, unknown> = {
    [rowName]: rows, finiteExportBindings, gordonExportNotes,
    backtestSignal: "carbon_intensity", measure: "sdg_alignment",
    measureInfo: { label: "SDG Alignment" }, compareGap: true,
  };
  return Object.fromEntries(attributes.properties.map(attr => {
    assert.ok(ts.isJsxAttribute(attr));
    const name = attr.name.getText(source);
    if (!attr.initializer) return [name, true];
    if (ts.isStringLiteral(attr.initializer)) return [name, attr.initializer.text];
    assert.ok(ts.isJsxExpression(attr.initializer));
    const expression = attr.initializer.expression!.getText(source);
    return [name, new Function(...Object.keys(environment), `return (${expression});`)(...Object.values(environment))];
  }));
}
function actualClick(key: SignalConsumerKey, rows: unknown[], beforeLoad?: () => void) {
  const path = "client/src/components/download-data-button.tsx";
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleClick")
      expression = node.initializer!.getText(source);
    node.forEachChild(visit);
  }
  visit(source); assert.ok(expression);
  const errors: unknown[] = [], deliveries: Buffer[] = [];
  const dependencies = {
    captureDownloadSelection, requireUnchangedDownloadSelection, captureDerivedConsumer, derivedConsumerIdentity,
    appendDerivedConsumerWorkbookLineage, exportDataIdentity, exportNotes, semanticRows, requireOutputSemantic,
    bindExportColumns, certifySupplementalSheetRows, createDownloadManifest, downloadManifestRows,
    setBusy() {}, setError(error: unknown) { if (error) errors.push(error); },
    interpretationNotes: [], ...actualProps(key, rows),
    loadExportWorkbook: async () => {
      beforeLoad?.();
      return { ...XLSX, writeFile(book: XLSX.WorkBook) {
        deliveries.push(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
      } };
    }, console: { error() {} },
  };
  const js = ts.transpileModule(`const click=(${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return { click: new Function(...Object.keys(dependencies), `${js}; return click;`)(...Object.values(dependencies)),
    errors, deliveries };
}
function decodedLineage(bytes: Buffer) {
  const book = XLSX.read(bytes, { type: "buffer" });
  return { book, lineage: Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(
    book.Sheets["Derived lineage"]).map(row => [row.Field, JSON.parse(row.Value)])) };
}
function actualJsonClick(key: SignalConsumerKey, rows: unknown[], afterPreparation?: () => void) {
  const path = "client/src/components/download-data-button.tsx";
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleJsonClick")
      expression = node.initializer!.getText(source);
    node.forEachChild(visit);
  }
  visit(source); assert.ok(expression, "Real central JSON companion handler exists");
  const errors: string[] = [], blobs: Blob[] = [], deliveries: Array<{ filename: string; blob: Blob }> = [];
  const revoked: string[] = [];
  const dependencies = {
    captureDownloadSelection, requireUnchangedDownloadSelection, captureDerivedConsumer, derivedConsumerIdentity,
    prepareQualifiedJsonExport: async (...args: Parameters<typeof prepareQualifiedJsonExport>) => {
      const result = await prepareQualifiedJsonExport(...args); afterPreparation?.(); return result;
    },
    setBusy() {}, setError(error: string) { if (error) errors.push(error); },
    interpretationNotes: [], ...actualProps(key, rows), Blob,
    URL: {
      createObjectURL(blob: Blob) { blobs.push(blob); return `blob:engineering-only/${blobs.length - 1}`; },
      revokeObjectURL(url: string) { revoked.push(url); },
    },
    document: { createElement(tag: string) {
      assert.equal(tag, "a");
      return { href: "", download: "", click() {
        deliveries.push({ filename: this.download, blob: blobs[Number(this.href.split("/").at(-1))] });
      } };
    } },
  };
  const js = ts.transpileModule(`const click=(${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return { click: new Function(...Object.keys(dependencies), `${js}; return click;`)(...Object.values(dependencies)),
    errors, deliveries, blobs, revoked };
}

test("closed real signal transforms retain per-parent indices, actual formulas, duplicate policy, units and nulls", () => {
  const cp = fixture("carbon-price", 1).result, sdg = fixture("sdg-growth", 1).result;
  const comparison = deriveSignalConsumer([cp, sdg, fixture("decarb-terciles", 1).result],
    "signal-comparison", "carbon_intensity");
  assert.deepEqual(comparison.intermediates[0].retainedIndices, [0, 2, 3]);
  assert.deepEqual(comparison.intermediates[0].excludedIndices, [1]);
  assert.equal(comparison.rows.length, 2);
  assert.equal(comparison.rows[1]["Carbon intensity group earnings-yield gap (pp)"], 2.5);
  assert.equal(comparison.rows[0]["SDG group earnings-yield gap (pp)"], null);
  assert.equal(comparison.intermediates[0].fields.firstPE, "bottomTercilePeRatio");
  assert.equal(comparison.derivation.units["Carbon intensity group earnings-yield gap (pp)"], "percentage points");
  assert.equal(comparison.derivation.fields["Carbon intensity group earnings-yield gap (pp)"], "chart.carbonIntensity");
  assert.match(comparison.derivation.chartFields.carbonIntensity, /parents\[0\]\.bottomTercilePeRatio/);
  const sparseSdg = structuredClone(sdg) as any[];
  sparseSdg[0].date = sparseSdg[3].date = "2025-02-28";
  const sparse = deriveSignalConsumer([cp, sparseSdg, fixture("decarb-terciles", 1).result],
    "signal-comparison", "carbon_intensity");
  assert.equal(sparse.chartRows[1].carbonIntensity, null);
  assert.equal(sparse.chartRows[2].sdgExposure, null);
  assert.deepEqual(Object.keys(sparse.chartRows[1]), ["date", "dateLabel", "carbonIntensity", "sdgExposure", "decarbAmbition"],
    "merged chart keys are explicitly normalized to null; chart-hash declaration is exact");
  const paired = deriveSignalConsumer([fixture("backtest", 1, "sdg_exposure").result,
    fixture("backtest", 1, "decarb_gap").result], "gap-cumulative", "sdg_alignment");
  assert.deepEqual(paired.chartRows.map(row => row.date), ["2025-01", "2025-02", "2025-03"]);
  assert.equal(paired.chartRows[2].benchmark, null, "primary row exists: missing primary benchmark cannot be backfilled");
  assert.equal(paired.chartRows[1].portfolio, null);
  assert.equal(paired.chartRows[0].valuation, null);
  assert.equal(paired.rows[2]["SDG Alignment-Driven Cumulative Return (%)"], 15);
  const nativeOrder = deriveSignalConsumer([fixture("backtest", 1).result], "signal-active", "carbon_intensity");
  assert.deepEqual(nativeOrder.rows.map(row => row.Date), ["2025-03", "2025-01", "2025-03"]);
  assert.equal(nativeOrder.rows[2]["Active Return (%)"], 0, "genuine zero is not missing");
  assert.equal(nativeOrder.rows[0]["Tracking Error (ann.) (%)"], 2,
    "preserve actual binary Math.round behavior, not idealized decimal rounding");
});

test("every finite measure/signal label matches actual qualified column schema without cloning response-derived rows", async () => {
  for (const [measure, pe] of [["carbon_intensity", "carbon-price"], ["sdg_alignment", "sdg-growth"],
    ["decarb_ambition", "decarb-terciles"]] as const) {
    const result = deriveProducerSignalConsumer([await consume(fixture(pe, 1))], "group-gap", measure);
    assert.strictEqual(certifyFiniteExport("groupGap", result.rows, { measure }), result.rows);
    assert.ok(captureDerivedConsumer(result.rows));
  }
  for (const signal of ["carbon_intensity", "sdg_exposure", "decarb_ambition"] as const) {
    const result = deriveProducerSignalConsumer([await consume(fixture("backtest", 1, signal))], "signal-cumulative", signal);
    assert.strictEqual(certifyFiniteExport("signalCumulative", result.rows, { signal }), result.rows);
    assert.ok(captureDerivedConsumer(result.rows));
  }
});

for (const key of keys) test(`${key}: actual checked-in page props and XLSX handler deliver exact bound rows and complete chain`, async () => {
  const inputs = await parents(key), result = derive(key, inputs), capture = captureDerivedConsumer(result.rows)!;
  const identity = await derivedConsumerIdentity(capture, result.rows);
  assert.ok(identity); bindNestedOutput("derivedConsumer", identity);
  assert.equal(identity.chartIdentity.hash, contentHash(result.chartRows));
  assert.equal(identity.derivationHash, contentHash(result.derivation));
  assert.equal(identity.parents!.length, inputs.length);
  const handler = actualClick(key, result.rows);
  await handler.click();
  assert.deepEqual(handler.errors, []);
  assert.equal(handler.deliveries.length, 1);
  const { book, lineage } = decodedLineage(handler.deliveries[0]);
  assert.deepEqual(lineage.parents, identity.parents);
  assert.deepEqual(lineage.intermediates, identity.intermediates);
  assert.equal(lineage.dataIdentity.hash, (await exportDataIdentity(result.rows)).hash);
  assert.equal(lineage.originalHistoricalExport, false);
  assert.equal(lineage.scientificAcceptance, false);
  const normalized = (await exportDataIdentity(result.rows)).normalized;
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null }), normalized);
  await verifyDerivedConsumerWorkbook(XLSX, handler.deliveries[0], lineage as any);
  const corrupted = structuredClone(book);
  const firstCell = Object.keys(corrupted.Sheets[book.SheetNames[0]]).find(cell => /^[A-Z]+2$/.test(cell))!;
  corrupted.Sheets[book.SheetNames[0]][firstCell].v = "corrupt";
  await assert.rejects(verifyDerivedConsumerWorkbook(XLSX,
    XLSX.write(corrupted, { type: "buffer", bookType: "xlsx" }), lineage as any));
});

for (const key of keys) test(`${key}: actual JSON companion delivers exact rows, parent chain, manifest and both declared hash serializations`, async () => {
  const result = derive(key, await parents(key));
  const handler = actualJsonClick(key, result.rows);
  await handler.click();
  assert.deepEqual(handler.errors, []);
  assert.equal(handler.deliveries.length, 1);
  assert.equal(handler.revoked.length, 1);
  const readback = JSON.parse(await handler.deliveries[0].blob.text());
  assert.deepEqual(readback.data, result.rows);
  const expectedJsonHash = createHash("sha256").update(JSON.stringify(readback.data, null, 2)).digest("hex");
  assert.equal(readback.dataIdentity.hash, expectedJsonHash);
  assert.equal(readback.manifest.dataIdentity.hash, expectedJsonHash);
  const identity = await derivedConsumerIdentity(captureDerivedConsumer(result.rows), result.rows);
  assert.deepEqual(readback.manifest.derivedConsumerIdentity, identity);
  assert.equal(identity!.dataIdentity.hash, (await exportDataIdentity(result.rows)).hash);
  assert.equal(readback.manifest.producerIdentity, null, "transformed rows are not exact native bytes");
  assert.equal(readback.manifest.derivedConsumerIdentity.scientificAcceptance, false);
  bindNestedOutput("derivedConsumer", readback.manifest.derivedConsumerIdentity);
  assert.match(handler.deliveries[0].filename, /\.json$/);
});

test("all six intended downloads refuse missing/unretained/mutated parents or changed derived rows before file creation", async () => {
  for (const key of keys) {
    const inputs = await parents(key);
    for (let parentIndex = 0; parentIndex < inputs.length; parentIndex++) {
      for (const bad of [undefined, structuredClone(inputs[parentIndex])]) {
        const incomplete = [...inputs]; incomplete[parentIndex] = bad;
        const result = derive(key, incomplete);
        const handler = actualClick(key, result.rows);
        await handler.click();
        assert.equal(handler.deliveries.length, 0, key);
        assert.match(String(handler.errors[0]), /retained parent.*unavailable/);
        const json = actualJsonClick(key, result.rows);
        await json.click();
        assert.equal(json.deliveries.length, 0);
        assert.equal(json.blobs.length, 0, "no JSON URL created for missing parent");
        assert.match(json.errors[0], /retained parent.*unavailable/);
      }
    }
    const result = derive(key, inputs);
    if (Array.isArray(inputs[0])) inputs[0][0].extraMutation = true;
    else (inputs[0] as any).summary.extraMutation = true;
    assert.throws(() => captureDerivedConsumer(result.rows), /parent changed/);
    const fresh = derive(key, await parents(key));
    fresh.rows[0].Date = "mutated";
    assert.throws(() => captureDerivedConsumer(fresh.rows), /rows or replay changed/);
    const chartMutated = derive(key, await parents(key));
    chartMutated.chartRows[0].visibleMutation = 1;
    assert.throws(() => captureDerivedConsumer(chartMutated.rows), /visible chart rows changed/);
  }
});

test("all six retained-but-empty chains explicitly refuse file creation; empty intermediate schema remains qualified", async () => {
  for (const key of keys) {
    const inputs = await Promise.all(paths(key).map(async (path, index) => {
      const parent = fixture(path, 1, index === 1 ? "decarb_gap" : key.startsWith("gap-") ? "sdg_exposure" : "carbon_intensity");
      const result = path === "backtest" ? { ...(parent.result as any), series: [] } : [];
      const packed = packAnalysisResult(parent.manifest, result);
      return consume({ ...packed.payload, id: packed.id, materialReplayState: parent.materialReplayState });
    }));
    const result = derive(key, inputs);
    assert.equal(result.rows.length, 0);
    const capture = captureDerivedConsumer(result.rows)!;
    assert.ok(capture);
    bindNestedOutput("derivedConsumer", await derivedConsumerIdentity(capture, result.rows));
    const workbook = actualClick(key, result.rows), json = actualJsonClick(key, result.rows);
    await workbook.click(); await json.click();
    assert.equal(workbook.deliveries.length, 0);
    assert.equal(json.deliveries.length, 0);
    assert.match(String(workbook.errors[0]), /no rows returned/);
    assert.match(json.errors[0], /no rows returned/);
  }
});

test("closed domains and malformed observation shapes refuse rather than inventing a series or selection identity", () => {
  assert.throws(() => deriveSignalConsumer([], "group-gap", "sdg_alignment"), /parent slots/);
  assert.throws(() => deriveSignalConsumer([[]], "group-gap", "sdg_exposure"), /closed domain/);
  assert.throws(() => deriveSignalConsumer([[]], "signal-cumulative", "sdg_alignment"), /closed domain/);
  assert.throws(() => deriveSignalConsumer([{}], "signal-active", "carbon_intensity"), /whole backtest response/);
  assert.throws(() => deriveSignalConsumer([[null]], "group-gap", "sdg_alignment"), /observation records/);
  assert.throws(() => deriveSignalConsumer([[]], "caller-formula" as any, "carbon_intensity"), /Unknown/);
});
test("material compatibility is exact across scenarios/settings: same material may join; changed material/code/model may not", async () => {
  const original = fixture("sdg-growth", 1);
  const cp = await consume(fixture("carbon-price", 1)), ambition = await consume(fixture("decarb-terciles", 1));
  for (const changed of [
    { settings: { ...original.manifest.settings, costOfEquity: "0.09" } },
    { settings: { ...original.manifest.settings, materialInputsId: "e".repeat(64) } },
    { codeVersion: "f".repeat(64) }, { modelVersion: "different-engineering-model" },
  ]) {
    const manifest = createManifest({ codeVersion: original.manifest.codeVersion,
      modelVersion: original.manifest.modelVersion, snapshotHashes: original.manifest.snapshotHashes,
      scenario: original.manifest.scenario, settings: original.manifest.settings, ...changed });
    const packed = packAnalysisResult(manifest, original.result);
    const sdg = await consume({ ...packed.payload, id: packed.id, materialReplayState: original.materialReplayState });
    const result = derive("signal-comparison", [cp, sdg, ambition]);
    if ("settings" in changed && changed.settings.materialInputsId === original.manifest.settings.materialInputsId)
      assert.ok(captureDerivedConsumer(result.rows), "scenario/calculator settings are not part of actual material-inputs-1 payload");
    else assert.throws(() => captureDerivedConsumer(result.rows), /conflicting retained source/);
  }
});

test("wrong scenario, mixed-source retained parents, detached backtest series and wrong retained signal all refuse", async () => {
  const cp = await consume(fixture("carbon-price", 1));
  assert.throws(() => captureDerivedConsumer(derive("group-gap", [cp]).rows), /scenario conflicts/);
  const mixed = [cp, await consume(fixture("sdg-growth", 2)), await consume(fixture("decarb-terciles", 1))];
  assert.throws(() => captureDerivedConsumer(derive("signal-comparison", mixed).rows), /conflicting retained source/);
  const materialConflict = fixture("sdg-growth", 1);
  const newManifest = createManifest({ codeVersion: materialConflict.manifest.codeVersion,
    modelVersion: materialConflict.manifest.modelVersion, snapshotHashes: materialConflict.manifest.snapshotHashes,
    scenario: materialConflict.manifest.scenario, settings: {
      ...materialConflict.manifest.settings, materialInputsId: "e".repeat(64),
    } });
  const changedMaterial = packAnalysisResult(newManifest, materialConflict.result);
  const differentMaterial = await consume({ ...changedMaterial.payload, id: changedMaterial.id,
    materialReplayState: materialConflict.materialReplayState });
  const ambition = await consume(fixture("decarb-terciles", 1));
  assert.throws(() => captureDerivedConsumer(derive("signal-comparison", [cp, differentMaterial,
    ambition]).rows), /conflicting retained source/);
  const wrong = await consume(fixture("backtest", 1, "decarb_ambition"));
  assert.throws(() => captureDerivedConsumer(derive("signal-active", [wrong]).rows), /summary/);
  const detached = derive("signal-active", [{ series: wrong.series, summary: wrong.summary }]);
  assert.throws(() => captureDerivedConsumer(detached.rows), /retained parent.*unavailable/);
  const right = derive("signal-active", await parents("signal-active"));
  const capture = captureDerivedConsumer(right.rows)!;
  assert.equal(captureDerivedConsumer(structuredClone(right.rows)), null);
  await assert.rejects(derivedConsumerIdentity(structuredClone(capture), right.rows), /caller attestation/);
  capture.derivation.key = "forged" as any;
  await assert.rejects(derivedConsumerIdentity(capture, right.rows), /unchanged/);
});

/** Isolated real middleware integration; no running application/workflow. */
async function mounted(run: (origin: string, choose: (seed: number | null) => void) => Promise<void>) {
  const stored = [1, 2].flatMap(seed => [
    ...["carbon-price", "sdg-growth", "decarb-terciles"].map(path => fixture(path, seed)),
    ...["carbon_intensity", "sdg_exposure", "decarb_ambition", "decarb_gap"].map(signal => fixture("backtest", seed, signal)),
  ]);
  const load = async (id: string) => {
    const result = stored.find(row => row.id === id);
    if (!result) throw new Error("Engineering retained archive missing");
    return structuredClone(result);
  };
  const app = express();
  app.use(releaseSafety()); app.use(downloadManifestMiddleware()); app.use(producerDownloadMiddleware(load));
  registerProducerDownloadRoutes(app, load);
  for (const path of ["carbon-price", "sdg-growth", "decarb-terciles", "backtest"]) app.get(`/api/cv/${path}`, async (req, res) => {
    const seed = req.query.snapshotId === "2".repeat(64) ? 2 : 1;
    if (seed === 1) await new Promise(resolve => setTimeout(resolve, 8));
    const parent = stored.find(row => row.manifest.scenario === `descriptive-valuation:/${path}` &&
      row.manifest.snapshotHashes[0] === String(seed).repeat(64) &&
      (path !== "backtest" || (row.result as any).summary.signal === req.query.signal))!;
    res.set("X-Analysis-Snapshot", parent.manifest.snapshotHashes[0]);
    res.set("X-Analysis-Overlays", "b".repeat(64));
    res.set("X-Indicator-Snapshot", "c".repeat(64));
    res.set("X-Indicator-Data-State", "archived-approved-indicators");
    res.set("X-Analysis-Manifest", parent.manifest.id);
    res.set("X-Analysis-Material-Inputs", String(parent.manifest.settings.materialInputsId));
    res.set("X-Analysis-Result", parent.id);
    res.json(parent.result);
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${(server.address() as any).port}`;
  const nativeFetch = globalThis.fetch, oldWindow = (globalThis as any).window;
  let value: string | null = null;
  (globalThis as any).window = { location: { origin }, sessionStorage: {
    getItem(key: string) { return key === selectionKey ? value : null; },
  } };
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) =>
    nativeFetch(typeof url === "string" && url.startsWith("/") ? origin + url : url, init)) as typeof fetch;
  try {
    await run(origin, seed => { value = seed === null ? null : JSON.stringify({
      workbook: String(seed).repeat(64), indicators: "c".repeat(64), overlays: ["b".repeat(64)], asOf: "2025-12-31",
    }); });
  } finally {
    globalThis.fetch = nativeFetch;
    if (oldWindow === undefined) delete (globalThis as any).window; else (globalThis as any).window = oldWindow;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
test("actual analysisFetch + producer middleware current/archive/current binds exact responses, refuses stale parents and in-flight selection changes", async () => {
  await mounted(async (_origin, choose) => {
    const read = () => Promise.all(paths("signal-comparison").map(async path =>
      (await analysisFetch(`/api/cv/${path}`)).json()));
    choose(null); const current = await read();
    const first = derive("signal-comparison", current), firstCapture = captureDerivedConsumer(first.rows)!;
    choose(2); assert.throws(() => captureDerivedConsumer(first.rows), /stale requested source/);
    const archived = derive("signal-comparison", await read()), archivedCapture = captureDerivedConsumer(archived.rows)!;
    assert.equal(archivedCapture.parents![0].orderedSnapshotHashes[0], "2".repeat(64));
    assert.notEqual(archivedCapture.parents![0].resultId, firstCapture.parents![0].resultId);
    const pending = actualClick("signal-comparison", archived.rows, () => choose(null));
    await pending.click(); assert.equal(pending.deliveries.length, 0);
    assert.match(String(pending.errors[0]), /selection changed/);
    assert.throws(() => captureDerivedConsumer(archived.rows), /stale requested source/);
    const again = derive("signal-comparison", await read());
    assert.deepEqual(captureDerivedConsumer(again.rows)!.parents, firstCapture.parents);
    assert.equal(contentHash(first.rows), contentHash(again.rows));
  });
});
test("request-bound selection survives delayed response arrival and JSON consumption across selection changes", async () => {
  await mounted(async (_origin, choose) => {
    choose(2);
    const pendingArchive = analysisFetch("/api/cv/sdg-growth");
    choose(null);
    const archived = await (await pendingArchive).json();
    assert.throws(() => captureDerivedConsumer(derive("group-gap", [archived]).rows), /stale requested source/);
    choose(null);
    const pendingCurrent = analysisFetch("/api/cv/sdg-growth");
    choose(2);
    const current = await (await pendingCurrent).json();
    assert.throws(() => captureDerivedConsumer(derive("group-gap", [current]).rows), /stale requested source/);
    const selectedResponse = await analysisFetch("/api/cv/sdg-growth");
    choose(null);
    const lateConsumed = await selectedResponse.json();
    assert.throws(() => captureDerivedConsumer(derive("group-gap", [lateConsumed]).rows), /stale requested source/);
  });
});
test("concurrent source selections resolve independently through real HTTP middleware; no global-current proof swapping", async () => {
  await mounted(async (origin, choose) => {
    choose(null);
    const responses = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const seed = index % 2 ? 2 : 1;
      const result = await Promise.all(paths("signal-comparison").map(async path =>
        retainProducerDownload(await fetch(`${origin}/api/cv/${path}?snapshotId=${String(seed).repeat(64)}`)).json()));
      return { seed, capture: captureDerivedConsumer(derive("signal-comparison", result).rows)! };
    }));
    for (const { seed, capture } of responses)
      assert.ok(capture.parents!.every(parent => parent.orderedSnapshotHashes[0] === String(seed).repeat(64)));
    const mixed = await Promise.all(paths("signal-comparison").map(async (path, index) =>
      retainProducerDownload(await fetch(`${origin}/api/cv/${path}?snapshotId=${String(index === 1 ? 2 : 1).repeat(64)}`)).json()));
    assert.throws(() => captureDerivedConsumer(derive("signal-comparison", mixed).rows), /conflicting retained source/);
    assert.equal((await fetch(`${origin}/api/cv/carbon-price`, { method: "POST" })).status, 403);
  });
});

function requestPaths(key: SignalConsumerKey) {
  return paths(key).map((path, index) => `/api/cv/${path}${path === "backtest"
    ? `?signal=${index === 1 ? "decarb_gap" : key.startsWith("gap-") ? "sdg_exposure" : "carbon_intensity"}` : ""}`);
}
test("all SIX chains traverse actual current/archive/current HTTP inputs and deliver JSON with exact selected source proofs", async () => {
  await mounted(async (_origin, choose) => {
    const firstIds = new Map<SignalConsumerKey, string>();
    const saved = new Map<SignalConsumerKey, ReturnType<typeof derive>>();
    for (const mode of [null, 2, null]) {
      choose(mode);
      for (const key of keys) {
        if (mode === 2) assert.throws(() => captureDerivedConsumer(saved.get(key)!.rows), /stale requested source/);
        const inputs = await Promise.all(requestPaths(key).map(async path => (await analysisFetch(path)).json()));
        const result = derive(key, inputs), capture = captureDerivedConsumer(result.rows)!;
        saved.set(key, result);
        assert.ok(capture.parents!.every(parent => parent.orderedSnapshotHashes[0] === String(mode ?? 1).repeat(64)));
        const ids = consumerCanonicalJson(capture.parents!.map(parent => parent.resultId));
        if (!firstIds.has(key)) firstIds.set(key, ids);
        else if (mode === 2) assert.notEqual(ids, firstIds.get(key));
        else assert.equal(ids, firstIds.get(key));
        const json = actualJsonClick(key, result.rows);
        await json.click();
        assert.deepEqual(json.errors, []);
        const envelope = JSON.parse(await json.deliveries[0].blob.text());
        assert.deepEqual(envelope.data, result.rows);
        assert.deepEqual(envelope.manifest.derivedConsumerIdentity.parents, capture.parents);
      }
    }
  });
});
test("all SIX concurrent source chains retain response-local lineage and JSON/XLSX selection-change refusals", async () => {
  await mounted(async (origin, choose) => {
    choose(null);
    for (const key of keys) {
      const results = await Promise.all(Array.from({ length: 4 }, async (_, index) => {
        const seed = index % 2 ? 2 : 1;
        const inputs = await Promise.all(requestPaths(key).map(async path => {
          const url = new URL(path, origin); url.searchParams.set("snapshotId", String(seed).repeat(64));
          return retainProducerDownload(await fetch(url)).json();
        }));
        return { seed, capture: captureDerivedConsumer(derive(key, inputs).rows)! };
      }));
      for (const { seed, capture } of results)
        assert.ok(capture.parents!.every(parent => parent.orderedSnapshotHashes[0] === String(seed).repeat(64)));
    }
    for (const key of keys) {
      choose(null);
      const result = derive(key, await Promise.all(requestPaths(key).map(async path => (await analysisFetch(path)).json())));
      const json = actualJsonClick(key, result.rows, () => choose(2));
      await json.click();
      assert.equal(json.deliveries.length, 0);
      assert.equal(json.blobs.length, 0);
      assert.match(json.errors[0], /selection changed/);
      choose(null);
      const workbook = actualClick(key, result.rows, () => choose(2));
      await workbook.click();
      assert.equal(workbook.deliveries.length, 0);
      assert.match(String(workbook.errors[0]), /selection changed/);
    }
  });
});
