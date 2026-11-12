/**
 * Explicit authorized-shell DEV engineering check. All database connections
 * MUST be read-only. NEW private files live in ephemeral 0700 directories and
 * are removed in finally; no approval, publication, DDL or original XLSX claim.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, readFile, writeFile, readdir, chmod, symlink, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { loadAnalysisResult } from "../server/snapshots/results";
import { contentHash } from "../server/calculation/analysisManifest";
import { readStoredProspectiveResultExport } from "../server/snapshots/prospectiveResultExportLifecycle";

const execute = promisify(execFile);
const parentId = "102d005b0437c31eced43aa4eb33e7470279de0a423dbb62191f4f1ebc62862c";

async function census() {
  const result = await db.execute(sql`SELECT s.id,s.kind,s.parent_id,s.company_count,s.observation_count,
    s.chunk_count,s.source_note,s.created_at,c.ordinal,md5(c.payload::text) AS payload_checksum
    FROM cv_analysis_snapshots s LEFT JOIN cv_analysis_chunks c ON c.snapshot_id=s.id
    ORDER BY s.id,c.ordinal`);
  const rows = JSON.parse(JSON.stringify(result.rows)) as { id: string; kind: string }[];
  const results = [...new Set(rows.filter(x => x.kind === "analysis-result").map(x => x.id))];
  return { checksum: contentHash(rows), headers: new Set(rows.map(x => x.id)).size,
    chunkRows: rows.length, retainedResultCount: results.length, resultIds: results };
}

async function check() {
  assert.equal(process.env.NODE_ENV, "development", "Explicit DEV only");
  assert.match(process.env.PGOPTIONS ?? "", /default_transaction_read_only=on/, "All connections must default read-only");
  const guard = await db.execute(sql`SELECT current_setting('transaction_read_only') AS read_only,
    current_setting('default_transaction_read_only') AS default_read_only`);
  assert.equal(guard.rows[0].read_only, "on");
  assert.equal(guard.rows[0].default_read_only, "on");
  const before = await census();
  assert.equal(before.retainedResultCount, 124, "The previously inspected 124 retained records must still be present");
  const parent = await loadAnalysisResult(parentId);
  const parentBefore = contentHash(JSON.parse(JSON.stringify(parent)));
  const root = await mkdtemp(join(tmpdir(), "prospective-export-real-dev-"));
  const config = { environment: "development", directory: root };
  const requestId = randomBytes(32).toString("hex");
  const selected = { requestId, expectedParentResultId: parentId };
  const filename = (key: string) => join(root, `prospective-result-export-${key}.json`);
  const env = { ...process.env, NODE_ENV: "development", PROSPECTIVE_RESULT_EXPORT_DIR: root };
  const cli = async (command: string, key = requestId, parent = parentId, extra: string[] = []) => {
    const result = await execute(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"),
      "script/operator-prospective-result-export.ts", command, parent, key, ...extra],
    { env, maxBuffer: 64 * 1024 * 1024, encoding: "buffer" });
    return result.stdout as Buffer;
  };
  let receipt: Record<string, unknown> | undefined;
  try {
    assert.equal((await stat(root)).mode & 0o777, 0o700);
    const capture = JSON.parse((await cli("capture")).toString());
    const stored = await readStoredProspectiveResultExport(selected, config, loadAnalysisResult);
    const envelopeBefore = await readFile(filename(requestId));
    assert.equal(capture.id, stored.id);
    assert.equal((await stat(filename(requestId))).mode & 0o777, 0o600);
    assert.ok((await cli("read", requestId, parentId, ["--xlsx-stdout"])).equals(stored.bytes));
    const retry = JSON.parse((await cli("capture")).toString());
    assert.equal(retry.disposition, "retained-retry");
    assert.equal(retry.id, capture.id);
    assert.equal(retry.record.capturedAt, capture.record.capturedAt);
    assert.ok((await readFile(filename(requestId))).equals(envelopeBefore));
    const readReceipt = JSON.parse((await cli("read")).toString());
    assert.equal(readReceipt.id, capture.id);
    const otherId = before.resultIds.find(id => id !== parentId)!;
    await assert.rejects(() => cli("capture", requestId, otherId), /conflict/);
    assert.ok((await readFile(filename(requestId))).equals(envelopeBefore));
    await assert.rejects(() => readStoredProspectiveResultExport({ ...selected, expectedParentResultId: otherId },
      config, loadAnalysisResult), /conflict/);
    const keys = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
    const concurrent = await Promise.all(keys.map(key => cli("capture", key)));
    for (let i = 0; i < keys.length; i++) {
      const first = JSON.parse(concurrent[i].toString());
      const back = await readStoredProspectiveResultExport({ ...selected, requestId: keys[i] }, config, loadAnalysisResult);
      assert.equal(first.id, back.id);
      assert.ok((await cli("read", keys[i], parentId, ["--xlsx-stdout"])).equals(back.bytes));
    }
    // Mutations are PRIVATE ephemeral engineering copies only, never DEV
    // parent records or an operator review/approval. Restore each copy exactly.
    const copyKey = randomBytes(32).toString("hex");
    const source = JSON.parse(envelopeBefore.toString());
    source.requestId = copyKey;
    const copyPath = filename(copyKey), copySelection = { ...selected, requestId: copyKey };
    const copyBytes = Buffer.from(JSON.stringify(source));
    await writeFile(copyPath, copyBytes, { flag: "wx", mode: 0o600 });
    const readCopy = () => readStoredProspectiveResultExport(copySelection, config, loadAnalysisResult);
    assert.ok((await readCopy()).bytes.equals(stored.bytes));
    await writeFile(copyPath, JSON.stringify({ ...source, version: "unsupported-version" }));
    await assert.rejects(readCopy);
    await writeFile(copyPath, JSON.stringify({ ...source, xlsxBase64: Buffer.from("corrupt").toString("base64") }));
    await assert.rejects(readCopy, /corrupt/);
    await writeFile(copyPath, copyBytes);
    await chmod(copyPath, 0o644);
    await assert.rejects(readCopy, /access/);
    await chmod(copyPath, 0o600);
    await rm(copyPath);
    await symlink(filename(requestId), copyPath);
    await assert.rejects(readCopy, /ELOOP/);
    await rm(copyPath);
    assert.ok((await readFile(filename(requestId))).equals(envelopeBefore));
    assert.equal(contentHash(JSON.parse(JSON.stringify(await loadAnalysisResult(parentId)))), parentBefore);
    const after = await census();
    assert.deepEqual(after, before, "All prior immutable headers and chunks unchanged");
    assert.ok((await readdir(root)).every(name => !name.includes("pending")));
    receipt = {
      check: "actual-DEV-existing-operator-CLI-private-file-lifecycle",
      databaseReadOnly: true,
      retainedResultsBefore: before.retainedResultCount, retainedResultsAfter: after.retainedResultCount,
      allArchiveHeadersBefore: before.headers, allArchiveChunkRowsBefore: before.chunkRows,
      allArchiveChecksumBefore: before.checksum, allArchiveChecksumAfter: after.checksum,
      old124Unchanged: true, parentUnchanged: true, parentResultId: parentId,
      captureId: stored.id, capturedAt: stored.record.capturedAt,
      binarySha256: stored.record.binarySha256, byteLength: stored.record.byteLength,
      cellsHash: stored.record.cellsHash, parent: stored.record.parent,
      actualCommandCaptureReadAndRetryPassed: true,
      retryExactIdTimeBytes: true, conflictingParentRefused: true,
      concurrentDifferentRequestIds: keys.length, concurrentExactByteReadback: true,
      privateEphemeralCopyVersionCorruptionPermissionsAndSymlinkRefused: true,
      directoryMode: "0700", fileMode: "0600", noPendingFiles: true,
      operatorApproval: false, originalHistoricalExport: false, published: false,
      persistentActivation: false, rawRowsOrPrivateBytesPrinted: false,
    };
  } finally { await rm(root, { recursive: true, force: true }); }
  await assert.rejects(() => stat(root), /ENOENT/);
  return { ...receipt, ephemeralPrivateDirectoryRemoved: true };
}

check().then(receipt => {
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(0);
}).catch(error => {
  console.error(error instanceof Error ? error.message : "DEV export check failed");
  process.exit(1);
});
