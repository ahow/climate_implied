import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, lstat, symlink, chmod, rename } from "node:fs/promises";
import path from "node:path";
import { buildFairBundle, installFairBundle, activateFairRelease, recoverFairActivation,
  exportFairRelease, unlockAbandonedFairStore } from "./fair-artifact-bundle";
import { fairArtifactCatalog, fairArtifactSelection, fairSha256 } from "../server/calculation/fairArtifactCatalog";
import { createFairArtifactLoader } from "../server/calculation/fairArtifacts";
import { readFairPrivateFile, safeBundlePath } from "../server/calculation/fairArtifactFiles";

/** Offline retained-byte installation rehearsal, NOT a scientific study or HTTP
 * server. All raw bytes and fault injection remain ignored and private. */
await mkdir("generated-artifacts", { recursive: true });
const root = await mkdtemp(path.resolve("generated-artifacts/fair-bundle-rehearsal-"));
const archive = path.join(root, "exact16.fairbundle");
const store = path.join(root, "store");
const built = await buildFairBundle(archive);
const original = await readFile(archive);
const magicLength = Buffer.byteLength("FAIR_PRIVATE_BUNDLE_V1\n");
const manifestLength = original.readUInt32BE(magicLength);
const manifest = JSON.parse(original.subarray(magicLength + 4, magicLength + 4 + manifestLength).toString("utf8"));
const body = original.subarray(magicLength + 4 + manifestLength);
function changedManifest(change: (value: any) => void) {
  const changed = structuredClone(manifest); change(changed);
  const header = Buffer.from(JSON.stringify(changed));
  const length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  return Buffer.concat([original.subarray(0, magicLength), length, header, body]);
}
function forgedSource() {
  const changed = structuredClone(manifest);
  let offset = 0;
  const chunks: Buffer[] = [];
  for (const entry of changed.files) {
    let bytes = body.subarray(offset, offset + entry.bytes);
    if (entry.path === "sources/server/calculation/fairArtifacts.ts") {
      bytes = Buffer.from(bytes); bytes[0] ^= 1;
      entry.sha256 = fairSha256(bytes);
    }
    chunks.push(bytes); offset += entry.bytes;
  }
  const header = Buffer.from(JSON.stringify(changed)), length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  return Buffer.concat([original.subarray(0, magicLength), length, header, ...chunks]);
}
let refusalChecks = 0;
async function rejects(operation: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(operation, pattern); refusalChecks++;
}
await rejects(() => buildFairBundle(archive), /NO_OVERWRITE/);
await rejects(() => buildFairBundle("public.fairbundle"), /PRIVATE_GENERATED/);
await rejects(() => installFairBundle(archive, "0".repeat(64), store), /CORRUPT/);
await rejects(() => installFairBundle(path.join(root, "missing.fairbundle"), built.bundleSha256, store), /ENOENT/);
const linked = path.join(root, "linked.fairbundle");
await symlink(archive, linked);
await rejects(() => installFairBundle(linked, built.bundleSha256, store), /SYMLINK/);
for (const [name, bytes, pattern] of [
  ["version", changedManifest(value => { value.version = "unregistered-version"; }), /Invalid literal|Invalid input/],
  ["traversal", changedManifest(value => { value.files[0].path = "../escape"; }), /PATH_INVALID/],
  ["member", changedManifest(value => { value.artifacts[0].members[0].memberSha256 = "0".repeat(64); }), /MEMBER_HASH/],
  ["source", changedManifest(value => {
    const source = value.files.find((file: any) => file.path.startsWith("sources/"));
    source.sha256 = "0".repeat(64);
  }), /FILE_CORRUPT/],
  ["self-attested-source", forgedSource(), /SOURCE_MISMATCH/],
  ["truncated", original.subarray(0, original.length - 1), /CORRUPT_OR_MISSING/],
] as const) {
  const file = path.join(root, `fault-${name}.fairbundle`);
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  await rejects(() => installFairBundle(file, fairSha256(bytes), store), pattern);
}
// Source file hashes are not merely self-attested: installer compares packaged
// source against the authorized local release, even if bundle hash is supplied.
await rejects(() => installFairBundle(archive, built.bundleSha256, store, root), /ENOENT/);
const installed = await installFairBundle(archive, built.bundleSha256, store);
await rejects(() => installFairBundle(archive, built.bundleSha256, store), /NO_OVERWRITE/);
await rejects(() => activateFairRelease(store, "0".repeat(64), null), /ENOENT/);
const activation = await activateFairRelease(store, built.bundleSha256, null);
await rejects(() => activateFairRelease(store, built.bundleSha256, null), /ACTIVE_CHANGED/);
const previousRoot = process.env.FAIR_ARTIFACT_ROOT;
try {
  process.env.FAIR_ARTIFACT_ROOT = store;
  const loader = createFairArtifactLoader();
  let loaded = 0;
  for (const entry of fairArtifactCatalog) {
    const artifact = await loader(fairArtifactSelection(entry));
    assert.equal(artifact.ensemble.memberIds.length, 841); loaded++;
  }
  assert.equal(loaded, 16);
  const dataFile = path.join(installed.target, "data", fairArtifactCatalog[0].directory, "ensemble.json");
  await rename(dataFile, `${dataFile}.held`);
  await assert.rejects(loader(fairArtifactSelection(fairArtifactCatalog[0])),
    (error: any) => error.status === 503 && error.code === "FAIR_ARTIFACT_MISSING");
  refusalChecks++;
  await rename(`${dataFile}.held`, dataFile);
  const actual = await readFile(dataFile), damaged = Buffer.from(actual); damaged[0] ^= 1;
  await writeFile(dataFile, damaged);
  await assert.rejects(loader(fairArtifactSelection(fairArtifactCatalog[0])),
    (error: any) => error.status === 503 && error.code === "FAIR_ARTIFACT_CORRUPT");
  refusalChecks++;
  await writeFile(dataFile, actual);
  const recovered = await recoverFairActivation(store, activation.receiptSha256, built.bundleSha256);
  assert.equal(recovered.release, null);
  await assert.rejects(loader(fairArtifactSelection(fairArtifactCatalog[0])),
    (error: any) => error.status === 503 && error.code === "FAIR_ARTIFACT_UNREADABLE");
  refusalChecks++;
  await activateFairRelease(store, built.bundleSha256, null);
  const restored = await loader(fairArtifactSelection(fairArtifactCatalog[15]));
  assert.equal(restored.identity.artifactId, fairArtifactCatalog[15].manifest.artifactId);
} finally {
  if (previousRoot === undefined) delete process.env.FAIR_ARTIFACT_ROOT;
  else process.env.FAIR_ARTIFACT_ROOT = previousRoot;
}
const exported = await exportFairRelease(store, built.bundleSha256, path.join(root, "exported.fairbundle"));
assert.equal(fairSha256(await readFile(exported.file)), built.bundleSha256);
assert.equal(fairSha256(await readFile(archive)), built.bundleSha256);
await rejects(() => exportFairRelease(store, built.bundleSha256, exported.file), /EEXIST/);
const interrupted = path.join(store, ".staging-interrupted-rehearsal");
await mkdir(interrupted, { mode: 0o700 });
await writeFile(path.join(interrupted, "incomplete"), Buffer.from("isolated engineering fault fixture"), { mode: 0o600, flag: "wx" });
await rejects(() => activateFairRelease(store, ".staging-interrupted-rehearsal", built.bundleSha256), /EXACT_SHA256/);
for (const value of ["../escape", "/absolute", "a\\b", "a//b", "./a", "a/../b"])
  assert.throws(() => safeBundlePath(value), /PATH_INVALID/);
