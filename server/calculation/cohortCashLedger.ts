import type {calculateOperatingCohorts} from "./operatingCohorts";
export interface CohortCashYear {
 year:number;openingReceivables:number;closingReceivables:number;collections:number;
 openingOtherWorkingCapital:number;closingOtherWorkingCapital:number;
 openingUnpaidTax:number;closingUnpaidTax:number;taxAccrual:number;
 openingDebt:number;closingDebt:number;
 openingNonCommonLiability:number;closingNonCommonLiability:number;nonCommonAccrual:number;
 operatingFixedCash:number;holdingCash:number;transactionCash:number;
 openingCash:number;closingCash:number;commonContribution:number;commonDistribution:number;
 evidenceIds:string[];
}
export interface CohortCashLedger {
 version:"cohort-cash-ledger-1";currency:"USD";claimantId:string;
 claim:"declared-project-common-distribution-not-whole-equity";
 distributionRightsEvidenceId:string;years:CohortCashYear[];
}
export interface DatedProjectCash {
 version:"dated-project-cash-1"; valuationOn:string; discountRate:number;
 convention:"ACT/365.25"; claimantId:string;
 events:{id:string;on:string;kind:"project-net-cash"|"common-contribution"|"common-distribution";usd:number;evidenceIds:string[]}[];
}
export type CashComponent="collections"|"variableCost"|"energyCost"|"operatingFixedCash"|"holdingCash"|"transactionCash"|"construction"|"maintenance"|"replacement"|"decommissioning"|"tax"|"otherWorkingCapital"|"interest"|"debtRaised"|"debtRepaid"|"nonCommon"|"commonContribution"|"commonDistribution";
export interface CashTiming {
 year:number;component:CashComponent;allocations:{on:string;fraction:number;evidenceIds:string[]}[];
}
export interface AccrualSchedule {
 version:"dated-accrual-1";claimantId:string;
 payables:{year:number;opening:number;closing:number}[];
 entries:{id:string;on:string;kind:"revenue"|"payable"|"tax"|"nonCommon";usd:number;evidenceIds:string[]}[];
}
export function reconcileDatedAccruals(model:ReturnType<typeof calculateOperatingCohorts>,ledger:CohortCashLedger,
 declaration:Omit<DatedProjectCash,"events">,timing:CashTiming[],accrual:AccrualSchedule,evidenceIds:string[]){
 const cash=deriveDatedProjectCash(model,ledger,declaration,timing,evidenceIds);
 if(accrual.version!=="dated-accrual-1"||accrual.claimantId!==ledger.claimantId||accrual.payables.length!==ledger.years.length)
  throw Error("Explicit matching accrual claimant/periods required");
 const ids=new Set<string>();
 for(const e of accrual.entries){
  const t=Date.parse(e.on);
  if(!e.id||ids.has(e.id)||!Number.isFinite(t)||! /^\d{4}-\d{2}-\d{2}$/.test(e.on)||
   new Date(t).toISOString().slice(0,10)!==e.on||e.on<declaration.valuationOn||
   !ledger.years.some(y=>y.year===new Date(t).getUTCFullYear())||!Number.isFinite(e.usd)||e.usd<0||
   !["revenue","payable","tax","nonCommon"].includes(e.kind)||!e.evidenceIds.length||e.evidenceIds.some(id=>!evidenceIds.includes(id)))
   throw Error("Invalid accrual date/amount/evidence");
  ids.add(e.id);
 }
 const eq=(a:number,b:number)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))throw Error("Dated accrual balance mismatch");};
 const days:any[]=[];
 for(let i=0;i<ledger.years.length;i++){
  const y=ledger.years[i],p=accrual.payables[i];
  if(p.year!==y.year||!Number.isFinite(p.opening)||!Number.isFinite(p.closing)||p.opening<0||p.closing<0)throw Error("Explicit payable boundaries required");
  if(i)eq(p.opening,accrual.payables[i-1].closing);
  const a=accrual.entries.filter(e=>Number(e.on.slice(0,4))===y.year);
  const c=cash.derivedEvents.filter(e=>e.year===y.year);
  for(const [kind,total] of [["revenue",model.rows[i].revenue],["tax",y.taxAccrual],["nonCommon",y.nonCommonAccrual]] as const)
   eq(a.filter(e=>e.kind===kind).reduce((s,e)=>s+e.usd,0),total);
  const b={receivables:y.openingReceivables,payables:p.opening,tax:y.openingUnpaidTax,debt:y.openingDebt,
   nonCommon:y.openingNonCommonLiability,cash:y.openingCash,otherWC:y.openingOtherWorkingCapital,contributions:0,distributions:0};
  const dates=Array.from(new Set([...a.map(e=>e.on),...c.map(e=>e.on)])).sort();
  for(const on of dates){
   for(const e of a.filter(e=>e.on===on)){
    const key={revenue:"receivables",payable:"payables",tax:"tax",nonCommon:"nonCommon"}[e.kind] as "receivables"|"payables"|"tax"|"nonCommon";
    b[key]+=e.usd;
   }
   for(const e of c.filter(e=>e.on===on)){
    b.cash+=e.component==="commonDistribution"?-e.usd:e.usd;
    if(e.component==="collections")b.receivables-=e.usd;
    else if(e.component==="tax")b.tax+=e.usd;
    else if(e.component==="debtRaised"||e.component==="debtRepaid")b.debt+=e.usd;
    else if(e.component==="nonCommon")b.nonCommon+=e.usd;
    else if(e.component==="otherWorkingCapital")b.otherWC-=e.usd;
    else if(e.component==="commonContribution")b.contributions+=e.usd;
    else if(e.component==="commonDistribution")b.distributions+=e.usd;
    else b.payables+=e.usd;
   }
   if(Object.values(b).some(v=>v < -1e-9))throw Error("Dated settlement precedes accrued liability/receivable or funding");
   days.push({on,...b});
  }
  for(const [key,total] of Object.entries({receivables:y.closingReceivables,payables:p.closing,tax:y.closingUnpaidTax,
   debt:y.closingDebt,nonCommon:y.closingNonCommonLiability,cash:y.closingCash,otherWC:y.closingOtherWorkingCapital,
   contributions:y.commonContribution,distributions:y.commonDistribution}))eq(b[key as keyof typeof b],total);
 }
 return {...cash,accrualVersion:accrual.version,accrualDays:days,
  accrualQualification:"Explicit dated postings; same-day net settlement, no intraday ordering, prepayment accounts, or complete asset/equity accounting"};
}
/** Derives amounts, never dates. Timing schedules require their own evidence.
 * Collections replace revenue; only OTHER working capital is deducted here. */
