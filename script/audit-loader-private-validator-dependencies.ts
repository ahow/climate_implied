/** Static read-only impact inventory. Pinned historical runtime loading is separately reviewed. */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize } from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
const targets = new Set([
  "server/climateValuation/dataProcessor.ts", "server/climateValuation/emissionsCarryForward.ts",
  "server/climateValuation/carbonPriceCalculator.ts", "server/climateValuation/workbookMissingness.ts",
  "server/climateValuation/workbookMissingnessExport.ts", "server/dataIngestion/adapters/noaa.ts",
  "server/calculation/driverEvidence.ts",
]);
function trace(file: string, seen: Set<string>) {
  if (seen.has(file) || !existsSync(file)) return;
  seen.add(file);
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (!(ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) || !node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
    const specifier = node.moduleSpecifier.text;
    const base = specifier.startsWith(".") ? normalize(join(dirname(file), specifier))
      : specifier.startsWith("@shared/") ? join("shared", specifier.slice(8)) : undefined;
    if (!base) continue;
    const next = [base, base + ".ts", base + ".tsx", join(base, "index.ts")].find(path => existsSync(path) && statSync(path).isFile());
    if (next) trace(next, seen);
  }
}
const validators = readdirSync("script").filter(name => /^validate-.*private\.ts$/.test(name)).sort().map(name => {
  const path = join("script", name), seen = new Set<string>(); trace(path, seen);
  return { path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    changedDependencies: Array.from(seen).filter(path => targets.has(path)).sort() };
});
console.log(JSON.stringify({ scope: "Static relative and @shared imports; dynamic pinned historical sources separately inspected", validators }, null, 2));
