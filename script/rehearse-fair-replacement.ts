import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, readdir, lstat, symlink, chmod } from "node:fs/promises";
import path from "node:path";
import { buildFairBundle, buildFairReplacementBundle, validateFairReplacement, installFairBundle,
  activateFairRelease, recoverFairActivation, exportFairRelease, FAIR_REPLACED_BUNDLE_SHA256 } from "./fair-artifact-bundle";
import { fairArtifactCatalog, fairArtifactSelection, fairSha256 } from "../server/calculation/fairArtifactCatalog";
import { createFairArtifactLoader } from "../server/calculation/fairArtifacts";

// Authorized private-byte engineering rehearsal only. No model/Python/HTTP run.
async function rehearse() {
const baseline = path.resolve("generated-artifacts/fair-bundle-rehearsal-yNPUor/exact16.fairbundle");
const oldStore = path.resolve("generated-artifacts/fair-bundle-rehearsal-yNPUor/store");
const oldSource = path.join(oldStore, "releases", FAIR_REPLACED_BUNDLE_SHA256, "sources");
async function treeFingerprint(directory: string): Promise<string> {
  const rows: { path: string; mode: number; sha256: string }[] = [];
  async function walk(folder: string) {
    for (const name of (await readdir(folder)).sort()) {
      const file = path.join(folder, name), info = await lstat(file);
      assert.equal(info.isSymbolicLink(), false);
      if (info.isDirectory()) await walk(file);
      else rows.push({ path: path.relative(directory, file), mode: info.mode & 0o777, sha256: fairSha256(await readFile(file)) });
    }
  }
  await walk(directory); return fairSha256(JSON.stringify(rows));
}
const oldTreeBefore = await treeFingerprint(oldStore);
assert.equal(fairSha256(await readFile(baseline)), FAIR_REPLACED_BUNDLE_SHA256);
await mkdir("generated-artifacts", { recursive: true });
const root = await mkdtemp(path.resolve("generated-artifacts/fair-cache-replacement-"));
const bundle = path.join(root, "exact16-cache-replacement-v2.fairbundle"), store = path.join(root, "store");
const built = await buildFairReplacementBundle(bundle, baseline, FAIR_REPLACED_BUNDLE_SHA256);
const validation = await validateFairReplacement(baseline, FAIR_REPLACED_BUNDLE_SHA256, bundle, built.bundleSha256);
assert.equal(validation.unchangedEnsembles, 16); assert.equal(validation.unchangedMembers, 13456);
const original = await readFile(bundle), magic = Buffer.from("FAIR_PRIVATE_BUNDLE_V2\n");
const headerLength = original.readUInt32BE(magic.length);
const manifest = JSON.parse(original.subarray(magic.length + 4, magic.length + 4 + headerLength).toString("utf8"));
const body = original.subarray(magic.length + 4 + headerLength);
let refusals = 0;
async function refuses(work: () => Promise<unknown>, pattern: RegExp) {
  await assert.rejects(work, pattern); refusals++;
}
function changedManifest(change: (value: any) => void) {
  const value = structuredClone(manifest); change(value);
  const header = Buffer.from(JSON.stringify(value)), length = Buffer.alloc(4); length.writeUInt32BE(header.length);
  return Buffer.concat([magic, length, header, body]);
}
await refuses(() => buildFairBundle(path.join(root, "silent-v1.fairbundle")), /REPLACEMENT_REQUIRED/);
await refuses(() => buildFairReplacementBundle(bundle, baseline, FAIR_REPLACED_BUNDLE_SHA256), /NO_OVERWRITE/);
await refuses(() => buildFairReplacementBundle(path.join(root, "unauthorized.fairbundle"), baseline, "0".repeat(64)), /BASELINE_NOT_AUTHORIZED/);
await refuses(() => installFairBundle(baseline, FAIR_REPLACED_BUNDLE_SHA256, store), /SOURCE_MISMATCH:server\/routes.ts/);
await refuses(() => installFairBundle(bundle, "0".repeat(64), store), /CORRUPT/);
await refuses(() => installFairBundle(path.join(root, "missing.fairbundle"), built.bundleSha256, store), /ENOENT/);
const linked = path.join(root, "linked.fairbundle"); await symlink(bundle, linked);
await refuses(() => installFairBundle(linked, built.bundleSha256, store), /SYMLINK/);
for (const [name, change, pattern] of [
  ["version", (v: any) => { v.version = "unreviewed"; }, /Invalid literal|Invalid input/],
  ["policy", (v: any) => { v.packagingPolicy.id = "unreviewed"; }, /Invalid literal|Invalid input/],
  ["closure", (v: any) => { v.packagingPolicy.sourceClosure.push("unrelated.ts"); }, /Array must contain/],
  ["traversal", (v: any) => { v.files[0].path = "../escape"; }, /PATH_INVALID/],
  ["member", (v: any) => { v.artifacts[0].members[0].memberSha256 = "0".repeat(64); }, /POLICY_MISMATCH/],
  ["file", (v: any) => { v.files[0].sha256 = "0".repeat(64); }, /FILE_CORRUPT/],
] as const) {
  const file = path.join(root, `fault-${name}.fairbundle`), bytes = changedManifest(change);
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  await refuses(() => installFairBundle(file, fairSha256(bytes), store), pattern);
}
const truncated = path.join(root, "fault-truncated.fairbundle");
await writeFile(truncated, original.subarray(0, original.length - 1), { flag: "wx", mode: 0o600 });
await refuses(() => installFairBundle(truncated, fairSha256(original.subarray(0, original.length - 1)), store), /CORRUPT_OR_MISSING/);
await chmod(truncated, 0o644);
await refuses(() => installFairBundle(truncated, built.bundleSha256, store), /PERMISSIONS/);
await chmod(truncated, 0o600);

const legacy = await installFairBundle(baseline, FAIR_REPLACED_BUNDLE_SHA256, store, oldSource);
const oldActivation = await activateFairRelease(store, FAIR_REPLACED_BUNDLE_SHA256, null, oldSource);
const installed = await installFairBundle(bundle, built.bundleSha256, store);
await refuses(() => installFairBundle(bundle, built.bundleSha256, store), /NO_OVERWRITE/);
await refuses(() => activateFairRelease(store, built.bundleSha256, null), /ACTIVE_CHANGED/);
await refuses(() => activateFairRelease(store, built.bundleSha256, FAIR_REPLACED_BUNDLE_SHA256, oldSource), /SOURCE_MISMATCH/);
const activation = await activateFairRelease(store, built.bundleSha256, FAIR_REPLACED_BUNDLE_SHA256);
const priorFlag = process.env.FAIR_ARTIFACT_ROOT;
try {
  process.env.FAIR_ARTIFACT_ROOT = store;
  const loader = createFairArtifactLoader();
  for (const entry of fairArtifactCatalog) {
    const artifact = await loader(fairArtifactSelection(entry));
    assert.equal(artifact.ensemble.memberIds.length, 841);
  }
  await refuses(() => recoverFairActivation(store, activation.receiptSha256, built.bundleSha256), /SOURCE_MISMATCH/);
  const recovery = await recoverFairActivation(store, activation.receiptSha256, built.bundleSha256, oldSource);
  assert.equal(recovery.release, FAIR_REPLACED_BUNDLE_SHA256);
  assert.equal((await loader(fairArtifactSelection(fairArtifactCatalog[0]))).identity.artifactId,
    fairArtifactCatalog[0].manifest.artifactId);
  const withholding = await recoverFairActivation(store, oldActivation.receiptSha256, FAIR_REPLACED_BUNDLE_SHA256, oldSource);
  assert.equal(withholding.release, null);
  await assert.rejects(loader(fairArtifactSelection(fairArtifactCatalog[0])), (error: any) => error.status === 503);
  refusals++;
  await activateFairRelease(store, built.bundleSha256, null);
} finally {
  if (priorFlag === undefined) delete process.env.FAIR_ARTIFACT_ROOT; else process.env.FAIR_ARTIFACT_ROOT = priorFlag;
}
const exported = await exportFairRelease(store, built.bundleSha256, path.join(root, "exported-v2.fairbundle"));
assert.equal(fairSha256(await readFile(exported.file)), built.bundleSha256);
const oldExport = await exportFairRelease(store, FAIR_REPLACED_BUNDLE_SHA256, path.join(root, "exported-v1.fairbundle"), oldSource);
assert.equal(fairSha256(await readFile(oldExport.file)), FAIR_REPLACED_BUNDLE_SHA256);
await refuses(() => exportFairRelease(store, built.bundleSha256, exported.file), /EEXIST/);
assert.equal(fairSha256(await readFile(baseline)), FAIR_REPLACED_BUNDLE_SHA256);
assert.equal(await treeFingerprint(oldStore), oldTreeBefore, "Original old release/activation/recovery bytes and modes must remain immutable");
let files = 0, directories = 0;
async function checkPermissions(directory: string) {
  assert.equal((await lstat(directory)).mode & 0o777, 0o700); directories++;
  for (const name of await readdir(directory)) {
    const file = path.join(directory, name), info = await lstat(file);
    assert.equal(info.isSymbolicLink(), false);
    if (info.isDirectory()) await checkPermissions(file);
    else { assert.equal(info.mode & 0o777, 0o600); files++; }
  }
}
await checkPermissions(store);
const proof = {
  passed: true, built, mandatoryPrivateValidation: validation, baseline, oldSource, root, store, legacy, installed,
  activation, oldActivation, oldOriginalStoreTreeSha256: oldTreeBefore, oldOriginalStoreUnchanged: true,
  newExportByteIdentical: true, oldExportByteIdentical: true, all16RuntimeRootLoads: true,
  strictOldBundleAgainstNewSourceRefused: true, recoveryRequiresExactOldAuthorizedSource: true,
  recoveryOldThenWithholdingThenNewPassed: true, refusals, permissions: { files0600: files, directories0700: directories },
  dataFiles: manifest.files.filter((entry: any) => entry.path.startsWith("data/")),
  sourceFiles: manifest.files.filter((entry: any) => entry.path.startsWith("sources/")),
  pythonHttpOrScientificExecution: false, provisioningOrDeployment: false, scientificAcceptance: "not-accepted",
};
await writeFile(path.join(root, "private-evidence.json"), JSON.stringify(proof, null, 2), { flag: "wx", mode: 0o600 });
console.log(JSON.stringify(proof, null, 2));
}
rehearse().catch(error => {
  console.error(error instanceof Error ? error.message : "FAIR_REPLACEMENT_REHEARSAL_FAILED");
  process.exitCode = 1;
});
