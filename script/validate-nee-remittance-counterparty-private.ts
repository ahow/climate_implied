import{readFileSync}from"node:fs";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import{extractNeeRemittanceFacts,remittanceIdentification,buildNeeRemittanceCase,publicNeeRemittanceSummary}
  from"../server/calculation/neeRemittanceCounterparty";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary required");
const root="generated-artifacts/company-operating-corpus/nee-remittance-counterparty-v1";
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const close=(a:number,b:number,label:string)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&
  Math.abs(a-b)<Math.max(.001,Math.abs(b)*1e-11),`${label}: ${a} != ${b}`);
const l=read(`${root}/latest.json`),f=read(l.freezePath),report=read(l.reportPath);
assert.equal(sha(l.freezePath),report.freezeHash);
assert.ok(Date.parse(f.frozenAt)<=Date.parse(report.calculatedAt));
for(const p of [...f.code,...f.preserve,f.primary])assert.equal(sha(p.path),p.sha256,`Changed protected ${p.path}`);
const facts=extractNeeRemittanceFacts(readFileSync(f.primary.path,"utf8"));
assert.deepEqual(facts,f.facts);assert.deepEqual(remittanceIdentification(facts),report.identification);
close(facts.consolidatedAffiliateCash,811e6,"consolidated cash, not all XPLR");
close(facts.reportedCreditSupportExposure,1300e6,"reported exposure scale");
close(facts.guaranteeFairValueNotCash,58e6,"fair value not another payment");
close(facts.thirdPartySweepPayable,127e6,"third-party payable not excess cash");
close(facts.currentRelatedReceivable+facts.noncurrentRelatedReceivable,287e6,"receivables not new cash writeoff");
close(facts.financedJointVentureDistribution,386e6,"financing-triggered distribution");
close(facts.financedJointVentureNciDerecognitionNotCash,844e6,"NCI derecognition not distribution");
let checkedCashRows=0,negativeCommonRows=0,checkedTerminalRows=0;
for(const c of report.cases){
  assert.equal(sha(c.path),c.sha256);
  const result=read(c.path).result,b=f.baselines.find((b:any)=>b.id===c.baselineId),base=read(b.path).result;
  assert.deepEqual(buildNeeRemittanceCase(facts,base,{reservePolicy:c.reservePolicy},b.reference),result);
  assert.deepEqual(result.originalStubUnchanged,base.originalStubUnchanged);
  const provision=c.reservePolicy==="reported-exposure-scale-cash-provision"?1300e6:0;
  let accumulatedFunding=0;
  result.rows.forEach((r:any,i:number)=>{
    const old=base.rows[i],tax=.21*Math.max(0,old.grossOperatingCash-old.fixedDa[0]-old.fixedDa[1]-
      old.nuclearAmortization-old.interest);
    const held=i===0?provision:0;
    const cash=old.grossOperatingCash-old.interest-tax+old.policyCash-old.increaseWorkingFunding-
      old.capitalSpend+old.debtProceeds-old.debtRepayments-old.dmiCashClaim-old.otherConditionalReserve-held;
    close(r.fcfe,cash,"independent funded cash");close(r.cashTax,tax,"tax without missing remittance");
    close(old.fcfe-r.fcfe,old.affiliateCash-(old.cashTax-tax)+held,"economic delta, no activity relabel");
    for(const k of ["grossOperatingCash","interest","policyCash","increaseWorkingFunding","capitalSpend",
      "debtProceeds","debtRepayments","dmiCashClaim","otherConditionalReserve","cashReserve"])assert.equal(r[k],old[k],`Held plan ${k}`);
    close(r.totalCashReserveIncludingExtraProvision,old.cashReserve+provision,"total cash reserves");
    accumulatedFunding+=r.cashProvisionFunding;
    close(accumulatedFunding,r.incrementalRestrictedCashHeld,"one funded cash reserve, never two calls");
    close(r.extraGuaranteeExpenseOrCall+r.extraReceivableWriteoffCash+r.cashSweepRelease,0,"no book/payment double deduction");
    close(r.commonCall,Math.max(0,-cash),"common calls retained");
    if(cash<0)negativeCommonRows++;checkedCashRows++;
  });
  close(result.rows[15].fcfe,result.rows[14].fcfe*(1+c.terminalGrowth),"sustainable funded nominal terminal");
  const df=(date:string)=>1.1**(-(Date.parse(date)-Date.parse(b.reference.referenceDate))/31557600000);
  const stub=base.originalStubUnchanged.cashFlows.reduce((s:number,x:any)=>s+x.fcfe*df(x.date),0);
  const explicit=result.rows.slice(0,15).reduce((s:number,x:any)=>s+x.fcfe*df(`${x.year}-12-31`),0);
  const terminal=result.rows[15].fcfe/(.1-c.terminalGrowth)*df("2040-12-31");
  close(result.signedPlanPv,stub+explicit+terminal,"independent dated PV");
  if(result.rows[4].fcfe>0)close(result.actualFcfe5YearGrowth,
    (result.rows[4].fcfe/169e6)**.2-1,"actual FCFE growth, not activity");
  else assert.equal(result.actualFcfe5YearGrowth,null);
  assert.equal(result.forwardWholeEquity===null,result.terminalFcfe<=0||result.signedPlanPv<=0);
  assert.equal(result.qualifiedOriginalIssuers,0);checkedTerminalRows++;
}
assert.equal(report.cases.length,48);assert.equal(checkedCashRows,768);assert.equal(checkedTerminalRows,48);
assert.deepEqual(report.publicDerivedAggregates,publicNeeRemittanceSummary(report.cases));
console.log(JSON.stringify({status:"passed",cases:48,checkedCashRows,checkedTerminalRows,negativeCommonRows,
  sourceBindings:facts.bindings.length,protectedFiles:f.preserve.length,oldKernelsReexecuted:false,
  qualifiedOriginalIssuers:0,freezeHash:sha(l.freezePath),reportHash:sha(l.reportPath)},null,2));
