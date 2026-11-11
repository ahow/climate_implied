import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, symlink, link, chmod } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { safeBundlePath, readFairPrivateFile, readRuntimeFairArtifact } from "../server/calculation/fairArtifactFiles";
import { createFairArtifactLoader } from "../server/calculation/fairArtifacts";
import { fairArtifactCatalog, fairArtifactSelection } from "../server/calculation/fairArtifactCatalog";
import { activateFairRelease, buildFairBundle, buildFairReplacementBundle, validateFairReplacement } from "./fair-artifact-bundle";

test("private reader refuses traversal, symlinks, hardlinks and open permissions", async () => {
  await mkdir("generated-artifacts", { recursive: true });
  const root = await mkdtemp(path.resolve("generated-artifacts/fair-file-engineering-test-"));
  // Explicit engineering fixture, not authentic climate data.
  await writeFile(path.join(root, "fixture"), "engineering-only", { mode: 0o600, flag: "wx" });
  assert.equal((await readFairPrivateFile(root, "fixture", true)).toString(), "engineering-only");
  for (const name of ["../fixture", "/fixture", "a/../fixture", "a//fixture", "a\\fixture", "./fixture", "\0"])
    assert.throws(() => safeBundlePath(name), /PATH_INVALID/);
  await symlink(path.join(root, "fixture"), path.join(root, "symlink"));
  await assert.rejects(readFairPrivateFile(root, "symlink", true), /SYMLINK/);
  await mkdir(path.join(root, "directory"), { mode: 0o700 });
  await symlink(path.join(root, "directory"), path.join(root, "linked-directory"));
  await assert.rejects(readFairPrivateFile(root, "linked-directory/file", true), /SYMLINK/);
  await link(path.join(root, "fixture"), path.join(root, "hardlink"));
  await assert.rejects(readFairPrivateFile(root, "hardlink", true), /NONREGULAR/);
  await writeFile(path.join(root, "open-permissions"), "engineering-only", { mode: 0o600, flag: "wx" });
  await chmod(path.join(root, "open-permissions"), 0o644);
  await assert.rejects(readFairPrivateFile(root, "open-permissions", true), /PERMISSIONS/);
});

test("runtime flag is explicit and fails closed; unset preserves original relative root", async () => {
  const previous = process.env.FAIR_ARTIFACT_ROOT;
  try {
    delete process.env.FAIR_ARTIFACT_ROOT;
    const source = await readRuntimeFairArtifact("server/calculation/fairArtifactCatalog.ts");
    assert.ok(source.toString().includes("s07-offline-fair-v1"));
    process.env.FAIR_ARTIFACT_ROOT = "relative-not-authorized";
    await assert.rejects(readRuntimeFairArtifact("server/calculation/fairArtifactCatalog.ts"), /ABSOLUTE/);
    const root = await mkdtemp(path.resolve("generated-artifacts/fair-root-engineering-test-"));
    process.env.FAIR_ARTIFACT_ROOT = root;
    await assert.rejects(createFairArtifactLoader()(fairArtifactSelection(fairArtifactCatalog[0])),
      (error: any) => error.status === 503 && error.code === "FAIR_ARTIFACT_MISSING");
    await writeFile(path.join(root, "active.json"), JSON.stringify({ version: "wrong", release: "0".repeat(64) }),
      { mode: 0o600, flag: "wx" });
    await assert.rejects(createFairArtifactLoader()(fairArtifactSelection(fairArtifactCatalog[0])),
      (error: any) => error.status === 503 && error.code === "FAIR_ARTIFACT_UNREADABLE");
  } finally {
    if (previous === undefined) delete process.env.FAIR_ARTIFACT_ROOT;
    else process.env.FAIR_ARTIFACT_ROOT = previous;
  }
});

test("offline package functions cannot write outside ignored generated directory or activate arbitrary paths", async () => {
  await assert.rejects(buildFairBundle("public/private.fairbundle"), /PRIVATE_GENERATED/);
  await assert.rejects(activateFairRelease("public/store", "0".repeat(64), null), /PRIVATE_GENERATED/);
  const root = await mkdtemp(path.resolve("generated-artifacts/fair-activation-engineering-test-"));
  await assert.rejects(activateFairRelease(root, "../traversal", null), /EXACT_SHA256/);
});

test("separately versioned replacement requires explicit trusted baseline; legacy build cannot silently refreeze", async () => {
  const root = await mkdtemp(path.resolve("generated-artifacts/fair-replacement-refusal-test-"));
  await assert.rejects(buildFairBundle(path.join(root, "silent.fairbundle")), /REPLACEMENT_REQUIRED/);
  await assert.rejects(buildFairReplacementBundle(path.join(root, "replacement.fairbundle"), "not-read", "0".repeat(64)),
    /BASELINE_NOT_AUTHORIZED/);
  await assert.rejects(validateFairReplacement("not-read", "0".repeat(64), "not-read", "0".repeat(64)),
    /BASELINE_NOT_AUTHORIZED/);
});

test("operator CLI accepts sha256 option names and reaches exact-baseline authorization", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "script/fair-artifact-bundle.ts", "validate-replacement",
    "--baseline=not-read", `--baseline-sha256=${"0".repeat(64)}`, "--bundle=not-read", `--sha256=${"0".repeat(64)}`],
  { encoding: "utf8", env: { ...process.env, DATABASE_URL: undefined, NODE_ENV: "test" } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /FAIR_REPLACEMENT_BASELINE_NOT_AUTHORIZED/);
  assert.doesNotMatch(result.stderr, /Use --key=value/);
});
