import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as XLSX from "xlsx";
import { registerReadonlyDiffApi } from "../server/readonlyDiffApi";
import { producerDownloadMiddleware, registerProducerDownloadRoutes } from "../server/producerDownload";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { packIndicators } from "../server/snapshots/indicatorContract";
import { packAnalysisResult, unpackAnalysisResult } from "../server/snapshots/resultContract";
import { contentHash, createManifest } from "../server/calculation/analysisManifest";
import { retainReadonlyDiffProducer, replayReadonlyDiff, verifyReadonlyDiffMaterial } from "../server/snapshots/readonlyDiffProducer";
import type { DiffArchive } from "../server/snapshots/readonlyDiffContract";
import { READONLY_PRODUCER_SCENARIO, deriveReadonlyConsumer } from "../shared/readonlyConsumer";
import { retainProducerDownload, captureDerivedConsumer, derivedConsumerIdentity } from "../client/src/lib/producer-download";
import { versionDiffExportRows, affectedAnalysisExportRows } from "../client/src/components/readonly-version-diff";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "../client/src/lib/download-selection";
import { selectionKey } from "../client/src/lib/analysis-selection";
import { exportNotes, prepareQualifiedJsonExport } from "../client/src/lib/export-contract";
import { exportDataIdentity } from "../client/src/lib/export-identity";
import { appendDerivedConsumerWorkbookLineage, verifyDerivedConsumerWorkbook } from "../client/src/lib/derived-consumer-workbook";
import { semanticRows, requireOutputSemantic } from "../shared/fieldSemantics";
import { bindExportColumns } from "../shared/outputFieldSemantics";
import { certifySupplementalSheetRows } from "../shared/supplementalSheetBindings";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";
import { methodologyDownloadCensus } from "./methodology-download-census";
import { remainingExportContracts } from "../shared/remainingExportContracts";

/** Isolated nonempty engineering archives. Never source approval or production
 * content. Only storage/transport are injected; retention/replay/proof builders
 * and the checked-in consumers and file handlers are the production code. */
