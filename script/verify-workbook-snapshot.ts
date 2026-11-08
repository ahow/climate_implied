import assert from "node:assert/strict";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { captureCurrentWorkbook, loadSnapshot, resolveSnapshot, snapshotContext } from "../server/snapshots/store";
import { contentHash } from "../server/calculation/analysisManifest";
import { loadCompaniesAndTimeSeries } from "../server/climateValuation/sharedUtils";
if (process.env.NODE_ENV === "production") throw new Error("Development verification only");
try {
  const before = await resolveSnapshot();
  assert.ok(before);
  const captured = await captureCurrentWorkbook();
  assert.equal(captured.id, before.id);
  assert.equal(captured.created, false);
  const result = await loadSnapshot(before);
  assert.equal(result.companies.length, before.companyCount);
  assert.equal(result.timeSeries.length, before.observationCount);
  const repeated = await snapshotContext.run(before, () => loadCompaniesAndTimeSeries(false));
  assert.equal(contentHash(result.companies), contentHash(repeated.companies));
  const normalize = (rows: typeof repeated.timeSeries) => rows.map(r => ({ ...r, date: r.date.toISOString() }))
    .sort((a, b) => a.companyId - b.companyId || a.date.localeCompare(b.date));
  assert.equal(contentHash(normalize(result.timeSeries)), contentHash(normalize(repeated.timeSeries)));
  for (const command of [
    sql`UPDATE cv_analysis_snapshots SET source_note='forbidden' WHERE id=${before.id}`,
    sql`DELETE FROM cv_analysis_chunks WHERE snapshot_id=${before.id} AND ordinal=0`,
    sql`INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload) VALUES(${before.id},999999,'{}')`,
  ]) {
    let blocked = false;
    try { await db.transaction(async tx => { await tx.execute(command); throw new Error("GUARD_DID_NOT_REJECT"); }); }
    catch (error) {
      const message = String(error) + String((error as { cause?: unknown }).cause ?? "");
      blocked = /Immutable analysis snapshot|Snapshot is already sealed/.test(message);
    }
    assert.ok(blocked, "Database must reject mutations to sealed data");
  }
  console.log(JSON.stringify({ status: "passed", snapshotId: before.id, companies: before.companyCount,
    observations: before.observationCount, captureIdempotent: true, consumerReplay: true, mutationGuards: 3 }));
} catch (error) {
  console.error("Snapshot verification failed:", error instanceof Error ? error.message : "Unknown failure");
  process.exitCode = 1;
} finally { process.exit(process.exitCode ?? 0); }
