import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { createManifest, contentHash, canonicalJson } from "../server/calculation/analysisManifest";
import { packAnalysisResult } from "../server/snapshots/resultContract";
import { retainedProducerPaths } from "../server/producerDownload";
import { captureProspectiveResultXlsx, readProspectiveResultXlsx } from "../server/snapshots/prospectiveResultExport";

/** Explicit synthetic private engineering fixtures, never installed/public
 * archives or a claimed operator review. Tests exercise the pure dependency API. */
function retained(path: string, result: unknown = [{ year: 2024, zero: 0, missing: null }]) {
  const manifest = createManifest({
    codeVersion: "a".repeat(64), modelVersion: "engineering-only",
    snapshotHashes: ["b".repeat(64), "c".repeat(64)],
    scenario: `descriptive-valuation:${path.slice("/api/cv".length)}`,
    settings: { materialInputsId: "d".repeat(64), privateSettingsMustNotBeExported: "hidden-test-settings" },
  });
  const packed = packAnalysisResult(manifest, result);
  return { ...packed.payload, id: packed.id, materialReplayState: "referenced-material-archives-verified" };
}
function loader(parent: ReturnType<typeof retained>) {
  return async (id: string) => {
    if (id !== parent.id) throw new Error("Missing retained parent");
    return structuredClone(parent);
  };
}
function cells(bytes: Buffer) {
  const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
  return Object.fromEntries(workbook.SheetNames.map(name => [name,
    XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: null, raw: true })]));
}

test("all nine retained producers capture NEW lossless JSON-chunk XLSX with exact parent/code/material/sheet/binary association", async () => {
  for (const path of retainedProducerPaths) {
    const parent = retained(path), before = contentHash(parent);
    const start = Date.now();
    const captured = await captureProspectiveResultXlsx(parent.id, loader(parent));
    assert.ok(Date.parse(captured.record.capturedAt) >= start);
    assert.ok(Date.parse(captured.record.capturedAt) <= Date.now());
    assert.equal(captured.record.originalHistoricalExport, false);
    assert.equal(captured.record.parent.resultId, parent.id);
    assert.equal(captured.record.parent.manifestId, parent.manifest.id);
    assert.equal(captured.record.parent.codeArchiveId, parent.manifest.codeVersion);
    assert.equal(captured.record.parent.materialInputsId, parent.manifest.settings.materialInputsId);
    assert.equal(captured.record.binarySha256, createHash("sha256").update(captured.bytes).digest("hex"));
    assert.equal(captured.record.parent.resultHash, contentHash(parent.result));
    assert.equal(captured.id, contentHash(captured.record));
    assert.equal(contentHash(parent), before, "Existing parent record remains immutable");
    const decoded = cells(captured.bytes);
    assert.deepEqual(Object.keys(decoded), ["Data", "Identity"]);
    assert.equal(decoded.Data.slice(1).map(row => row[1]).join(""), canonicalJson(parent.result));
    assert.ok(!canonicalJson(decoded).includes("hidden-test-settings"));
    assert.deepEqual((await readProspectiveResultXlsx(captured.id, captured.record, captured.bytes,
      parent.id, loader(parent))).bytes, captured.bytes);
  }
});

test("isolated private file roundtrip preserves original captured bytes and detects subsequent disk corruption without regeneration", async () => {
  const root = await mkdtemp(join(tmpdir(), "prospective-private-export-"));
  try {
    const parent = retained(retainedProducerPaths[0], { text: "😀".repeat(19000), zero: 0, absent: null });
    const captured = await captureProspectiveResultXlsx(parent.id, loader(parent));
    const metadata = join(root, `${captured.id}.json`), binary = join(root, `${captured.id}.xlsx`);
    await writeFile(metadata, JSON.stringify(captured.record), { flag: "wx", mode: 0o600 });
    await writeFile(binary, captured.bytes, { flag: "wx", mode: 0o600 });
    assert.equal((await stat(root)).mode & 0o777, 0o700);
    assert.equal((await stat(binary)).mode & 0o777, 0o600);
    const loaded = await readProspectiveResultXlsx(captured.id, JSON.parse(await readFile(metadata, "utf8")),
      await readFile(binary), parent.id, loader(parent));
    assert.ok(loaded.bytes.equals(captured.bytes));
    assert.ok(cells(loaded.bytes).Data.length > 2, "Unicode-safe bounded multi-cell chunks read back losslessly");
    const corrupt = Buffer.from(await readFile(binary)); corrupt[100] ^= 1;
    await writeFile(binary, corrupt);
    await assert.rejects(() => readProspectiveResultXlsx(captured.id, captured.record,
      corrupt, parent.id, loader(parent)), /corrupt/);
    await rm(binary);
    await assert.rejects(() => readFile(binary), /ENOENT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("reader refuses missing bytes/dependencies, corrupt records, wrong parents and unknown versions; never installs or upgrades", async () => {
  const parent = retained(retainedProducerPaths[0]), other = retained(retainedProducerPaths[1]);
  const captured = await captureProspectiveResultXlsx(parent.id, loader(parent));
  const read = (id = captured.id, record: unknown = captured.record, bytes = captured.bytes,
    expected = parent.id, load = loader(parent)) => readProspectiveResultXlsx(id, record, bytes, expected, load);
  await assert.rejects(() => read(captured.id, captured.record, Buffer.alloc(0)), /corrupt/);
  await assert.rejects(() => readProspectiveResultXlsx(captured.id, undefined, captured.bytes, parent.id, loader(parent)));
  await assert.rejects(() => read("e".repeat(64)), /identity/);
  await assert.rejects(() => read(captured.id, captured.record, captured.bytes, other.id), /parent/);
  await assert.rejects(() => read(captured.id, { ...captured.record, version: "unknown-version" }));
  await assert.rejects(() => read(captured.id, captured.record, captured.bytes, parent.id, loader(other)), /Missing/);
  await assert.rejects(() => captureProspectiveResultXlsx("../../private.xlsx", loader(parent)));
  const legacy = { ...parent, materialReplayState: "legacy-result-without-material-bundle" };
  await assert.rejects(() => captureProspectiveResultXlsx(parent.id, async () => legacy), /binding unavailable/);
  const wrongMaterial = { ...captured.record, parent: { ...captured.record.parent, materialInputsId: "f".repeat(64) } };
  await assert.rejects(() => read(contentHash(wrongMaterial), wrongMaterial), /dependency/);
});

test("rehashed tampered worksheets, chunk order, extra sheets and embedded identity still refuse exact same-parent readback", async () => {
  const parent = retained(retainedProducerPaths[0], { values: [0, null, -2], text: "x".repeat(18000) });
  const captured = await captureProspectiveResultXlsx(parent.id, loader(parent));
  const mutate = async (change: (book: XLSX.WorkBook) => void) => {
    const book = XLSX.read(Buffer.from(captured.bytes), { type: "buffer" });
    change(book);
    const bytes: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    const record = { ...captured.record, binarySha256: createHash("sha256").update(bytes).digest("hex"),
      byteLength: bytes.length };
    if (book.SheetNames.length === 2) record.cellsHash = contentHash(cells(bytes));
    await assert.rejects(() => readProspectiveResultXlsx(contentHash(record), record, bytes, parent.id, loader(parent)));
  };
  await mutate(book => { book.Sheets.Data.B2.v = "changed output"; });
  await mutate(book => { book.Sheets.Data.A2.v = `${parent.manifest.scenario}#7`; });
  await mutate(book => { book.Sheets.Identity.B2.v = JSON.stringify("forged-contract"); });
  await mutate(book => { XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["unapproved"]]), "Extra"); });
});
