import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, readdir, chmod, symlink, readFile, writeFile, stat, link, rename } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Request, Response } from "express";
import express from "express";
import { createManifest, contentHash } from "../server/calculation/analysisManifest";
import { packAnalysisResult } from "../server/snapshots/resultContract";
import {
  captureStoredProspectiveResultExport as capture, readStoredProspectiveResultExport as read,
} from "../server/snapshots/prospectiveResultExportLifecycle";
import { denyPrivateProspectiveExport, registerProspectiveResultExportBoundary } from "../server/prospectiveResultExportApi";
import { releaseSafety } from "../server/releaseSafety";

// Explicit engineering parents only. The separate DEV check uses the genuine
// retained reader and read-only database; these are never production fallbacks.
function parent(value = 0) {
  const manifest = createManifest({
    codeVersion: "a".repeat(64), modelVersion: "engineering-fixture-only",
    snapshotHashes: ["b".repeat(64)], scenario: "descriptive-valuation:/summary",
    settings: { materialInputsId: "c".repeat(64) },
  });
  const packed = packAnalysisResult(manifest, { value, missing: null });
  return { ...packed.payload, id: packed.id, materialReplayState: "referenced-material-archives-verified" };
}
async function fixture(run: (x: {
  root: string; config: { environment: string; directory: string };
  selected: { requestId: string; expectedParentResultId: string };
  load: (id: string) => Promise<unknown>; first: ReturnType<typeof parent>; other: ReturnType<typeof parent>;
}) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "prospective-lifecycle-test-"));
  const first = parent(), other = parent(1);
  const load = async (id: string) => {
    const found = [first, other].find(p => p.id === id);
    if (!found) throw new Error("Missing retained parent");
    return structuredClone(found);
  };
  try {
    await run({ root, config: { environment: "development", directory: root },
      selected: { requestId: "d".repeat(64), expectedParentResultId: first.id }, load, first, other });
  } finally { await rm(root, { recursive: true, force: true }); }
}
const pathFor = (root: string, requestId: string) => join(root, `prospective-result-export-${requestId}.json`);

test("NEW append-only capture, exact durable read and same-request retry preserve original id/time/bytes", async () => {
  await fixture(async ({ root, config, selected, load, first }) => {
    const before = contentHash(first);
    const result = await capture(selected, config, load);
    assert.equal(result.disposition, "captured-new");
    assert.equal(result.record.originalHistoricalExport, false);
    const storedBytes = await readFile(pathFor(root, selected.requestId));
    const retry = await capture(selected, config, load);
    assert.equal(retry.disposition, "retained-retry");
    assert.equal(retry.id, result.id);
    assert.equal(retry.record.capturedAt, result.record.capturedAt);
    assert.ok(retry.bytes.equals(result.bytes));
    assert.ok((await read(selected, config, load)).bytes.equals(result.bytes));
    assert.ok((await readFile(pathFor(root, selected.requestId))).equals(storedBytes));
    assert.equal((await stat(pathFor(root, selected.requestId))).mode & 0o777, 0o600);
    assert.equal(contentHash(first), before);
    assert.deepEqual(await readdir(root), [`prospective-result-export-${selected.requestId}.json`]);
  });
});

test("same request with a different parent conflicts without altering committed bytes", async () => {
  await fixture(async ({ root, config, selected, load, other }) => {
    await capture(selected, config, load);
    const before = await readFile(pathFor(root, selected.requestId));
    const wrong = { ...selected, expectedParentResultId: other.id };
    await assert.rejects(() => capture(wrong, config, load), /conflict/);
    await assert.rejects(() => read(wrong, config, load), /conflict/);
    assert.ok((await readFile(pathFor(root, selected.requestId))).equals(before));
  });
});

test("concurrent different request IDs retain separate exact byte-identical readbacks", async () => {
  await fixture(async ({ root, config, selected, load }) => {
    const selections = ["1", "2", "3", "4"].map(v => ({ ...selected, requestId: v.repeat(64) }));
    const results = await Promise.all(selections.map(s => capture(s, config, load)));
    assert.equal((await readdir(root)).length, 4);
    for (let i = 0; i < results.length; i++) {
      assert.equal(results[i].disposition, "captured-new");
      assert.ok((await read(selections[i], config, load)).bytes.equals(results[i].bytes));
      assert.equal((await capture(selections[i], config, load)).id, results[i].id);
    }
  });
});

test("concurrent same-request captures commit one winner and all retries return exactly its id/time/bytes", async () => {
  await fixture(async ({ root, config, selected, load }) => {
    const results = await Promise.all(Array.from({ length: 5 }, () => capture(selected, config, load)));
    assert.equal(results.filter(r => r.disposition === "captured-new").length, 1);
    for (const result of results) {
      assert.equal(result.id, results[0].id);
      assert.equal(result.record.capturedAt, results[0].record.capturedAt);
      assert.ok(result.bytes.equals(results[0].bytes));
    }
    assert.equal((await readdir(root)).length, 1);
  });
});

