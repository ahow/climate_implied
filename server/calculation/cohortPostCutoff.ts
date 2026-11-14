import {contentHash} from "./analysisManifest";
import {calculateOperatingCohorts,type CohortSpecification,type CohortYear} from "./operatingCohorts";
import {assessCohortDisposition,type CohortDisposition} from "./cohortDisposition";
import {settleTerminal,type TerminalSettlement,type TerminalBalances} from "./terminalSettlement";
export interface PostCutoffInterval{
 version:"post-cutoff-interval-1";priorSpecificationHash:string;claimantId:string;
 cashBasis:"owned-service-and-owned-nonvolume-cash";
 workingCapitalBasis:"otherWC-excludes-AR-AP-tax";
 inputClassification:"declared-conditional-forecast";coverageFrom:string;coverageThrough:string;
 years:CohortYear[];events:TerminalSettlement["events"];
 priorRetiredOwnership?:{cohortId:string;specificationHash:string;ownedFraction:number;evidenceIds:string[]}[];
}
const day=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error("Exact interval date required");return Date.parse(s);};
/** Owned exposure is a calculation transform, never a rewritten physical source. */
export function ownedFinancialSpecification(spec:CohortSpecification,p:CohortDisposition,capRights:boolean,
 prior:NonNullable<PostCutoffInterval["priorRetiredOwnership"]>=[],original=spec){
 const cutoff=`${original.years.at(-1)!.year+1}-01-01`;
 const ids=new Set<string>();
 for(const o of prior){
  const c=original.cohorts.find(c=>c.id===o.cohortId);
  if(ids.has(o.cohortId)||!c?.dated||c.dated.retiredOn>cutoff||p.assets.some(a=>a.cohortId===o.cohortId)||
   o.specificationHash!==contentHash(original)||!Number.isFinite(o.ownedFraction)||o.ownedFraction<=0||o.ownedFraction>1||
   !o.evidenceIds.length||o.evidenceIds.some(id=>!c.evidenceIds.includes(id)||!original.evidenceIds.includes(id)))
   throw Error("Prior-retired ownership needs its own matched cohort/specification/source");
  ids.add(o.cohortId);
 }
 return {...spec,cohorts:spec.cohorts.map(c=>{
  const a=p.assets.find(a=>a.cohortId===c.id);
  const historical=prior.find(o=>o.cohortId===c.id);
  if(!a&&!historical)throw Error("Explicit ownership for every financial cohort required");
  const retiredOn=capRights&&a&&a.on<c.dated!.retiredOn?a.on:c.dated!.retiredOn;
  return {...c,installedUnits:c.installedUnits*(a?.ownedFraction??historical!.ownedFraction),retiredYear:Number(retiredOn.slice(0,4)),
   dated:{...c.dated!,retiredOn}};
 })};
}
export function calculatePostCutoff(spec:CohortSpecification,p:CohortDisposition,x:PostCutoffInterval,
 terminal:TerminalSettlement,closing:TerminalBalances,parent:string,valuationOn:string,rate:number){
 const cutoff=`${spec.years.at(-1)!.year+1}-01-01`;
 if(x.version!=="post-cutoff-interval-1"||x.priorSpecificationHash!==contentHash(spec)||x.claimantId!==terminal.claimantId||
  x.cashBasis!=="owned-service-and-owned-nonvolume-cash"||x.workingCapitalBasis!=="otherWC-excludes-AR-AP-tax"||x.inputClassification!=="declared-conditional-forecast"||
  x.coverageFrom!==cutoff||day(x.coverageThrough)<day(cutoff)||!x.years.length||x.years[0].year!==Number(cutoff.slice(0,4))||
  terminal.events.length)throw Error("Explicit interval/claim/source coverage and one event schedule required");
 const assessment=assessCohortDisposition(spec,p,x.claimantId,terminal.openingObligations);
 const missing=assessment.missing.filter(s=>s!=="Delayed disposition requires an explicit matched post-cutoff operating interval");
 if(missing.length)throw Error("Unsupported delayed disposition: "+missing.join("; "));
 if(p.assets.some(a=>a.on>x.coverageThrough)||x.years.at(-1)!.year!==Number(x.coverageThrough.slice(0,4)))
  throw Error("No extrapolation outside declared interval coverage");
 const future={...spec,years:x.years};delete future.liquidation;
 const ownedSpec=ownedFinancialSpecification(future,p,true,x.priorRetiredOwnership,spec),owned=calculateOperatingCohorts(ownedSpec);
 // Gross operating exposure retains sold assets; a withdrawal/removal changes
 // operating activity only where explicitly declared. Material/title state stays
 // in the separate disposition ledger, not inferred from operating capacity.
 const gross=calculateOperatingCohorts({...future,cohorts:future.cohorts.map(c=>{
  const a=p.assets.find(a=>a.cohortId===c.id);
  if(!a||a.outcome!=="retire"||a.on>=c.dated!.retiredOn)return c;
  return {...c,retiredYear:Number(a.on.slice(0,4)),dated:{...c.dated!,retiredOn:a.on}};
 })});
 const e=structuredClone(x.events);
 if(e.some(v=>v.kind==="asset-receivable-accrual"||(v.kind==="payable-accrual"&&!v.component)))
  throw Error("Asset recognition is compiler-generated; operating accrual components must be classified");
 const operating=e.filter(v=>v.kind==="revenue-accrual"||v.kind==="cash-operating-cost"||v.kind==="capital-spend"||
  (v.kind==="payable-accrual"&&v.component));
 for(const v of operating){
  const operatingComponent=["variableCost","energyCost","fixedCashCost","interest"].includes(v.component??"");
  const capitalComponent=["construction","maintenance","replacement","decommissioning"].includes(v.component??"");
  if(v.kind==="revenue-accrual"?v.component!==undefined:
   operatingComponent?!["cash-operating-cost","payable-accrual"].includes(v.kind):
   capitalComponent?v.kind!=="capital-spend":true)throw Error("Explicit compatible operating/capital classification required");
  if(v.component==="interest"&&v.kind!=="cash-operating-cost")throw Error("Interest accrual requires an additional explicit settlement contract");
 }
 for(const v of operating)if(v.on<x.coverageFrom||v.on>x.coverageThrough||!x.years.some(y=>y.year===Number(v.on.slice(0,4))))
  throw Error("Economic recognition outside declared source/assumption coverage");
 const eq=(a:number,b:number)=>{if(Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))throw Error("Interval activity/economics/event reconciliation failed");};
 for(const row of owned.rows){
  const events=operating.filter(v=>Number(v.on.slice(0,4))===row.year),y=x.years.find(y=>y.year===row.year)!;
  eq(events.filter(v=>v.kind==="revenue-accrual").reduce((n,v)=>n+v.usd,0),row.revenue);
  for(const [component,value] of [["variableCost",row.variableCost],["energyCost",row.energyCost],["fixedCashCost",y.fixedCashCostUsd],
   ["construction",y.constructionCashUsd],["maintenance",y.maintenanceCashUsd],["replacement",y.replacementCashUsd],["decommissioning",y.decommissioningCashUsd],["interest",y.interestCashUsd]] as const){
   eq(events.filter(v=>v.component===component).reduce((n,v)=>n+v.usd,0),value??0);
  }
  const all=e.filter(v=>Number(v.on.slice(0,4))===row.year);
  for(const [kind,value] of [["tax",y.cashTaxUsd],["debt-funding",y.debtRaisedUsd],["debt",y.debtRepaidUsd],["nonCommon",y.nonCommonCashUsd]] as const)
   eq(all.filter(v=>v.kind===kind).reduce((n,v)=>n+v.usd,0),value);
  eq(all.reduce((n,v)=>n+(v.kind==="otherWC-invest"?v.usd:v.kind==="otherWC"?-v.usd:0),0),y.increaseOperatingWorkingCapitalUsd);
 }
 // Prefix checks use the same daily law, capped exclusively AFTER the accrual
 // day. This is an integration bound, not a changed source retirement date.
 for(const on of Array.from(new Set(operating.map(v=>v.on))).sort()){
  const year=Number(on.slice(0,4)),cap=new Date(day(on)+86400000).toISOString().slice(0,10);
  const cohorts=ownedSpec.cohorts.filter(c=>c.dated!.commissionedOn<cap&&c.dated!.retiredOn>`${year}-01-01`).map(c=>{
   const retiredOn=c.dated!.retiredOn<cap?c.dated!.retiredOn:cap;return {...c,retiredYear:Number(retiredOn.slice(0,4)),dated:{...c.dated!,retiredOn}};
  });
  const prefix=cohorts.length?calculateOperatingCohorts({...ownedSpec,years:[x.years.find(y=>y.year===year)!],cohorts}).rows[0]:null;
  for(const k of ["revenue","variableCost","energyCost"] as const){
   const amount=operating.filter(v=>v.on<=on&&v.on.startsWith(`${year}-`)&&(k==="revenue"?v.kind==="revenue-accrual":v.component===k)).reduce((n,v)=>n+v.usd,0);
   if(amount-(prefix?.[k]??0)>1e-9*Math.max(1,amount))throw Error("Delayed recognition precedes earned service/energy");
  }
 }
 const compiled:TerminalSettlement={...structuredClone(terminal),version:"terminal-settlement-2-operations",events:e};
 for(const a of p.assets){
  compiled.events.push({id:`asset:${a.cohortId}:recognition`,on:a.on,kind:"asset-receivable-accrual",usd:a.proceedsUsd!,evidenceIds:a.proceedsEvidenceIds},
   {id:`asset:${a.cohortId}:receipt`,on:a.cashOn!,kind:"receivables",usd:a.proceedsUsd!,evidenceIds:a.proceedsEvidenceIds});
  for(const o of a.obligations!){
   const eventId=`asset:${a.cohortId}:${o.id}:payment`;
   if(!o.alreadyAccrued)compiled.events.push({id:`asset:${a.cohortId}:${o.id}:accrual`,on:o.accruedOn,kind:o.kind==="tax"?"tax-accrual":"payable-accrual",usd:o.usd,evidenceIds:o.evidenceIds,...(o.kind==="tax"?{}:{costBasis:"retirement" as const})});
   else compiled.openingObligations!.allocations.push({eventId,obligationId:o.id,usd:o.usd});
   compiled.events.push({id:eventId,on:o.paidOn,kind:o.kind==="tax"?"tax":"payables",usd:o.usd,evidenceIds:o.evidenceIds});
  }
 }
 const cash=settleTerminal(compiled,closing,parent,x.claimantId,cutoff,valuationOn,rate,spec.evidenceIds);
 const physicalRows=(model:typeof owned,includeAccrual:boolean)=>model.rows.map(r=>({
  year:r.year,openingOperatingUnits:r.opening,addedOperatingUnits:r.added,retiredOperatingUnits:r.retired,closingOperatingUnits:r.closing,
  service:r.service,chargeEnergyKwh:r.chargeEnergyKwh,contributions:r.contributions,
  ...(includeAccrual?{revenueAccrualBasisUsd:r.revenue,variableAccrualBasisUsd:r.variableCost,energyAccrualBasisUsd:r.energyCost}:{})
 }));
 return {version:x.version,inputHash:contentHash({spec,p,x,terminal,closing}),assessment,
  ownedExposure:{inputHash:owned.inputHash,rows:physicalRows(owned,true)},
  grossOperatingExposure:{inputHash:gross.inputHash,rows:physicalRows(gross,false)},
  cash,periodicValueUsd:null,wholeEquityValueUsd:null,
  measureBoundary:"Operating units/exposure are not material-asset/title destruction. Gross exposure contains no cash valuation; actual dated common cash is counted only in cash.",
  ownershipEquation:"Owned exposure = source installed capacity × ownership once; prices are per owned service and non-volume cash inputs already represent the declared claim",
  formula:"Daily owned exposure stops at rights transfer; gross service need not stop. Operating revenue and sale receivables are separate; common cash is discounted once.",
  scope:"Conditional forecast; capped dates are calculation bounds, not rewritten observations or legal approval",scientificAcceptance:false};
}
