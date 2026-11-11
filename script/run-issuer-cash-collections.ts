import{readFileSync,writeFileSync,mkdirSync,existsSync}from"node:fs";
import{createHash}from"node:crypto";
import{extractFslrActualCollections,extractEnlinkProjectBoundary,rebuildTaggedTransferCollections}from"../server/calculation/issuerCashCollectionInputs";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const root="generated-artifacts/company-operating-corpus/issuer-cash-collections-v1";
const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const read=(name:string)=>readFileSync(`${root}/${name}`,"utf8");
const receipts=JSON.parse(read("receipts.json"));
if(receipts.attempts.length>14||receipts.attempts.length!==13||receipts.attempts.some((a:any)=>a.status!==200||!a.path||hash(a.path)!==a.sha256))throw new Error("Actual13primary payload integrity/status");
const priorDir="generated-artifacts/company-operating-corpus/issuer-contract-law-v1/2026-11-11T11-43-26-394Z";
const priorPath=`${priorDir}/frozen-before-qualification.json`,old=JSON.parse(readFileSync(priorPath,"utf8"));
const previous=[...old.preserve,...old.code,...old.receipts.attempts.filter((a:any)=>a.path&&a.sha256).map((a:any)=>({path:a.path,sha256:a.sha256})),
  ...old.derived.map((d:any)=>({path:d.textPath,sha256:d.textHash})),
  {path:priorPath,sha256:"d15a0e7fa4f14cae4d7bc4119415ffc1296041b8678cf1cc616ec82e975728d4"},
  {path:`${priorDir}/report.json`,sha256:"5922610ce9d5f9bec85d5d6cb4bf6e482de783884bb15d2b85b24f51714bce77"},
  {path:old.receiptPath,sha256:old.receiptSha256},
  {path:"docs/issuer-contract-law-evidence.json",sha256:"58380bdaf61ed449de4b5c25935ce9163ae41c2460cf118d33cebf02e77f4068"}];
const preserve=Array.from(new Map(previous.map((p:any)=>[p.path,p])).values()) as {path:string;sha256:string}[];
for(const p of preserve)if(!existsSync(p.path)||hash(p.path)!==p.sha256)throw new Error(`Protected hash drift ${p.path}`);
const facts=extractFslrActualCollections(read("fslr-2025q1.html"),read("fslr-2026q1.html"),read("fslr-2026q3.html"));
const xomBoundary=extractEnlinkProjectBoundary(read("enlink-fy2022-10k.html"),read("enlink-fy2023-10k.html"),read("enlink-2024q3.html"),read("cf-2025-startup.html"));
const code=["server/calculation/issuerCashCollectionInputs.ts","script/capture-issuer-cash-collection-sources.ts",
  "script/run-issuer-cash-collections.ts","script/issuer-cash-collections.test.ts","script/validate-issuer-cash-collections-private.ts"].map(path=>({path,sha256:hash(path)}));
const stamp=new Date().toISOString().replace(/[:.]/g,"-"),dir=`${root}/${stamp}`;mkdirSync(dir,{recursive:true});
const frozen={version:"issuer-cash-collections-source-1",frozenAt:new Date().toISOString(),receipts,
  receiptPath:`${root}/receipts.json`,receiptSha256:hash(`${root}/receipts.json`),preserve,code,facts,xomBoundary,
  interpretationFrozenBeforeCalculation:{futureCreditGenerationAssumption:null,futurePricingAssumption:null,futureCashTimingAssumption:null,
    nominalUsd:true,reportedCfoOrFcfeAdjustment:false,identifiedNetContractClaimsOnlyNotGaapGovernmentGrantRollforward:true,
    subsequentCollectionFactsNotAvailableAtOriginalPriceCutoff:true,originalFY2024SharesPriceStubFiveYearFadeAndTerminalUnchanged:true,
    noValuationOrGrowthOrReverseScoring:true,originalCaseQualification:0,ownerGatesChanged:false,oldKernelsExecuted:0}};
const freezePath=`${dir}/frozen-before-calculation.json`;writeFileSync(freezePath,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
const cash=rebuildTaggedTransferCollections(facts.transfers);
const originCashYearCells=facts.transfers.flatMap(l=>l.receipts.map(p=>({generationYear:l.generationYear,cashYear:p.year,cashUsd:p.cashUsd})));
originCashYearCells.push({generationYear:2024,cashYear:2026,cashUsd:facts.treasuryCashOnly.cashUsd});
const grouped=Array.from(new Map(originCashYearCells.map(c=>[`${c.generationYear}/${c.cashYear}`,
  {generationYear:c.generationYear,cashYear:c.cashYear,cashUsd:originCashYearCells.filter(d=>d.generationYear===c.generationYear&&d.cashYear===c.cashYear).reduce((s,d)=>s+d.cashUsd,0)}])).values());
const report={version:frozen.version,calculatedAt:new Date().toISOString(),freezePath,freezeSha256:hash(freezePath),
  code,protectedDistinctHashes:preserve.length,primaryAttempts:receipts.attempts.length,fslr:{cash,
    treasuryCashOnly:facts.treasuryCashOnly,selectedObservedCashOriginByReceiptYear:grouped,
    totalSelectedObservedTransferPlusTreasuryCashUsd:cash.totalObservedTransferCashUsd+facts.treasuryCashOnly.cashUsd,
    sourcePolicyChannels:facts.sourcePolicyChannels,
    selectedLotCashNotAllCorporateOrAllCreditGeneration:true,allCompanyGrantOrCreditBalancesUnknown:true},
  xomBoundary,qualifiedOriginalIssuers:0,requiredOriginalIssuers:3,qualifiedOriginalPairs:0,
  fullOriginalTerminalAssessmentPerformed:false,oldKernelExecutions:0,ownerGatesChanged:false};
const reportPath=`${dir}/report.json`;writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
writeFileSync(`${root}/latest.json`,JSON.stringify({dir,freezePath,freezeSha256:hash(freezePath),reportPath,reportSha256:hash(reportPath)},null,2)+"\n");
console.log(JSON.stringify({version:report.version,reportPath,reportSha256:hash(reportPath),freezePath,freezeSha256:hash(freezePath),
  protectedDistinctHashes:preserve.length,primaryAttempts:13,transferCohorts:3,transferCashUsd:cash.totalObservedTransferCashUsd,
  selectedTotalCashUsd:report.fslr.totalSelectedObservedTransferPlusTreasuryCashUsd,
  finalIdentifiedTransferProceedsOutstandingUsd:cash.finalIdentifiedContractProceedsOutstandingUsd,
  xomCurrentForecast:xomBoundary.currentTransportForecastMetricTonnes,qualifiedOriginalIssuers:0}));
