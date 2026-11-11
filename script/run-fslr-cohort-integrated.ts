import{readFileSync,writeFileSync,mkdirSync}from"node:fs";
import{createHash}from"node:crypto";
import{extractFslrLegacyRecognition,historicalFslrCashBridge,integrateFslrSourceCohorts}from"../server/calculation/fslrCohortIntegratedLedger";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const root="generated-artifacts/company-operating-corpus",out=`${root}/fslr-cohort-integrated-v1`;
mkdirSync(out,{recursive:true});
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const priorLatest=read(`${root}/issuer-cash-collections-v1/latest.json`),prior=read(priorLatest.freezePath);
if(hash(priorLatest.freezePath)!==priorLatest.freezeSha256||hash(priorLatest.reportPath)!==priorLatest.reportSha256)throw new Error("Prior source component hash drift");
const originalReportPath=`${root}/issuer-original-v3/2026-11-10T23-02-42-669Z/report.json`,originalReport=read(originalReportPath);
const selected=originalReport.cases.find((c:any)=>c.symbol==="FSLR"&&c.options.variant==="source-conditioned"&&c.options.terminalGrowth===.025);
if(!selected)throw new Error("Specific original case not located");
const original=read(originalReport.freezePath),baseline=read(selected.path),prepared=original.prepared.find((p:any)=>p.symbol==="FSLR");
const previous=[...prior.preserve,...prior.code,...prior.receipts.attempts,
  {path:priorLatest.freezePath,sha256:priorLatest.freezeSha256},{path:priorLatest.reportPath,sha256:priorLatest.reportSha256},
  {path:prior.receiptPath,sha256:prior.receiptSha256},
  {path:"docs/issuer-cash-collections-evidence.json",sha256:"1bbcd2c56bd7697b235e3d859a876d1167317da9031854d7e874209d30a4877a"},
  {path:selected.path,sha256:selected.sha256},
  {path:originalReportPath,sha256:"26e7e0a228b318e199f7a8969d9a8c006a8daaefa9450bbed53a70f820159c2d"},
  {path:originalReport.freezePath,sha256:originalReport.freezeHash}];
const preserve=Array.from(new Map(previous.map((p:any)=>[p.path,{path:p.path,sha256:p.sha256}])).values()) as {path:string;sha256:string}[];
for(const p of preserve)if(hash(p.path)!==p.sha256)throw new Error(`Protected prior drift ${p.path}`);
const primaryPath=`${root}/issuer-cashflow-v1/FSLR-primary.html`,legacy=extractFslrLegacyRecognition(readFileSync(primaryPath,"utf8"));
if(prepared.input.otherCurrentAssets!==legacy.otherCurrentAssetsUsd||
  prepared.input.reconciliation.normalized.legacyGrant!==legacy.currentGrantReceivableUsd)throw new Error("OtherWC/sourcegrant fields not disjoint retained input");
const parameters={fslrForecastCredit2025:original.assumptions.fslrForecastCredit2025,
  fslrCashPerFaceCredit:original.assumptions.fslrCashPerFaceCredit,fslrCreditReceivableYears:original.assumptions.fslrCreditReceivableYears};
if(Math.abs(baseline.built.engineInput.years[0].cashPolicyCredit-parameters.fslrForecastCredit2025*parameters.fslrCashPerFaceCredit)>.001)throw new Error("Original forecast carry template changed");
const code=["server/calculation/fslrCohortIntegratedLedger.ts","script/fslr-cohort-integrated.test.ts",
  "script/run-fslr-cohort-integrated.ts","script/validate-fslr-cohort-integrated-private.ts"].map(path=>({path,sha256:hash(path)}));
const dir=`${out}/${new Date().toISOString().replace(/[:.]/g,"-")}`;mkdirSync(dir,{recursive:true});
const frozen={version:"fslr-source-cohort-integrated-1",frozenAt:new Date().toISOString(),preserve,code,
  primaryPath,primarySha256:hash(primaryPath),legacy,sourceFacts:prior.facts,
  originalCasePath:selected.path,originalCaseSha256:selected.sha256,baseline,parameters,
  originalMarketHash:createHash("sha256").update(JSON.stringify(prepared.market)).digest("hex"),
  revisedHistoryOnly:true,notFullFY2025ReportedCfoReconstruction:true,
  assumptions:{visaTimingBoundaries:["pre-cutoff-reserved","post-cutoff-march31"],
    receiptDaysAreConventionsNotObserved:true,monthendForKnownMonths:true,yearendForMidyearContractCash:true,
    noPreContractAdvanceAssumedForJuneJulyOctober2025:true,
    actualReceiptCashNotStubProrated:true,removeMatchingOldNetCashAndCarryFirst:true,
    noNewRecognitionTaxDiscountOtherWcOrExcessCashChange:true,
    unmatchedForecastCreditFaceRemainsConditionalNotObserved:true,unclassifiedOtherGrantsStayReserved:true,
    originalNegativeCommonFundingDebtReinvestmentFadeTerminalPreserved:true,
    noOriginalKernelOrReverseGridExecution:true,sourceVolumeEligibilityNotInferredFromGlobalOutput:true,
    sourceActualQuarter2026Q3GlobalProducedGw:4.3,sourceActualQuarter2026Q3GlobalSoldGw:4.1,
    actualUsEligibleWatts:null,currentEligibilityCertified:false,ownerReview:"pending-not-requested"}};
const freezePath=`${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
const visa=prior.facts.transfers.find((l:any)=>l.generationYear===2024);
const history=historicalFslrCashBridge(legacy,visa.receipts.filter((r:any)=>r.year===2024).reduce((s:number,r:any)=>s+r.cashUsd,0));
const cases=(["pre-cutoff-reserved","post-cutoff-march31"] as const).map(visaTiming=>integrateFslrSourceCohorts({baseline,parameters,facts:prior.facts,visaTiming}));
const report={version:frozen.version,calculatedAt:new Date().toISOString(),freezePath,freezeSha256:hash(freezePath),
  protectedDistinctHashes:preserve.length,newPrimaryRequests:0,history,cases,
  technicalSourceIntegrationExecuted:true,technicalOriginalIssuerCompletion:false,qualifiedOriginalIssuers:0,
  requiredOriginalIssuers:3,ownerReview:"pending-not-requested",oldIssuerKernelExecutions:0,newRootAttempts:0};
const reportPath=`${dir}/report.json`;writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
writeFileSync(`${out}/latest.json`,JSON.stringify({freezePath,freezeSha256:hash(freezePath),reportPath,reportSha256:hash(reportPath)},null,2)+"\n");
console.log(JSON.stringify({version:report.version,freezePath,freezeSha256:hash(freezePath),reportPath,reportSha256:hash(reportPath),
  protectedDistinctHashes:preserve.length,selected2024CreditCashUsd:history.selected2024CreditCashUsd,
  cfoLessSelectedCreditCashUsd:history.cfoLessSelectedCreditCashUsd,unallocatedOtherGrantBridgeUsd:history.unallocatedGrantBridgeResidualUsd,
  integratedCases:cases.map(c=>({timing:c.visaTiming,finiteCashDeltaPvUsd:c.finiteCashDeltaPvUsd,
    conditionalIntegratedWholeEquityUsd:c.conditionalIntegratedWholeEquityUsd,terminalUnchanged:c.terminalUnchanged})),
  qualifiedOriginalIssuers:0}));
