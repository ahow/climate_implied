import {contentHash} from "./analysisManifest";
import {compileDeploymentGrowth,freezeDeploymentGrowth} from "./deploymentGrowth";
import {reconcileDatedAccruals,type CohortCashLedger,type DatedProjectCash,type CashTiming,type AccrualSchedule} from "./cohortCashLedger";
import {assessCohortRecognition} from "./cohortRecognition";

/** Prospective fixed-rate loan, actual dated draw/repayment and same-year interest.
 * Not a creditor-priority opinion or a perpetual refinancing assumption. */
export interface DeploymentDebt {
 version:"dated-deployment-debt-1"|"dated-deployment-debt-2-earned";
 recognitionLaw?:"earned-service-prefix-1";
 frozen:ReturnType<typeof freezeDeploymentGrowth>;growth:number;
 ledger:CohortCashLedger;declaration:Omit<DatedProjectCash,"events">;
 timing:CashTiming[];accrual:AccrualSchedule;
 loan:{id:string;borrower:string;lender:string;currency:"USD";rate:number;basis:"ACT/365.25";
  priority:"contractual-before-common";rightsEvidenceId:string;
  draws:{on:string;usd:number}[];repayments:{on:string;usd:number}[]};
 ownership:"full";recoveries:"none";openingObligations:"none";
}
const day=(s:string)=>{
 const n=Date.parse(s);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==s)throw Error("Exact loan date required");
 return n;
};
export function freezeDeploymentDebt(input:DeploymentDebt){
 const x=structuredClone(input),p=x.frozen.protocol,l=x.loan;
 freezeDeploymentGrowth(p);
 if(contentHash(p)!==x.frozen.definitionHash||!["dated-deployment-debt-1","dated-deployment-debt-2-earned"].includes(x.version)||
  x.ownership!=="full"||x.recoveries!=="none"||x.openingObligations!=="none"||
  !l.id||!l.borrower||!l.lender||l.borrower!==x.ledger.claimantId||l.currency!=="USD"||
  l.priority!=="contractual-before-common"||l.basis!=="ACT/365.25"||!Number.isFinite(l.rate)||l.rate<0||
  !p.evidenceIds.includes(l.rightsEvidenceId)||x.accrual.version!=="dated-accrual-2"||
  x.declaration.valuationOn!==p.baselineOn||x.ledger.years[0].openingDebt!==0)
  throw Error("Explicit matched conditional loan/claim/source/full ownership required; recoveries/opening obligations unsupported");
 if(x.version==="dated-deployment-debt-2-earned"?x.recognitionLaw!=="earned-service-prefix-1":x.recognitionLaw!==undefined)
  throw Error("Recognition law must match its frozen debt version");
 const initial=x.ledger.years[0];
 if(x.accrual.payables[0]?.opening!==0||initial.openingUnpaidTax!==0||initial.openingNonCommonLiability!==0||
  initial.openingOtherWorkingCapital!==0||initial.openingReceivables!==0||initial.openingCash!==0)
  throw Error("Inherited accounts require a separate opening funding/obligation contract");
 const end=Date.UTC(p.baselineBinding.horizon[1]+1,0,1),start=day(p.baselineOn);
 for(const rows of [l.draws,l.repayments]){
  if(new Set(rows.map(r=>r.on)).size!==rows.length)throw Error("Duplicate loan event");
  for(const r of rows)if(day(r.on)<start||day(r.on)>=end||!Number.isFinite(r.usd)||r.usd<=0)throw Error("Loan event outside finite domain");
 }
 return {definitionHash:contentHash(x),input:x};
}
export function executeDeploymentDebt(f:ReturnType<typeof freezeDeploymentDebt>){
 if(contentHash(f.input)!==f.definitionHash)throw Error("Changed frozen loan specification");
 freezeDeploymentDebt(f.input);
 const x=f.input,p=x.frozen.protocol,physical=compileDeploymentGrowth(x.frozen,x.growth),l=x.loan;
 const eq=(a:number,b:number)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-8)throw Error("Loan interest/principal reconciliation mismatch");};
 let principal=0;
 const earnedByDate=new Map<string,number>();let earned=0;
 const years=[] as {year:number;opening:number;closing:number;interest:number}[];
 for(const y of physical.specification.years){
  const opening=principal;let interest=0;
  for(let t=Math.max(day(p.baselineOn),Date.UTC(y.year,0,1));t<Date.UTC(y.year+1,0,1);t+=86400000){
   const on=new Date(t).toISOString().slice(0,10);
   principal+=l.draws.filter(r=>r.on===on).reduce((a,r)=>a+r.usd,0);
   principal-=l.repayments.filter(r=>r.on===on).reduce((a,r)=>a+r.usd,0);
   if(principal<0)throw Error("Principal repayment precedes funding");
   const daily=principal*l.rate/365.25;
   interest+=daily;earned+=daily;earnedByDate.set(on,earned);
  }
  const a=x.ledger.years.find(v=>v.year===y.year);if(!a)throw Error("Missing loan account period");
  eq(a.openingDebt,opening);eq(a.closingDebt,principal);eq(y.interestCashUsd,interest);
  // This version deliberately cannot carry unpaid interest across years.
  const interestAccrual=x.accrual.entries.filter(e=>e.kind==="payable"&&e.component==="interest"&&e.on.startsWith(`${y.year}-`)).reduce((a,e)=>a+e.usd,0);
  eq(interestAccrual,interest);
  years.push({year:y.year,opening,closing:principal,interest});
 }
 let recognized=0;
 for(const e of [...x.accrual.entries].filter(e=>e.kind==="payable"&&e.component==="interest").sort((a,b)=>a.on.localeCompare(b.on))){
  recognized+=e.usd;
  const earned=earnedByDate.get(e.on);
  if(earned===undefined||recognized>earned+1e-8)throw Error("Interest recognition precedes daily earned loan interest");
 }
 const cash=reconcileDatedAccruals(physical.model,x.ledger,x.declaration,x.timing,x.accrual,p.evidenceIds);
 const recognitionAssessment=x.version==="dated-deployment-debt-2-earned"?
  assessCohortRecognition(physical.specification,x.accrual,x.recognitionLaw):null;
 for(const [component,rows] of [["debtRaised",l.draws],["debtRepaid",l.repayments]] as const){
  const events=cash.derivedEvents.filter(e=>e.component===component);
  for(const on of Array.from(new Set([...rows.map(r=>r.on),...events.map(e=>e.on)])))
   eq(rows.filter(r=>r.on===on).reduce((a,r)=>a+r.usd,0),events.filter(e=>e.on===on).reduce((a,e)=>a+Math.abs(e.usd),0));
 }
 for(const c of physical.capitalRequirements)
  eq(physical.capitalRequirements.filter(v=>v.on===c.on).reduce((a,v)=>a+v.usd,0),
   -cash.derivedEvents.filter(e=>e.component==="construction"&&e.on===c.on).reduce((a,e)=>a+e.usd,0));
 return {version:x.version,definitionHash:f.definitionHash,physical,cash,loanYears:years,
  ...(recognitionAssessment?{recognitionAssessment}:{}),
  conditionalPeriodicProjectValueUsd:null,inverse:null,marketImplied:false,scientificAcceptance:false,
  formula:"daily closing principal × fixed rate /365.25; recognition cannot precede earned daily interest; actual same-year payments; no second debt deduction",
  remaining:"Cross-year accrued interest, recovery/partial ownership and funded periodic debt join remain unsupported"};
}
