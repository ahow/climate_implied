import { constants } from "node:fs";
import { mkdir, open, lstat, rename, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fairArtifactCatalog, fairArtifactSelection, FAIR_ARTIFACT_VERSION, fairSha256 } from "../server/calculation/fairArtifactCatalog";
import { createFairArtifactLoader, fairMember } from "../server/calculation/fairArtifacts";
import { readFairPrivateFile, safeBundlePath } from "../server/calculation/fairArtifactFiles";

// Offline operator CLI only. This file is never imported by an HTTP module.
const MAGIC = Buffer.from("FAIR_PRIVATE_BUNDLE_V1\n");
const sourcePaths = [
  "server/calculation/fairArtifactCatalog.ts", "server/calculation/fairArtifacts.ts",
  "server/calculation/fairArtifactFiles.ts", "server/calculation/fairArtifactRoutes.ts",
  "server/calculation/ensemble.ts", "server/calculation/historicalValidation.ts", "server/routes.ts",
  "script/fair-artifact-bundle.ts", "script/fair-reference.py", "script/regional_fair_pathway.py",
  "script/fair_physical_retention.py", "docs/Independent_FaIR_Benchmark_Protocol.md", "docs/Regional_FaIR_Coupling.md",
];
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({
  format: z.literal("fair-private-bundle-v1"), version: z.literal(FAIR_ARTIFACT_VERSION),
  scientificAcceptance: z.literal("not-accepted"),
  files: z.array(z.object({ path: z.string(), sha256: sha, bytes: z.number().int().positive().max(16_000_000),
    mode: z.literal("0600") }).strict()).length(36 + sourcePaths.length),
  artifacts: z.array(z.object({
    selection: z.object({ artifactId: z.string(), version: z.string(), manifestSha256: sha,
      ensembleSha256: sha, memberIdsSha256: sha }).strict(),
    catalogManifest: z.record(z.unknown()),
    members: z.array(z.object({ memberId: z.string(), memberSha256: sha }).strict()).length(841),
  }).strict()).length(16),
}).strict();
type Manifest = z.infer<typeof manifestSchema>;
const pointerSchema = z.object({ version: z.literal(FAIR_ARTIFACT_VERSION), release: sha.nullable(),
  activationReceiptSha256: sha }).strict();
const receiptSchema = z.object({ version: z.literal(FAIR_ARTIFACT_VERSION), previous: sha.nullable(),
  release: sha.nullable(), nonce: z.string().uuid() }).strict();
const json = (value: unknown) => Buffer.from(JSON.stringify(value));

function requireSha(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("FAIR_BUNDLE_EXACT_SHA256_REQUIRED");
  return value;
}
/** All raw output is confined to the repository-ignored generated directory.
 * A portable checkout may run this under its own working directory. */
