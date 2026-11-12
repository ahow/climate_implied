import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import * as XLSX from "xlsx";
import { createManifest, contentHash } from "../server/calculation/analysisManifest";
import { packAnalysisResult } from "../server/snapshots/resultContract";
import { verifiedProducer } from "../server/producerDownload";
import { consumerCanonicalJson, deriveValuationPE, valuationPEDerivations, type ValuationPEDerivation } from "../shared/derivedConsumer";
import { retainProducerDownload, deriveProducerValuationPE, captureDerivedConsumer, derivedConsumerIdentity } from "../client/src/lib/producer-download";
import { appendDerivedConsumerWorkbookLineage, verifyDerivedConsumerWorkbook } from "../client/src/lib/derived-consumer-workbook";
import { exportDataIdentity } from "../client/src/lib/export-identity";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "../client/src/lib/download-selection";
import { exportNotes } from "../client/src/lib/export-contract";
import { semanticRows, requireOutputSemantic } from "../shared/fieldSemantics";
import { bindExportColumns, bindNestedOutput } from "../shared/outputFieldSemantics";
import { certifySupplementalSheetRows } from "../shared/supplementalSheetBindings";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";
import { certifyFiniteExport, finiteExportBindings } from "../shared/finiteExportSchemas";

/** Isolated engineering-only fixture. Real current public P/E producers were
 * read first and returned empty arrays; these values never enter production. */
function fixture(key: ValuationPEDerivation, seed: number) {
  const spec = valuationPEDerivations[key];
  const result = [
    { date: "2025-03-31T00:00:00.000Z", [spec.high]: 12.345, [spec.low]: 0,
      [spec.highCount]: 7, [spec.lowCount]: 0 },
    { date: null, [spec.high]: 19, [spec.low]: 4 },
    { date: "2024-12-31T23:59:59.000Z", [spec.high]: null, [spec.low]: -2.126,
      [spec.highCount]: null, [spec.lowCount]: 2 },
    { date: "2025-03-31T00:00:00.000Z", [spec.high]: 12.345, [spec.low]: 0,
      [spec.highCount]: 7, [spec.lowCount]: 0 },
  ];
  const manifest = createManifest({ codeVersion: "a".repeat(64), modelVersion: "isolated-engineering-only",
    snapshotHashes: [String(seed).repeat(64), "b".repeat(64)], scenario: spec.scenario,
    settings: { materialInputsId: "d".repeat(64), seed } });
  const packed = packAnalysisResult(manifest, result);
  return { ...packed.payload, id: packed.id, materialReplayState: "referenced-material-archives-verified" };
}
async function consume(parent: ReturnType<typeof fixture>) {
  const proof = verifiedProducer(parent.id, parent, parent.result);
  return retainProducerDownload(new Response(JSON.stringify(parent.result), {
    headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") },
  })).json();
}
/** Extract the checked-in central writer's real click handler. Only final
 * browser writeFile and state setters are substituted; bytes are real XLSX. */
