/** Development-only acceptance. All fixtures AND archives are rolled back. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "../server/db";
import { indicatorValues, cvAnalysisChunks, cvAnalysisSnapshots } from "../shared/schema";
import { approveProposalInTransaction, createManualApprovedInTransaction } from "../server/dataIngestion/dataStore";
import { packIndicators, unpackIndicators } from "../server/snapshots/indicatorContract";
import { snapshotsAvailable } from "../server/snapshots/store";
if (process.env.NODE_ENV === "production") throw new Error("Development only");
const rollback = new Error("intentional acceptance rollback");
const key = `acceptance-fixture-${randomUUID()}`;
const archiveIds: string[] = [];
async function isolated(value: number) {
  try {
    await db.transaction(async tx => {
      // Same lock ordering as production. Concurrent transactions each roll
      // back, so no fixture can enter the permanent append-only archive.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('approved-indicator-archive'))`);
      const [proposal] = await tx.insert(indicatorValues).values({
        indicatorKey: key, year: 2024, value, source: "Acceptance fixture",
        method: "manual", status: "pending",
      }).returning();
      assert.equal((await approveProposalInTransaction(tx, proposal.id))?.status, "approved");
      assert.equal(await approveProposalInTransaction(tx, proposal.id), undefined);
      await createManualApprovedInTransaction(tx, { indicatorKey: key, year: 2024, value: value + 10 });
      const rows = await tx.select().from(indicatorValues).where(eq(indicatorValues.status, "approved"));
      assert.equal(rows.filter(r => r.indicatorKey === key).length, 1);
      const packed = packIndicators(rows);
      archiveIds.push(packed.id);
      const [header] = await tx.select().from(cvAnalysisSnapshots).where(eq(cvAnalysisSnapshots.id, packed.id));
      const [chunk] = await tx.select().from(cvAnalysisChunks).where(eq(cvAnalysisChunks.snapshotId, packed.id));
      assert.equal(header.observationCount, rows.length);
      assert.deepEqual(unpackIndicators(header.id, chunk.payload), packed.payload.rows);
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
}
try {
  assert.equal(await snapshotsAvailable(), true, "Provision development archive guards first");
  await Promise.all([isolated(1), isolated(2)]);
  await assert.rejects(db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('approved-indicator-archive'))`);
    const [proposal] = await tx.insert(indicatorValues).values({
      indicatorKey: key, year: 2025, value: 1, source: "",
      method: "manual", status: "pending",
    }).returning();
    // Invalid archive metadata must roll back the approval, not merely log it.
    await approveProposalInTransaction(tx, proposal.id);
  }));
  assert.equal((await db.select().from(indicatorValues).where(eq(indicatorValues.indicatorKey, key))).length, 0);
  for (const id of archiveIds)
    assert.equal((await db.select().from(cvAnalysisSnapshots).where(eq(cvAnalysisSnapshots.id, id))).length, 0);
  console.log("PASS: concurrent approval transactions serialize, capture exact approved sets, reject double approval, and roll back inputs plus archives without persistent fixtures; invalid archive metadata also rolls back approval");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Approval acceptance failed");
  process.exitCode = 1;
} finally { process.exit(process.exitCode ?? 0); }
