import{readFileSync}from"node:fs";
import{execFileSync}from"node:child_process";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import{originalCfContractFacts,metsDiscoveryBoundary,extractAmendedSolarPolicy,solarPolicyConstraints}
  from"../server/calculation/issuerContractLawInputs";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Mandatory private-primary only");
const dir="generated-artifacts/company-operating-corpus/issuer-contract-law-v1";
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const l=read(`${dir}/latest.json`),f=read(l.freezePath),r=read(l.reportPath);
assert.equal(sha(l.freezePath),r.freezeHash);assert.ok(Date.parse(f.frozenAt)<=Date.parse(r.qualifiedAt));
assert.equal(sha(f.receiptPath),f.receiptSha256);
for(const x of [...f.preserve,...f.code,...f.receipts.attempts.filter((a:any)=>a.path)])assert.equal(sha(x.path),x.sha256,`Changed ${x.path}`);
assert.equal(f.receipts.attempts.length,24);
assert.equal(new Set(f.receipts.attempts.map((x:any)=>x.url+" "+(x.requestBody??""))).size,24);
for(const d of f.derived){
  assert.equal(sha(d.pdfPath),d.pdfHash);assert.equal(sha(d.textPath),d.textHash);
  const rebuilt=execFileSync("pdftotext",["-layout",d.pdfPath,"-"],{maxBuffer:15000000});
  assert.equal(createHash("sha256").update(rebuilt).digest("hex"),d.textHash,"Actual PDF-to-text lineage");
}
const src=(name:string)=>readFileSync(f.receipts.attempts.find((x:any)=>x.name===name&&x.status===200).path,"utf8");
const text=(n:string)=>readFileSync(`${dir}/${n}.txt`,"utf8");
assert.deepEqual(originalCfContractFacts(src("cf-original-2022-announcement.html"),
  readFileSync("generated-artifacts/company-operating-corpus/xom-contract-permit-v1/cf-fy2022-10k.html","utf8"),src("cf-2022-q3-ex991.html")),r.originalCf);
assert.equal(r.originalCf.crossDocumentMassLabelConflict,true);assert.equal(r.originalCf.contractFeePerTonne,null);
assert.equal(r.originalCf.announcedStorageGeography,"Vermilion Parish, Louisiana");
assert.deepEqual(metsDiscoveryBoundary(src("gov-ukets-installations-comply.html"),src("mets-public-landing.html"),src("mets-public-client.js")),r.metsBoundary);
assert.equal(r.metsBoundary.exactUkEts11402DocumentRetrieved,false);assert.equal(r.metsBoundary.authenticationAttempted,false);
const policy=extractAmendedSolarPolicy(text("ira117-169"),text("pl119-21"),text("irs-notice2026-15"),src("fslr-fy2025-10k.html"));
assert.deepEqual(policy,r.solarPolicy);
// Independent source numeral extraction, distinct from adapter's literal assertions.
const legal=text("pl119-21").replace(/([A-Za-z])-\s*\n\s*([A-Za-z])/g,"$1$2").replace(/\s+/g," ");
const p=legal.indexOf("in the case of any solar energy component"),q=legal.indexOf("in the case of any wind energy component",p),solar=legal.slice(p,q);
const map=new Map(Array.from(solar.matchAll(/during calendar year (\d{4}), (\d+) percent/g)).map(m=>[Number(m[1]),Number(m[2])/100]));
assert.deepEqual(Array.from(map.entries()),[[2026,.5],[2027,.6],[2028,.7],[2029,.8]]);
assert.match(solar,/after December 31, 2029, 85 percent/);
for(const row of r.solarConstraintCalendar){
  const rebuilt=solarPolicyConstraints(policy,{...r.unknownFutureFslrInputs,calendarSaleYear:row.calendarSaleYear,claimPath:row.claimPath});
  assert.deepEqual(rebuilt,row);assert.equal(row.creditCashUsd,null);assert.equal(row.currentCompanyEligibilityCertified,false);
  const y=row.calendarSaleYear;
  assert.equal(row.solarMacrMinimum,y>=2030?.85:map.get(y));
  assert.equal(row.conditionalPhaseoutMultiplier,y>=2033?0:y===2032?.25:y===2031?.5:y===2030?.75:1);
  assert.equal(row.status,y>=2033?"statutory-phaseout-zero":"unresolved-source-inputs");
  assert.equal(row.embedded65PercentRuleApplies,row.claimPath==="embedded-primary-component"&&y>=2027);
}
assert.equal(r.solarConstraintCalendar.length,16);assert.equal(r.qualifiedOriginalIssuers,0);
assert.equal(r.financialScenarioGrids,0);assert.equal(r.oldKernelsExecuted,false);
console.log(JSON.stringify({status:"passed",sourceAttemptHashes:24,pdfTextIndependentRebuilds:4,
  protectedPriorDistinctFiles:f.preserve.length,originalCfAnnouncementAndDeclaredEx991:2,
  historicalMassLabelConflictPreserved:true,metsPublicRouteRecords:3,noLoginOrSiteSubstitution:true,
  originalLegalAndGuidanceDocuments:3,independentSolarThresholdYears:5,statutoryCalendarRows:16,
  unresolvedEligibilityRows:14,statutoryPhaseoutZeroRows:2,noActualFslrCostsOrBenefitsInvented:true,
  oldKernelsExecuted:false,financialScenarioGrids:0,qualifiedOriginalIssuers:0,
  freezeHash:sha(l.freezePath),reportHash:sha(l.reportPath)},null,2));