refusalChecks += 6;
const active = path.join(store, "active.json");
await chmod(active, 0o644);
await rejects(() => readFairPrivateFile(store, "active.json", true), /PERMISSIONS/);
await chmod(active, 0o600);
// Abandoned staging data never becomes active; live locks cannot be removed.
const liveLock = Buffer.from(JSON.stringify({ pid: process.pid, nonce: "f0837a46-2420-4dbb-83d1-87e80f60fa80" }));
await writeFile(path.join(store, "operator.lock"), liveLock, { flag: "wx", mode: 0o600 });
await rejects(() => unlockAbandonedFairStore(store, fairSha256(liveLock)), /OWNER_STILL_RUNNING/);
await rejects(() => activateFairRelease(store, built.bundleSha256, built.bundleSha256), /STORE_LOCKED/);
// This rehearsal owns the live test lock and removes only that fixture.
const { unlink } = await import("node:fs/promises"); await unlink(path.join(store, "operator.lock"));
const staleLock = Buffer.from(JSON.stringify({ pid: 2147483647, nonce: "f0837a46-2420-4dbb-83d1-87e80f60fa80" }));
await writeFile(path.join(store, "operator.lock"), staleLock, { flag: "wx", mode: 0o600 });
await unlockAbandonedFairStore(store, fairSha256(staleLock));
let files = 0, directories = 0;
async function permissions(directory: string) {
  assert.equal((await lstat(directory)).mode & 0o777, 0o700); directories++;
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name), info = await lstat(file);
    assert.equal(info.isSymbolicLink(), false);
    if (info.isDirectory()) await permissions(file);
    else { assert.equal(info.mode & 0o777, 0o600); files++; }
  }
}
await permissions(store);
const sourceHashes = manifest.files.filter((file: any) => file.path.startsWith("sources/"))
  .map((file: any) => ({ source: file.path.slice(8), sha256: file.sha256 }));
console.log(JSON.stringify({ check: "actual16-private-portable-bundle-rehearsal", passed: true,
  built, installed, activation, sourceHashes, sourceHashesSha256: fairSha256(JSON.stringify(sourceHashes)),
  runtimeFlag: "FAIR_ARTIFACT_ROOT", runtimeRoot: store, all16RuntimeRootReads: true,
  exportByteIdentity: true, recoveryToExplicitWithholdingAndReactivation: true,
  staleLockRecovery: true, refusalChecks, permissionProof: { files0600: files, directories0700: directories },
  rawBytesOnlyUnderIgnoredGeneratedDirectory: true, pythonOrHttpExecution: false,
  deploymentOrServiceChanges: false, scientificAcceptance: "not-accepted" }, null, 2));
