import {contentHash} from "./analysisManifest";
import {calculateOperatingCohorts,type CohortSpecification} from "./operatingCohorts";
import {reconcileDatedAccruals,type CohortCashLedger,type DatedProjectCash,type CashTiming,type AccrualSchedule} from "./cohortCashLedger";
import {reconcileRenewalClosure,type RenewalClosureDeclaration} from "./renewalClosure";

/** Prospective conditional law, not a fitted horizon or observed future series.
 * 400 Gregorian years reproduce civil-day/leap structure exactly. */
export interface GregorianRenewalDeclaration {
 version:"gregorian-renewal-1";claim:"conditional-project-common-residual";
 specification:CohortSpecification;discountRate:number;cashLedger:CohortCashLedger;
 datedAccounting:{declaration:Omit<DatedProjectCash,"events">;timing:CashTiming[];accrual:AccrualSchedule};
 wholeStateCycle:RenewalClosureDeclaration;
 futureLaw:{version:"declared-gregorian-repeat-1";classification:"conditional-stationary-assumption";periodYears:400;evidenceIds:string[]};
 replacementAccruals:{cohortId:string;accrualId:string;usd:number}[];
 retirementPolicy:{completePhysicalRemovalAssumed:true;zeroSalvageAssumed:true;noUnmodelledLiabilitiesAssumed:true;evidenceIds:string[]};
 transition?:never;
}
export function evaluateGregorianRenewal(x:GregorianRenewalDeclaration){
 const s=x.specification,d=x.datedAccounting.declaration;
 if(x.claim!=="conditional-project-common-residual"||x.futureLaw?.version!=="declared-gregorian-repeat-1"||
  x.futureLaw.classification!=="conditional-stationary-assumption"||x.futureLaw.periodYears!==400||
  !x.futureLaw.evidenceIds.length||x.futureLaw.evidenceIds.some(id=>!s.evidenceIds.includes(id))||
  s.timing!=="utc-civil-day-service"||s.liquidation||x.transition||s.years.length!==800||
  !Number.isFinite(x.discountRate)||x.discountRate<=0||x.discountRate>=1||
  d.discountRate!==x.discountRate||d.claimantId!==x.cashLedger.claimantId)
  throw Error("Explicit complete Gregorian conditional cash law required");
 const first=s.years[0].year,boundaries=[`${first}-01-01`,`${first+400}-01-01`,`${first+800}-01-01`];
 if(contentHash(boundaries)!==contentHash(x.wholeStateCycle.boundaries)||d.valuationOn!==boundaries[0])
  throw Error("Exact before-event valuation and Gregorian boundaries required");
 const day=(on:string)=>Date.parse(on)/86400000;
 const start=day(boundaries[0]),middle=day(boundaries[1]),end=day(boundaries[2]),period=middle-start;
 if(period!==146097||end-middle!==period)throw Error("Unsupported calendar period");
 const model=calculateOperatingCohorts(s);
 for(const e of x.datedAccounting.accrual.entries)
  if((e.kind==="revenue"||e.component==="energyCost"||e.component==="variableCost")&&!e.on.endsWith("-12-31"))
   throw Error("This repeat-law version supports completed annual service recognition only");
 const cash=reconcileDatedAccruals(model,x.cashLedger,d,x.datedAccounting.timing,x.datedAccounting.accrual,s.evidenceIds);
 const closure=reconcileRenewalClosure(s,x.cashLedger,cash,x.wholeStateCycle,x.datedAccounting.accrual);
 if(x.retirementPolicy?.completePhysicalRemovalAssumed!==true||x.retirementPolicy.zeroSalvageAssumed!==true||
  x.retirementPolicy.noUnmodelledLiabilitiesAssumed!==true||!x.retirementPolicy.evidenceIds.length||
  x.retirementPolicy.evidenceIds.some(id=>!s.evidenceIds.includes(id)))throw Error("Explicit conditional complete-retirement boundary required; not legal approval");
 const incoming=s.cohorts.filter(c=>day(c.dated!.commissionedOn)>=start&&day(c.dated!.commissionedOn)<end);
 if(x.replacementAccruals.length!==incoming.length||new Set(x.replacementAccruals.map(a=>a.cohortId)).size!==incoming.length)
  throw Error("Each replacement requires matched positive capital, not a cost-free fleet");
 const used=new Map<string,number>();
 for(const a of x.replacementAccruals){
  const c=incoming.find(c=>c.id===a.cohortId),e=x.datedAccounting.accrual.entries.find(e=>e.id===a.accrualId);
  if(!c||!e||e.kind!=="payable"||e.component!=="replacement"||e.on>c.dated!.commissionedOn||
   !Number.isFinite(a.usd)||a.usd<=0)throw Error("Replacement capital/accrual/commissioning mismatch");
  used.set(e.id,(used.get(e.id)??0)+a.usd);
 }
 for(const e of x.datedAccounting.accrual.entries.filter(e=>e.kind==="payable"&&e.component==="replacement"))
  if(Math.abs((used.get(e.id)??0)-e.usd)>1e-9*Math.max(1,e.usd))throw Error("Missing or duplicated replacement capital");
 const eq=(a:unknown,b:unknown)=>{if(contentHash(a)!==contentHash(b))throw Error("Full declared physical/economic/cash repeat law mismatch");};
 for(let i=0;i<400;i++){
  const {year:ya,...a}=s.years[i],{year:yb,...b}=s.years[i+400];
  if(ya!==first+i||yb!==ya+400)throw Error("Incomplete calendar years");
  eq(a,b);
 }
 const physicalProfile=(t:number)=>s.cohorts.filter(c=>c.dated&&day(c.dated.commissionedOn)<t+period&&day(c.dated.retiredOn)>=t).map(c=>{
  const rights=x.wholeStateCycle.rights.find(r=>r.cohortId===c.id)!;
  return {slot:rights.slot,entity:rights.entity,ownership:rights.ownedFraction,
   start:day(c.dated!.commissionedOn)-t,end:day(c.dated!.retiredOn)-t,units:c.installedUnits,
   degradation:c.annualDegradation,dayBasis:c.dated!.degradationDayBasis,
   efficiency:c.dated!.roundTripEfficiency??null,capacityUnit:c.capacityUnit,serviceUnit:c.serviceUnit,
   annualService:c.servicePerInstalledUnitPerYear};
 }).sort((a,b)=>a.start-b.start||a.slot.localeCompare(b.slot));
 eq(physicalProfile(start),physicalProfile(middle));
 const profile=(t:number)=>cash.derivedEvents.filter(e=>day(e.on)>=t&&day(e.on)<t+period)
  .map(e=>({offset:day(e.on)-t,component:e.component,usd:e.usd})).sort((a,b)=>a.offset-b.offset||a.component.localeCompare(b.component));
 eq(profile(start),profile(middle));
 const accrualProfile=(t:number)=>x.datedAccounting.accrual.entries.filter(e=>day(e.on)>=t&&day(e.on)<t+period)
  .map(e=>({offset:day(e.on)-t,kind:e.kind,component:e.component??null,usd:e.usd}))
  .sort((a,b)=>a.offset-b.offset||a.kind.localeCompare(b.kind)||String(a.component).localeCompare(String(b.component)));
 eq(accrualProfile(start),accrualProfile(middle));
 const commonProfile=(t:number)=>x.wholeStateCycle.commonCash.filter(e=>day(e.on)>=t&&day(e.on)<t+period)
  .map(e=>({offset:day(e.on)-t,contribution:e.contributionUsd,distribution:e.distributionUsd,capital:e.capitalReturnedUsd})).sort((a,b)=>a.offset-b.offset);
 eq(commonProfile(start),commonProfile(middle));
 let pv=0;
 for(const e of profile(start)){
  const common=e.component==="commonDistribution"?e.usd:e.component==="commonContribution"?-e.usd:0;
  pv+=common/Math.pow(1+x.discountRate,e.offset/365.25);
 }
 const denominator=-Math.expm1(-Math.log1p(x.discountRate)*period/365.25),value=pv/denominator;
 if(!Number.isFinite(value))throw Error("Nonfinite conditional periodic value");
 return {version:x.version,inputHash:contentHash(x),model,datedAccounting:cash,wholeStateClosure:closure,
  cyclePv:pv,conditionalPeriodicProjectValueUsd:value,periodDays:period,transition:null,
  cashBasis:"declared-common-distributions-net-contributions",
  futureLawHash:contentHash(x.futureLaw),
  formulas:{value:"PV(dated common distributions minus contributions over146097days) / (1-(1+r)^(-146097/365.25))"},
  limitations:["Explicit stationary Gregorian future law is assumed, not empirically established",
   "Stationary nominal USD cash; not a replacement for the original2.5–4% whole-equity terminal convention",
   "Already-funded opening state; no additional opening cash, sale or debt deduction",
   "No transition, changing exogenous future law, whole-equity target or inverse certification",
   "Paid-capital and declared account closure are not GAAP, legal, source or owner authentication"],
  marketImplied:false,scientificAcceptance:false};
}
