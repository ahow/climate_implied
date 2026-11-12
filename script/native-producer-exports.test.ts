import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as XLSX from "xlsx";
import { nativeCandidateHandler } from "../server/nativeCandidateApi";
import { captureNativeInputs, replayNativeCandidate, verifyNativeCandidateMaterial } from "../server/snapshots/nativeCandidateProducer";
import { readCalculationSourceArtifact } from "../server/snapshots/materialInputs";
import { packAnalysisResult, unpackAnalysisResult } from "../server/snapshots/resultContract";
import { contentHash, createManifest } from "../server/calculation/analysisManifest";
import { candidateInventory, constantScenario, illustrativeScenario, projectNativeEmissions } from "../server/calculation/emissionsCandidate";
import { resolveEmissionsInputs } from "../server/calculation/emissionsInputs";
import { nativeCandidateResidualDiagnostics } from "../server/calculation/nativeThresholdDiagnostics";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { registerProducerDownloadRoutes } from "../server/producerDownload";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { deriveNativeConsumer, NATIVE_PRODUCER_SCENARIO, type NativeScenario, type NativeConsumerKey } from "../shared/nativeConsumer";
import { nativeExportRow, nativeExportBindings } from "../shared/nativeExport";
import { nativeThresholdExportRows, nativeThresholdExportBindings } from "../client/src/lib/native-threshold-export";
import { retainProducerDownload, bindProducerNativeConsumer, exactProducerDownload, captureDerivedConsumer, derivedConsumerIdentity } from "../client/src/lib/producer-download";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "../client/src/lib/download-selection";
import { selectionKey } from "../client/src/lib/analysis-selection";
import { exportNotes, prepareQualifiedJsonExport } from "../client/src/lib/export-contract";
import { exportDataIdentity } from "../client/src/lib/export-identity";
import { appendDerivedConsumerWorkbookLineage, verifyDerivedConsumerWorkbook } from "../client/src/lib/derived-consumer-workbook";
import { semanticRows, requireOutputSemantic } from "../shared/fieldSemantics";
import { bindExportColumns } from "../shared/outputFieldSemantics";
import { certifySupplementalSheetRows } from "../shared/supplementalSheetBindings";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";

/** Actual public source, inventory and engine, with isolated storage only.
 * No synthetic response, source approval, scientific fixture or public write. */
