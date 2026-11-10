/** Disposable engineering inputs only. Caller MUST roll back its transaction. */
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { indicatorValues } from "../shared/schema";
import { approveProposalInTransaction } from "../server/dataIngestion/dataStore";
import { reviewInTransaction } from "../server/financialData/reviewStore";
import { stageOverlayReviewInTransaction,decideOverlayReviewInTransaction } from "../server/snapshots/overlayReview";
import assert from "node:assert/strict";
type Transaction=Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function combinedRefreshFixture(tx:Transaction,marker:string,companyId:number,observationDate:string) {
  const before=await tx.execute(sql`SELECT id FROM cv_analysis_snapshots ORDER BY id`);
  const existing=new Set(before.rows.map(r=>String(r.id)));
  const financialId=`rollback-financial-${marker}`;
  const payload={
    identity:{companyId:2147483647,isin:"US0378331005",symbol:"FIXTURE",currency:"USD",
      exchange:"NASDAQ",shareClassFIGI:"FIXTURE",issuerId:marker,marketCapScope:"issuer",
      primaryListingEvidence:"https://example.org/fixture",issuerEvidence:"https://example.org/fixture",
      reviewedAt:"2026-11-06T00:00:00Z"},
    quote:{price:10,marketCap:1000,observedAt:"2026-11-05T21:00:00Z"},
    statement:{netIncome:100,currency:"USD",period:"2025-12-31",filingDate:"2026-02-01"},
    fetchedAt:"2026-11-06T00:00:00Z",
  };
  await tx.execute(sql`INSERT INTO financial_reviews(id,status,payload)
    VALUES(${financialId},'pending',${JSON.stringify(payload)}::jsonb)`);
  await reviewInTransaction(tx,financialId,"approved");
  await reviewInTransaction(tx,financialId,"approved");
  await assert.rejects(reviewInTransaction(tx,financialId,"rejected"));
  const driverId=`rollback-driver-${marker}`;
  await tx.insert(indicatorValues).values({id:driverId,indicatorKey:"evSalesSharePct",
    year:2024,value:99,source:`disposable:${marker}`,asOfDate:"2024-12-31",method:"manual",status:"pending"});
  assert.ok(await approveProposalInTransaction(tx,driverId));
  assert.equal(await approveProposalInTransaction(tx,driverId),undefined);
  const driverRows=await tx.execute(sql`SELECT indicator_key AS "indicatorKey",year,value,source,
    source_url AS "sourceUrl",as_of_date AS "asOfDate",method FROM indicator_values
    WHERE status='approved' ORDER BY indicator_key,year`);
  const carbonProposal=await stageOverlayReviewInTransaction(tx,[{
    companyId,observationDate,availableAt:observationDate,kind:"carbon",field:"scope1Emissions",
    unit:"tCO2e",value:123,source:`disposable:${marker}`,approvalEvidence:"Rollback-only engineering fixture",
    historyBasis:"revised-history",
  }]);
  const carbonDecision=await decideOverlayReviewInTransaction(tx,carbonProposal,"approved");
  assert.deepEqual(await decideOverlayReviewInTransaction(tx,carbonProposal,"approved"),carbonDecision);
  await assert.rejects(decideOverlayReviewInTransaction(tx,carbonProposal,"rejected"),/Conflicting/);
  const after=await tx.execute(sql`SELECT id FROM cv_analysis_snapshots ORDER BY id`);
  const archiveIds=after.rows.map(r=>String(r.id)).filter(id=>!existing.has(id));
  assert.ok(archiveIds.length>=5,"Financial, indicator, carbon proposal/decision/overlay archives required");
  return {financialId,driverId,driverRows:driverRows.rows,carbonOverlayId:carbonDecision.overlayId!,archiveIds};
}
