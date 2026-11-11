import{readFileSync,writeFileSync,mkdirSync}from"node:fs";
import{createHash}from"node:crypto";
import{extractFy2024UkLaw,qualifyPermitUnits,extractOriginalXomPlan,extractBaytownFunding,qualifiedPlanEnvelope}
  from"../server/calculation/xomSourceInputQualification";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary required");
const root="generated-artifacts/company-operating-corpus",dir=`${root}/xom-source-inputs-v1`;
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const receipts=read(`${dir}/receipts.json`);
if(receipts.attempts.length!==16)throw new Error("Bounded actual16 source attempts required");
for(const s of receipts.attempts)if(s.path&&sha(s.path)!==s.sha256)throw new Error("Captured source bytes changed");
const old=read(`${root}/xom-climate-liability-v1/latest.json`),oldFreeze=read(old.freezePath);
const prior=read(`${root}/nee-remittance-counterparty-v1/latest.json`),priorFreeze=read(prior.freezePath),priorReport=read(prior.reportPath);
const preserve=[{path:old.freezePath,sha256:sha(old.freezePath)},{path:old.reportPath,sha256:sha(old.reportPath)},
  ...oldFreeze.sourceFiles,...oldFreeze.code,...oldFreeze.preserve,
  {path:prior.freezePath,sha256:sha(prior.freezePath)},{path:prior.reportPath,sha256:sha(prior.reportPath)},
  ...priorFreeze.code,...priorFreeze.preserve,...priorReport.cases.map((c:any)=>({path:c.path,sha256:c.sha256}))];
for(const p of preserve)if(sha(p.path)!==p.sha256)throw new Error(`Protected old source/study changed ${p.path}`);
const frozenAt=new Date().toISOString(),out=`${dir}/${frozenAt.replaceAll(":","-").replaceAll(".","-")}`;
mkdirSync(out,{recursive:true});
const frozen={version:"xom-source-inputs-1",frozenAt,sourceReceipts:receipts,receiptPath:`${dir}/receipts.json`,
  receiptSha256:sha(`${dir}/receipts.json`),retainedPermitEvidence:oldFreeze.evidence,permitsFromStoredEvidenceOnly:true,
  preserve,code:["script/capture-xom-source-inputs.ts","server/calculation/xomSourceInputQualification.ts",
    "script/xom-source-inputs.test.ts","script/run-xom-source-inputs.ts","script/validate-xom-source-inputs-private.ts"]
    .map(path=>({path,sha256:sha(path)})),
  futureFinancialAssumptionsAdded:false,valuationScoringPerformed:false,oldKernelsExecuted:false,
  ownerGatesChanged:false,qualifiedOriginalIssuers:0};
const freezePath=`${out}/frozen-before-qualification.json`;
writeFileSync(freezePath,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
const source=(name:string)=>{
  const r=receipts.attempts.find((r:any)=>r.name===name);
  if(r.status!==200)throw new Error("Cannot qualify failed response");
  return readFileSync(r.path,"utf8");};
const law=extractFy2024UkLaw(source("ukets-article4-fy2024.xml"),source("ukets-schedule2-fy2024.xml"),source("ukets-full-fy2024.xml"));
const permits=oldFreeze.evidence.permits.map((p:any)=>qualifyPermitUnits(p,law));
const corporatePlan=extractOriginalXomPlan(source("xom-plan-2030.html")),baytown=extractBaytownFunding(source("xom-adnoc-baytown.html"));
const report={version:frozen.version,frozenAt,qualifiedAt:new Date().toISOString(),freezePath,freezeHash:sha(freezePath),
  law,permits,corporatePlan,baytown,planEnvelope:qualifiedPlanEnvelope(corporatePlan),
  selectedPermitAggregate:{reportedCoveredTco2e:permits.reduce((s:number,p:any)=>s+p.requiredSurrenderUnits,0),
    deliveredUka:permits.reduce((s:number,p:any)=>s+p.actualDeliveredFreeUnits,0),
    uncoveredBeforeBankOrTransfersUka:permits.reduce((s:number,p:any)=>s+p.uncoveredUnitsBeforeBankOrTransfers,0),
    nativeCo2Tonnes:null,actualPurchaseUnits:null,actualPaidCash:null},
  newPublicRequests:16,http200:receipts.attempts.filter((r:any)=>r.status===200).length,
  http404:receipts.attempts.filter((r:any)=>r.status===404).length,qualifiedOriginalIssuers:0,qualifiedOriginalPairs:0,
  newFinancialScenarioGrids:0,valuationScoringPerformed:false,oldKernelsExecuted:false};
for(const p of preserve)if(sha(p.path)!==p.sha256)throw new Error("Protected study changed during qualification");
const reportPath=`${out}/report.json`;
writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
writeFileSync(`${dir}/latest.json`,JSON.stringify({freezePath,reportPath},null,2)+"\n");
console.log(JSON.stringify({freezePath,reportPath,freezeHash:sha(freezePath),reportHash:sha(reportPath),
  newPublicRequests:16,http200:report.http200,http404:report.http404,permitCount:permits.length,
  unitLawQualified:true,selectedPermitAggregate:report.selectedPermitAggregate,planEnvelope:report.planEnvelope,
  qualifiedOriginalIssuers:0,valuationScoringPerformed:false,oldKernelsExecuted:false},null,2));
