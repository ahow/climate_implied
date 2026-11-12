import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { contentHash } from "../calculation/analysisManifest";

let release: { id: string; payload: unknown } | undefined;
/** Pure release-local source/config/lock archive. No DB, credentials, uploads,
 * generated/private evidence or provider reads; safe in offline CLI contexts. */
export function calculationSourceArtifact(root = ".") {
  if (release) return release;
  const files: Record<string, string> = {};
  function walk(directory: string) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(tsx?|json|csv)$/.test(path)) files[path] = readFileSync(join(root, path), "utf8");
    }
  }
  for (const directory of ["server", "shared", "client/src"]) walk(directory);
  for (const file of ["package.json", "package-lock.json", "tsconfig.json"]) files[file] = readFileSync(join(root, file), "utf8");
  const payload = { version: "calculation-source-1", files, nodeVersion: process.version,
    meaning: "Source/config/embedded data/dependency lock; not a historical publication vintage or executable container" };
  release = { id: contentHash(payload), payload };
  return release;
}
