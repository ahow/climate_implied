/**
 * Parent-authorized CI source retention only. Never exports history, assets,
 * environment files or generated artifacts. Tests do not invoke this exporter.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import {
  WARNING_SOURCE_REVISION, WARNING_CLIENT_TREE, REFERENCE_SOURCE_REVISION, REFERENCE_SOURCE_PATH,
  inspectRetainedSource, reconstructClientTree, sha256, type RetainedSource,
} from "./fixtures/retainedWarningSource";

if (process.argv[2] !== "--export-reviewed-warning-source")
  throw new Error("Explicit reviewed historical-source export authorization required");
const output = "script/fixtures/retained-warning-source.json";
const policy = readFileSync("script/sync-github.py", "utf8");
if (!/SOURCE_DIRS = \{[^}]*"client"/.test(policy))
  throw new Error("Existing approved client-source export policy absent");
function sources(revision: string, path: string): RetainedSource[] {
  const entries = execFileSync("git", ["ls-tree", "-rz", revision, "--", path]).toString().split("\0").filter(Boolean);
  return entries.map(entry => {
    const [info, sourcePath] = entry.split("\t"), [mode, kind, blob] = info.split(" ");
    if (kind !== "blob" || !["100644", "100755"].includes(mode))
      throw new Error(`Nonregular historical source refuses export: ${sourcePath}`);
    const bytes = execFileSync("git", ["cat-file", "blob", blob], { maxBuffer: 2_000_000 });
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error(`Non-UTF8 source refuses export: ${sourcePath}`);
    const file = { path: sourcePath, mode, gitBlobSha1: blob, sha256: sha256(bytes), bytes: bytes.length, text };
    inspectRetainedSource(file);
    return file;
  });
}
const files = sources(WARNING_SOURCE_REVISION, "client/src");
if (files.length !== 89 || files.reduce((sum, file) => sum + file.bytes, 0) !== 519294 ||
  reconstructClientTree(files) !== WARNING_CLIENT_TREE)
  throw new Error("Authorized complete original client-source tree differs");
const reference = sources(REFERENCE_SOURCE_REVISION, REFERENCE_SOURCE_PATH);
if (reference.length !== 1 || reference[0].path !== REFERENCE_SOURCE_PATH)
  throw new Error("Exact authorized pre-fix reference component absent");
const fixture = {
  format: "retained-warning-source-fixture-v1",
  original: { revision: WARNING_SOURCE_REVISION, root: "client/src", gitTreeSha1: WARNING_CLIENT_TREE, files },
  preFixReference: { revision: REFERENCE_SOURCE_REVISION, file: reference[0] },
};
const bytes = Buffer.from(JSON.stringify(fixture, null, 2) + "\n");
// Exclusive create: never silently overwrite this immutable reviewed snapshot.
writeFileSync(output, bytes, { flag: "wx", mode: 0o444 });
console.log(JSON.stringify({ output, sha256: sha256(bytes), bytes: bytes.length,
  originalFiles: files.length, originalSourceBytes: 519294, originalTree: WARNING_CLIENT_TREE,
  originalFileModes: Array.from(new Set(files.map(file => file.mode))),
  referenceBlob: reference[0].gitBlobSha1, referenceSha256: reference[0].sha256,
  referenceSourceBytes: reference[0].bytes, credentialFingerprintMatches: 0, privateArtifacts: 0 }));
