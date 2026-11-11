import{readFileSync,writeFileSync,mkdirSync}from"node:fs";
import{createHash}from"node:crypto";
import{originalCfContractFacts,metsDiscoveryBoundary,extractAmendedSolarPolicy,solarPolicyConstraints,
  type SolarGateInput}from"../server/calculation/issuerContractLawInputs";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary required");
const root="generated-artifacts/company-operating-corpus",dir=`${root}/issuer-contract-law-v1`;
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const receipts=read(`${dir}/receipts.json`);if(receipts.attempts.length!==24)throw new Error("Actual bounded24retrievals required");
for(const s of receipts.attempts)if(s.path&&sha(s.path)!==s.sha256)throw new Error("New source bytes changed");
const old=read(`${root}/xom-contract-permit-v1/latest.json`),of=read(old.freezePath);
const oldRefs=[...of.preserve,...of.code,...of.receipts.attempts.filter((x:any)=>x.path),of.derivedPdfText,
  {path:of.receiptPath,sha256:of.receiptSha256},{path:old.freezePath,sha256:sha(old.freezePath)},
  {path:old.reportPath,sha256:sha(old.reportPath)}];
const map=new Map<string,{path:string;sha256:string}>();
for(const x of oldRefs){if(map.has(x.path)&&map.get(x.path)!.sha256!==x.sha256)throw new Error("Conflicting original hash");
  map.set(x.path,{path:x.path,sha256:x.sha256});}
const preserve=Array.from(map.values());for(const x of preserve)if(sha(x.path)!==x.sha256)throw new Error(`Protected prior source/study changed ${x.path}`);
const derived=["pl119-21","ira117-169","irs-notice2026-15","cf-ccs-factsheet"].map(name=>({
  pdfPath:`${dir}/${name}.pdf`,pdfHash:sha(`${dir}/${name}.pdf`),textPath:`${dir}/${name}.txt`,textHash:sha(`${dir}/${name}.txt`)}));
const frozenAt=new Date().toISOString(),out=`${dir}/${frozenAt.replaceAll(":","-").replaceAll(".","-")}`;mkdirSync(out,{recursive:true});
const code=["script/capture-issuer-contract-law-sources.ts","server/calculation/issuerContractLawInputs.ts","script/issuer-contract-law.test.ts",
  "script/run-issuer-contract-law-inputs.ts","script/validate-issuer-contract-law-private.ts"].map(path=>({path,sha256:sha(path)}));
const frozen={version:"issuer-contract-law-1",frozenAt,receipts,receiptPath:`${dir}/receipts.json`,receiptSha256:sha(`${dir}/receipts.json`),
  code,preserve,derived,
  frozenScope:["Source solar framework: enacted2022IRA plus2025PL119-21 and IRSinterimNotice2026-15; not exhaustive certification of all later law",
    "Solar component MACR thresholds, phaseout and embedded-primary65%cost gate only; not company eligibility or all solar revenue",
    "Actual FSLRfuture material attribution/PFE-control/domestic-primary cost data absent: NULL, never zero foreign costs",
    "2022CFpress metric label and annual short-ton convention held as cross-document conflict, not physical trend",
    "Regulator-linked METSlanding/client observation only; no login/account/contact/authenticated endpoint requests",
    "No Article18/unit/capacity kernels rerun, no financial grids/reverse roots/cash scoring"],
  qualifiedOriginalIssuers:0,ownerGatesChanged:false,oldKernelsExecuted:false};
const freezePath=`${out}/frozen-before-qualification.json`;writeFileSync(freezePath,JSON.stringify(frozen,null,2)+"\n",{flag:"wx"});
const src=(name:string)=>{let s=receipts.attempts.find((r:any)=>r.name===name&&r.status===200);if(!s)throw new Error(`No accepted source ${name}`);return readFileSync(s.path,"utf8");};
const text=(n:string)=>readFileSync(`${dir}/${n}.txt`,"utf8");
const policy=extractAmendedSolarPolicy(text("ira117-169"),text("pl119-21"),text("irs-notice2026-15"),src("fslr-fy2025-10k.html"));
const unknown:Omit<SolarGateInput,"calendarSaleYear"|"claimPath">={calendarTaxpayer:true,
  usProductionAndEligibleSale:null,pfeEntityAndControlClear:null,sameManufacturingFacility:null,
  secondaryDirectMaterialCostShareFromUsPrimaryEligibleComponents:null,totalDirectMaterialCosts:null,
  pfeDirectMaterialCosts:null,costAttributionEvidenceValidated:null};
const calendar=Array.from({length:8},(_,i)=>2026+i).flatMap(calendarSaleYear=>
  (["direct-module-sale","embedded-primary-component"]as const).map(claimPath=>solarPolicyConstraints(policy,{...unknown,calendarSaleYear,claimPath})));
const report={version:frozen.version,frozenAt,qualifiedAt:new Date().toISOString(),freezePath,freezeHash:sha(freezePath),
  actualSourceAttempts:24,statusCounts:receipts.attempts.reduce((a:any,s:any)=>(a[s.status??"error"]=(a[s.status??"error"]??0)+1,a),{}),
  methodCounts:{get:receipts.attempts.filter((s:any)=>s.method==="GET").length,readOnlyPost:receipts.attempts.filter((s:any)=>s.method==="POST").length},
  originalCf:originalCfContractFacts(src("cf-original-2022-announcement.html"),
    readFileSync(`${root}/xom-contract-permit-v1/cf-fy2022-10k.html`,"utf8"),src("cf-2022-q3-ex991.html")),
  metsBoundary:metsDiscoveryBoundary(src("gov-ukets-installations-comply.html"),src("mets-public-landing.html"),src("mets-public-client.js")),
  solarPolicy:policy,solarConstraintCalendar:calendar,
  unknownFutureFslrInputs:unknown,qualifiedOriginalIssuers:0,qualifiedOriginalPairs:0,
  financialScenarioGrids:0,financialValuationScoring:false,oldKernelsExecuted:false};
for(const x of preserve)if(sha(x.path)!==x.sha256)throw new Error("Protected old files changed");
const reportPath=`${out}/report.json`;writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n",{flag:"wx"});
writeFileSync(`${dir}/latest.json`,JSON.stringify({freezePath,reportPath},null,2)+"\n");
console.log(JSON.stringify({freezePath,reportPath,freezeHash:sha(freezePath),reportHash:sha(reportPath),
  actualSourceAttempts:24,statusCounts:report.statusCounts,methodCounts:report.methodCounts,protectedPriorDistinctFiles:preserve.length,
  originalCf:report.originalCf,metsBoundary:report.metsBoundary,solarPolicy:policy,
  statutoryCalendarRows:calendar.length,unresolvedRows:calendar.filter(r=>r.status==="unresolved-source-inputs").length,
  phaseoutZeroRows:calendar.filter(r=>r.status==="statutory-phaseout-zero").length,
  qualifiedOriginalIssuers:0,financialScenarioGrids:0,oldKernelsExecuted:false},null,2));
