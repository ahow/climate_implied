/** Actual SDG calculations and review helpers, deliberately rolled-back development fixture. */
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../server/db";
import { resolveSnapshot,snapshotContext } from "../server/snapshots/store";
import { overlayContext,loadOverlay } from "../server/snapshots/overlays";
import { stageOverlayReviewInTransaction,decideOverlayReviewInTransaction } from "../server/snapshots/overlayReview";
import { calculateSDGGrowthDifferential } from "../server/climateValuation/sdgGrowthCalculator";
import { contentHash } from "../server/calculation/analysisManifest";
import { combinedRefreshFixture } from "./combined-refresh-fixture";
import { runWithOverrideRows,requestOverrides,type OverrideRow } from "../server/dataIngestion/requestOverrides";
if(process.env.NODE_ENV==="production") throw new Error("Development only");
const header=await resolveSnapshot();assert.ok(header);
const baseline=await snapshotContext.run(header,()=>calculateSDGGrowthDifferential(.08));
const digest=(x:unknown)=>contentHash(JSON.parse(JSON.stringify(x)));
const baselineHash=digest(baseline),marker=randomUUID(),rollback=new Error("rollback");
let proposalId="",decisionId="",overlayId="";
let extra:Awaited<ReturnType<typeof combinedRefreshFixture>>|undefined;
const originalDrivers=await db.execute(sql`SELECT indicator_key AS "indicatorKey",year,value,source,
 source_url AS "sourceUrl",as_of_date AS "asOfDate",method FROM indicator_values WHERE status='approved' ORDER BY indicator_key,year`);
const originalDriverHash=runWithOverrideRows(originalDrivers.rows as OverrideRow[],()=>requestOverrides.getStore()!.hash);
try {
  await db.transaction(async tx=>{
    const candidates=await tx.execute(sql`SELECT c.id,t.date FROM cv_companies c JOIN cv_time_series t ON t.company_id=c.id
      WHERE c.sdg_alignment_score>0 AND t.net_profit>0 AND t.market_cap>0 ORDER BY c.id,t.date LIMIT 1`);
    assert.equal(candidates.rows.length,1);
    const row=candidates.rows[0];
    const observationDate=new Date(row.date as string).toISOString().slice(0,10);
    let release!:()=>void;
    const pending=new Promise<void>(resolve=>{release=resolve;});
    // Old request starts before approval, suspends while the reviewed request runs.
    const oldRequest=runWithOverrideRows(originalDrivers.rows as OverrideRow[],()=>snapshotContext.run(header,async()=>{
      await pending;
      assert.equal(overlayContext.getStore(),undefined,"Overlay must not leak across requests");
      assert.equal(requestOverrides.getStore()!.hash,originalDriverHash,"Current driver refresh must not contaminate suspended request");
      return calculateSDGGrowthDifferential(.08);
    }));
    try {
      extra=await combinedRefreshFixture(tx,marker,Number(row.id),observationDate);
      proposalId=await stageOverlayReviewInTransaction(tx,[{companyId:Number(row.id),
        observationDate,availableAt:observationDate,kind:"sdg",field:"sdgAlignmentScore",
        unit:"score",value:-100,source:`rollback-only:${marker}`,approvalEvidence:"Disposable fixture, not real review",
        historyBasis:"revised-history"}]);
      const decision=await decideOverlayReviewInTransaction(tx,proposalId,"approved");
      decisionId=String(decision.id);overlayId=decision.overlayId!;
      const overlay=await loadOverlay(overlayId,tx);
      const carbon=await loadOverlay(extra.carbonOverlayId,tx);
      const modified=await runWithOverrideRows(extra.driverRows as OverrideRow[],()=>snapshotContext.run(header,()=>overlayContext.run({
        ids:[extra!.carbonOverlayId,overlayId],cutoff:decision.decidedAt.slice(0,10),overlays:[carbon,overlay],
      },()=>{
        assert.notEqual(requestOverrides.getStore()!.hash,originalDriverHash);
        return calculateSDGGrowthDifferential(.08);
      })));
      assert.notEqual(digest(modified),baselineHash,"The approved perturbation must affect this request");
    } finally { release(); }
    assert.equal(digest(await oldRequest),baselineHash,"Old in-flight request retains baseline after review");
    throw rollback;
  });
} catch(e) {if(e!==rollback) throw e;}
for(const id of [proposalId,decisionId,overlayId,...(extra?.archiveIds ?? [])])
  assert.equal((await db.execute(sql`SELECT id FROM cv_analysis_snapshots WHERE id=${id}`)).rows.length,0);
assert.ok(extra);
assert.equal((await db.execute(sql`SELECT id FROM financial_reviews WHERE id=${extra.financialId}`)).rows.length,0);
assert.equal((await db.execute(sql`SELECT id FROM indicator_values WHERE id=${extra.driverId}`)).rows.length,0);
const restoredDrivers=await db.execute(sql`SELECT indicator_key AS "indicatorKey",year,value,source,
 source_url AS "sourceUrl",as_of_date AS "asOfDate",method FROM indicator_values WHERE status='approved' ORDER BY indicator_key,year`);
assert.equal(runWithOverrideRows(restoredDrivers.rows as OverrideRow[],()=>requestOverrides.getStore()!.hash),originalDriverHash);
console.log(JSON.stringify({status:"pass",scope:"Combined financial/carbon/SDG/driver real helper transaction; SDG result and driver-context overlap",
  limitation:"Current financial review remains separate from historical workbook substitution; not all-nine-path combined-refresh acceptance",baselineHash,
  modifiedRequestChanged:true,oldRequestUnchanged:true,completeRollback:true,realApprovals:0}));
process.exit(0);
