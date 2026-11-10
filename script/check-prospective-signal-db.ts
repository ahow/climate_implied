import {sql} from "drizzle-orm";
import {randomUUID} from "node:crypto";
import assert from "node:assert/strict";
import {db} from "../server/db";
import {contentHash} from "../server/calculation/analysisManifest";
import {captureProspectiveSignalInTransaction as capture} from "../server/snapshots/prospectiveSignal";
if(process.env.NODE_ENV==="production")throw new Error("Development rollback only");
const stop=new Error("deliberate rollback");let id="";
try{
 await db.transaction(async tx=>{
  const now=Date.now(),origin=new Date(now-86400000).toISOString();
  const definition={currency:"USD",basis:"FCFE",horizonYears:5,growthDefinition:"CAGR",nominal:true};
  const pair={origin,peer:"fixture",projectionManifest:"a".repeat(64),valuationManifest:"b".repeat(64),
   projectionDefinition:definition,valuationDefinition:definition,projectionAvailableAt:origin,valuationAvailableAt:origin,
   members:[{id:"fixture",projectedGrowth:.03,impliedGrowth:.02}]};
  const request={version:"prospective-paired-signal-1",protocolHash:contentHash(randomUUID()),universeHash:"c".repeat(64),
   origin,executionNotBefore:new Date(now+3600000).toISOString(),outcomeNotBefore:new Date(now+86400000).toISOString(),
   expectedCompanyIds:["fixture-a","fixture-b"],pairs:[{...pair,companyId:"fixture-a"},{...pair,companyId:"fixture-b"}]};
  const first=await capture(tx,request);id=first.id;
  assert.equal(first.repeated,false);assert.equal((await capture(tx,request)).id,id);
  assert.equal((await capture(tx,request)).repeated,true);
  await assert.rejects(()=>capture(tx,{...request,pairs:request.pairs.map(p=>({...p,members:[{id:"fixture",projectedGrowth:.04,impliedGrowth:.02}]}))}),/Conflicting/);
  await assert.rejects(()=>capture(tx,{...request,protocolHash:"e".repeat(64),executionNotBefore:origin}),/precede/);
  throw stop;
 });
}catch(e){if(e!==stop)throw e;}
const remaining=await db.execute(sql`SELECT id FROM cv_analysis_snapshots WHERE id=${id}`);
assert.equal(remaining.rows.length,0);
console.log("PASS real DEVELOPMENT prospective capture, repeat/conflict, clock rejection and complete rollback; no genuine live signal claimed");
process.exit(0);
