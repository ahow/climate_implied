import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { economicBridgeDownloadWriters } from "../shared/economicBridgeSchema";
import { serverDownloadRegistry } from "../shared/serverDownloadRegistry";

/** Audit an exact new source writer and its closed readback chain. Merely being
 * in a named file does NOT register another writer, arbitrary Blob or URL. */
export function auditEconomicDownloadWriter(path: string, source: ts.SourceFile, call: ts.CallExpression) {
  const contract = economicBridgeDownloadWriters.find(item => item.source === path);
  assert.ok(contract, `Unregistered writer: ${path}`);
  assert.equal(call.getText(source), "URL.createObjectURL(blob)", `Unregistered writer expression in ${path}`);
  const declaration = call.parent;
  assert.ok(ts.isVariableDeclaration(declaration) && declaration.name.getText(source) === "url");
  const statement = declaration.parent.parent;
  assert.ok(ts.isVariableStatement(statement) && ts.isBlock(statement.parent));
  const statements = [...statement.parent.statements];
  const statementIndex = statements.indexOf(statement);
  assert.ok(statementIndex > 0);
  assert.equal(statements[statementIndex - 1].getText(source),
    `const blob = await ${contract.reader}(document, format);`,
    `Writer must consume the immediately preceding verified Blob, not another scope or replacement: ${path}`);
  let container: ts.Node | undefined = call.parent;
  while (container && !ts.isFunctionDeclaration(container)) container = container.parent;
  assert.ok(container && ts.isFunctionDeclaration(container) && container.name?.text === "download",
    `Writer must stay in the reviewed async download handler: ${path}`);
  const handler = container.getText(source);
  assert.ok(handler.includes(`const blob = await ${contract.reader}(document, format);`), `Missing complete bound readback: ${path}`);
  assert.ok(handler.includes(`link.download = \`${contract.filename}\`;`), `Unbound filename: ${path}`);
  assert.match(handler, /link\.href = url;/);
  assert.match(handler, /link\.click\(\);/);
  assert.match(handler, /URL\.revokeObjectURL\(url\)/);
  assert.ok(handler.indexOf(`await ${contract.reader}`) < handler.indexOf("URL.createObjectURL(blob)"));
  const panel = source.getFullText();
  assert.ok(panel.includes(`import { ${contract.reader},`), `Unbound reader import: ${path}`);
  assert.ok(panel.includes('(["json", "xlsx"] as const).map(format =>'), `Unexpected format domain: ${path}`);
  const reader = readFileSync(contract.readerSource, "utf8");
  assert.ok(reader.includes(`return ${contract.readback}(document, format, ${contract.parser});`),
    `Named reader bypasses closed readback: ${path}`);
  const readback = readFileSync(contract.readbackSource, "utf8");
  for (const fragment of [
    'const route = economicBridgeContracts[document.key].route;',
    'await apiRequest("GET", `${route}/export.${format}`)',
    "exactEconomicJson(result) !== exactEconomicJson(document)",
    'workbook.SheetNames[0] !== "Public calculation"',
    '"f" in cell || "F" in cell || "l" in cell',
    "economicBridgeCells(document).map(row => [row.pointer, row.jsonValue])",
    "exactEconomicJson(rows) !== exactEconomicJson(expected)",
  ]) assert.ok(readback.includes(fragment), `Missing exact readback guard: ${fragment}`);
  for (const format of contract.formats) assert.ok(serverDownloadRegistry.some(entry =>
    (entry.paths as readonly string[]).includes(`${contract.route}/export.${format}`)));
  return contract;
}