function privateOutput(relative: string) {
  const root = path.resolve("generated-artifacts");
  const output = path.resolve(relative);
  if (!output.startsWith(`${root}${path.sep}`)) throw new Error("FAIR_BUNDLE_OUTPUT_MUST_BE_PRIVATE_GENERATED_DIRECTORY");
  return output;
}
async function privateDirectory(directory: string) {
  const absolute = privateOutput(directory);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    try { await mkdir(current, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("FAIR_BUNDLE_SYMLINK_REFUSED");
    // Do not chmod existing shared source roots or directories.
    if (current === absolute && (info.mode & 0o077)) throw new Error("FAIR_BUNDLE_PERMISSIONS_INVALID");
  }
  return absolute;
}
async function exclusiveFile(file: string, bytes: Buffer) {
  const handle = await open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
async function syncDirectory(directory: string) {
  const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try { await handle.sync(); } finally { await handle.close(); }
}
async function syncPrivateTree(directory: string) {
  for (const name of await readdir(directory)) {
    const child = path.join(directory, name), info = await lstat(child);
    if (info.isSymbolicLink()) throw new Error("FAIR_BUNDLE_SYMLINK_REFUSED");
    if (info.isDirectory()) await syncPrivateTree(child);
  }
  await syncDirectory(directory);
}
async function absent(file: string) {
  try { await lstat(file); throw new Error("FAIR_BUNDLE_NO_OVERWRITE"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
function decode(bytes: Buffer, expectedBundleSha256: string) {
  if (fairSha256(bytes) !== requireSha(expectedBundleSha256)) throw new Error("FAIR_BUNDLE_CORRUPT");
  if (!bytes.subarray(0, MAGIC.length).equals(MAGIC) || bytes.length < MAGIC.length + 4)
    throw new Error("FAIR_BUNDLE_FORMAT_INVALID");
  const length = bytes.readUInt32BE(MAGIC.length);
  if (length > 4_000_000 || length === 0) throw new Error("FAIR_BUNDLE_MANIFEST_INVALID");
  let position = MAGIC.length + 4 + length;
  const manifest = manifestSchema.parse(JSON.parse(bytes.subarray(MAGIC.length + 4, position).toString("utf8")));
  const files = new Map<string, Buffer>();
  for (const file of manifest.files) {
    safeBundlePath(file.path);
    if (files.has(file.path)) throw new Error("FAIR_BUNDLE_DUPLICATE_PATH");
    const content = bytes.subarray(position, position + file.bytes);
    if (content.length !== file.bytes || fairSha256(content) !== file.sha256) throw new Error("FAIR_BUNDLE_FILE_CORRUPT_OR_MISSING");
    files.set(file.path, content);
    position += file.bytes;
  }
  if (position !== bytes.length) throw new Error("FAIR_BUNDLE_TRAILING_OR_MISSING_BYTES");
  return { manifest, files };
}
async function validateManifest(manifest: Manifest, files: Map<string, Buffer>, sourceRoot: string) {
  // The trusted SHA256 must arrive separately through the authorized operator,
  // never be auto-derived from an untrusted uploaded/downloaded package.
  for (const source of sourcePaths) {
    const actual = await readFairPrivateFile(sourceRoot, source);
    const packaged = files.get(`sources/${source}`);
    if (!packaged || fairSha256(actual) !== fairSha256(packaged)) throw new Error(`FAIR_BUNDLE_SOURCE_MISMATCH:${source}`);
  }
  const reader = async (name: string) => {
    const content = files.get(`data/${safeBundlePath(name)}`);
    if (!content) throw Object.assign(new Error("FAIR_BUNDLE_DATA_MISSING"), { code: "ENOENT" });
    return content;
  };
  const loader = createFairArtifactLoader(reader);
  const expectedPaths = new Set(sourcePaths.map(name => `sources/${name}`));
  for (const [i, entry] of fairArtifactCatalog.entries()) {
    const selection = fairArtifactSelection(entry);
    if (JSON.stringify(manifest.artifacts[i].selection) !== JSON.stringify(selection)) throw new Error("FAIR_BUNDLE_VERSION_MISMATCH");
    if (JSON.stringify(manifest.artifacts[i].catalogManifest) !== JSON.stringify(entry.manifest))
      throw new Error("FAIR_BUNDLE_MANIFEST_IDENTITY_MISMATCH");
    const loaded = await loader(selection);
    const members = loaded.ensemble.memberIds.map(memberId => {
      const member = fairMember(loaded, memberId);
      return { memberId, memberSha256: member.memberSha256 };
    });
    if (JSON.stringify(members) !== JSON.stringify(manifest.artifacts[i].members)) throw new Error("FAIR_BUNDLE_MEMBER_HASH_MISMATCH");
    for (const suffix of ["ensemble.json", "result.json"]) expectedPaths.add(`data/${entry.directory}/${suffix}`);
    for (const input of loaded.provenance.inputs) expectedPaths.add(`data/generated-artifacts/fair-reference/${input.file}`);
  }
  if (files.size !== expectedPaths.size || [...files.keys()].some(name => !expectedPaths.has(name)))
    throw new Error("FAIR_BUNDLE_UNEXPECTED_OR_MISSING_FILE");
}
export async function buildFairBundle(output: string, sourceRoot = process.cwd()) {
  const file = privateOutput(output);
  await privateDirectory(path.dirname(file));
  await absent(file);
  const loader = createFairArtifactLoader(name => readFairPrivateFile(sourceRoot, name));
  const files = new Map<string, Buffer>();
  const artifacts: Manifest["artifacts"] = [];
  for (const entry of fairArtifactCatalog) {
    const loaded = await loader(fairArtifactSelection(entry));
    for (const suffix of ["ensemble.json", "result.json"])
      files.set(`data/${entry.directory}/${suffix}`, await readFairPrivateFile(sourceRoot, `${entry.directory}/${suffix}`));
    for (const input of loaded.provenance.inputs) {
      const name = `generated-artifacts/fair-reference/${input.file}`;
      files.set(`data/${name}`, await readFairPrivateFile(sourceRoot, name));
    }
    artifacts.push({ selection: fairArtifactSelection(entry), catalogManifest: entry.manifest, members: loaded.ensemble.memberIds.map(memberId => {
      const member = fairMember(loaded, memberId);
      return { memberId, memberSha256: member.memberSha256 };
    }) });
  }
  for (const source of sourcePaths) files.set(`sources/${source}`, await readFairPrivateFile(sourceRoot, source));
  const manifest = manifestSchema.parse({ format: "fair-private-bundle-v1", version: FAIR_ARTIFACT_VERSION,
    scientificAcceptance: "not-accepted", artifacts,
    files: [...files].map(([name, bytes]) => ({ path: name, sha256: fairSha256(bytes), bytes: bytes.length, mode: "0600" })) });
  await validateManifest(manifest, files, sourceRoot);
  const header = json(manifest);
  const length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  // Builder never replaces a previous bundle. Failed/incomplete outputs remain
  // private and will be rejected by their absent trusted receipt/full SHA.
  const handle = await open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    for (const bytes of [MAGIC, length, header, ...files.values()]) await handle.writeFile(bytes);
    await handle.sync();
  } finally { await handle.close(); }
  await syncDirectory(path.dirname(file));
  const bundle = await readFairPrivateFile(path.dirname(file), path.basename(file), true);
  const bundleSha256 = fairSha256(bundle);
  decode(bundle, bundleSha256);
  return { file, bytes: bundle.length, bundleSha256, manifestSha256: fairSha256(header),
    artifacts: 16, memberSeries: 13456, files: files.size, sourceFiles: sourcePaths.length,
    mode: "0600", directoryMode: "0700", scientificAcceptance: "not-accepted" };
}
async function withLock<T>(store: string, operation: () => Promise<T>) {
  const lock = path.join(store, "operator.lock");
  const lockBytes = json({ pid: process.pid, nonce: randomUUID() });
  try { await exclusiveFile(lock, lockBytes); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("FAIR_BUNDLE_STORE_LOCKED"); throw error; }
  try { return await operation(); } finally {
    const current = await readFairPrivateFile(store, "operator.lock", true);
    if (!current.equals(lockBytes)) throw new Error("FAIR_BUNDLE_LOCK_CHANGED");
    await unlink(lock);
  }
}
export async function installFairBundle(bundleFile: string, expectedSha256: string, storePath: string, sourceRoot = process.cwd()) {
  const file = privateOutput(bundleFile);
  const store = await privateDirectory(storePath);
  const bytes = await readFairPrivateFile(path.dirname(file), path.basename(file), true);
  const { manifest, files } = decode(bytes, expectedSha256);
  await validateManifest(manifest, files, sourceRoot);
  return withLock(store, async () => {
    await privateDirectory(path.join(store, "releases"));
    const target = path.join(store, "releases", requireSha(expectedSha256));
    await absent(target);
    const staging = await privateDirectory(path.join(store, `.staging-${randomUUID()}`));
    for (const [name, content] of files) {
      const output = path.join(staging, safeBundlePath(name));
      await privateDirectory(path.dirname(output));
      await exclusiveFile(output, content);
    }
    await exclusiveFile(path.join(staging, "bundle-manifest.json"), json(manifest));
    await exclusiveFile(path.join(staging, "installation.json"), json({ version: FAIR_ARTIFACT_VERSION,
      bundleSha256: expectedSha256, manifestSha256: fairSha256(json(manifest)), bytes: bytes.length }));
    await syncPrivateTree(staging);
    await rename(staging, target);
    await syncDirectory(path.join(store, "releases"));
    return { release: expectedSha256, target, activeChanged: false, files: files.size, permissions: "directories0700-files0600" };
  });
}
async function validateRelease(store: string, release: string, sourceRoot: string) {
  requireSha(release);
  const directory = `releases/${release}`;
  const manifest = manifestSchema.parse(JSON.parse((await readFairPrivateFile(store, `${directory}/bundle-manifest.json`, true)).toString("utf8")));
  const receipt = JSON.parse((await readFairPrivateFile(store, `${directory}/installation.json`, true)).toString("utf8"));
  if (receipt.bundleSha256 !== release || receipt.version !== FAIR_ARTIFACT_VERSION ||
    receipt.manifestSha256 !== fairSha256(json(manifest))) throw new Error("FAIR_BUNDLE_INSTALLATION_IDENTITY_INVALID");
  const files = new Map<string, Buffer>();
  for (const entry of manifest.files) {
    const bytes = await readFairPrivateFile(store, `${directory}/${safeBundlePath(entry.path)}`, true);
    if (bytes.length !== entry.bytes || fairSha256(bytes) !== entry.sha256) throw new Error("FAIR_BUNDLE_INSTALLED_FILE_CORRUPT");
    files.set(entry.path, bytes);
  }
  // Reconstruct the exact deterministic archive hash, not just self-attested
  // installation metadata, before activation/export.
  const header = json(manifest), length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256");
  for (const bytes of [MAGIC, length, header, ...files.values()]) hash.update(bytes);
  if (hash.digest("hex") !== release) throw new Error("FAIR_BUNDLE_INSTALLED_IDENTITY_MISMATCH");
  await validateManifest(manifest, files, sourceRoot);
  return { manifest, files };
}
async function activeRelease(store: string) {
  try { return pointerSchema.parse(JSON.parse((await readFairPrivateFile(store, "active.json", true)).toString("utf8"))).release; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function activateFairRelease(storePath: string, release: string | null, expectedActive: string | null, sourceRoot = process.cwd()) {
  const store = await privateDirectory(storePath);
  return withLock(store, async () => {
    if (release !== null) await validateRelease(store, release, sourceRoot);
    const previous = await activeRelease(store);
    if (previous !== expectedActive) throw new Error("FAIR_BUNDLE_ACTIVE_CHANGED");
    await privateDirectory(path.join(store, "activation-history"));
    const receipt = { version: FAIR_ARTIFACT_VERSION, previous, release, nonce: randomUUID() };
    const receiptSha256 = fairSha256(json(receipt));
    await exclusiveFile(path.join(store, "activation-history", `${receiptSha256}.json`), json(receipt));
    const temporary = path.join(store, `.activation-${randomUUID()}`);
    await exclusiveFile(temporary, json({ version: FAIR_ARTIFACT_VERSION, release, activationReceiptSha256: receiptSha256 }));
    await rename(temporary, path.join(store, "active.json"));
    await syncDirectory(store);
    return { release, previous, receiptSha256, atomicActivation: true, retainedPreviousRelease: true };
  });
}
export async function recoverFairActivation(storePath: string, receiptSha256: string, expectedActive: string | null, sourceRoot = process.cwd()) {
  const store = privateOutput(storePath);
  const bytes = await readFairPrivateFile(store, `activation-history/${requireSha(receiptSha256)}.json`, true);
  if (fairSha256(bytes) !== receiptSha256) throw new Error("FAIR_BUNDLE_RECOVERY_RECEIPT_CORRUPT");
  const receipt = receiptSchema.parse(JSON.parse(bytes.toString("utf8")));
  if (receipt.release !== expectedActive) throw new Error("FAIR_BUNDLE_RECOVERY_STATE_MISMATCH");
  return activateFairRelease(store, receipt.previous, expectedActive, sourceRoot);
}
/** Local private export/read support for authorized transport; never HTTP.
 * No arbitrary file read: release and member/source hashes are validated first. */
export async function exportFairRelease(storePath: string, release: string, output: string, sourceRoot = process.cwd()) {
  const store = privateOutput(storePath);
  const { manifest, files } = await validateRelease(store, release, sourceRoot);
  const destination = privateOutput(output);
  await privateDirectory(path.dirname(destination));
  const header = json(manifest), length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  const handle = await open(destination, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { for (const bytes of [MAGIC, length, header, ...files.values()]) await handle.writeFile(bytes); await handle.sync(); }
  finally { await handle.close(); }
  return { file: destination, bundleSha256: release, private: true };
}
export async function unlockAbandonedFairStore(storePath: string, expectedLockSha256: string) {
  const store = privateOutput(storePath);
  const bytes = await readFairPrivateFile(store, "operator.lock", true);
  if (fairSha256(bytes) !== requireSha(expectedLockSha256)) throw new Error("FAIR_BUNDLE_LOCK_IDENTITY_MISMATCH");
  const lock = z.object({ pid: z.number().int().positive(), nonce: z.string().uuid() }).strict().parse(JSON.parse(bytes.toString("utf8")));
  try { process.kill(lock.pid, 0); throw new Error("FAIR_BUNDLE_OWNER_STILL_RUNNING"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; }
  await unlink(path.join(store, "operator.lock"));
  return { unlocked: true, removedLockSha256: expectedLockSha256, privateDataRemoved: false };
}

async function main() {
  const [operation, ...args] = process.argv.slice(2);
  const options = Object.fromEntries(args.map(arg => {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match) throw new Error("Use --key=value arguments; no implicit activation.");
    return [match[1], match[2]];
  }));
  const required = (name: string) => { if (!options[name]) throw new Error(`Missing --${name}`); return options[name]; };
  const expected = () => required("expected-active") === "none" ? null : requireSha(required("expected-active"));
  let result: unknown;
  if (operation === "build") result = await buildFairBundle(required("output"));
  else if (operation === "install") result = await installFairBundle(required("bundle"), required("sha256"), required("store"));
  else if (operation === "activate") result = await activateFairRelease(required("store"), requireSha(required("release")), expected());
  else if (operation === "recover") result = await recoverFairActivation(required("store"), required("receipt"), expected());
  else if (operation === "export") result = await exportFairRelease(required("store"), required("release"), required("output"));
  else if (operation === "unlock") result = await unlockAbandonedFairStore(required("store"), required("lock-sha256"));
  else throw new Error("Operations: build, install, activate, recover, export, unlock. All paths remain under ignored generated-artifacts.");
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error(error instanceof Error ? error.message : "FAIR_BUNDLE_FAILED"); process.exitCode = 1; });