function actualClick(rows: unknown[], key: ValuationPEDerivation, deliver: (bytes: Buffer) => void) {
  const path = "client/src/components/download-data-button.tsx";
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleClick")
      expression = node.initializer!.getText(source);
    node.forEachChild(visit);
  }
  visit(source); assert.ok(expression);
  const errors: unknown[] = [];
  const dependencies = {
    captureDownloadSelection, requireUnchangedDownloadSelection, captureDerivedConsumer, derivedConsumerIdentity,
    appendDerivedConsumerWorkbookLineage, exportDataIdentity, exportNotes, semanticRows, requireOutputSemantic,
    bindExportColumns, certifySupplementalSheetRows, createDownloadManifest, downloadManifestRows,
    setBusy() {}, setError(error: unknown) { errors.push(error); },
    kind: "valuation", filename: `engineering-only-${key}`, sheetName: "P-E Ratio", rows,
    interpretationNotes: [{ Field: "Engineering boundary", Value: "Not scientific acceptance or data approval" }],
    fieldBindings: finiteExportBindings("valuationPE", { case: key }),
    loadExportWorkbook: async () => ({ ...XLSX, writeFile(book: XLSX.WorkBook) {
      deliver(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    } }),
    console: { error() {} },
  };
  const js = ts.transpileModule(`const click=(${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const click = new Function(...Object.keys(dependencies), `${js}; return click;`)(...Object.values(dependencies));
  return { click, errors };
}
function lineage(bytes: Buffer) {
  const book = XLSX.read(Buffer.from(bytes), { type: "buffer" });
  return Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Derived lineage"])
    .map(row => [row.Field, JSON.parse(row.Value)]));
}

test("closed P/E registry preserves exact filter/index/order/unit/rounding/missingness, not fabricated science", () => {
  for (const key of Object.keys(valuationPEDerivations) as ValuationPEDerivation[]) {
    const parent = fixture(key, 1), result = deriveValuationPE(parent.result, key);
    assert.deepEqual(result.derivation.retainedIndices, [0, 2, 3]);
    assert.deepEqual(result.derivation.excludedIndices, [1]);
    assert.equal(result.rows.length, 3);
    assert.deepEqual(Object.values(result.rows[0]), ["Mar 31, 2025", 12.35, 0]);
    assert.deepEqual(Object.values(result.rows[1]), ["Dec 31, 2024", null, -2.13]);
    assert.deepEqual(result.rows[0], result.rows[2], "Duplicate dates/rows preserved");
    assert.equal(result.chartRows[0][key === "ambition" ? "bestCount" : "cleanCount"], 7);
    assert.equal(result.chartRows[0][key === "ambition" ? "worstCount" : "dirtyCount"], 0);
    assert.ok(Object.values(result.derivation.units).includes("dimensionless multiple (x)"));
    assert.throws(() => deriveValuationPE(parent.result, "submitted-formula" as any));
    assert.throws(() => deriveValuationPE(null, key));
  }
});

test("all three production P/E downloads execute actual writer and read back exact parent/derivation/custom metadata cells", async () => {
  for (const key of Object.keys(valuationPEDerivations) as ValuationPEDerivation[]) {
    const parent = fixture(key, 1), source = await consume(parent);
    const derived = deriveProducerValuationPE(source, key);
    const rows = certifyFiniteExport("valuationPE", derived.rows, { case: key });
    const before = contentHash(parent);
    let bytes!: Buffer;
    const handler = actualClick(rows, key, output => { bytes = output; });
    await handler.click();
    assert.deepEqual(handler.errors, [null]); assert.ok(bytes.length > 0);
    const expected = lineage(bytes) as any;
    assert.ok(bindNestedOutput("derivedConsumer", expected).every(field =>
      field.scope.includes("No original cohort closure") && field.unit && field.formula));
    const readback = await verifyDerivedConsumerWorkbook(XLSX, bytes, expected);
    assert.equal(expected.parent.resultId, parent.id);
    assert.equal(expected.parent.resultHash, contentHash(parent.result));
    assert.equal(expected.parent.materialInputsId, parent.manifest.settings.materialInputsId);
    assert.equal(expected.parent.codeArchiveId, parent.manifest.codeVersion);
    assert.deepEqual(expected.parent.orderedSnapshotHashes, parent.manifest.snapshotHashes);
    assert.equal(expected.derivationHash, contentHash(derived.derivation));
    assert.equal(expected.chartIdentity.hash, contentHash(derived.derivation.retainedIndices.map(index =>
      Object.fromEntries(Object.entries(derived.chartRows[index]).map(([field, value]) => [field, value ?? null])))));
    assert.equal(expected.dataIdentity.hash, (await exportDataIdentity(rows)).hash);
    assert.equal(expected.originalHistoricalExport, false);
    assert.equal(expected.scientificAcceptance, false);
    assert.equal(contentHash(parent), before);
    const manifest = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(
      readback.book.Sheets["Download manifest"]).map(row => [row.Field, JSON.parse(row.Value)]));
    assert.equal(manifest.producerIdentity, null, "Derived rows are not native result bytes");
    assert.equal(manifest.derivedConsumerIdentity.parent.resultId, parent.id);
    assert.deepEqual(expected.sheets.map((s: any) => s.name),
      ["P-E Ratio", "Interpretation", "Field semantics", "Column bindings", "Download manifest"]);
    assert.equal(createHash("sha256").update(bytes).digest("hex").length, 64);
    // Check against the trusted capture, not metadata read out of the file itself.
    const captured = captureDerivedConsumer(rows)!;
    const trusted = await derivedConsumerIdentity(captured, rows);
    assert.deepEqual(expected.parent, trusted!.parent);
    assert.deepEqual(expected.derivation, trusted!.derivation);
    const book = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    book.Sheets["P-E Ratio"].B2.v = 999;
    await assert.rejects(() => verifyDerivedConsumerWorkbook(XLSX,
      XLSX.write(book, { type: "array", bookType: "xlsx" }), expected), /cells conflict/);
    book.SheetNames.reverse();
    await assert.rejects(() => verifyDerivedConsumerWorkbook(XLSX,
      XLSX.write(book, { type: "array", bookType: "xlsx" }), expected), /sheet order/);
    for (const name of ["Interpretation", "Field semantics", "Column bindings", "Download manifest"]) {
      const metadata = XLSX.read(Buffer.from(bytes), { type: "buffer" });
      metadata.Sheets[name].B2.v = "tampered metadata";
      await assert.rejects(() => verifyDerivedConsumerWorkbook(XLSX,
        XLSX.write(metadata, { type: "array", bookType: "xlsx" }), expected), /cells conflict/);
    }
    const duplicate = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    XLSX.utils.sheet_add_aoa(duplicate.Sheets["Derived lineage"],
      [["version", JSON.stringify(expected.version)]], { origin: -1 });
    await assert.rejects(() => verifyDerivedConsumerWorkbook(XLSX,
      XLSX.write(duplicate, { type: "array", bookType: "xlsx" }), expected), /lineage cells conflict/);
    const otherParent = { ...expected, parent: { ...expected.parent, resultId: "f".repeat(64) } };
    await assert.rejects(() => verifyDerivedConsumerWorkbook(XLSX, bytes, otherParent), /lineage/);
  }
});

test("concurrent A/B/current identical values retain distinct source identities; no global current proof or UI fallback", async () => {
  const parents = [fixture("carbon", 1), fixture("carbon", 2), fixture("carbon", 3)];
  const sources = await Promise.all(parents.map(consume));
  const outputs = await Promise.all(sources.map(async (source, index) => {
    const result = deriveProducerValuationPE(source, "carbon");
    await new Promise(resolve => setTimeout(resolve, (2 - index) * 10));
    let bytes!: Buffer;
    await actualClick(result.rows, "carbon", output => { bytes = output; }).click();
    return lineage(bytes);
  }));
  outputs.forEach((output, index) => {
    assert.equal(output.parent.resultId, parents[index].id);
    assert.deepEqual(output.parent.orderedSnapshotHashes, parents[index].manifest.snapshotHashes);
    assert.equal(output.parent.resultHash, contentHash(parents[index].result));
  });
  assert.equal(new Set(outputs.map(output => output.parent.resultId)).size, 3);
  assert.equal(new Set(outputs.map(output => output.dataIdentity.hash)).size, 1);
  const ordinary = deriveProducerValuationPE(structuredClone(sources[0]), "carbon").rows;
  assert.equal(captureDerivedConsumer(ordinary), null);
  assert.equal(captureDerivedConsumer({ resultId: parents[0].id }), null);
});

test("forged captures, swapped scenarios, source/output changes, conflicting body hashes and malformed headers refuse", async () => {
  const parent = fixture("carbon", 1), source = await consume(parent);
  const rows = deriveProducerValuationPE(source, "carbon").rows;
  assert.equal(captureDerivedConsumer(structuredClone(rows)), null);
  const captured = captureDerivedConsumer(rows)!;
  await assert.rejects(() => derivedConsumerIdentity(structuredClone(captured), rows), /caller attestation/);
  captured.parent.resultId = "f".repeat(64);
  await assert.rejects(() => derivedConsumerIdentity(captured, rows), /caller attestation/);
  assert.throws(() => deriveProducerValuationPE(source, "sdg"), /scenario conflicts/);
  rows[0].Date = "altered";
  assert.throws(() => captureDerivedConsumer(rows), /rows changed/);
  const changed = await consume(parent);
  changed[0].date = "2020-01-01";
  assert.throws(() => deriveProducerValuationPE(changed, "carbon"), /parent changed/);
  const proof = verifiedProducer(parent.id, parent, parent.result);
  await assert.rejects(() => retainProducerDownload(new Response("[]", {
    headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") },
  })).json(), /hash conflicts/);
  assert.throws(() => retainProducerDownload(new Response("[]", {
    headers: { "X-Producer-Identity": Buffer.from(JSON.stringify({ ...proof, codeArchiveId: null })).toString("base64url") },
  })), /Invalid/);
  assert.equal(consumerCanonicalJson([]), "[]");
});
