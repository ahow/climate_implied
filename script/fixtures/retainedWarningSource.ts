import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export const WARNING_SOURCE_REVISION = "7985aa08dc0cc7240491eaea37e94690f8b2234e";
export const WARNING_CLIENT_TREE = "70d5729f65e7ae76a4149fbe2d32f48456df944c";
export const REFERENCE_SOURCE_REVISION = "40c524b29bec455f51e0bb9ac7d3efabe0218e3e";
export const REFERENCE_SOURCE_PATH = "client/src/components/published-scenario-references.tsx";
export const RETAINED_WARNING_FIXTURE_SHA256 = "54c86532decc726490c5fa0abf45f9966b3591f986c910f2f8596708ff69331f";
export interface RetainedSource {
  path: string; mode: string; gitBlobSha1: string; sha256: string; bytes: number; text: string;
}
export const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function gitHash(kind: "blob" | "tree", bytes: Buffer) {
  return createHash("sha1").update(`${kind} ${bytes.length}\0`).update(bytes).digest("hex");
}
// Same credential fingerprints as the existing approved sync-github policy.
const forbidden = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/,
  /AKIA[0-9A-Z]{16}/, /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/,
];
export function inspectRetainedSource(file: RetainedSource) {
  if (!/^client\/src\/[A-Za-z0-9_./-]+\.(?:tsx?|css|json)$/.test(file.path) ||
    file.path.split("/").some(part => ["", ".", "..", "node_modules", "__pycache__", ".env"].includes(part) || part.startsWith(".env.")) ||
    !["100644", "100755"].includes(file.mode) || typeof file.text !== "string")
    throw new Error(`Unapproved retained source path/mode: ${file.path}`);
  const bytes = Buffer.from(file.text, "utf8");
  if (file.text.includes("\0") || bytes.toString("utf8") !== file.text ||
    file.bytes !== bytes.length || file.sha256 !== sha256(bytes) ||
    file.gitBlobSha1 !== gitHash("blob", bytes))
    throw new Error(`Retained source byte/blob identity mismatch: ${file.path}`);
  if (forbidden.some(pattern => pattern.test(file.text)))
    throw new Error(`Credential fingerprint refuses source export: ${file.path}`);
}

/** Rebuild the complete Git tree from original modes/names/blob bytes, without Git. */
export function reconstructClientTree(files: RetainedSource[]) {
  type Tree = { children: Map<string, Tree | RetainedSource> };
  const root: Tree = { children: new Map() };
  for (const file of files) {
    inspectRetainedSource(file);
    const parts = file.path.slice("client/src/".length).split("/");
    let tree = root;
    for (const name of parts.slice(0, -1)) {
      const prior = tree.children.get(name);
      if (prior && !("children" in prior)) throw new Error("Retained source file/directory collision");
      if (!prior) tree.children.set(name, { children: new Map() });
      tree = tree.children.get(name) as Tree;
    }
    const name = parts[parts.length - 1];
    if (tree.children.has(name)) throw new Error("Retained source duplicate path");
    tree.children.set(name, file);
  }
  function hashTree(tree: Tree): string {
    const entries = Array.from(tree.children, ([name, child]) => "children" in child
      ? { name, mode: "40000", hash: hashTree(child), order: `${name}/` }
      : { name, mode: child.mode, hash: child.gitBlobSha1, order: name });
    entries.sort((a, b) => Buffer.compare(Buffer.from(a.order), Buffer.from(b.order)));
    return gitHash("tree", Buffer.concat(entries.flatMap(entry => [
      Buffer.from(`${entry.mode} ${entry.name}\0`), Buffer.from(entry.hash, "hex"),
    ])));
  }
  return hashTree(root);
}

export function decodeRetainedWarningSource(bytes: Buffer) {
  if (sha256(bytes) !== RETAINED_WARNING_FIXTURE_SHA256)
    throw new Error("Immutable retained-warning source fixture SHA256 mismatch");
  const fixture = JSON.parse(bytes.toString("utf8")) as {
    format: string;
    original: { revision: string; root: string; gitTreeSha1: string; files: RetainedSource[] };
    preFixReference: { revision: string; file: RetainedSource };
  };
  const { original, preFixReference } = fixture;
  if (fixture.format !== "retained-warning-source-fixture-v1" ||
    original.revision !== WARNING_SOURCE_REVISION || original.root !== "client/src" ||
    original.gitTreeSha1 !== WARNING_CLIENT_TREE || original.files.length !== 89 ||
    original.files.reduce((sum, file) => sum + file.bytes, 0) !== 519294 ||
    reconstructClientTree(original.files) !== WARNING_CLIENT_TREE)
    throw new Error("Complete retained original client tree identity mismatch");
  inspectRetainedSource(preFixReference.file);
  if (preFixReference.revision !== REFERENCE_SOURCE_REVISION ||
    preFixReference.file.path !== REFERENCE_SOURCE_PATH ||
    preFixReference.file.gitBlobSha1 !== "2d61565f45a48411e696c966c9f8d4d81994a953" ||
    preFixReference.file.sha256 !== "a52a221ef6b7cce6da29f735357d6447e72012e048cb3735f6e573a934ca58e2" ||
    preFixReference.file.bytes !== 11611)
    throw new Error("Retained pre-fix published-reference source identity mismatch");
  return fixture;
}

/** CI reads approved exact source bytes, never unavailable workspace Git history. */
export function loadRetainedWarningSource() {
  return decodeRetainedWarningSource(readFileSync("script/fixtures/retained-warning-source.json"));
}