test("cross-process forced link/unlink interleave waits boundedly, then reads only the single-link committed file", async () => {
  await fixture(async ({ root, config, selected, load }) => {
    const result = await capture(selected, config, load);
    const path = pathFor(root, selected.requestId), staging = join(root, ".prospective-export-pending-cross-process-test");
    await rename(path, staging);
    const child = spawn(process.execPath, ["--input-type=module", "-e",
      'import {linkSync,unlinkSync} from "node:fs"; linkSync(process.argv[1],process.argv[2]); process.stdout.write("linked\\n"); process.stdin.once("data",()=>setTimeout(()=>{unlinkSync(process.argv[1]);},50));',
      staging, path], { stdio: ["pipe", "pipe", "pipe"] });
    const ended = once(child, "exit");
    try {
      await once(child.stdout!, "data");
      assert.equal((await stat(path)).nlink, 2, "Reader starts inside the publication window");
      const pendingRead = read(selected, config, load);
      child.stdin!.end("release-staging-link\n");
      const readback = await pendingRead;
      assert.equal((await stat(path)).nlink, 1, "Never accepts the two-link state");
      assert.ok(readback.bytes.equals(result.bytes));
      assert.equal((await ended)[0], 0);
      assert.equal((await capture(selected, config, load)).id, result.id);
    } finally {
      if (child.exitCode === null) { child.kill(); await ended; }
    }
  });
});

test("explicit DEV/private directory access, malformed identities and symlinks are refused without writes", async () => {
  await fixture(async ({ root, config, selected, load }) => {
    for (const environment of [undefined, "production", "test"])
      await assert.rejects(() => capture(selected, { ...config, environment }, load), /explicit development/);
    for (const directory of [undefined, ".", `${root}/missing`, `${root}/../${root.split("/").pop()}`])
      await assert.rejects(() => capture(selected, { ...config, directory }, load));
    await assert.rejects(() => capture({ ...selected, requestId: "../evil" }, config, load));
    await chmod(root, 0o755);
    await assert.rejects(() => capture(selected, config, load), /0700/);
    await chmod(root, 0o700);
    const alias = `${root}-alias`;
    try {
      await symlink(root, alias);
      await assert.rejects(() => capture(selected, { ...config, directory: alias }, load), /non-symlink/);
    } finally { await rm(alias, { force: true }); }
    assert.deepEqual(await readdir(root), []);
    // All changes below are isolated temporary fixtures, never broad /tmp or
    // workspace permission changes. Validate the entire path, not only leaf.
    const parent = join(root, "ancestor"), leaf = join(parent, "private");
    await mkdir(parent, { mode: 0o700 });
    await mkdir(leaf, { mode: 0o700 });
    const nestedConfig = { ...config, directory: leaf };
    for (const unsafeMode of [0o777, 0o775, 0o770]) {
      await chmod(parent, unsafeMode);
      await assert.rejects(() => capture(selected, nestedConfig, load), /Unsafe private export ancestor/);
      await assert.rejects(() => read(selected, nestedConfig, load), /Unsafe private export ancestor/);
      assert.deepEqual(await readdir(leaf), []);
    }
    await chmod(parent, 0o700);
    const ancestorAlias = join(root, "ancestor-alias");
    await symlink(parent, ancestorAlias);
    await assert.rejects(() => capture(selected, { ...config, directory: join(ancestorAlias, "private") }, load), /non-symlink/);
    await rm(ancestorAlias);
    // Normal private directory under the platform's sticky tmp ancestry works.
    const captured = await capture(selected, nestedConfig, load);
    assert.ok((await read(selected, nestedConfig, load)).bytes.equals(captured.bytes));
    // Trusted-owner sticky ancestors are safe: sticky prevents OTHER uid users
    // from replacing the trusted-owned child, including in this uid-owned /tmp.
    await chmod(parent, 0o1777);
    assert.ok((await read(selected, nestedConfig, load)).bytes.equals(captured.bytes));
    await chmod(parent, 0o700);
  });
});

test("private file permission, hardlink and symlink access failures refuse reads and retries without repair", async () => {
  await fixture(async ({ root, config, selected, load }) => {
    await capture(selected, config, load);
    const path = pathFor(root, selected.requestId), original = await readFile(path);
    await chmod(path, 0o644);
    await assert.rejects(() => read(selected, config, load), /access/);
    await assert.rejects(() => capture(selected, config, load), /access/);
    await chmod(path, 0o600);
    const alias = join(root, "alias");
    await link(path, alias);
    await assert.rejects(() => read(selected, config, load), /access/);
    await rm(alias);
    await rm(path);
    await writeFile(alias, original, { flag: "wx", mode: 0o600 });
    await symlink(alias, path);
    await assert.rejects(() => read(selected, config, load), /ELOOP/);
    await assert.rejects(() => capture(selected, config, load), /ELOOP/);
    assert.ok((await readFile(alias)).equals(original));
  });
});