export function deriveDatedProjectCash(model:ReturnType<typeof calculateOperatingCohorts>,ledger:CohortCashLedger,
 declaration:Omit<DatedProjectCash,"events">,timing:CashTiming[],evidenceIds:string[]){
 reconcileCohortCash(model,ledger,evidenceIds);
 const used=new Set<string>(),derived:{year:number;component:CashComponent;on:string;usd:number;fraction:number;evidenceIds:string[]}[]=[];
 for(const [i,r] of Array.from(model.rows.entries())){
  const y=ledger.years[i],a=r.inputs;
  const totals:Record<CashComponent,number>={collections:y.collections,variableCost:-r.variableCost,energyCost:-r.energyCost,
   operatingFixedCash:-y.operatingFixedCash,holdingCash:-y.holdingCash,transactionCash:-y.transactionCash,
   construction:-a.constructionCashUsd,maintenance:-a.maintenanceCashUsd,replacement:-a.replacementCashUsd,
   decommissioning:-a.decommissioningCashUsd,tax:-a.cashTaxUsd,
   otherWorkingCapital:-(y.closingOtherWorkingCapital-y.openingOtherWorkingCapital),
   interest:-a.interestCashUsd,debtRaised:a.debtRaisedUsd,debtRepaid:-a.debtRepaidUsd,
   nonCommon:-a.nonCommonCashUsd,commonContribution:y.commonContribution,commonDistribution:y.commonDistribution};
  for(const [component,total] of Object.entries(totals) as [CashComponent,number][]){
   const key=`${r.year}/${component}`,matches=timing.filter(t=>t.year===r.year&&t.component===component);
   if(matches.length>1)throw Error("Duplicate component timing");
   if(!matches.length){if(total!==0)throw Error(`Missing dated component ${key}`);continue;}
   used.add(key);const allocations=matches[0].allocations;
   if(!allocations.length||allocations.some(t=>!Number.isFinite(t.fraction)||t.fraction<=0||!t.on.startsWith(`${r.year}-`)||
    !t.evidenceIds.length||t.evidenceIds.some(id=>!evidenceIds.includes(id)))||
    Math.abs(allocations.reduce((s,t)=>s+t.fraction,0)-1)>1e-12)throw Error("Incomplete or unsupported cash timing allocation");
   for(const t of allocations)derived.push({year:r.year,component,on:t.on,usd:total*t.fraction,fraction:t.fraction,evidenceIds:t.evidenceIds});
  }
 }
 if(timing.some(t=>!used.has(`${t.year}/${t.component}`)))throw Error("Unknown timing component/period");
 const events:DatedProjectCash["events"]=derived.map((d,i)=>({id:`${d.year}/${d.component}/${i}`,on:d.on,usd:d.usd,evidenceIds:d.evidenceIds,
  kind:d.component==="commonContribution"?"common-contribution":d.component==="commonDistribution"?"common-distribution":"project-net-cash"}));
 const result=valueDatedProjectCash(model,ledger,{...declaration,events},evidenceIds);
 return {...result,derivedEvents:derived,formula:"collections - operating cash costs - capital - cash tax - otherWC - interest + debt raised - debt repaid - noncommon; AR is not deducted again",
  timingQualification:"Explicit source/assumption schedules, not inferred payment dates; annual accrual reconciliation does not prove daily AR/tax balances"};
}
/** Finite dated cash only. Annual totals do not establish intra-year operating
 * cash provenance, and this evaluator deliberately supplies no perpetuity. */
