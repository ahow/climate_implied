import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import * as XLSX from "xlsx";
import { exportContracts, exportNotes, type ExportKind } from "../client/src/lib/export-contract";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
}

test("every client download declares a valid evidence contract; no alternate writer bypasses it", () => {
  let count = 0;
  let readonlyDiffSites = 0;
  for (const path of files("client/src")) {
    const text = readFileSync(path, "utf8");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node: ts.Node) {
      if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        ["DownloadDataButton", "DownloadJsonButton"].includes(node.tagName.getText(source))) {
        count++;
        if (path === "client/src/components/readonly-version-diff.tsx") readonlyDiffSites++;
        const kind = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(source) === "kind");
        assert.ok(kind && ts.isJsxAttribute(kind) && kind.initializer && ts.isStringLiteral(kind.initializer), path);
        assert.ok(Object.hasOwn(exportContracts, kind.initializer.text), path);
      }
      if (ts.isCallExpression(node) && /(?:writeFile|writeFileXLSX|saveAs|createObjectURL)$/.test(node.expression.getText(source))) {
        assert.equal(path, "client/src/components/download-data-button.tsx", `Unregistered writer: ${path}`);
      }
      node.forEachChild(visit);
    }
    visit(source);
  }
  assert.equal(readonlyDiffSites, 2, "Exactly two new reviewed count/hash and affected-manifest export sites");
  assert.equal(count, 26, "Prior24 reviewed export sites plus2 explicit read-only diff/affected-analysis spreadsheet sites; no alternate writer");
});

test("interpretation survives XLSX serialization with missingness and exact data unchanged", () => {
  for (const kind of Object.keys(exportContracts) as ExportKind[]) {
    const notes = exportNotes(kind, "example", "2026-11-09T00:00:00Z");
    const wb = XLSX.utils.book_new();
    const rows = [{ year: 2024, value: 0 }, { year: 2025, value: null }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Data");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notes), "Interpretation");
    const restored = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets.Interpretation), notes);
    assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets.Data, { defval: null }), rows);
    assert.match(JSON.stringify(notes), /not an immutable analysis archive/);
  }
  assert.match(JSON.stringify(exportNotes("legacy", "x", "now")), /not regional temperatures/);
  assert.throws(() => exportNotes("unknown" as ExportKind, "x", "now"));
});
