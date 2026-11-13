import {contentHash} from "./analysisManifest";
import {calculateOperatingCohorts,type CohortSpecification} from "./operatingCohorts";
import type {TerminalSettlement,TerminalBalances} from "./terminalSettlement";
type Obligation={id:string;kind:"decommissioning"|"restoration"|"recycling"|"tax";accruedOn:string;paidOn:string;usd:number;evidenceIds:string[];alreadyAccrued:boolean};
export interface CohortDisposition {
 version:"cohort-disposition-1";specificationHash:string;claimantId:string;currency:"USD";stockBasis:"full-unit-before-ownership";
 assets:{cohortId:string;ownedFraction:number;amountBasis:"owned-claim-USD";rightsEvidenceIds:string[];outcome:"retain"|"dispose"|"retire";
  on:string;cashOn:string|null;proceedsUsd:number|null;proceedsEvidenceIds:string[];
  obligations:Obligation[]|null;obligationCompletenessEvidenceIds:string[]}[];
}
function day(s:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error("Invalid disposition civil date");return Date.parse(s);}
/** Inventory and explicit instructions only. No book-value salvage inference,
 * no automatic cash posting and no implied continuing operation after cutoff. */
export function assessCohortDisposition(spec:CohortSpecification,p:CohortDisposition,claimant:string){
 const physical=calculateOperatingCohorts(spec);
 if(p.version!=="cohort-disposition-1"||p.stockBasis!=="full-unit-before-ownership"||p.specificationHash!==contentHash(spec)||p.claimantId!==claimant||p.currency!=="USD"||spec.liquidation)
  throw Error("Disposition parent/claim mismatch or duplicate legacy liquidation");
 if(spec.timing!=="utc-civil-day-service")throw Error("Dated asset boundaries required");
 const cutoff=`${spec.years.at(-1)!.year+1}-01-01`,t=day(cutoff),ids=new Set<string>(),obligations=new Set<string>();
 const survivors=spec.cohorts.filter(c=>day(c.dated!.commissionedOn)<t&&day(c.dated!.retiredOn)>=t);
 const evidence=(a:string[])=>a.length>0&&a.every(id=>spec.evidenceIds.includes(id));
 if(p.assets.length!==survivors.length)throw Error("Every surviving cohort needs exactly one outcome");
 const rows=p.assets.map(a=>{
  const c=survivors.find(c=>c.id===a.cohortId);
  if(!c||ids.has(a.cohortId))throw Error("Missing, duplicate or nonsurviving disposition");
  ids.add(a.cohortId);
  if(a.amountBasis!=="owned-claim-USD"||!Number.isFinite(a.ownedFraction)||a.ownedFraction<=0||a.ownedFraction>1||!evidence(a.rightsEvidenceIds)||day(a.on)<t||
   !["retain","dispose","retire"].includes(a.outcome))throw Error("Explicit ownership/rights/outcome/date required");
  const missing:string[]=[];
  if(a.on!==cutoff)missing.push("Delayed disposition requires an explicit matched post-cutoff operating interval");
  if(a.outcome==="retain")missing.push("Retained stock requires a separate funded continuation; no automatic periodic value");
  if(a.outcome!=="retain"&&(a.proceedsUsd===null||a.cashOn===null||!evidence(a.proceedsEvidenceIds)))missing.push("Source-supported proceeds and receipt date unavailable; book value is not salvage");
  if(a.proceedsUsd!==null&&(!Number.isFinite(a.proceedsUsd)||a.proceedsUsd<0))throw Error("Invalid proceeds");
  if(a.cashOn!==null&&day(a.cashOn)<day(a.on))throw Error("Advance proceeds need a separate liability contract");
  if(a.obligations===null||!evidence(a.obligationCompletenessEvidenceIds))missing.push("Complete retirement/restoration/recycling/tax obligations unavailable");
  for(const o of a.obligations??[]){
   if(!o.id||obligations.has(o.id)||!["decommissioning","restoration","recycling","tax"].includes(o.kind)||
    !Number.isFinite(o.usd)||o.usd<0||!evidence(o.evidenceIds)||typeof o.alreadyAccrued!=="boolean"||
    day(o.paidOn)<day(o.accruedOn)||day(o.paidOn)<t)throw Error("Duplicate/invalid obligation or settlement date");
   obligations.add(o.id);
   if(o.alreadyAccrued)missing.push(`Obligation ${o.id} requires exact opening-liability reconciliation; do not accrue twice`);
   else if(day(o.accruedOn)<t)throw Error("Past obligation must reconcile to opening liabilities");
  }
  const ageDays=(t-day(c.dated!.commissionedOn))/86400000;
  return {cohortId:c.id,capacityUnit:c.capacityUnit,serviceUnit:c.serviceUnit,installedUnits:c.installedUnits,
   ownedUnits:c.installedUnits*a.ownedFraction,ownershipAppliedOnce:true,ageDays,
   serviceMultiplierAtCutoff:Math.pow(1-c.annualDegradation,ageDays/c.dated!.degradationDayBasis),
   roundTripEfficiency:c.dated!.roundTripEfficiency??null,outcome:a.outcome,on:a.on,
   instructions:a,missing,postCutoffActivity:null,
   activityReason:"No post-cutoff activity generated; delayed disposition needs a separately modeled service/energy/cash interval"};
 });
 const total=rows.reduce((n,r)=>n+r.installedUnits,0);
 if(Math.abs(total-physical.rows.at(-1)!.closing)>1e-9*Math.max(1,total))throw Error("Closing stock does not reconcile");
 return {version:p.version,identity:contentHash({spec,p}),cutoff,rows,closingGrossUnits:total,
  missing:rows.flatMap(r=>r.missing),cashPosted:false,periodicValueUsd:null,wholeEquityValueUsd:null,
  scientificAcceptance:false,scope:"Source-declared disposition instructions; financial posting and delayed operating intervals not yet executed"};
}
/** Immediate cutoff disposition only. Prices are declared owned-claim proceeds,
 * never gross assets multiplied a second time. Recognition is a sale receivable,
 * NOT operating revenue or an inferred taxable gain. */
