/** Disposable DEVELOPMENT transaction; no real issuer approvals or retained fixtures. */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {sql} from "drizzle-orm";
import {db} from "../server/db";
import {contentHash} from "../server/calculation/analysisManifest";
import {materialLeaves} from "../server/calculation/companyProjectionAsOf";
import {packCompanySource} from "../server/calculation/companySourceArchive";
import {stageCompanyOperatingInTransaction as stage,stageCompanySourcePacketInTransaction,decideCompanyOperatingInTransaction as decide,projectReviewedCompanyInTransaction as project} from "../server/snapshots/companyOperatingReview";
if(process.env.NODE_ENV==="production") throw new Error("Development only");
const rollback=new Error("deliberate rollback"),ids:string[]=[];
const marker=randomUUID(),isin="ZZ"+marker.replaceAll("-","").slice(0,9).toUpperCase()+"0";
try{
 await db.transaction(async tx=>{
  const company=await tx.execute(sql`INSERT INTO cv_companies(isin,name) VALUES(${isin},'ISOLATED ENGINEERING FIXTURE') RETURNING id`);
  const identity={companyId:String(company.rows[0].id),isin};
  const year={exposures:[{region:"fixture-region",sector:"fixture-sector",activityGrowth:.01}],
    marketShareMultiplier:1,operatingMargin:.1,taxRate:.2,interest:0,depreciation:10,capex:10,
    increaseWorkingCapital:0,netBorrowing:0,nonOperatingIncome:0,incomeAttributionAdjustment:0,otherCashAdjustments:0,
    scope1IntensityMultiplier:1,scope2IntensityMultiplier:1,scope3IntensityMultiplier:1,
    scope1LiableFraction:0,scope2LiableFraction:0,effectiveCarbonPrice:0,passThrough:0};
  const input={companyId:identity.companyId,manifestId:marker,currency:"USD",businessType:"non-financial",
    baseYear:2024,baseRevenue:1000,baseFcfe:80,baseEmissionsTonnes:{scope1:100,scope2:0,scope3:100},
    marginBounds:{minimum:0,maximum:.2,evidence:["synthetic"]},
    mapping:{basis:"operating-geography",evidence:["synthetic"],shares:[{region:"fixture-region",sector:"fixture-sector",weight:1}]},
    members:["a","b"].map(id=>({id,years:Array.from({length:5},(_,i)=>({...year,year:2025+i}))}))};
  const availableAt="2024-01-01T00:00:00Z";
  const claims=Object.entries(materialLeaves(input)).map(([path,value])=>({path,valueHash:contentHash(value),
    locator:"synthetic fixture",unit:"fixture unit, not economic evidence",period:"2024-2029",geography:"fixture-region",
    basis:"assumption",availableAt,method:"Synthetic engineering input",dependencies:[]}));
  const source=packCompanySource({version:"company-operating-source-1",...identity,url:"https://example.org/fixture",
    publisher:"Synthetic fixture",publishedAt:availableAt,retrievedAt:availableAt,content:marker,contentHash:contentHash(marker),
    licence:"Synthetic",claims});
  ids.push(source.id);
  const sourcePacket=await stageCompanySourcePacketInTransaction(tx,identity,[source.payload],["Synthetic missing operating inputs"]);
  ids.push(sourcePacket);
  assert.equal(sourcePacket,await stageCompanySourcePacketInTransaction(tx,identity,[source.payload],["Synthetic missing operating inputs"]));
  await assert.rejects(()=>decide(tx,sourcePacket,"approved",1),/archive|Archive/);
  const evidence=claims.map(({path,valueHash,basis,availableAt})=>({path,valueHash,basis,availableAt,sourceArchiveId:source.id}));
  const proposal=await stage(tx,input,evidence,[source.payload],identity,availableAt);ids.push(proposal);
  assert.equal(await stage(tx,input,evidence,[source.payload],identity,availableAt),proposal);
  // Expected validation failures do not issue failing SQL or abort the outer transaction.
  await assert.rejects(decide(tx,proposal,"approved","nonexistent"),/owner-approved/);
  const financialId=marker;
  await tx.execute(sql`INSERT INTO financial_reviews(id,status,payload,reviewed_at)
    VALUES(${financialId},'approved',${JSON.stringify({identity:{...identity,companyId:Number(identity.companyId)}})}::jsonb,transaction_timestamp())`);
  const approved=await decide(tx,proposal,"approved",financialId);ids.push(String(approved.id),approved.financialIdentityArchive);
  assert.deepEqual(await decide(tx,proposal,"approved",financialId),approved);
  await assert.rejects(decide(tx,proposal,"rejected",financialId),/Conflicting/);
  await assert.rejects(project(tx,String(approved.id),availableAt),/Approval unavailable/);
  const result=await project(tx,String(approved.id),approved.decidedAt);
  assert.equal(result.scientificAcceptance,false);
  assert.deepEqual(await project(tx,String(approved.id),approved.decidedAt),result);
  assert.equal(result.sourceEvidence.originalVintageProven,false);
  throw rollback;
 });
}catch(error){if(error!==rollback) throw error;}
for(const id of ids) assert.equal((await db.execute(sql`SELECT id FROM cv_analysis_snapshots WHERE id=${id}`)).rows.length,0);
assert.equal((await db.execute(sql`SELECT id FROM cv_companies WHERE isin=${isin}`)).rows.length,0);
assert.equal((await db.execute(sql`SELECT id FROM financial_reviews WHERE id=${marker}`)).rows.length,0);
console.log("PASS operating lifecycle: pending stage/idempotency, missing identity rejection, synthetic approval/repeat/conflict, historical cutoff rejection, deterministic projection, complete rollback");
process.exit(0);
