/** Nine actual calculator paths and review helpers; rolled-back development fixture only. */
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../server/db";
import { resolveSnapshot,snapshotContext } from "../server/snapshots/store";
import { overlayContext,loadOverlay } from "../server/snapshots/overlays";
import { stageOverlayReviewInTransaction,decideOverlayReviewInTransaction } from "../server/snapshots/overlayReview";
import { contentHash } from "../server/calculation/analysisManifest";
import { combinedRefreshFixture } from "./combined-refresh-fixture";
import { runWithOverrideRows,requestOverrides,type OverrideRow } from "../server/dataIngestion/requestOverrides";
import { calculateSelectedResult,replayPaths } from "./replay-sdg-result";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { packOverlay } from "../server/snapshots/overlayContract";
if(process.env.NODE_ENV==="production") throw new Error("Development only");
const header=await resolveSnapshot();assert.ok(header);
const calculateAll=async()=>{
  const results:Record<string,unknown>={};
  for(const path of replayPaths) results[path]=publicValuationResult(
    await calculateSelectedResult(path,{method:"absolute"},header),path.startsWith("/decarb-gap"));
  return results;
};
const digest=(x:unknown)=>contentHash(JSON.parse(JSON.stringify(x)));
const marker=randomUUID(),rollback=new Error("rollback");
let proposalId="",decisionId="",overlayId="";
let extra:Awaited<ReturnType<typeof combinedRefreshFixture>>|undefined;
const originalDrivers=await db.execute(sql`SELECT indicator_key AS "indicatorKey",year,value,source,
 source_url AS "sourceUrl",as_of_date AS "asOfDate",method FROM indicator_values WHERE status='approved' ORDER BY indicator_key,year`);
const originalDriverHash=runWithOverrideRows(originalDrivers.rows as OverrideRow[],()=>requestOverrides.getStore()!.hash);
const baseline=await runWithOverrideRows(originalDrivers.rows as OverrideRow[],()=>snapshotContext.run(header,calculateAll));
const baselineHash=digest(baseline);
let changedPaths:string[]=[];
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
      return calculateAll();
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
      // Financial review intentionally cannot enter the SDG/carbon review workflow.
      // Its actual helper ran above; historical substitution is a private engineering overlay.
      const financial=packOverlay([{companyId:Number(row.id),
        observationDate,availableAt:observationDate,kind:"financial",field:"marketCap",
        unit:"USD million",value:1000000,source:`rollback-only:${marker}`,
        approvalEvidence:"Synthetic engineering only; rollback",historyBasis:"revised-history"}]);
      const modified=await runWithOverrideRows(extra.driverRows as OverrideRow[],()=>snapshotContext.run(header,()=>overlayContext.run({
        ids:[extra!.carbonOverlayId,overlayId,financial.id],cutoff:decision.decidedAt.slice(0,10),overlays:[carbon,overlay,financial.payload],
      },()=>{
        assert.notEqual(requestOverrides.getStore()!.hash,originalDriverHash);
        return calculateAll();
      })));
      assert.notEqual(digest(modified),baselineHash,"The approved perturbation must affect this request");
      changedPaths=replayPaths.filter(path=>digest(modified[path])!==digest(baseline[path]));
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
assert.equal(overlayContext.getStore(),undefined);
assert.equal(snapshotContext.getStore(),undefined);
assert.equal(requestOverrides.getStore(),undefined);
const returned=await runWithOverrideRows(restoredDrivers.rows as OverrideRow[],()=>snapshotContext.run(header,calculateAll));
assert.equal(digest(returned),baselineHash,"Returning to baseline selection after combined refresh");
console.log(JSON.stringify({status:"pass",scope:"Combined financial/carbon/SDG/driver real helper transaction; all nine actual calculator paths",
  actualPaths:replayPaths,changedPaths,currentSelectionReturned:true,
  emptyTargetPaths:replayPaths.filter(path=>Array.isArray(baseline[path])&&(baseline[path] as unknown[]).length===0),
  limitation:"Target calculators lack base-year metadata and remain empty; no nonempty-target acceptance. Current financial review is separate from explicit historical financial overlay. No production or real issuer approvals.",baselineHash,
  modifiedRequestChanged:true,oldRequestUnchanged:true,completeRollback:true,realApprovals:0}));
process.exit(0);