function fixture() {
  const source = readCalculationSourceArtifact();
  const materials = new Map<string, { kind: string; payload: any }>();
  const results = new Map<string, any>();
  async function loadArchive(id: string, kind: any) {
    const row = materials.get(id);
    if (!row || row.kind !== kind || contentHash(row.payload) !== id) throw new Error("Missing/corrupt actual archive parent");
    return structuredClone(row.payload);
  }
  async function loadResult(id: string) {
    const row = results.get(id);
    if (!row) throw new Error("Missing completed native result");
    const packed = unpackAnalysisResult(id, row);
    await verifyNativeCandidateMaterial(packed.manifest.settings.materialInputsId as string,
      packed.manifest, packed.result, loadArchive);
    return { ...packed, id, recordedAt: new Date().toISOString(), materialReplayState: "referenced-material-archives-verified" };
  }
  const store = {
    captureSource: async () => { materials.set(source.id, { kind: "calculation-source", payload: structuredClone(source.payload) }); return source.id; },
    saveArchive: async (kind: "native-candidate-inputs" | "native-candidate-material", payload: unknown) => {
      const id = contentHash(payload); materials.set(id, { kind, payload: structuredClone(payload) }); return id;
    },
    saveResult: async (manifest: ReturnType<typeof createManifest>, result: unknown) => {
      const packed = packAnalysisResult(manifest, result); results.set(packed.id, packed.payload); return packed.id;
    },
    loadResult,
  };
  return { source, store, materials, results, loadArchive };
}
async function mounted(f: ReturnType<typeof fixture>, run: (base: string) => Promise<void>) {
  const app = express();
  app.use(downloadManifestMiddleware());
  app.get("/api/emissions/candidate", nativeCandidateHandler(f.store));
  registerProducerDownloadRoutes(app, f.store.loadResult);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
function props(key: NativeConsumerKey, data: any, scenario: NativeScenario) {
  const source = ts.createSourceFile("candidate.tsx", readFileSync("client/src/components/emissions-candidate-review.tsx", "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let attributes: ts.JsxAttributes | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === "DownloadDataButton") {
      const filename = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === "filename")!;
      if (filename.getText(source).includes(key === "native-thresholds" ? "native-mass-five" : "native-emissions-"))
        attributes = node.attributes;
    }
    node.forEachChild(visit);
  }
  visit(source); assert.ok(attributes);
  const context = { data, scenario, nativeThresholdExportRows, nativeThresholdExportBindings, nativeExportRow,
    nativeExportBindings, bindProducerNativeConsumer, exactProducerDownload };
  return Object.fromEntries(attributes.properties.map(attr => {
    assert.ok(ts.isJsxAttribute(attr));
    const name = attr.name.getText(source);
    if (!attr.initializer) return [name, true];
    if (ts.isStringLiteral(attr.initializer)) return [name, attr.initializer.text];
    assert.ok(ts.isJsxExpression(attr.initializer));
    return [name, new Function(...Object.keys(context), `return (${attr.initializer.expression!.getText(source)});`)(...Object.values(context))];
  }));
}
function actualHandler(name: "handleClick" | "handleJsonClick", actualProps: Record<string, any>) {
  const source = ts.createSourceFile("button.tsx", readFileSync("client/src/components/download-data-button.tsx", "utf8"),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
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
    interpretationNotes: [], sheetName: "Data", fieldBindings: undefined, testId: "native-readback", ...actualProps,
    setBusy() {}, setError(error: string | null) { if (error) errors.push(error); },
    loadExportWorkbook: async () => ({ ...XLSX, writeFile(book: XLSX.WorkBook) {
      workbooks.push(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    } }), console: { error() {} }, Blob,
    URL: { createObjectURL(blob: Blob) { blobs.push(blob); return `blob:native/${blobs.length - 1}`; }, revokeObjectURL() {} },
    document: { createElement() { return { href: "", download: "", click() { json.push(blobs[Number(this.href.split("/").at(-1))]); } }; } },
  };
  const js = ts.transpileModule(`const click=(${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return { run: new Function(...Object.keys(dependencies), `${js}; return click;`)(...Object.values(dependencies)),
    errors, workbooks, json };
}
async function consumed(base: string, scenario: NativeScenario) {
  const response = await fetch(`${base}/api/emissions/candidate?scenario=${scenario}`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Producer-Binding-Status"), "retained");
  assert.ok(response.headers.get("X-Producer-Identity"));
  return retainProducerDownload(response).json();
}
for (const scenario of ["constant", "transition", "dashboard"] as const) {
  test(`${scenario}: actual native producer matches unchanged engine and retains inputs/model/seed/member/code, exact HTTP JSON`, async () => {
    const f = fixture();
    await mounted(f, async base => {
      const data = await consumed(base, scenario), inputs = resolveEmissionsInputs();
      const result = projectNativeEmissions(scenario === "dashboard" ? inputs.diagnostic : scenario === "transition" ? illustrativeScenario : constantScenario);
      assert.deepEqual(data, { promotion: "blocked-pending-calibration-and-Packages-3-4", inventory: candidateInventory(), inputs, result,
        residualDiagnostics: nativeCandidateResidualDiagnostics(result) });
      const nativeProps = props("native-trajectory", data, scenario);
      const capture = captureDerivedConsumer(nativeProps.rows)!;
      assert.ok(capture); assert.equal(capture.parent.scenario, NATIVE_PRODUCER_SCENARIO);
      const material = f.materials.get(capture.parent.materialInputsId)!.payload;
      const input = f.materials.get(material.inputArchive)!.payload;
      assert.deepEqual(input.history.map((r: any) => r.year), [2023, 2024]);
      assert.deepEqual(input.inventory, candidateInventory());
      assert.deepEqual(material.seed, { applicability: "not-applicable-deterministic-no-random-sampling", value: null });
      assert.equal(material.scenario, scenario);
      assert.equal(material.memberId, "deterministic-native-scenario-not-an-ensemble-member");
      assert.equal(capture.parent.modelVersion, result.version);
      assert.equal(capture.parent.codeArchiveId, f.source.id);
      assert.deepEqual(capture.parent.orderedSnapshotHashes, [material.inputArchive]);
      const exact = await fetch(`${base}${exactProducerDownload(data)}`);
      assert.equal(exact.status, 200);
      const retained = await exact.json();
      assert.deepEqual(retained.data, data);
      assert.equal(retained.manifest.producerIdentity.resultId, capture.parent.resultId);
    });
  });
  for (const key of ["native-thresholds", "native-trajectory"] as const) {
    test(`${scenario}/${key}: actual checked-in JSX and JSON/XLSX handlers, full metadata and decoded file readback`, async () => {
      const f = fixture();
      await mounted(f, async base => {
        const data = await consumed(base, scenario), actualProps = props(key, data, scenario);
        assert.equal(actualProps.requireDerivedParent, true);
        const replay = deriveNativeConsumer(data, key, scenario);
        assert.deepEqual(actualProps.rows, replay.rows);
        assert.ok(replay.rows.length > 0);
        assert.equal(replay.rows.length, key === "native-trajectory" ? 77 : data.residualDiagnostics.records.length);
        const json = actualHandler("handleJsonClick", actualProps);
        await json.run(); assert.deepEqual(json.errors, []); assert.equal(json.json.length, 1);
        const decoded = JSON.parse(await json.json[0].text());
        assert.deepEqual(decoded.data, replay.rows);
        assert.equal(decoded.manifest.producerIdentity, null);
        const identity = decoded.manifest.derivedConsumerIdentity;
        assert.equal(identity.parent.scenario, NATIVE_PRODUCER_SCENARIO);
        assert.equal(identity.derivation.version, "native-candidate-consumer-1");
        assert.deepEqual(identity.derivation.fields, replay.derivation.fields);
        assert.deepEqual(identity.derivation.units, replay.derivation.units);
        assert.deepEqual(identity.derivation.retainedIndices, replay.rows.map((_, i) => i));
        assert.deepEqual(identity.derivation.excludedIndices, []);
        if (key === "native-trajectory") {
          const capture = captureDerivedConsumer(actualProps.rows)!;
          assert.deepEqual(capture.chartRows, [2024, 2030, 2050, 2100].map(year => ({
            Year: year, "Reporting emissions (GtCO2e, AR6 GWP100)":
              data.result.trajectory.find((point: any) => point.year === year).reportingGtCO2e,
          })));
          assert.equal(replay.rows.length, 77, "Four-year preview never truncates export");
        }
        const xlsx = actualHandler("handleClick", actualProps);
        await xlsx.run(); assert.deepEqual(xlsx.errors, []); assert.equal(xlsx.workbooks.length, 1);
        const book = XLSX.read(xlsx.workbooks[0], { type: "buffer" });
        const lineage = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Derived lineage"])
          .map(row => [row.Field, JSON.parse(row.Value)]));
        assert.deepEqual(lineage.parent, identity.parent);
        await verifyDerivedConsumerWorkbook(XLSX, xlsx.workbooks[0], lineage as any);
        assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { defval: null }), replay.rows);
        book.Sheets[book.SheetNames[0]]["A2"].v = "tampered";
        book.Sheets[book.SheetNames[0]]["A2"].t = "s";
        await assert.rejects(verifyDerivedConsumerWorkbook(XLSX, XLSX.write(book, { type: "buffer", bookType: "xlsx" }), lineage as any), /cells conflict/);
      });
    });
  }
}
test("native captured approved-source metadata and actual consumed dashboard values are retained, never UI asserted", () => {
  runWithOverrideRows([{ indicatorKey: "renewableCapacityGW", year: 2024, value: 6000,
    source: "isolated input-context engineering test; not production approval", method: "request isolation test" }], () => {
    const input = captureNativeInputs(), result = replayNativeCandidate(input, "dashboard");
    assert.equal(input.indicatorSource.rows.length, 1);
    assert.equal(result.result.scenario.renewableCapacityGW, 6000);
    assert.equal(input.history.find(r => r.year === 2024)!.renewableCapacityGW, 6000);
    assert.equal(result.result.productionEligible, false);
    const corrupt = structuredClone(input); corrupt.history.find(r => r.year === 2024)!.renewableCapacityGW++;
    assert.throws(() => replayNativeCandidate(corrupt, "dashboard"), /source value conflict/);
  });
});
test("native missing/corrupt input, code, material and result parents refuse exact retained HTTP export", async () => {
  for (const kind of ["native-candidate-inputs", "calculation-source", "native-candidate-material", "analysis-result"]) {
    for (const fault of ["missing", "corrupt"]) {
      const f = fixture();
      await mounted(f, async base => {
        const data = await consumed(base, "transition"), url = exactProducerDownload(data)!;
        if (kind === "analysis-result") {
          const id = [...f.results.keys()][0];
          if (fault === "missing") f.results.delete(id);
          else f.results.get(id).result.result.trajectory[0].reportingGtCO2e++;
        } else {
          const [id, row] = [...f.materials].find(([, row]) => row.kind === kind)!;
          if (fault === "missing") f.materials.delete(id);
          else row.payload.corruption = "changed stored bytes";
        }
        const response = await fetch(`${base}${url}`);
        assert.equal(response.status, 422, `${kind}/${fault}`);
        assert.equal(response.headers.get("content-disposition"), null);
        assert.equal(response.headers.get("X-Producer-Identity"), null);
      });
    }
  }
});
test("native archive outage preserves actual nonempty native data and ordinary XLSX, explicitly without producer attestation", async () => {
  const f = fixture();
  f.store.captureSource = async () => { throw new Error("isolated storage outage"); };
  await mounted(f, async base => {
    const response = await fetch(`${base}/api/emissions/candidate?scenario=constant`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Producer-Binding-Status"), "unavailable-no-producer-attestation");
    assert.equal(response.headers.get("X-Producer-Identity"), null);
    const data = await retainProducerDownload(response).json();
    assert.equal(data.result.trajectory.length, 77);
    assert.equal(exactProducerDownload(data), null);
    const actualProps = props("native-trajectory", data, "constant");
    assert.equal(actualProps.requireDerivedParent, false);
    assert.equal(captureDerivedConsumer(actualProps.rows), null);
    const handler = actualHandler("handleClick", actualProps);
    await handler.run(); assert.deepEqual(handler.errors, []); assert.equal(handler.workbooks.length, 1);
    const book = XLSX.read(handler.workbooks[0], { type: "buffer" });
    assert.equal(book.SheetNames.includes("Derived lineage"), false);
    assert.equal(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]).length, 77);
  });
});
test("native changed parent/rows, wrong selected scenario, clones and stale request selection cannot obtain or reuse producer claims", async () => {
  const f = fixture();
  await mounted(f, async base => {
    for (const key of ["native-trajectory", "native-thresholds"] as const) {
      const data = await consumed(base, "constant"), actualProps = props(key, data, "constant");
      assert.throws(() => props(key, data, "transition"), /matching conditional candidate/);
      const clone = props(key, structuredClone(data), "constant");
      assert.equal(clone.requireDerivedParent, false);
      assert.equal(captureDerivedConsumer(clone.rows), null);
      for (const name of ["handleClick", "handleJsonClick"] as const) {
        const missing = actualHandler(name, { ...clone, requireDerivedParent: true });
        await missing.run(); assert.equal(missing.workbooks.length + missing.json.length, 0);
        assert.match(missing.errors[0], /required retained producer parent/);
      }
      actualProps.rows[0][Object.keys(actualProps.rows[0])[0]] = "changed";
      assert.throws(() => captureDerivedConsumer(actualProps.rows), /rows or exact replay changed/);
      const clean = props(key, data, "constant");
      data.inputs.indicatorYear = 2099;
      assert.throws(() => captureDerivedConsumer(clean.rows), /parent missing, changed or conflicting/);
    }
    const data = await consumed(base, "dashboard"), actualProps = props("native-trajectory", data, "dashboard");
    const original = (globalThis as any).window;
    (globalThis as any).window = { sessionStorage: { getItem: (key: string) => key === selectionKey ?
      JSON.stringify({ workbook: "a".repeat(64), indicators: "b".repeat(64) }) : null } };
    try { assert.throws(() => captureDerivedConsumer(actualProps.rows), /stale requested input selection/); }
    finally { if (original === undefined) delete (globalThis as any).window; else (globalThis as any).window = original; }
  });
});
test("native validly rehashed stale engine/model/scenario/member/seed/source records cannot authenticate a retained result", async () => {
  const f = fixture();
  await mounted(f, async base => {
    const data = await consumed(base, "dashboard"), capture = captureDerivedConsumer(props("native-trajectory", data, "dashboard").rows)!;
    const original = f.materials.get(capture.parent.materialInputsId)!.payload;
    const packed = f.results.get(capture.parent.resultId);
    for (const version of ["native-emissions-candidate-1", "native-emissions-candidate-2"]) {
      const oldResponse = structuredClone(data);
      oldResponse.result.version = version;
      assert.throws(() => deriveNativeConsumer(oldResponse, "native-trajectory", "dashboard"),
        /actual matching conditional candidate response/);
      const material = { ...original, modelVersion: version };
      const id = contentHash(material);
      f.materials.set(id, { kind: "native-candidate-material", payload: material });
      await assert.rejects(verifyNativeCandidateMaterial(id,
        { ...packed.manifest, modelVersion: version }, packed.result, f.loadArchive), /conflict/);
    }
    for (const field of ["modelVersion", "scenario", "memberId", "seed", "endYear"]) {
      const material = structuredClone(original);
      material[field] = field === "seed" ? { applicability: "random", value: 123 } : field === "endYear" ? 2050 : "invented";
      const id = contentHash(material); f.materials.set(id, { kind: "native-candidate-material", payload: material });
      await assert.rejects(verifyNativeCandidateMaterial(id, packed.manifest, packed.result, f.loadArchive), /conflict/);
    }
    for (const path of ["server/calculation/emissionsCandidate.ts", "server/calculation/nativeMechanisms.ts"]) {
      const code: any = structuredClone(f.source.payload);
      assert.equal(typeof code.files[path], "string", `Missing captured engine dependency: ${path}`);
      code.files[path] += "\n// stale but rehashed\n";
      const codeId = contentHash(code); f.materials.set(codeId, { kind: "calculation-source", payload: code });
      const material = { ...original, sourceArchive: codeId }, materialId = contentHash(material);
      f.materials.set(materialId, { kind: "native-candidate-material", payload: material });
      await assert.rejects(verifyNativeCandidateMaterial(materialId,
        { ...packed.manifest, codeVersion: codeId }, packed.result, f.loadArchive), /archived engine differs/);
    }
  });
});