test("corrupt/missing bytes, wrong version/parent/id and missing dependencies never regenerate an envelope", async () => {
  await fixture(async ({ root, config, selected, load }) => {
    await capture(selected, config, load);
    const path = pathFor(root, selected.requestId), original = await readFile(path);
    const envelope = JSON.parse(original.toString());
    const mutations = [
      { ...envelope, version: "future-version" },
      { ...envelope, requestId: "e".repeat(64) },
      { ...envelope, parentResultId: "e".repeat(64) },
      { ...envelope, captureId: "e".repeat(64) },
      { ...envelope, record: { ...envelope.record, version: "future-version" } },
      { ...envelope, xlsxBase64: Buffer.from("corrupt").toString("base64") },
      { ...envelope, xlsxBase64: "" },
    ];
    for (const changed of mutations) {
      const bytes = Buffer.from(JSON.stringify(changed));
      await writeFile(path, bytes);
      await assert.rejects(() => read(selected, config, load));
      await assert.rejects(() => capture(selected, config, load));
      assert.ok((await readFile(path)).equals(bytes), "No repair or overwrite");
    }
    await writeFile(path, "{truncated");
    await assert.rejects(() => capture(selected, config, load));
    await writeFile(path, original);
    const absent = async () => { throw Object.assign(new Error("Missing material dependency"), { code: "ENOENT", path: "/unrelated/material" }); };
    await assert.rejects(() => capture(selected, config, absent), /Missing material dependency/);
    assert.ok((await readFile(path)).equals(original));
  });
});

test("failed new parent verification leaves no file; absent stored export is not auto-captured", async () => {
  await fixture(async ({ root, config, selected }) => {
    await assert.rejects(() => capture(selected, config, async () => { throw new Error("Parent unavailable"); }), /Parent unavailable/);
    await assert.rejects(() => read(selected, config, async () => { throw new Error("Must not load"); }), /ENOENT/);
    assert.deepEqual(await readdir(root), []);
  });
});

test("publication collision/failure cleans staged files and never overwrites a competing invalid target", async () => {
  await fixture(async ({ root, config, selected, load }) => {
    const path = pathFor(root, selected.requestId), competing = Buffer.from("{invalid-existing-record");
    let inserted = false;
    const race = async (id: string) => {
      if (!inserted) {
        inserted = true;
        await writeFile(path, competing, { flag: "wx", mode: 0o600 });
      }
      return load(id);
    };
    await assert.rejects(() => capture(selected, config, race));
    assert.ok((await readFile(path)).equals(competing));
    assert.deepEqual(await readdir(root), [`prospective-result-export-${selected.requestId}.json`]);
  });
});

test("mounted private HTTP read/capture deny every method without a fabricated principal or store read", async () => {
  const registrations: { path: string; handler: unknown }[] = [];
  registerProspectiveResultExportBoundary({ all(path: string, handler: unknown) {
    registrations.push({ path, handler });
  } } as any);
  assert.deepEqual(registrations.map(x => x.path), [
    "/api/analysis/results/:id/prospective-exports",
    "/api/analysis/results/:id/prospective-exports/:requestId",
  ]);
  assert.ok(registrations.every(x => x.handler === denyPrivateProspectiveExport));
  for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE"]) {
    let status = 0, body: any, nextCalls = 0;
    const response = { set() { return this; }, status(value: number) { status = value; return this; },
      json(value: unknown) { body = value; return this; } };
    const request = { method, path: `/api/analysis/results/${"a".repeat(64)}/prospective-exports/${"b".repeat(64)}`,
      headers: { authorization: "Bearer invented-is-not-auth", "x-operator-role": "admin" }, user: { role: "admin" } };
    releaseSafety()(request as unknown as Request, response as unknown as Response, () => { nextCalls++; });
    if (["GET", "HEAD"].includes(method)) {
      assert.equal(nextCalls, 1);
      denyPrivateProspectiveExport(request as unknown as Request, response as unknown as Response, () => assert.fail("must deny"));
    } else assert.equal(nextCalls, 0);
    assert.equal(status, 403);
    assert.equal(body.error, "operator-cli-required");
  }
  // Isolated loopback Express fixture, not an app workflow or public listener.
  const app = express();
  app.use(releaseSafety());
  registerProspectiveResultExportBoundary(app);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const port = (server.address() as { port: number }).port;
    const url = `http://127.0.0.1:${port}/api/analysis/results/${"a".repeat(64)}/prospective-exports/${"b".repeat(64)}`;
    for (const method of ["GET", "HEAD", "POST", "PUT", "DELETE"]) {
      const response = await fetch(url, { method, headers: {
        authorization: "Bearer not-a-real-principal", "x-operator-role": "admin", "x-forwarded-for": "127.0.0.1",
      } });
      assert.equal(response.status, 403);
      if (method === "GET") assert.equal(response.headers.get("Cache-Control"), "no-store");
      if (method !== "HEAD") assert.equal((await response.json()).error, "operator-cli-required");
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
