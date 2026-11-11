import{readFileSync,writeFileSync,mkdirSync}from"node:fs";import{createHash}from"node:crypto";
import{execFileSync}from"node:child_process";import assert from"node:assert/strict";
import{qualifyRoseTracker}from"../server/calculation/issuerFinancialFollowupInputs";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const root="generated-artifacts/company-operating-corpus/issuer-financial-followup-v1";
const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const receiptPath=`${root}/receipts.json`,book=JSON.parse(readFileSync(receiptPath,"utf8"));
assert.equal(book.attempts.length,6);for(const r of book.attempts){assert.equal(r.status,200);assert.equal(hash(r.path),r.sha256);}
const code=["script/capture-issuer-financial-followup.ts","server/calculation/issuerFinancialFollowupInputs.ts",
  "script/issuer-financial-followup.test.ts","script/validate-issuer-financial-followup-private.ts"].map(path=>({path,sha256:hash(path)}));
const derived=["epa-classvi-tracker-20260925","texas-classvi-applications-20261105"].map(name=>{
  const pdf=`${root}/${name}.pdf`,text=`${root}/${name}.txt`;
  const rebuilt=execFileSync("pdftotext",["-layout",pdf,"-"],{encoding:"utf8",maxBuffer:2e6});
  assert.equal(rebuilt,readFileSync(text,"utf8"));return{pdf,pdfSha256:hash(pdf),text,textSha256:hash(text)};
});
const dir=`${root}/${new Date().toISOString().replace(/[:.]/g,"-")}`;mkdirSync(dir,{recursive:true});
const frozen={version:"issuer-financial-followup-source-1",frozenAt:new Date().toISOString(),receiptPath,receiptSha256:hash(receiptPath),book,code,derived,
  frozenInterpretation:{applicationNotApproval:true,abbreviatedOperatorNotVerifiedLegalRegistry:true,
    noCfContractCrosswalkInferred:true,noThroughputOrPriceFromWellCount:true,notAnExxonLiabilityOrRepricedOldCase:true}};
const freezePath=`${dir}/frozen-before-qualification.json`;writeFileSync(freezePath,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
const primary=JSON.parse(readFileSync(`${root}/oneok-sec-submissions.json`,"utf8"));
assert.equal(primary.name,"ONEOK INC /NEW/");assert.equal(Number(primary.cik),1039684);
const annuals=[{year:2024,path:`${root}/oneok-fy2024-10k.html`,document:"oke-20241231.htm",accession:"0001039684-25-000036"},
  {year:2025,path:`${root}/oneok-fy2025-10k.html`,document:"oke-20251231.htm",accession:"0001039684-26-000006"}].map(a=>{
  const i=primary.filings.recent.accessionNumber.indexOf(a.accession);assert.ok(i>=0);
  assert.equal(primary.filings.recent.primaryDocument[i],a.document);
  const text=readFileSync(a.path,"utf8").replace(/<[^>]*>/g," ").replace(/\s+/g," ");
  assert.ok(/\bONEOK\b/.test(text)&&text.includes("0001039684"),"Actual named issuer/CIK in annual payload");
  const pattern=/Exxon\s*Mobil|Pecan\s*Island|sequestr|financial arrangement|contract termination/gi;
  const matches=Array.from(text.matchAll(pattern));assert.equal(matches.length,0);
  return{year:a.year,published:primary.filings.recent.filingDate[i],path:a.path,sha256:hash(a.path),
    scope:"Full two specified annual HTMLdocuments; case-insensitive explicit terms only",searchedPattern:pattern.source,
    termMatches:0,executedCommercialContractObtained:false,feesMinBillingsSettlementValueOrCash:null};
});
const tracker=readFileSync(`${root}/texas-classvi-applications-20261105.txt`,"utf8"),rose=qualifyRoseTracker(tracker);
// Independent extraction checks, distinct from source adapter regex.
const row=tracker.split("\n").find(s=>s.trimStart().startsWith("57803"));assert.ok(row);
assert.ok(row.includes("Rose CCS")&&row.includes("Jefferson")&&row.includes("Hearing"));
assert.ok(row.includes("03/14/2024")&&row.includes("10/31/2025"));
assert.equal(rose.rrcTrackingNumber,row.trim().split(/\s+/)[0]);
assert.equal(rose.observationBoundary.observedFinalPermitVerified,false);
const epa=readFileSync(`${root}/epa-classvi-tracker-20260925.txt`,"utf8");
assert.equal(/\brose\b/i.test(epa),false);assert.equal(rose.cfContractToTrackingNumberCrosswalkVerified,false);
const report={version:frozen.version,qualifiedAt:new Date().toISOString(),freezePath,freezeSha256:hash(freezePath),
  primaryPayloadsVerified:6,independentPdfRebuilds:2,oneokAnnuals:annuals,rose,
  epaTrackerRoseLiteralAbsentNotPermitAbsence:true,qualifiedOriginalIssuers:0,financialOrRootOrOldKernelCalculations:0};
const reportPath=`${dir}/report.json`;writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
writeFileSync(`${root}/latest.json`,JSON.stringify({freezePath,freezeSha256:hash(freezePath),reportPath,reportSha256:hash(reportPath)},null,2)+"\n");
console.log(JSON.stringify({privatePrimaryValidation:"pass",primaryPayloadsVerified:6,independentPdfRebuilds:2,
  roseTracking:rose.rrcTrackingNumber,roseCounty:rose.county,roseStatus:rose.applicationStatus,
  finalPermitVerified:false,oneokAnnualsReviewed:2,settlementCashOrFeesQualified:false,
  freezePath,freezeSha256:hash(freezePath),reportPath,reportSha256:hash(reportPath)}));
