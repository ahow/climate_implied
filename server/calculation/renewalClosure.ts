import {contentHash} from "./analysisManifest";
import type {CohortSpecification} from "./operatingCohorts";
import type {CohortCashLedger,AccrualSchedule,reconcileDatedAccruals} from "./cohortCashLedger";
export interface RenewalClosureDeclaration {
 version:"dated-whole-state-1";specificationHash:string;claimantId:string;
 boundaries:[string,string,string];openingPaidCapitalUsd:number;
 rights:{cohortId:string;slot:string;entity:string;ownedFraction:number;evidenceIds:string[]}[];
 commonCash:{on:string;contributionUsd:number;distributionUsd:number;capitalReturnedUsd:number;evidenceIds:string[]}[];
}
/** Necessary closure from executed state, not an extrapolation/periodicity proof. */
export function reconcileRenewalClosure(spec:CohortSpecification,ledger:CohortCashLedger,
 cash:ReturnType<typeof reconcileDatedAccruals>,d:RenewalClosureDeclaration,accrual:AccrualSchedule){
 const date=(s:string)=>{const t=Date.parse(s);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw Error("Exact closure date required");return t;};
 const times=d.boundaries.map(date),start=Date.UTC(spec.years[0].year,0,1),end=Date.UTC(spec.years.at(-1)!.year+1,0,1);
 if(d.version!=="dated-whole-state-1"||d.specificationHash!==contentHash(spec)||d.claimantId!==ledger.claimantId||
  times[0]<start||times[2]>end||times[1]<=times[0]||times[2]-times[1]!==times[1]-times[0]||
  !Number.isFinite(d.openingPaidCapitalUsd)||d.openingPaidCapitalUsd<0)throw Error("Matched equal-elapsed declared cycle boundaries required");
 const evidence=(ids:string[])=>{if(!ids.length||ids.some(id=>!spec.evidenceIds.includes(id)))throw Error("Closure source mismatch");};
 if(d.rights.length!==spec.cohorts.length||new Set(d.rights.map(r=>r.cohortId)).size!==d.rights.length)throw Error("Every cohort needs independent rights");
 for(const r of d.rights){evidence(r.evidenceIds);if(!r.slot||!r.entity||r.ownedFraction!==1||!spec.cohorts.some(c=>c.id===r.cohortId&&r.evidenceIds.every(id=>c.evidenceIds.includes(id))))throw Error("Closure requires matched full-claim rights; partial-claim renewal remains unsupported");}
 const eq=(a:number,b:number)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))throw Error("Executed whole-state cycle drift");};
 const common=cash.derivedEvents.filter(e=>["commonContribution","commonDistribution"].includes(e.component));
 if(new Set(d.commonCash.map(e=>e.on)).size!==d.commonCash.length)throw Error("Duplicate common-cash allocation");
 for(const on of Array.from(new Set([...common.map(e=>e.on),...d.commonCash.map(e=>e.on)]))){
  const a=d.commonCash.find(e=>e.on===on);if(!a)throw Error("Explicit common-capital versus income allocation required");date(on);evidence(a.evidenceIds);
  if([a.contributionUsd,a.distributionUsd,a.capitalReturnedUsd].some(v=>!Number.isFinite(v)||v<0)||a.capitalReturnedUsd>a.distributionUsd)throw Error("Invalid capital allocation");
  eq(a.contributionUsd,common.filter(e=>e.on===on&&e.component==="commonContribution").reduce((s,e)=>s+e.usd,0));
  eq(a.distributionUsd,common.filter(e=>e.on===on&&e.component==="commonDistribution").reduce((s,e)=>s+e.usd,0));
 }
 const y=ledger.years[0],opening={cash:y.openingCash,receivables:y.openingReceivables,tax:y.openingUnpaidTax,
  otherWC:y.openingOtherWorkingCapital,debt:y.openingDebt,nonCommon:y.openingNonCommonLiability,payables:accrual.payables[0].opening};
 const states=d.boundaries.map(on=>{
  const t=date(on),last=cash.accrualDays.filter(v=>v.on<on).at(-1)??opening;
  let paidCapital=d.openingPaidCapitalUsd;
  for(const a of d.commonCash.filter(a=>a.on<on).sort((a,b)=>a.on.localeCompare(b.on))){paidCapital+=a.contributionUsd-a.capitalReturnedUsd;if(paidCapital<0)throw Error("Unfunded capital redemption");}
  const financial=Object.fromEntries(Object.keys(opening).map(k=>[k,(last as Record<string,number>)[k]]));
  const physical=spec.cohorts.filter(c=>{if(!c.dated)throw Error("Dated cohorts required");return date(c.dated.commissionedOn)<t&&date(c.dated.retiredOn)>=t;}).map(c=>{
   const r=d.rights.find(r=>r.cohortId===c.id)!;
   return {slot:r.slot,entity:r.entity,units:c.installedUnits,ageDays:(t-date(c.dated!.commissionedOn))/86400000,
    degradation:c.annualDegradation,capacityUnit:c.capacityUnit,serviceUnit:c.serviceUnit,annualService:c.servicePerInstalledUnitPerYear,
    efficiency:c.dated!.roundTripEfficiency??null};
  }).sort((a,b)=>a.slot.localeCompare(b.slot));
  if(new Set(physical.map(p=>p.slot)).size!==physical.length)throw Error("Overlapping replacement slot");
  return {on,financial,paidCapital,physical};
 });
 for(const s of states.slice(1)){
  for(const [k,v] of Object.entries(states[0].financial))eq(v as number,s.financial[k] as number);
  eq(states[0].paidCapital,s.paidCapital);
  if(contentHash(states[0].physical)!==contentHash(s.physical))throw Error("Physical age/service/rights drift");
 }
 return {version:d.version,states,inputHash:contentHash(d),necessaryClosurePassed:true,periodicValueUsd:null,
  limitation:"Finite repeated states do not prove future forcing/calendar/economic law or legal rights; no periodic valuation or scientific acceptance"};
}
