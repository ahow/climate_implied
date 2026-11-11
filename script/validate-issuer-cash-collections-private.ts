import{readFileSync,existsSync}from"node:fs";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Mandatory --private-primary separate from public code-only tests");
const root="generated-artifacts/company-operating-corpus/issuer-cash-collections-v1";
const latest=JSON.parse(readFileSync(`${root}/latest.json`,"utf8"));
const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
assert.equal(hash(latest.freezePath),latest.freezeSha256);assert.equal(hash(latest.reportPath),latest.reportSha256);
const f=JSON.parse(readFileSync(latest.freezePath,"utf8")),r=JSON.parse(readFileSync(latest.reportPath,"utf8"));
assert.ok(Date.parse(f.frozenAt)<=Date.parse(r.calculatedAt));
for(const a of [...f.code,...f.preserve,...f.receipts.attempts]){assert.ok(existsSync(a.path));assert.equal(hash(a.path),a.sha256);}
assert.equal(f.receipts.attempts.length,13);assert.ok(f.receipts.attempts.every((a:any)=>a.status===200));
// Independent primary-HTML parse. Does not import/reuse the production cash adapter or cash builder.
function source(name:string){return readFileSync(`${root}/${name}`,"utf8").replace(/<[^>]*>/g," ").replace(/&#160;|&nbsp;/g," ")
  .replace(/&#8217;|&rsquo;/g,"'").replace(/\$\s+/g,"$").replace(/\bCO\s+2\b/g,"CO2").replace(/\s+/g," ");}
const all=source("fslr-2026q3.html"),start=all.indexOf("5. Government Grants"),end=all.indexOf("6. Derivative Financial",start);
assert.ok(start>0&&end>start);
const note=all.slice(start,end),matches=Array.from(note.matchAll(/for the sale of \$([\d,.]+) million of Section 45X tax credits we generated during (\d{4}) for aggregate cash proceeds of \$([\d,.]+) million/g));
assert.equal(matches.length,3);
const usd=(n:string)=>Math.round(Number(n.replace(/,/g,""))*1e6);
const independent=matches.map((m,i)=>{
  const paragraph=note.slice(m.index!,i+1<matches.length?matches[i+1].index:note.length);
  const full=paragraph.match(/full cash proceeds during the year ended December 31, (\d{4})/);
  let receipts:{year:number;usd:number}[]=[];
  if(full)receipts=[{year:Number(full[1]),usd:usd(m[3])}];
  else{
    const initial=paragraph.match(/initial cash proceeds of \$([\d,.]+) million (?:in December|during the year ended December 31,) (\d{4})/);
    const remaining=paragraph.match(/remaining cash proceeds of \$([\d,.]+) million during the (?:year|nine months) ended (?:December 31,|September 30,) (\d{4})/);
    assert.ok(initial&&remaining,"Independent exact initial/remaining source cash lines");
    receipts=[{year:Number(initial[2]),usd:usd(initial[1])},{year:Number(remaining[2]),usd:usd(remaining[1])}];
  }
  return{face:usd(m[1]),origin:Number(m[2]),net:usd(m[3]),receipts};
});
assert.deepEqual(independent.map(l=>l.face),r.fslr.cash.lotChecks.map((l:any)=>l.faceUsd));
assert.deepEqual(independent.map(l=>l.net),r.fslr.cash.lotChecks.map((l:any)=>l.contractProceedsUsd));
for(const l of independent)assert.equal(l.receipts.reduce((a,p)=>a+p.usd,0),l.net);
for(const row of r.fslr.cash.years){
  const receipts=independent.flatMap(l=>l.receipts).filter(p=>p.year===row.year).reduce((s,p)=>s+p.usd,0);
  assert.equal(receipts,row.observedCashCollectionsUsd);
  assert.equal(row.closingIdentifiedContractProceedsUsd,independent.reduce((s,l)=>s+(l.origin<=row.year?l.net-l.receipts.filter(p=>p.year<=row.year).reduce((n,p)=>n+p.usd,0):0),0));
  assert.equal(row.cashIdentityResidualUsd,0);
}
const treasury=note.match(/received \$([\d,.]+) million from the U.S. Department of the Treasury related to Section 45X tax credits generated during (\d{4})/);
assert.ok(treasury);assert.equal(Number(treasury[2]),2024);
assert.equal(usd(treasury[1]),r.fslr.treasuryCashOnly.cashUsd);
assert.equal(r.fslr.treasuryCashOnly.creditFaceUsd,null);assert.equal(r.fslr.treasuryCashOnly.parRealizationAssumed,false);
assert.equal(r.fslr.totalSelectedObservedTransferPlusTreasuryCashUsd,independent.reduce((s,l)=>s+l.net,0)+usd(treasury[1]));
const q1=source("fslr-2026q1.html");
assert.ok(q1.includes("remaining cash proceeds of $95.2 million in February 2026"));
assert.ok(q1.includes("In January 2026, we also received $117.6 million"));
assert.ok(all.includes("initiated by our international fleet and then completed in the United States"));
assert.equal(r.fslr.sourcePolicyChannels.futureOrCurrentLegalEligibilityCertified,false);
const en=source("enlink-2024q3.html"),cf=source("cf-2025-startup.html");
assert.ok(en.includes("unable to identify alternative CO2 transportation projects for EnLink"));
assert.ok(en.includes("pursuing a financial arrangement for the value to EnLink"));
assert.ok(cf.includes("through enhanced oil recovery")&&cf.includes("draft Class VI permit for Rose"));
assert.equal(r.xomBoundary.currentTransportForecastMetricTonnes,null);
assert.equal(r.xomBoundary.minimumBillingsUsd,null);assert.equal(r.xomBoundary.transportFeeUsdPerTonne,null);
assert.equal(r.xomBoundary.contractRecoveryOrXomObligationUsd,null);
assert.equal(r.xomBoundary.startup2025Source.applicablePermitsReceivedObserved,null);
assert.equal(r.qualifiedOriginalIssuers,0);assert.equal(r.oldKernelExecutions,0);assert.equal(r.ownerGatesChanged,false);
console.log(JSON.stringify({privatePrimaryValidation:"pass",primaryPayloadsVerified:13,protectedDistinctHashes:f.preserve.length,
  independentTransferCohorts:independent.length,independentAnnualCashRows:r.fslr.cash.years.length,
  actualTreasuryCashSourceVerified:true,componentGeographyAndRouteBoundariesVerified:true,qualifiedOriginalIssuers:0}));