export function valueDatedProjectCash(model:ReturnType<typeof calculateOperatingCohorts>,ledger:CohortCashLedger,dated:DatedProjectCash,evidenceIds:string[]){
 reconcileCohortCash(model,ledger,evidenceIds);
 const day=(s:string)=>{const t=Date.parse(s);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw Error("Exact valid UTC cash date required");return t;};
 const origin=day(dated.valuationOn);
 if(dated.version!=="dated-project-cash-1"||dated.convention!=="ACT/365.25"||dated.claimantId!==ledger.claimantId||
 !Number.isFinite(dated.discountRate)||dated.discountRate<=0||dated.discountRate>=1)throw Error("Compatible dated claim/rate required");
 const ids=new Set<string>(),events=dated.events.map(e=>{
  const time=day(e.on);
  if(!e.id||ids.has(e.id)||time<origin||!Number.isFinite(e.usd)||
   !["project-net-cash","common-contribution","common-distribution"].includes(e.kind)||
   (e.kind!=="project-net-cash"&&e.usd<0)||!e.evidenceIds.length||e.evidenceIds.some(id=>!evidenceIds.includes(id)))
   throw Error("Invalid/duplicate/cutoff cash event");
  ids.add(e.id);return {...e,time};
 }).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id));
 if(events.some(e=>!ledger.years.some(y=>y.year===new Date(e.time).getUTCFullYear())))throw Error("Cash event outside declared periods");
 const eq=(a:number,b:number)=>{if(Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))throw Error("Dated cash totals/balances mismatch");};
 let pv=0;const days:{on:string;closingCash:number;commonNet:number}[]=[];
 for(const [i,y] of Array.from(ledger.years.entries())){
  const own=events.filter(e=>new Date(e.time).getUTCFullYear()===y.year);
  const sum=(kind:string)=>own.filter(e=>e.kind===kind).reduce((s,e)=>s+e.usd,0);
  eq(sum("project-net-cash"),model.rows[i].fcfe);eq(sum("common-contribution"),y.commonContribution);eq(sum("common-distribution"),y.commonDistribution);
  let cash=y.openingCash;
  for(const time of Array.from(new Set(own.map(e=>e.time)))){
   const batch=own.filter(e=>e.time===time);let commonNet=0;
   for(const e of batch){cash+=e.kind==="common-distribution"?-e.usd:e.usd;commonNet+=e.kind==="common-distribution"?e.usd:e.kind==="common-contribution"?-e.usd:0;}
   if(cash < -1e-9)throw Error("Dated cash funding shortfall");
   pv+=commonNet/(1+dated.discountRate)**((time-origin)/86400000/365.25);
   days.push({on:new Date(time).toISOString().slice(0,10),closingCash:cash,commonNet});
  }
  eq(cash,y.closingCash);
 }
 return {version:dated.version,valuationOn:dated.valuationOn,finiteCommonCashPvUsd:pv,days,
  limitations:["Net project cash event timing is declared, not independently decomposed operating-event evidence","Same-day net settlement only; no intraday credit assumption","No terminal value, periodic certification, whole-equity or market identification"],
  scientificAcceptance:false};
}
export function reconcileCohortCash(model:ReturnType<typeof calculateOperatingCohorts>,ledger:CohortCashLedger,evidenceIds:string[]){
 if(ledger.version!=="cohort-cash-ledger-1"||ledger.currency!=="USD"||!ledger.claimantId||
  ledger.claim!=="declared-project-common-distribution-not-whole-equity"||
  !evidenceIds.includes(ledger.distributionRightsEvidenceId)||ledger.years.length!==model.rows.length)
  throw Error("Explicit complete cash/claim/evidence boundary required");
 const eq=(a:number,b:number)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))throw Error("Accrual/cash balance reconciliation failed");};
 const balances=["Receivables","OtherWorkingCapital","UnpaidTax","Debt","NonCommonLiability","Cash"] as const;
 return ledger.years.map((y,i)=>{
  const r=model.rows[i],a=r.inputs;
  if(y.year!==r.year||!y.evidenceIds.length||y.evidenceIds.some(id=>!evidenceIds.includes(id)))throw Error("Cash year/source mismatch");
  const required=["collections","taxAccrual","nonCommonAccrual","operatingFixedCash","holdingCash","transactionCash","commonContribution","commonDistribution",
   ...balances.flatMap(b=>[`opening${b}`,`closing${b}`])];
  for(const key of required){const value=(y as unknown as Record<string,unknown>)[key];if(typeof value!=="number"||!Number.isFinite(value)||value<0)throw Error(`Missing/invalid cash field ${key}`);}
  for(const b of balances)if(i)eq(y[`opening${b}`],ledger.years[i-1][`closing${b}`]);
  eq(y.closingReceivables,y.openingReceivables+r.revenue-y.collections);
  eq(a.increaseOperatingWorkingCapitalUsd,y.closingReceivables-y.openingReceivables+y.closingOtherWorkingCapital-y.openingOtherWorkingCapital);
  eq(y.closingUnpaidTax,y.openingUnpaidTax+y.taxAccrual-a.cashTaxUsd);
  eq(y.closingDebt,y.openingDebt+a.debtRaisedUsd-a.debtRepaidUsd);
  eq(y.closingNonCommonLiability,y.openingNonCommonLiability+y.nonCommonAccrual-a.nonCommonCashUsd);
  eq(a.fixedCashCostUsd,y.operatingFixedCash+y.holdingCash+y.transactionCash);
  // FCFE already includes total operating WC, cash tax, debt and non-common cash.
  // Collections and balances reconcile that same cash, not additional deductions.
  const available=y.openingCash+r.fcfe+y.commonContribution;
  if(available<0||y.commonDistribution>available+1e-9)throw Error("Unfunded cash or distribution exceeds available declared cash");
  eq(y.closingCash,available-y.commonDistribution);
  return {year:y.year,fcfe:r.fcfe,commonNetCash:y.commonDistribution-y.commonContribution,
   fundingContribution:y.commonContribution,closingCash:y.closingCash,
   formula:"commonNetCash=distribution-contribution; closingCash=openingCash+FCFE-commonNetCash",
   legalQualification:"Declared rights evidence only; no independent legal/owner authentication"};
 });
}
