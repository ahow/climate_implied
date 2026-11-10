/** Real helpers, one transaction deliberately rolled back; no committed fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { stageOverlayReviewInTransaction as stage, decideOverlayReviewInTransaction as decide } from "../server/snapshots/overlayReview";
import { contentHash } from "../server/calculation/analysisManifest";
import { loadOverlay } from "../server/snapshots/overlays";
if (process.env.NODE_ENV === "production") throw new Error("Development only");
const sentinel = new Error("rollback"), marker = randomUUID(), ids: string[] = [];
try {
  await db.transaction(async tx => {
    const r = await tx.execute(sql`SELECT company_id,date FROM cv_time_series ORDER BY id LIMIT 1`);
    assert.ok(r.rows.length);
    const companyId = Number(r.rows[0].company_id), observationDate = new Date(r.rows[0].date as string).toISOString().slice(0,10);
    for (const [kind, field, unit] of [["carbon","scope1Emissions","tCO2e"],["sdg","sdgAlignmentScore","score"]]) {
      const entries = [{ companyId, observationDate, availableAt: observationDate,
        kind, field, unit, value: 1, source: `disposable:${marker}`, approvalEvidence: "rollback-only fixture",
        historyBasis: "revised-history" }];
      const proposal = await stage(tx, entries); ids.push(proposal);
      assert.equal(await stage(tx, entries), proposal);
      const decision = await decide(tx, proposal, "approved"); ids.push(String(decision.id), decision.overlayId!);
      assert.deepEqual(await decide(tx, proposal, "approved"), decision);
      await assert.rejects(decide(tx, proposal, "rejected"), /Conflicting/);
      const archive = await tx.execute(sql`SELECT payload FROM cv_analysis_chunks WHERE snapshot_id=${decision.overlayId}`);
      assert.equal(contentHash(archive.rows[0].payload), decision.overlayId);
      const payload = archive.rows[0].payload as any;
      assert.deepEqual(await loadOverlay(decision.overlayId!,tx),payload);
      assert.equal(payload.entries[0].availableAt, decision.decidedAt.slice(0,10));
      await assert.rejects(tx.transaction(async savepoint=>{
        await savepoint.execute(sql`UPDATE cv_analysis_chunks SET payload='{}'::jsonb WHERE snapshot_id=${decision.overlayId}`);
      }),/immutable|append|mutation/i);
      const rejected = await stage(tx, entries.map(e => ({ ...e,value:2 }))); ids.push(rejected);
      const no = await decide(tx,rejected,"rejected"); ids.push(String(no.id));
      assert.equal(no.overlayId,null);
      assert.deepEqual(await decide(tx,rejected,"rejected"),no);
      await assert.rejects(decide(tx,rejected,"approved"),/Conflicting/);
    }
    throw sentinel;
  });
} catch(e) { if(e!==sentinel) throw e; }
for(const id of ids) assert.equal((await db.execute(sql`SELECT id FROM cv_analysis_snapshots WHERE id=${id}`)).rows.length,0);
console.log("PASS carbon and SDG: stage/idempotency, approve/repeat/conflict, reject/repeat/conflict, hash/date, complete rollback");
process.exit(0);
