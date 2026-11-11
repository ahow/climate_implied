import{readFileSync}from"node:fs";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import{extractCfFy2024Projects,corroborateYazooAnnouncement,examineCfAgreementAndExhibits,
  extractHistoricalEprSite,sourceBoundCaptureCapacity}from"../server/calculation/xomCounterpartyPermitInputs";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const dir="generated-artifacts/company-operating-corpus/xom-contract-permit-v1";
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const l=read(`${dir}/latest.json`),f=read(l.freezePath),r=read(l.reportPath);
assert.equal(sha(l.freezePath),r.freezeHash);assert.ok(Date.parse(f.frozenAt)<=Date.parse(r.qualifiedAt));
assert.equal(sha(f.receiptPath),f.receiptSha256);
for(const p of [...f.preserve,...f.code,...f.receipts.attempts.filter((x:any)=>x.path),f.derivedPdfText])
  assert.equal(sha(p.path),p.sha256,`Protected/source/code bytes changed ${p.path}`);
assert.equal(f.receipts.attempts.length,18);assert.equal(new Set(f.receipts.attempts.map((x:any)=>x.url+" "+(x.requestBody??""))).size,18);
const src=(n:string)=>readFileSync(f.receipts.attempts.find((x:any)=>x.name===n&&x.status===200).path,"utf8");
const projects=extractCfFy2024Projects(src("cf-fy2024-10k.html"));
assert.deepEqual(projects,r.projects);
assert.deepEqual(corroborateYazooAnnouncement(src("cf-yazoo-2024-announcement.html"),projects[1]),r.yazooCorroboration);
const normalize=(s:string)=>s.replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\bCO\s+2\b/g,"CO2").replace(/\s+/g," ");
const actual=normalize(src("cf-fy2024-10k.html"));
// Independent source numeral extraction and independently staged activity envelope, NOT an old valuation kernel.
const dm=/At Donaldsonville, CCS is expected to commence in (\d{4}) and annually will sequester up to approximately ([\d.]+) million metric tons of CO2/.exec(actual);
const ym=/At Yazoo City, CCS is expected to commence in (\d{4}) and annually will sequester up to approximately ([\d,]+) metric tons of CO2/.exec(actual);
assert.ok(dm&&ym);const starts=[Number(dm[1]),Number(ym[1])],caps=[Number(dm[2])*1e6,Number(ym[2].replaceAll(",",""))];
assert.deepEqual(starts,[2025,2028]);assert.deepEqual(caps,[2e6,500000]);
const independent=Array.from({length:5},(_,i)=>caps.reduce((sum,c,j)=>sum+(starts[j]<=2025+i?c:0),0));
assert.deepEqual(independent,r.sourceBoundCapacity.conditionalYears2025To2029.map((x:any)=>x.conditionalPhysicalCapacityUpperMetricTonnes));
assert.equal(independent.reduce((a,b)=>a+b,0),11e6);
assert.equal(r.sourceBoundCapacity.aggregateCfCapitalUsdPerAnnualMetricTonne,(200e6+100e6)/(2e6+500000));
assert.deepEqual(sourceBoundCaptureCapacity(projects),r.sourceBoundCapacity);
for(const year of [2022,2024] as const)assert.deepEqual(examineCfAgreementAndExhibits(src(`cf-fy${year}-10k.html`),year),r.exhibitSearch.find((e:any)=>e.fiscalYear===year));
assert.equal(r.exhibitSearch[0].original2022ReportedCapacityShortTonsPerYear,2e6);
assert.equal(r.exhibitSearch[0].original2022CapacityMetricTonnesPerYear,null);
const pdf=readFileSync(f.derivedPdfText.path,"utf8"),site=extractHistoricalEprSite(pdf);
assert.deepEqual(site,r.historicalEprSite);assert.equal(site.page,9);assert.equal(site.ukEtsIdOccurrences,0);
assert.match(pdf.split("\f")[8],/00026538/);assert.equal(site.ukEts11402SiteQualified,false);
assert.equal(site.mappedUkEtsPermitId,null);assert.equal(site.nativeCo2Tonnes,null);
for(const p of projects){assert.equal(p.xomFeePerTonne,null);assert.equal(p.xomOpex,null);assert.equal(p.xomCapital,null);}
assert.equal(r.sourceBoundCapacity.xomRevenue,null);assert.equal(r.sourceBoundCapacity.xomProjectCashValue,null);
assert.equal(r.existingFy2024StatutoryUnitUnchanged,1);assert.equal(r.newFinancialGrids,0);assert.equal(r.oldKernelsExecuted,false);
assert.equal(r.qualifiedOriginalIssuers,0);
console.log(JSON.stringify({status:"passed",primaryAttemptHashes:18,sourceStatuses:r.sourceStatuses,
  protectedPriorDistinctFiles:f.preserve.length,independentPhysicalCapacityYearChecks:5,
  actualCounterpartyProjects:2,actualAnnualExhibitIndexes:2,actualDatedCounterpartyAnnouncement:1,
  actualEprPdfPages:pdf.split("\f").length-1,actualNoticePage:site.page,
  priorStatutoryOneAllowancePerTco2ePreserved:true,original2022ShortTonConventionPreserved:true,
  noEprUkEtsSiteConflation:true,noInventedFeeOrCash:true,newFinancialGrids:0,oldKernelsExecuted:false,
  qualifiedOriginalIssuers:0,freezeHash:sha(l.freezePath),reportHash:sha(l.reportPath)},null,2));
