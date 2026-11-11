import{readFileSync,writeFileSync,mkdirSync}from"node:fs";
import{createHash}from"node:crypto";
import{extractCfFy2024Projects,corroborateYazooAnnouncement,examineCfAgreementAndExhibits,
  extractHistoricalEprSite,sourceBoundCaptureCapacity}from"../server/calculation/xomCounterpartyPermitInputs";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const root="generated-artifacts/company-operating-corpus",dir=`${root}/xom-contract-permit-v1`;
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const receipts=read(`${dir}/receipts.json`);
if(receipts.attempts.length!==18)throw new Error("Bounded18 actual source attempts required");
for(const s of receipts.attempts)if(s.path&&sha(s.path)!==s.sha256)throw new Error("Changed new source bytes");
const old=read(`${root}/xom-source-inputs-v1/latest.json`),oldF=read(old.freezePath),oldR=read(old.reportPath);
const preserved=[...oldF.preserve,...oldF.code,...oldF.sourceReceipts.attempts.filter((a:any)=>a.path),
  {path:old.freezePath,sha256:sha(old.freezePath)},{path:old.reportPath,sha256:sha(old.reportPath)},
  {path:oldF.receiptPath,sha256:oldF.receiptSha256}];
const map=new Map<string,{path:string;sha256:string}>();
for(const p of preserved){
  if(map.has(p.path)&&map.get(p.path)!.sha256!==p.sha256)throw new Error("Conflicting protected source hashes");
  map.set(p.path,{path:p.path,sha256:p.sha256});
}
const preserve=Array.from(map.values());
for(const p of preserve)if(sha(p.path)!==p.sha256)throw new Error(`Prior unit/frozen studies changed ${p.path}`);
const frozenAt=new Date().toISOString(),out=`${dir}/${frozenAt.replaceAll(":","-").replaceAll(".","-")}`;
mkdirSync(out,{recursive:true});
const code=["script/capture-xom-contract-permit-sources.ts","server/calculation/xomCounterpartyPermitInputs.ts",
  "script/xom-contract-permit.test.ts","script/run-xom-contract-permit-inputs.ts","script/validate-xom-contract-permit-private.ts"]
  .map(path=>({path,sha256:sha(path)}));
const frozen={version:"xom-contract-permit-1",frozenAt,receipts,receiptPath:`${dir}/receipts.json`,receiptSha256:sha(`${dir}/receipts.json`),
  derivedPdfText:{path:`${dir}/ea-fawley-epr-v008.txt`,sha256:sha(`${dir}/ea-fawley-epr-v008.txt`),command:"pdftotext -layout ea-fawley-epr-v008.pdf ea-fawley-epr-v008.txt"},
  preserve,code,qualifiedOriginalIssuers:0,oldUnitClosurePreserved:oldR.law.tonnesCo2ePerAllowance===1,
  frozenConditionalInterpretations:[
    "FY2024 source expectations, not observed future commissioning or contracted minimum billings",
    "Capacity-ceiling vector only if expected start years are met; no full first-year utilization assumed",
    "CF client dehydration/compression investment only; never XOM transport/storage capital, fee or opex",
    "Capital/annual-capacity ratios at stated upper capacity, not levelized cash cost/tariff",
    "2022tons explicitly shorttons;2024metrictons distinct; no retroactive unit relabelling",
    "2019EPR permit actual facility address is not proof of UKETS11402 identity or FY2024 permit currency"
  ],futureFeeOrUtilizationCoefficientsAdded:false,financialValuationScoring:false,oldKernelsExecuted:false,ownerGatesChanged:false};
const freezePath=`${out}/frozen-before-qualification.json`;
writeFileSync(freezePath,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
const src=(name:string)=>{const r=receipts.attempts.find((r:any)=>r.name===name&&r.status===200);if(!r)throw new Error("Missing qualified source");return readFileSync(r.path,"utf8");};
const sec=JSON.parse(src("cf-sec-submissions.json"));
if(sec.name!=="CF Industries Holdings, Inc."||Number(sec.cik)!==1324404)throw new Error("Exact CF SEC legal identity required");
const projects=extractCfFy2024Projects(src("cf-fy2024-10k.html"));
const report={version:frozen.version,frozenAt,qualifiedAt:new Date().toISOString(),freezePath,freezeHash:sha(freezePath),
  sourceAttemptCount:18,sourceStatuses:receipts.attempts.reduce((a:any,r:any)=>(a[r.status??"error"]=(a[r.status??"error"]??0)+1,a),{}),
  sourceMethodCounts:{get:receipts.attempts.filter((r:any)=>r.method!=="POST").length,readOnlyIssuerNewsPost:receipts.attempts.filter((r:any)=>r.method==="POST").length},
  secIdentity:{name:sec.name,cik:sec.cik},projects,
  yazooCorroboration:corroborateYazooAnnouncement(src("cf-yazoo-2024-announcement.html"),projects.find(p=>p.site==="Yazoo City")!),
  exhibitSearch:[examineCfAgreementAndExhibits(src("cf-fy2022-10k.html"),2022),examineCfAgreementAndExhibits(src("cf-fy2024-10k.html"),2024)],
  historicalEprSite:extractHistoricalEprSite(readFileSync(frozen.derivedPdfText.path,"utf8")),
  sourceBoundCapacity:sourceBoundCaptureCapacity(projects),
  existingFy2024StatutoryUnitUnchanged:oldR.law.tonnesCo2ePerAllowance,
  qualifiedOriginalIssuers:0,qualifiedOriginalPairs:0,newFinancialGrids:0,oldKernelsExecuted:false,financialValuationScoring:false,
  residuals:["Actual signed CCS fee/minimum billable quantity/escalation/opex/capex/replacement/funding/credit waterfall not located",
    "ExactUKETS11402 monitoring/site document not retrieved; different EPR permit cannot be substituted",
    "Original2022issuer press release and actual executed agreement remain unvisited; dated2022annual agreement narrative and full exhibit index examined"]};
for(const p of preserve)if(sha(p.path)!==p.sha256)throw new Error("Protected prior source/study changed");
const reportPath=`${out}/report.json`;
writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
writeFileSync(`${dir}/latest.json`,JSON.stringify({freezePath,reportPath},null,2)+"\n");
console.log(JSON.stringify({freezePath,reportPath,freezeHash:sha(freezePath),reportHash:sha(reportPath),
  sourceAttemptCount:18,sourceStatuses:report.sourceStatuses,sourceMethodCounts:report.sourceMethodCounts,
  sourceBoundCapacity:report.sourceBoundCapacity,historicalEprSite:report.historicalEprSite,
  protectedPriorDistinctFiles:preserve.length,qualifiedOriginalIssuers:0,newFinancialGrids:0,oldKernelsExecuted:false},null,2));
