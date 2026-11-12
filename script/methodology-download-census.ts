import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import { serverDownloadRegistry } from "../shared/serverDownloadRegistry";

function files(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(root, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(root, entry.name)] : []).sort();
}

/** A public-source-only AST census. No Git, generated artifacts, evidence
 * archives, environment configuration or private source workbook is read.
 * Expressions are retained exactly, including dynamic finite chart settings.
 */
export function methodologyDownloadCensus() {
  const centralSites: { path: string; line: number; component: string; attributes: Record<string, string> }[] = [];
  const downloadLinks: { path: string; line: number; href: string; embeddedManifest: boolean }[] = [];
  const attachmentSites: { path: string; line: number; expression: string; registered: boolean }[] = [];
  const workbookSheets: { path: string; line: number; expression: string }[] = [];
  const writers: { path: string; line: number; expression: string }[] = [];
  const inlineDataDownloads: { path: string; line: number; expression: string }[] = [];
  const sourceHashes: Record<string, string> = {};
  for (const path of [...files("client/src"), ...files("server")]) {
    const text = readFileSync(path, "utf8");
    sourceHashes[path] = createHash("sha256").update(text).digest("hex");
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true,
      path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const line = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    function visit(node: ts.Node) {
      if (path.startsWith("client/") && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateExpression(node)) && /^data:(?:application|image|text)\//.test(
          ts.isTemplateExpression(node) ? node.head.text : node.text))
        inlineDataDownloads.push({ path, line: line(node), expression: node.getText(source) });
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const component = node.tagName.getText(source);
        const attributes = Object.fromEntries(node.attributes.properties.filter(ts.isJsxAttribute).map(attr =>
          [attr.name.getText(source), attr.initializer?.getText(source) ?? "true"]));
        if (["DownloadDataButton", "DownloadJsonButton"].includes(component)) centralSites.push({ path, line: line(node), component, attributes });
        if (component === "a" && attributes.href) {
          const label = ts.isJsxOpeningElement(node) ? node.parent.getText(source) : node.getText(source);
          if ("download" in attributes || /(?:[Ee]xport|[Dd]ownload|[Ee]xact.*(?:JSON|XLSX)|Public (?:JSON|XLSX))/.test(label)) {
            // "Exact audit JSON" is a regular report API, not an attachment.
            if (!label.includes(">Exact audit JSON<")) downloadLinks.push({ path, line: line(node),
              href: attributes.href, embeddedManifest: /withDownloadManifest/.test(attributes.href) ||
                (path.endsWith("warming-validation-reference.tsx") && /withDownloadManifest/.test(text)) });
          }
        }
      }
      if (ts.isCallExpression(node)) {
        const expression = node.expression.getText(source);
        if (/\.(?:attachment|download)$/.test(expression) ||
          /\.(?:setHeader|set)$/.test(expression) && node.arguments[0]?.getText(source).includes("Content-Disposition")) {
          attachmentSites.push({ path, line: line(node), expression: node.getText(source),
            registered: serverDownloadRegistry.some(entry => entry.source === path) });
        }
        if (/\.book_append_sheet$/.test(expression)) workbookSheets.push({ path, line: line(node), expression: node.arguments[2]?.getText(source) ?? "" });
        if (/\.addWorksheet$/.test(expression)) workbookSheets.push({ path, line: line(node), expression: node.arguments[0]?.getText(source) ?? "" });
        if (path.startsWith("client/") && /(?:writeFile|writeFileXLSX|saveAs|createObjectURL|toDataURL|toBlob)$/.test(expression))
          writers.push({ path, line: line(node), expression });
      }
      node.forEachChild(visit);
    }
    visit(source);
  }
  return { version: "public-source-download-census-v1", centralSites, downloadLinks, attachmentSites,
    serverDownloads: serverDownloadRegistry, workbookSheets, writers, inlineDataDownloads, sourceHashes,
    boundary: "Browser/UI and HTTP attachment census, including custom XLSX sheets and denied engineering-test-only attachment code. Operator CLI files and internal archive serialization are not browser downloads. AST coverage plus isolated transport/readback tests, not a live click-through of every data-dependent view. Denied private routes remain denied; no private bytes inspected." };
}
