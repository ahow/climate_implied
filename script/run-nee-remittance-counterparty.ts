import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractNeeRemittanceFacts, remittanceIdentification, neeRemittanceExperiment,
  buildNeeRemittanceCase, publicNeeRemittanceSummary, type RemittanceOption } from "../server/calculation/neeRemittanceCounterparty";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV==="production")
  throw new Error("Explicit --private-primary remittance experiment required outside production");
const root="generated-artifacts/company-operating-corpus", read=(p:string)=>JSON.parse(readFileSync(p,"utf8"));
const sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const old=read(`${root}/nee-project-cash-waterfall-v1/latest.json`), oldFreeze=read(old.freezePath), oldReport=read(old.reportPath);
const primary=oldFreeze.primary;
if(sha(primary.path)!==primary.sha256)throw new Error("Authenticated primary changed");
const facts=extractNeeRemittanceFacts(readFileSync(primary.path,"utf8"));
const preserve=[{path:old.freezePath,sha256:sha(old.freezePath)},{path:old.reportPath,sha256:sha(old.reportPath)},
  ...oldFreeze.code,...oldFreeze.preserve,...oldReport.cases.map((c:any)=>({path:c.path,sha256:c.sha256}))];
for(const p of preserve)if(sha(p.path)!==p.sha256)throw new Error(`Prior immutable dependency changed: ${p.path}`);
const baselines=oldReport.cases.map((c:any)=>{
  const b=oldFreeze.baselines.find((b:any)=>b.id===c.baselineId);
  return {id:c.id,path:c.path,sha256:c.sha256,reference:{
    referenceDate:b.original.referenceDate,discountRate:b.original.costOfEquity,actualBaseFcfe:b.original.baseFcfe}};
});
if(baselines.length!==24)throw new Error("Expected24 stored NEE cases, never rerun old kernel");
const options:RemittanceOption[]=[
  {reservePolicy:"no-extra-guarantee-cash-provision"},{reservePolicy:"reported-exposure-scale-cash-provision"}];
const frozenAt=new Date().toISOString(),dir=`${root}/nee-remittance-counterparty-v1/${frozenAt.replaceAll(":","-").replaceAll(".","-")}`;
mkdirSync(dir,{recursive:true});
const frozen={...neeRemittanceExperiment,frozenAt,primary,facts,baselines,options,preserve,
  revisedHistoryReference:true,sourceRequests:0,providerRequests:0,oldKernelsReexecuted:false,
  code:["server/calculation/neeRemittanceCounterparty.ts","script/run-nee-remittance-counterparty.ts",
    "script/nee-remittance-counterparty.test.ts","script/validate-nee-remittance-counterparty-private.ts"]
    .map(path=>({path,sha256:sha(path)})),outcomesNotCalculatedBeforeFreeze:true};
const freezePath=`${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
const identification=remittanceIdentification(facts),cases=[];
for(const b of baselines)for(const option of options){
  const baseline=read(b.path).result,result=buildNeeRemittanceCase(facts,baseline,option,b.reference);
  const id=`${b.id}-${option.reservePolicy}-remittance-v1`,path=`${dir}/${id}.json`;
  writeFileSync(path,JSON.stringify({id,result},null,2)+"\n",{flag:"wx"});
  cases.push({id,baselineId:b.id,...option,path,sha256:sha(path),terminalGrowth:result.terminalGrowth,
    status:result.status,terminalFcfe:result.terminalFcfe,signedPlanPv:result.signedPlanPv,
    forwardWholeEquity:result.forwardWholeEquity,totalCommonCalls:result.totalCommonCalls,
    provisionAmount:result.provisionAmount,actualFcfe5YearGrowth:result.actualFcfe5YearGrowth,
    growthRejection:result.growthRejection});
}
for(const p of preserve)if(sha(p.path)!==p.sha256)throw new Error("Protected case changed during new experiment");
const report={version:frozen.version,frozenAt,calculatedAt:new Date().toISOString(),freezePath,freezeHash:sha(freezePath),
  identification,cases,publicDerivedAggregates:publicNeeRemittanceSummary(cases),sourceRequests:0,providerRequests:0,
  originalIssuersQualified:0,originalPairsQualified:0,oldKernelsReexecuted:false};
const reportPath=`${dir}/report.json`;
writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
writeFileSync(`${root}/nee-remittance-counterparty-v1/latest.json`,JSON.stringify({freezePath,reportPath},null,2)+"\n");
console.log(JSON.stringify({reportPath,freezePath,freezeHash:sha(freezePath),reportHash:sha(reportPath),
  primaryBindings:facts.bindings.length,...report.publicDerivedAggregates},null,2));
