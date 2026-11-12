import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as XLSX from "xlsx";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "../client/src/lib/download-selection";
import { exportDataIdentity, exportJsonIdentity } from "../client/src/lib/export-identity";
import { exportNotes } from "../client/src/lib/export-contract";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";
import { semanticRows, requireOutputSemantic } from "../shared/fieldSemantics";
import { bindExportColumns } from "../shared/outputFieldSemantics";
import { certifySupplementalSheetRows } from "../shared/supplementalSheetBindings";
import { captureDerivedConsumer, derivedConsumerIdentity } from "../client/src/lib/producer-download";
import { appendDerivedConsumerWorkbookLineage } from "../client/src/lib/derived-consumer-workbook";

/** Execute the checked-in handler/preparer bodies, not a rewritten test model.
 * Only slow package/hash boundaries and final browser delivery are instrumented. */
function actual(path: string, name: string, dependencies: Record<string, unknown>) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) expression = node.getText(source).replace(/^export\s+/, "");
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) expression = node.initializer.getText(source);
    node.forEachChild(visit);
  }
  visit(source); assert.ok(expression, `${path}#${name}`);
  const js = ts.transpileModule(`const value=(${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(dependencies), `${js}; return value;`)(...Object.values(dependencies));
}
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
const selection = { workbook: "a".repeat(64), indicators: "b".repeat(64),
  overlays: ["c".repeat(64), "d".repeat(64)], asOf: "2024-12-31" };
function browserSelection(initial: unknown) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  let raw = initial === null ? null : JSON.stringify(initial);
  Object.defineProperty(globalThis, "window", { configurable: true,
    value: { sessionStorage: { getItem: () => raw } } });
  return { set(value: unknown) { raw = value === null ? null : JSON.stringify(value); },
    restore() { if (previous) Object.defineProperty(globalThis, "window", previous); else delete (globalThis as any).window; } };
}
const sharedDependencies = {
  captureDownloadSelection, requireUnchangedDownloadSelection, exportDataIdentity, exportNotes,
  semanticRows, requireOutputSemantic, bindExportColumns, certifySupplementalSheetRows,
  createDownloadManifest, downloadManifestRows,
  captureDerivedConsumer, derivedConsumerIdentity, appendDerivedConsumerWorkbookLineage,
};
const componentPath = "client/src/components/download-data-button.tsx";

test("actual XLSX click snapshots UI selection, lazy rows, notes and bindings before asynchronous package/hash preparation", async () => {
  const browser = browserSelection(selection), slowPackage = gate(), started = gate();
  const rows = [{ Year: 2024 }], notes = [{ Field: "Source note", Value: "captured note" }];
  const bindings = { Year: { id: "indicator.year", transform: "Identity" } };
  const writes: { book: XLSX.WorkBook; name: string }[] = [], errors: unknown[] = [];
  const click = actual(componentPath, "handleClick", { ...sharedDependencies,
    setBusy() {}, setError(value: unknown) { errors.push(value); },
    kind: "indicators", filename: "engineering-snapshot", sheetName: "Data", rows: () => rows,
    interpretationNotes: notes, fieldBindings: bindings,
    loadExportWorkbook: async () => { started.release(); await slowPackage.promise;
      return { ...XLSX, writeFile(book: XLSX.WorkBook, name: string) { writes.push({ book, name }); } }; },
  });
  try {
    const pending = click(); await started.promise;
    rows[0].Year = 9999; notes[0].Value = "late mutation"; bindings.Year.id = "invalid-late-binding";
    slowPackage.release(); await pending;
    assert.equal(writes.length, 1); assert.deepEqual(errors, [null]);
    const book = XLSX.read(XLSX.write(writes[0].book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets.Data), [{ Year: 2024 }]);
    const manifest = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Download manifest"])
      .map(row => [row.Field, JSON.parse(row.Value)]));
    assert.deepEqual(manifest.requestedUiSelection, selection);
    assert.equal(manifest.producerIdentity, null);
    assert.equal(manifest.columnBindings.Year.id, "indicator.year");
    assert.match(manifest.selectionBoundary, /NOT certified input\/model\/run identity/);
    const interpretation = XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets.Interpretation);
    assert.equal(interpretation.find(row => row.Field === "Source note")!.Value, "captured note");
    assert.match(interpretation[0].Field, /Requested UI selection/);
  } finally { slowPackage.release(); browser.restore(); }
});

test("actual XLSX async hash flow refuses changed, cleared, newly selected, reordered or malformed UI selection before file delivery", async () => {
  for (const [before, after] of [
    [selection, { ...selection, workbook: "e".repeat(64) }], [selection, null], [null, selection],
    [selection, { ...selection, overlays: [...selection.overlays].reverse() }], [selection, { broken: true }],
  ]) {
    const browser = browserSelection(before), slowHash = gate(), started = gate();
    let writes = 0; const errors: unknown[] = [];
    const click = actual(componentPath, "handleClick", { ...sharedDependencies,
      setBusy() {}, setError(value: unknown) { errors.push(value); },
      kind: "indicators", filename: "engineering-refused", sheetName: "Data", rows: [{ Year: 2024 }],
      interpretationNotes: [], fieldBindings: { Year: { id: "indicator.year", transform: "Identity" } },
      loadExportWorkbook: async () => ({ ...XLSX, writeFile() { writes++; } }),
      exportDataIdentity: async (rows: Record<string, unknown>[]) => {
        const identity = await exportDataIdentity(rows); started.release(); await slowHash.promise; return identity;
      },
      console: { error() {} },
    });
    try {
      const pending = click(); await started.promise;
      browser.set(after); slowHash.release(); await pending;
      assert.equal(writes, 0);
      assert.ok(errors.some(value => typeof value === "string" && /No completed download was produced/.test(value)));
      if (!(after && "broken" in after)) assert.ok(errors.some(value => typeof value === "string" && /selection changed/.test(value)));
    } finally { slowHash.release(); browser.restore(); }
  }
});

for (const changed of [false, true]) test(`actual JSON handler and preparer ${changed ? "refuse selection changes before URL allocation" : "snapshot payload/UI before digest and deliver only unchanged requested state"}`, async () => {
  const browser = browserSelection(selection), slowHash = gate(), started = gate();
  const payload = { sourceIdentity: "not-certified-by-ui-state", nested: { value: 0 } };
  const errors: unknown[] = [], blobs: Blob[] = []; let clicks = 0, revoked = 0;
  const prepare = actual("client/src/lib/export-contract.ts", "prepareQualifiedJsonExport", {
    captureDownloadSelection, createDownloadManifest, exportNotes,
    exportJsonIdentity: async (data: unknown) => {
      started.release(); await slowHash.promise; return exportJsonIdentity(data);
    },
  });
  const click = actual(componentPath, "download", { ...sharedDependencies,
    setBusy() {}, setError(value: unknown) { errors.push(value); }, payload,
    kind: "indicators", filename: "engineering.json", validatePayload: (data: unknown) => data,
    prepareQualifiedJsonExport: prepare,
    URL: { createObjectURL(blob: Blob) { blobs.push(blob); return "blob:engineering"; }, revokeObjectURL() { revoked++; } },
    document: { createElement() { return { href: "", download: "", click() { clicks++; } }; } },
  });
  try {
    const pending = click(); await started.promise;
    payload.nested.value = 9999;
    if (changed) browser.set({ ...selection, indicators: "f".repeat(64) });
    slowHash.release(); await pending;
    if (changed) {
      assert.equal(blobs.length, 0); assert.equal(clicks, 0); assert.equal(revoked, 0);
      assert.ok(errors.some(value => typeof value === "string" && /selection changed/.test(value)));
    } else {
      assert.equal(blobs.length, 1); assert.equal(clicks, 1); assert.equal(revoked, 1);
      const document = JSON.parse(await blobs[0].text());
      assert.deepEqual(document.data, { sourceIdentity: "not-certified-by-ui-state", nested: { value: 0 } });
      assert.deepEqual(document.manifest.requestedUiSelection, selection);
      assert.equal(document.manifest.producerIdentity, null);
      assert.equal(document.manifest.requestContext, null);
      assert.equal(document.dataIdentity.hash, (await exportJsonIdentity(document.data)).hash);
      assert.match(document.interpretation[0].Value, /NOT certified input\/model\/run identity/);
    }
  } finally { slowHash.release(); browser.restore(); }
});

test("actual JSON handler rechecks immediately before anchor delivery and revokes an allocated URL on refusal", async () => {
  const browser = browserSelection(selection), errors: unknown[] = [];
  let allocations = 0, clicks = 0, revoked = 0;
  const prepare = actual("client/src/lib/export-contract.ts", "prepareQualifiedJsonExport", {
    captureDownloadSelection, createDownloadManifest, exportNotes, exportJsonIdentity,
  });
  const click = actual(componentPath, "download", { ...sharedDependencies,
    setBusy() {}, setError(value: unknown) { errors.push(value); }, payload: { value: 0 },
    kind: "indicators", filename: "engineering.json", validatePayload: (data: unknown) => data,
    prepareQualifiedJsonExport: prepare,
    URL: { createObjectURL() { allocations++; browser.set(null); return "blob:engineering"; }, revokeObjectURL() { revoked++; } },
    document: { createElement() { return { href: "", download: "", click() { clicks++; } }; } },
  });
  try {
    await click(); assert.equal(allocations, 1); assert.equal(clicks, 0); assert.equal(revoked, 1);
    assert.ok(errors.some(value => typeof value === "string" && /selection changed/.test(value)));
  } finally { browser.restore(); }
});
