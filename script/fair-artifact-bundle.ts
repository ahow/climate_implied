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
const REPLACEMENT_MAGIC = Buffer.from("FAIR_PRIVATE_BUNDLE_V2\n");
export const FAIR_REPLACED_BUNDLE_SHA256 = "155bd3ffe3a9ec17cb00a62d21e059f6441f1b11c2b8104d713e0b071ba2a724";
export const FAIR_REPLACEMENT_POLICY = "s07-cache-response-detachment-1";
const sourcePaths = [
  "server/calculation/fairArtifactCatalog.ts", "server/calculation/fairArtifacts.ts",
  "server/calculation/fairArtifactFiles.ts", "server/calculation/fairArtifactRoutes.ts",
  "server/calculation/ensemble.ts", "server/calculation/historicalValidation.ts", "server/routes.ts",
  "script/fair-artifact-bundle.ts", "script/fair-reference.py", "script/regional_fair_pathway.py",
  "script/fair_physical_retention.py", "docs/Independent_FaIR_Benchmark_Protocol.md", "docs/Regional_FaIR_Coupling.md",
];
const replacementSourcePaths = [...sourcePaths, "server/calculation/projectionCacheResponse.ts"];
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const manifestFields = {
  version: z.literal(FAIR_ARTIFACT_VERSION),
  scientificAcceptance: z.literal("not-accepted"),
  files: z.array(z.object({ path: z.string(), sha256: sha, bytes: z.number().int().positive().max(16_000_000),
    mode: z.literal("0600") }).strict()),
  artifacts: z.array(z.object({
    selection: z.object({ artifactId: z.string(), version: z.string(), manifestSha256: sha,
      ensembleSha256: sha, memberIdsSha256: sha }).strict(),
    catalogManifest: z.record(z.unknown()),
    members: z.array(z.object({ memberId: z.string(), memberSha256: sha }).strict()).length(841),
  }).strict()).length(16),
};
const replacementPolicySchema = z.object({
  id: z.literal(FAIR_REPLACEMENT_POLICY), replacesBundleSha256: z.literal(FAIR_REPLACED_BUNDLE_SHA256),
  sourceClosure: z.array(z.string()).length(14),
  reviewedSourceChanges: z.array(z.object({ path: z.string(), previousSha256: sha.nullable(), currentSha256: sha }).strict()).length(3),
  unchangedDataFilesSha256: sha, unchangedArtifactIdentitiesSha256: sha,
}).strict();
const manifestSchema = z.discriminatedUnion("format", [
  z.object({ format: z.literal("fair-private-bundle-v1"), ...manifestFields,
    files: manifestFields.files.length(49) }).strict(),
  z.object({ format: z.literal("fair-private-bundle-v2"), ...manifestFields,
    files: manifestFields.files.length(50), packagingPolicy: replacementPolicySchema, packagingPolicySha256: sha }).strict(),
]);
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
  const magic = bytes.subarray(0, MAGIC.length);
  if ((!magic.equals(MAGIC) && !magic.equals(REPLACEMENT_MAGIC)) || bytes.length < MAGIC.length + 4)
    throw new Error("FAIR_BUNDLE_FORMAT_INVALID");
  const length = bytes.readUInt32BE(MAGIC.length);
  if (length > 4_000_000 || length === 0) throw new Error("FAIR_BUNDLE_MANIFEST_INVALID");
  let position = MAGIC.length + 4 + length;
  const manifest = manifestSchema.parse(JSON.parse(bytes.subarray(MAGIC.length + 4, position).toString("utf8")));
  if (!magic.equals(manifest.format === "fair-private-bundle-v1" ? MAGIC : REPLACEMENT_MAGIC))
    throw new Error("FAIR_BUNDLE_FORMAT_INVALID");
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
async function validateManifest(manifest: Manifest, files: Map<string, Buffer>, sourceRoot: string, checkLocalSource = true) {
  const closure = manifest.format === "fair-private-bundle-v1" ? sourcePaths : replacementSourcePaths;
  if (manifest.format === "fair-private-bundle-v2" &&
      (JSON.stringify(manifest.packagingPolicy.sourceClosure) !== JSON.stringify(replacementSourcePaths) ||
       fairSha256(json(manifest.packagingPolicy)) !== manifest.packagingPolicySha256))
    throw new Error("FAIR_REPLACEMENT_POLICY_MISMATCH");
  if (manifest.format === "fair-private-bundle-v2") {
    const changes = [
      { path: "server/routes.ts", previousSha256: "653ccf33e628df5ee42a3ae5c7386ff996235c887ff3c904e90df7e2e44bd303",
        currentSha256: "1171228a36fa145d5371c4c9a9d79172960dc1ba350a05f8eaac1276a7873a8a" },
      { path: "script/fair-artifact-bundle.ts", previousSha256: "cb0a879e761a43537f8c1f787c08d9c0c502819a132ff920431234e6d65c4547",
        currentSha256: fairSha256(files.get("sources/script/fair-artifact-bundle.ts") ?? Buffer.alloc(0)) },
      { path: "server/calculation/projectionCacheResponse.ts", previousSha256: null,
        currentSha256: "cef7e8d66c3bd7a5c95f695636b904cbc9311306bf366353f2e95e605edc91c8" },
    ];
    if (JSON.stringify(changes) !== JSON.stringify(manifest.packagingPolicy.reviewedSourceChanges) ||
        fairSha256(json(manifest.files.filter(file => file.path.startsWith("data/")))) !== manifest.packagingPolicy.unchangedDataFilesSha256 ||
        fairSha256(json(manifest.artifacts)) !== manifest.packagingPolicy.unchangedArtifactIdentitiesSha256)
      throw new Error("FAIR_REPLACEMENT_POLICY_MISMATCH");
  }
  // The trusted SHA256 must arrive separately through the authorized operator,
  // never be auto-derived from an untrusted uploaded/downloaded package.
  for (const source of closure) {
    const packaged = files.get(`sources/${source}`);
    if (!packaged) throw new Error(`FAIR_BUNDLE_SOURCE_MISMATCH:${source}`);
    if (checkLocalSource && fairSha256(await readFairPrivateFile(sourceRoot, source)) !== fairSha256(packaged))
      throw new Error(`FAIR_BUNDLE_SOURCE_MISMATCH:${source}`);
  }
  const reader = async (name: string) => {
    const content = files.get(`data/${safeBundlePath(name)}`);
    if (!content) throw Object.assign(new Error("FAIR_BUNDLE_DATA_MISSING"), { code: "ENOENT" });
    return content;
  };
  const loader = createFairArtifactLoader(reader);
  const expectedPaths = new Set(closure.map(name => `sources/${name}`));
  for (const [i, entry] of Array.from(fairArtifactCatalog.entries())) {
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
  if (files.size !== expectedPaths.size || Array.from(files.keys()).some(name => !expectedPaths.has(name)))
    throw new Error("FAIR_BUNDLE_UNEXPECTED_OR_MISSING_FILE");
}
export async function buildFairBundle(output: string, sourceRoot = process.cwd()) {
  privateOutput(output);
  // Legacy v1 is readable/recoverable, but must never silently re-freeze changed
  // sources. The deliberate replacement operation requires the trusted old hash.
  throw new Error("FAIR_BUNDLE_REPLACEMENT_REQUIRED_USE_BUILD_REPLACEMENT");
}
async function trustedBaseline(bundleFile: string, expectedSha256: string) {
  if (expectedSha256 !== FAIR_REPLACED_BUNDLE_SHA256) throw new Error("FAIR_REPLACEMENT_BASELINE_NOT_AUTHORIZED");
  const file = privateOutput(bundleFile);
  const baseline = decode(await readFairPrivateFile(path.dirname(file), path.basename(file), true), expectedSha256);
  if (baseline.manifest.format !== "fair-private-bundle-v1") throw new Error("FAIR_REPLACEMENT_BASELINE_FORMAT");
  // Only this independently pinned immutable baseline may omit local-source
  // comparison. Public install/activate/export always check local sources.
  await validateManifest(baseline.manifest, baseline.files, "", false);
  return baseline;
}
function reviewedChanges(baseline: Map<string, Buffer>, replacement: Map<string, Buffer>) {
  const allowed = new Set(["server/routes.ts", "script/fair-artifact-bundle.ts", "server/calculation/projectionCacheResponse.ts"]);
  const changes: z.infer<typeof replacementPolicySchema>["reviewedSourceChanges"] = [];
  for (const source of replacementSourcePaths) {
    const before = baseline.get(`sources/${source}`), after = replacement.get(`sources/${source}`);
    if (!after) throw new Error(`FAIR_REPLACEMENT_SOURCE_MISSING:${source}`);
    if (!before || !before.equals(after)) {
      if (!allowed.has(source)) throw new Error(`FAIR_REPLACEMENT_UNREVIEWED_SOURCE_CHANGE:${source}`);
      changes.push({ path: source, previousSha256: before ? fairSha256(before) : null, currentSha256: fairSha256(after) });
    }
  }
  if (changes.length !== 3 ||
      fairSha256(baseline.get("sources/server/routes.ts")!) !== "653ccf33e628df5ee42a3ae5c7386ff996235c887ff3c904e90df7e2e44bd303" ||
      fairSha256(replacement.get("sources/server/routes.ts")!) !== "1171228a36fa145d5371c4c9a9d79172960dc1ba350a05f8eaac1276a7873a8a" ||
      fairSha256(replacement.get("sources/server/calculation/projectionCacheResponse.ts")!) !== "cef7e8d66c3bd7a5c95f695636b904cbc9311306bf366353f2e95e605edc91c8")
    throw new Error("FAIR_REPLACEMENT_REVIEWED_CACHE_FIX_PIN_MISMATCH");
  return changes;
}
function unchangedData(baseline: { manifest: Manifest; files: Map<string, Buffer> },
  replacement: { manifest: Manifest; files: Map<string, Buffer> }) {
  const oldData = baseline.manifest.files.filter(file => file.path.startsWith("data/"));
  const newData = replacement.manifest.files.filter(file => file.path.startsWith("data/"));
  if (JSON.stringify(oldData) !== JSON.stringify(newData) ||
      JSON.stringify(baseline.manifest.artifacts) !== JSON.stringify(replacement.manifest.artifacts))
    throw new Error("FAIR_REPLACEMENT_SCIENTIFIC_BYTES_CHANGED");
  for (const entry of oldData)
    if (!baseline.files.get(entry.path)!.equals(replacement.files.get(entry.path)!))
      throw new Error("FAIR_REPLACEMENT_SCIENTIFIC_BYTES_CHANGED");
  return { unchangedDataFilesSha256: fairSha256(json(oldData)),
    unchangedArtifactIdentitiesSha256: fairSha256(json(baseline.manifest.artifacts)) };
}
/** Mandatory private, exact-byte validator. No science execution or public data output. */
export async function validateFairReplacement(baselineFile: string, expectedBaselineSha256: string,
  replacementFile: string, expectedReplacementSha256: string, sourceRoot = process.cwd()) {
  const baseline = await trustedBaseline(baselineFile, expectedBaselineSha256);
  const file = privateOutput(replacementFile);
  const replacement = decode(await readFairPrivateFile(path.dirname(file), path.basename(file), true), expectedReplacementSha256);
  if (replacement.manifest.format !== "fair-private-bundle-v2") throw new Error("FAIR_REPLACEMENT_FORMAT_REQUIRED");
  await validateManifest(replacement.manifest, replacement.files, sourceRoot);
  const changes = reviewedChanges(baseline.files, replacement.files), identities = unchangedData(baseline, replacement);
  const policy = { id: FAIR_REPLACEMENT_POLICY, replacesBundleSha256: FAIR_REPLACED_BUNDLE_SHA256,
    sourceClosure: replacementSourcePaths, reviewedSourceChanges: changes, ...identities };
  if (JSON.stringify(policy) !== JSON.stringify(replacement.manifest.packagingPolicy))
    throw new Error("FAIR_REPLACEMENT_POLICY_MISMATCH");
  return { passed: true, baselineBundleSha256: expectedBaselineSha256, replacementBundleSha256: expectedReplacementSha256,
    packagingPolicy: policy, packagingPolicySha256: replacement.manifest.packagingPolicySha256,
    unchangedEnsembles: 16, unchangedOutputs: 16, unchangedMembers: 13456, unchangedDataFiles: 36,
    exactDataByteEquality: true, scientificAcceptance: "not-accepted" };
}
export async function buildFairReplacementBundle(output: string, baselineFile: string, expectedBaselineSha256: string,
  sourceRoot = process.cwd()) {
  const file = privateOutput(output);
  await privateDirectory(path.dirname(file));
  await absent(file);
  const baseline = await trustedBaseline(baselineFile, expectedBaselineSha256);
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
  for (const source of replacementSourcePaths) files.set(`sources/${source}`, await readFairPrivateFile(sourceRoot, source));
  const entries = Array.from(files).map(([name, bytes]) => ({ path: name, sha256: fairSha256(bytes), bytes: bytes.length, mode: "0600" as const }));
  const changes = reviewedChanges(baseline.files, files);
  const identities = unchangedData(baseline, { files, manifest: { ...baseline.manifest, files: entries, artifacts } });
  const policy = { id: FAIR_REPLACEMENT_POLICY, replacesBundleSha256: FAIR_REPLACED_BUNDLE_SHA256,
    sourceClosure: replacementSourcePaths, reviewedSourceChanges: changes, ...identities };
  const manifest = manifestSchema.parse({ format: "fair-private-bundle-v2", version: FAIR_ARTIFACT_VERSION,
    scientificAcceptance: "not-accepted", artifacts,
    files: entries, packagingPolicy: policy, packagingPolicySha256: fairSha256(json(policy)) });
  await validateManifest(manifest, files, sourceRoot);
  const header = json(manifest);
  const length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  // Builder never replaces a previous bundle. Failed/incomplete outputs remain
  // private and will be rejected by their absent trusted receipt/full SHA.
  const handle = await open(file, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    for (const bytes of [REPLACEMENT_MAGIC, length, header, ...Array.from(files.values())]) await handle.writeFile(bytes);
    await handle.sync();
  } finally { await handle.close(); }
  await syncDirectory(path.dirname(file));
  const bundle = await readFairPrivateFile(path.dirname(file), path.basename(file), true);
  const bundleSha256 = fairSha256(bundle);
  decode(bundle, bundleSha256);
  const validation = await validateFairReplacement(baselineFile, expectedBaselineSha256, file, bundleSha256, sourceRoot);
  return { file, bytes: bundle.length, bundleSha256, manifestSha256: fairSha256(header),
    format: manifest.format, packagingPolicySha256: fairSha256(json(policy)),
    artifacts: 16, memberSeries: 13456, files: files.size, sourceFiles: replacementSourcePaths.length,
    mode: "0600", directoryMode: "0700", scientificAcceptance: "not-accepted", validation };
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
    for (const [name, content] of Array.from(files)) {
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
  const magic = manifest.format === "fair-private-bundle-v1" ? MAGIC : REPLACEMENT_MAGIC;
  for (const bytes of [magic, length, header, ...Array.from(files.values())]) hash.update(bytes);
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
  const magic = manifest.format === "fair-private-bundle-v1" ? MAGIC : REPLACEMENT_MAGIC;
  try { for (const bytes of [magic, length, header, ...Array.from(files.values())]) await handle.writeFile(bytes); await handle.sync(); }
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
    const match = /^--([a-z][a-z0-9-]*)=(.+)$/.exec(arg);
    if (!match) throw new Error("Use --key=value arguments; no implicit activation.");
    return [match[1], match[2]];
  }));
  const required = (name: string) => { if (!options[name]) throw new Error(`Missing --${name}`); return options[name]; };
  const expected = () => required("expected-active") === "none" ? null : requireSha(required("expected-active"));
  const sourceRoot = options["source-root"] ?? process.cwd();
  let result: unknown;
  if (operation === "build") result = await buildFairBundle(required("output"));
  else if (operation === "build-replacement") result = await buildFairReplacementBundle(required("output"),
    required("baseline"), required("baseline-sha256"), sourceRoot);
  else if (operation === "validate-replacement") result = await validateFairReplacement(required("baseline"),
    required("baseline-sha256"), required("bundle"), required("sha256"), sourceRoot);
  else if (operation === "install") result = await installFairBundle(required("bundle"), required("sha256"), required("store"), sourceRoot);
  else if (operation === "activate") result = await activateFairRelease(required("store"), requireSha(required("release")), expected(), sourceRoot);
  else if (operation === "recover") result = await recoverFairActivation(required("store"), required("receipt"), expected(), sourceRoot);
  else if (operation === "export") result = await exportFairRelease(required("store"), required("release"), required("output"), sourceRoot);
  else if (operation === "unlock") result = await unlockAbandonedFairStore(required("store"), required("lock-sha256"));
  else throw new Error("Operations: build-replacement, validate-replacement, install, activate, recover, export, unlock. Legacy build refuses changed-source refreeze. Paths remain under ignored generated-artifacts.");
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main().catch(error => { console.error(error instanceof Error ? error.message : "FAIR_BUNDLE_FAILED"); process.exitCode = 1; });