function fixture() {
  const source = { version: "calculation-source-1", files: Object.fromEntries([
    "server/snapshots/readonlyDiffProducer.ts", "shared/readonlyConsumer.ts",
    "client/src/components/readonly-version-diff.tsx",
  ].map(path => [path, readFileSync(path, "utf8")])) };
  const archives = new Map<string, DiffArchive>(), materials = new Map<string, any>(), results = new Map<string, any>();
  const mk = (value: number) => {
    const packed = packIndicators([{ indicatorKey: "engineering-only-driver", year: 2020, value,
      source: "PRIVATE PARENT SOURCE MUST NOT LEAK", method: "isolated engineering fixture" }]);
    const archive: DiffArchive = { id: packed.id, kind: "indicator-overrides", chunks: [packed.payload],
      companyCount: 0, observationCount: 1 };
    archives.set(archive.id, archive); return archive;
  };
  const before = mk(0), next = mk(1);
  const reference = packAnalysisResult(createManifest({ codeVersion: "old-engineering-source",
    modelVersion: "isolated-test", snapshotHashes: [before.id], scenario: "isolated-engineering-reference",
    settings: {} }), { nonempty: true });
  results.set(reference.id, { ...reference.payload, id: reference.id, recordedAt: "2026-11-01T00:00:00.000Z" });
  materials.set(contentHash(source), source);
  async function loadSource(id: string, kind: DiffArchive["kind"]) {
    const archive = archives.get(id);
    if (!archive || archive.kind !== kind) throw new Error("Missing source parent");
    return structuredClone(archive);
  }
  async function loadArchive(id: string, _kind: any) {
    const material = materials.get(id);
    if (!material || contentHash(material) !== id) throw new Error("Missing/corrupt retained material");
    return structuredClone(material);
  }
  async function loadResult(id: string): Promise<any> {
    const result = results.get(id);
    if (!result) throw new Error("Missing completed-result parent");
    const payload = unpackAnalysisResult(id, { version: result.version, manifest: result.manifest, result: result.result });
    if (payload.manifest.scenario === READONLY_PRODUCER_SCENARIO)
      await verifyReadonlyDiffMaterial(payload.manifest.settings.materialInputsId as string,
        payload.manifest, payload.result, loadResult, loadArchive, loadSource);
    return { ...structuredClone(result), materialReplayState: "referenced-material-archives-verified" };
  }
  const store = {
    captureSource: async () => contentHash(source),
    saveMaterial: async (payload: unknown) => { const id = contentHash(payload); materials.set(id, structuredClone(payload)); return id; },
    saveResult: async (manifest: ReturnType<typeof createManifest>, result: unknown) => {
      const packed = packAnalysisResult(manifest, result);
      results.set(packed.id, { ...packed.payload, id: packed.id, recordedAt: "2026-11-02T00:00:00.000Z" });
      return packed.id;
    }, loadResult,
  };
  const repository = { load: loadSource, results: async (_after?: string) => ({
    items: [{ id: reference.id, payload: reference.payload, recordedAt: "2026-11-01T00:00:00.000Z" }],
    nextCursor: null,
  }) };
  const input = { query: { from: before.id, to: next.id, kind: before.kind },
    before, next, page: { items: [{ id: reference.id, payload: reference.payload,
      recordedAt: "2026-11-01T00:00:00.000Z" }], nextCursor: null } };
  return { source, before, next, input, archives, materials, results, reference, store, repository };
}
async function mounted(f: ReturnType<typeof fixture>, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(downloadManifestMiddleware());
  app.use(producerDownloadMiddleware(f.store.loadResult));
  registerProducerDownloadRoutes(app, f.store.loadResult);
  registerReadonlyDiffApi(app, f.repository, (input, result) => retainReadonlyDiffProducer(input, result, f.store));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
async function consumed(base: string, f: ReturnType<typeof fixture>) {
  const response = await fetch(`${base}/api/data/version-diff?${new URLSearchParams(f.input.query)}`);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("X-Producer-Identity"));
  return retainProducerDownload(response, null).json();
}
function props(filename: string, data: any) {
  const path = "client/src/components/readonly-version-diff.tsx";
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let attributes: ts.JsxAttributes | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "DownloadDataButton" &&
      node.attributes.properties.some(attr => ts.isJsxAttribute(attr) &&
        attr.name.getText(source) === "filename" && attr.initializer?.getText(source) === JSON.stringify(filename)))
      attributes = node.attributes;
    node.forEachChild(visit);
  }
  visit(source); assert.ok(attributes);
  const context = { data, versionDiffExportRows, affectedAnalysisExportRows };
  return Object.fromEntries(attributes.properties.map(attr => {
    assert.ok(ts.isJsxAttribute(attr));
    const name = attr.name.getText(source);
    if (!attr.initializer) return [name, true];
    if (ts.isStringLiteral(attr.initializer)) return [name, attr.initializer.text];
    assert.ok(ts.isJsxExpression(attr.initializer));
    return [name, new Function(...Object.keys(context), `return (${attr.initializer.expression!.getText(source)});`)(...Object.values(context))];
  }));
}
function actualHandler(name: "handleClick" | "handleJsonClick", actualProps: Record<string, unknown>) {
  const path = "client/src/components/download-data-button.tsx";
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer!.getText(source);
    node.forEachChild(visit);
  }
  visit(source); assert.ok(expression);
  const errors: string[] = [], workbooks: Buffer[] = [], blobs: Blob[] = [], json: Blob[] = [];
  const dependencies = {
    captureDownloadSelection, requireUnchangedDownloadSelection, captureDerivedConsumer, derivedConsumerIdentity,
    appendDerivedConsumerWorkbookLineage, exportDataIdentity, exportNotes, semanticRows, requireOutputSemantic,
    bindExportColumns, certifySupplementalSheetRows, createDownloadManifest, downloadManifestRows, prepareQualifiedJsonExport,
    interpretationNotes: [], fieldBindings: undefined, testId: "engineering-readonly-download", ...actualProps,
    setBusy() {}, setError(error: string | null) { if (error) errors.push(error); },
    loadExportWorkbook: async () => ({ ...XLSX, writeFile(book: XLSX.WorkBook) {
      workbooks.push(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    } }), console: { error() {} }, Blob,
    URL: { createObjectURL(blob: Blob) { blobs.push(blob); return `blob:engineering/${blobs.length - 1}`; }, revokeObjectURL() {} },
    document: { createElement() { return { href: "", download: "", click() { json.push(blobs[Number(this.href.split("/").at(-1))]); } }; } },
  };
  const js = ts.transpileModule(`const click=(${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return { run: new Function(...Object.keys(dependencies), `${js}; return click;`)(...Object.values(dependencies)),
    errors, workbooks, json };
}

test("finite remaining census has nineteen central families and no blanket filename gate", () => {
  const census = methodologyDownloadCensus();
  assert.equal(census.centralSites.length, 26);
  assert.equal(remainingExportContracts.length, 19);
  assert.doesNotMatch(readFileSync("client/src/lib/producer-download.ts", "utf8"), /requireRemainingExportParent/);
  assert.doesNotMatch(readFileSync("client/src/lib/export-contract.ts", "utf8"), /requireRemainingExportParent/);
});
for (const key of ["version-diff", "affected-analyses"] as const) {
  const filename = key === "version-diff" ? "readonly-version-diff" : "affected-archived-analyses";
  test(`${key}: actual source-backed route, retained proof, actual JSX/JSON/XLSX handlers and workbook readback`, async () => {
    const f = fixture();
    await mounted(f, async base => {
      const data = await consumed(base, f), actual = props(filename, data);
      assert.equal(actual.requireDerivedParent, true);
      const rows = (actual.rows as Function)(), capture = captureDerivedConsumer(rows)!;
      assert.equal(capture.parent.scenario, READONLY_PRODUCER_SCENARIO);
      assert.deepEqual(capture.parent.orderedSnapshotHashes, [f.before.id, f.next.id]);
      assert.equal(capture.parent.codeArchiveId, contentHash(f.source));
      assert.equal(capture.parent.modelVersion, "readonly-source-comparison-1");
      assert.deepEqual(rows, deriveReadonlyConsumer(data, key).rows);
      const xlsx = actualHandler("handleClick", actual); await xlsx.run();
      assert.deepEqual(xlsx.errors, []); assert.equal(xlsx.workbooks.length, 1);
      const book = XLSX.read(xlsx.workbooks[0], { type: "buffer" });
      assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null }), rows);
      const lineage = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Derived lineage"])
        .map(row => [row.Field, JSON.parse(row.Value)]));
      await verifyDerivedConsumerWorkbook(XLSX, xlsx.workbooks[0], lineage as any);
      const js = actualHandler("handleJsonClick", actual); await js.run();
      assert.deepEqual(js.errors, []); assert.equal(js.json.length, 1);
      const document = JSON.parse(await js.json[0].text());
      assert.deepEqual(document.data, rows);
      assert.equal(document.manifest.producerIdentity, null, "Transformed rows never claim native identity");
      assert.equal(document.manifest.derivedConsumerIdentity.parent.resultId, capture.parent.resultId);
      assert.equal(document.manifest.derivedConsumerIdentity.dataIdentity.hash, (await exportDataIdentity(rows)).hash);
      assert.doesNotMatch(JSON.stringify(document), /PRIVATE PARENT SOURCE MUST NOT LEAK/);
      assert.doesNotMatch(JSON.stringify(document.data), /"source":|"approvalEvidence":|"value":/);
      const exact = await fetch(`${base}/api/analysis/results/${capture.parent.resultId}/export.json?downloadMetadata=manifest-v1`);
      assert.equal(exact.status, 200);
      const retained = await exact.json(); assert.deepEqual(retained.data, data);
      assert.equal(retained.manifest.producerIdentity.resultId, capture.parent.resultId);
      const original = XLSX.utils.sheet_to_json<any[]>(book.Sheets[book.SheetNames[0]], { header: 1 });
      book.Sheets[book.SheetNames[0]].A2.v = "changed source";
      book.Sheets[book.SheetNames[0]].A2.t = "s";
      assert.ok(original.length > 1);
      await assert.rejects(() => verifyDerivedConsumerWorkbook(XLSX,
        XLSX.write(book, { type: "buffer", bookType: "xlsx" }), lineage as any), /cells conflict/);
    });
  });
  test(`${key}: missing/cloned/unretained parents and changed parent or rows refuse actual file handlers`, async () => {
    const f = fixture();
    await mounted(f, async base => {
      const data = await consumed(base, f);
      for (const name of ["handleClick", "handleJsonClick"] as const) {
        const cloned = actualHandler(name, props(filename, structuredClone(data)));
        await cloned.run(); assert.equal(cloned.workbooks.length + cloned.json.length, 0);
        assert.match(cloned.errors[0], /retained producer parent unavailable/);
        const actual = props(filename, data), rows = (actual.rows as Function)();
        (rows[0] as any).From = "f".repeat(64);
        const changed = actualHandler(name, { ...actual, rows });
        await changed.run(); assert.equal(changed.workbooks.length + changed.json.length, 0);
        assert.match(changed.errors[0], /rows changed/);
      }
      const actual = props(filename, data), rows = (actual.rows as Function)();
      data.disclosure = "mutated"; const changed = actualHandler("handleClick", { ...actual, rows });
      await changed.run(); assert.match(changed.errors[0], /parent changed/);
    });
  });
}
test("readonly retained archive refuses missing/corrupt source, material, code and scanned-result parents", async () => {
  for (const corrupt of ["source-missing", "source-corrupt", "material", "code", "scanned-result"] as const) {
    const f = fixture(), report = replayReadonlyDiff(f.input);
    const proof = await retainReadonlyDiffProducer(f.input, report, f.store);
    if (corrupt === "source-missing") f.archives.delete(f.before.id);
    if (corrupt === "source-corrupt") f.before.chunks = [{ changed: true }];
    if (corrupt === "material") f.materials.get(proof.materialInputsId).page.nextCursor = "f".repeat(64);
    if (corrupt === "code") f.materials.delete(proof.codeArchiveId);
    if (corrupt === "scanned-result") f.results.delete(f.reference.id);
    await assert.rejects(() => f.store.loadResult(proof.resultId));
    await mounted(f, async base => {
      const response = await fetch(`${base}/api/analysis/results/${proof.resultId}/export.json`);
      assert.equal(response.status, 422);
      assert.equal(response.headers.get("Content-Disposition"), null);
      assert.equal(response.headers.get("X-Producer-Identity"), null);
    });
  }
});
test("readonly request rejects corrupt source and failed retention without publishing a producer header", async () => {
  const f = fixture(); f.before.chunks = [{ invalid: true }];
  await mounted(f, async base => {
    const response = await fetch(`${base}/api/data/version-diff?${new URLSearchParams(f.input.query)}`);
    assert.equal(response.status, 422); assert.equal(response.headers.get("X-Producer-Identity"), null);
  });
  const fresh = fixture();
  const report = replayReadonlyDiff(fresh.input);
  await assert.rejects(() => retainReadonlyDiffProducer(fresh.input, report, {
    ...fresh.store, saveMaterial: async () => "0".repeat(64),
  }), /conflicting identity/);
  await assert.rejects(() => retainReadonlyDiffProducer(fresh.input, { ...report, scannedResults: 99 }, fresh.store), /source replay/);
});
test("readonly request-bound selection refuses stale UI state; no UI source attestation upgrade", async () => {
  const f = fixture(); let selection: string | null = null;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: { getItem: (key: string) => key === selectionKey ? selection : null },
  } });
  try {
    await mounted(f, async base => {
      const data = await consumed(base, f), actual = props("readonly-version-diff", data);
      selection = JSON.stringify({ workbook: "a".repeat(64), indicators: "b".repeat(64) });
      for (const name of ["handleClick", "handleJsonClick"] as const) {
        const handler = actualHandler(name, actual); await handler.run();
        assert.equal(handler.workbooks.length + handler.json.length, 0);
        assert.match(handler.errors[0], /stale requested UI selection/);
      }
    });
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete (globalThis as any).window;
  }
});
test("unmodified ordinary non-signal outputs still export; missing bindings are disclosed, not blanket withheld", async () => {
  const handler = actualHandler("handleClick", { filename: "global-emissions-trajectory", kind: "legacy",
    sheetName: "Emissions Trajectory", rows: [{ Year: 2024, "P10 (GtCO2e)": 0,
      "Median P50 (GtCO2e)": null, "P90 (GtCO2e)": 1 }], requireDerivedParent: false });
  await handler.run(); assert.deepEqual(handler.errors, []); assert.equal(handler.workbooks.length, 1);
  const book = XLSX.read(handler.workbooks[0], { type: "buffer" });
  const manifest = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Download manifest"])
    .map(row => [row.Field, JSON.parse(row.Value)]));
  assert.equal(manifest.producerIdentity, null);
  assert.equal(manifest.derivedConsumerIdentity, undefined);
});