export function compileDispositionSettlement(spec:CohortSpecification,p:CohortDisposition,terminal:TerminalSettlement,closing:TerminalBalances){
 const assessment=assessCohortDisposition(spec,p,terminal.claimantId);
 if(assessment.missing.length)return {assessment,compiled:null};
 for(const k of Object.keys(closing) as (keyof TerminalBalances)[])
  if(terminal.opening[k]!==closing[k])throw Error("Swapped financial opening before asset recognition");
 const compiled=structuredClone(terminal),augmented={...closing};
 const recognition=[];
 for(const a of p.assets){
  if(a.outcome==="retain")throw Error("Retention is not disposition");
  const usd=a.proceedsUsd!;augmented.receivables+=usd;
  recognition.push({cohortId:a.cohortId,on:assessment.cutoff,assetSaleReceivableUsd:usd,amountBasis:a.amountBasis,evidenceIds:a.proceedsEvidenceIds});
  compiled.events.push({id:`asset:${a.cohortId}:receipt`,on:a.cashOn!,kind:"receivables",usd,evidenceIds:a.proceedsEvidenceIds});
  for(const o of a.obligations!){
   compiled.events.push({id:`asset:${a.cohortId}:${o.id}:accrual`,on:o.accruedOn,kind:o.kind==="tax"?"tax-accrual":"payable-accrual",
    usd:o.usd,evidenceIds:o.evidenceIds,...(o.kind==="tax"?{}:{costBasis:o.kind==="decommissioning"?"retirement" as const:"remediation" as const})},
    {id:`asset:${a.cohortId}:${o.id}:payment`,on:o.paidOn,kind:o.kind==="tax"?"tax":"payables",usd:o.usd,evidenceIds:o.evidenceIds});
  }
 }
 compiled.opening=augmented;
 return {assessment,compiled,closing:augmented,recognition,
  boundary:"Immediate cutoff asset exit; no post-disposal activity. Sale receivable is not operating revenue/taxable gain; tax schedule must be explicit."};
}
