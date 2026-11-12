import {contentHash} from "./analysisManifest";
import type {CohortSpecification} from "./operatingCohorts";

export type LiquidationKind="salvage"|"working-capital-release"|"tax"|"debt-principal"|
 "interest"|"non-common"|"retirement"|"remediation"|"transaction-cost"|"holding-cost";
export interface CohortLiquidation {
 version:"cohort-liquidation-1"; policy:"finite-liquidation";
 currency:"USD"; cashBoundary:"undistributed-at-cutoff";
 openingCashDistributionOn:string;
 postHorizonService:"none-offline"; transactionCostsUsd:number; holdingCostsUsd:number;
 discountRate:number; evidenceIds:string[];
 opening:{cash:number;workingCapital:number;unpaidTax:number;debt:number;nonCommonLiability:number};
 subsequentAccrual:{tax:number;interest:number;remediation:number};
 dispositions:{cohortId:string;units:number;on:string;retirementLiability:number;remediationLiability:number}[];
 payments:{id:string;on:string;kind:LiquidationKind;usd:number;cohortId?:string;evidenceIds:string[]}[];
}
const date=(x:string)=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x)||!Number.isFinite(Date.parse(x))||
    new Date(x).toISOString().slice(0,10)!==x)throw Error("Exact liquidation civil date required");
 return Date.parse(x);
};
const equal=(a:number,b:number,label:string)=>{
 if(Math.abs(a-b)>8*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b)))
  throw Error(`Liquidation ${label} does not reconcile`);
};
/** This is a residual PROJECT cash claim. It is not issuer common-equity value.
 * Calling it requires actual opening balances, not inference from annual flows. */
export function calculateCohortLiquidation(spec:CohortSpecification,closingStock:number,policy:CohortLiquidation){
 const p: CohortLiquidation=JSON.parse(JSON.stringify(policy));
 if(p.version!=="cohort-liquidation-1"||p.policy!=="finite-liquidation"||p.currency!=="USD"||
    p.cashBoundary!=="undistributed-at-cutoff"||p.postHorizonService!=="none-offline"||
    !Number.isFinite(p.discountRate)||p.discountRate<0||p.discountRate>=1)
  throw Error("Explicit finite project liquidation policy required");
 const cutoff=Date.UTC(spec.years.at(-1)!.year+1,0,1);
 if(date(p.openingCashDistributionOn)<cutoff)throw Error("Opening cash distribution precedes the balance cutoff");
 if(!p.evidenceIds.length||new Set(p.evidenceIds).size!==p.evidenceIds.length||
    p.evidenceIds.some(id=>!spec.evidenceIds.includes(id)))throw Error("Liquidation evidence missing from specification");
 for(const [group,keys] of [[p.opening,["cash","workingCapital","unpaidTax","debt","nonCommonLiability"]],
   [p.subsequentAccrual,["tax","interest","remediation"]],
   [p,["transactionCostsUsd","holdingCostsUsd"]]] as const)
  for(const k of keys)if(!Number.isFinite((group as any)[k])||(group as any)[k]<0)
   throw Error(`Explicit nonnegative liquidation balance required: ${k}`);
 if(p.dispositions.length!==spec.cohorts.length||new Set(p.dispositions.map(d=>d.cohortId)).size!==spec.cohorts.length)
  throw Error("Complete unique cohort disposition domain required");
 for(const d of p.dispositions){
  const c=spec.cohorts.find(c=>c.id===d.cohortId);
  if(!c)throw Error("Unknown disposition cohort");
  const commissioned=c.dated?date(c.dated.commissionedOn):Date.UTC(c.commissionedYear,0,1);
  const retired=c.dated?date(c.dated.retiredOn):Date.UTC(c.retiredYear,0,1);
  if(commissioned>=cutoff)throw Error("Uncommissioned future investment needs a separate continuation model");
  const expected=retired>=cutoff?c.installedUnits:0;
  for(const value of [d.units,d.retirementLiability,d.remediationLiability])
   if(!Number.isFinite(value)||value<0)throw Error("Explicit disposition balances required");
  equal(d.units,expected,"cohort closing units");
  if(date(d.on)<cutoff)throw Error("Liquidation disposition precedes closing stock");
 }
 equal(p.dispositions.reduce((s,d)=>s+d.units,0),closingStock,"total closing stock");
 const kinds:LiquidationKind[]=["salvage","working-capital-release","tax","debt-principal","interest","non-common","retirement","remediation","transaction-cost","holding-cost"];
 const ids=new Set<string>();
 for(const payment of p.payments){
  if(!payment.id||ids.has(payment.id)||!kinds.includes(payment.kind)||!Number.isFinite(payment.usd)||payment.usd<0||
     date(payment.on)<cutoff||!payment.evidenceIds.length||
     payment.evidenceIds.some(id=>!p.evidenceIds.includes(id)))throw Error("Invalid/duplicate/undated liquidation payment");
  ids.add(payment.id);
  if(["salvage","retirement","remediation"].includes(payment.kind)){
   const disposition=p.dispositions.find(d=>d.cohortId===payment.cohortId);
   if(!disposition)throw Error("Cohort-specific cash needs its disposition");
   if(payment.kind==="salvage"&&disposition.units===0&&payment.usd!==0)
    throw Error("No salvage for already disposed stock");
   if(payment.kind==="salvage"&&date(payment.on)<date(disposition.on))
    throw Error("Advance salvage receipts need a separate receivable contract");
  }else if(payment.cohortId!==undefined)throw Error("Unsupported cohort allocation on aggregate balance");
 }
 const sum=(kind:LiquidationKind)=>p.payments.filter(v=>v.kind===kind).reduce((s,v)=>s+v.usd,0);
 equal(sum("working-capital-release"),p.opening.workingCapital,"working capital");
 equal(sum("tax"),p.opening.unpaidTax+p.subsequentAccrual.tax,"tax");
 equal(sum("debt-principal"),p.opening.debt,"debt");
 equal(sum("interest"),p.subsequentAccrual.interest,"interest");
 equal(sum("non-common"),p.opening.nonCommonLiability,"non-common claims");
 equal(sum("transaction-cost"),p.transactionCostsUsd,"transaction costs");
 equal(sum("holding-cost"),p.holdingCostsUsd,"offline holding costs");
 for(const d of p.dispositions){
  if(d.units>0&&!p.payments.some(v=>v.kind==="salvage"&&v.cohortId===d.cohortId))
   throw Error("Explicit salvage, including true zero, required for surviving stock");
  equal(p.payments.filter(v=>v.kind==="retirement"&&v.cohortId===d.cohortId).reduce((s,v)=>s+v.usd,0),
   d.retirementLiability,"cohort retirement liability");
  const paid=p.payments.filter(v=>v.kind==="remediation"&&v.cohortId===d.cohortId).reduce((s,v)=>s+v.usd,0);
  if(paid<d.remediationLiability)throw Error("Cohort remediation liability not settled");
 }
 equal(sum("remediation"),p.dispositions.reduce((s,d)=>s+d.remediationLiability,0)+p.subsequentAccrual.remediation,"remediation");
 const rows=p.payments.slice().sort((a,b)=>a.on.localeCompare(b.on)||a.id.localeCompare(b.id)).map(v=>{
  const signedCash=["salvage","working-capital-release"].includes(v.kind)?v.usd:-v.usd;
  const yearFraction=(date(v.on)-cutoff)/86400000/365.25;
  return {...v,signedCash,yearFraction,presentCash:signedCash/(1+p.discountRate)**yearFraction};
 });
 const commonResidual=p.opening.cash+rows.reduce((s,r)=>s+r.signedCash,0);
 const openingCashPresent=p.opening.cash/(1+p.discountRate)**((date(p.openingCashDistributionOn)-cutoff)/86400000/365.25);
 const presentResidual=openingCashPresent+rows.reduce((s,r)=>s+r.presentCash,0);
 const dates=Array.from(new Set(rows.map(r=>r.on))).sort();
 let available=0,peakDeficit=0;
 const settlementTimeline=dates.map(on=>{
  const cash=rows.filter(r=>r.on===on).reduce((s,r)=>s+r.signedCash,0);
  available+=cash;peakDeficit=Math.max(peakDeficit,-available);
  return {on,netSettlementCash:cash,cumulativeSettlementCash:available};
 });
 if(!Number.isFinite(commonResidual)||!Number.isFinite(presentResidual))throw Error("Nonfinite liquidation cash");
 return {version:p.version,inputHash:contentHash(p),at:new Date(cutoff).toISOString().slice(0,10),
  rows,openingCashDistributed:p.opening.cash,openingCashDistributionOn:p.openingCashDistributionOn,
  openingCashPresent,stockAtValuation:closingStock,
  liquidationCompleteOn:[...p.dispositions.map(d=>d.on),...p.payments.map(v=>v.on),p.openingCashDistributionOn].sort().at(-1)!,
  remainingStockMeaning:"After all declared physical dispositions, not at valuation cutoff",
  commonResidual,presentResidual,dispositions:p.dispositions,settlementTimeline,
  peakInterimFundingRequired:peakDeficit,fundingSource:peakDeficit>0?"not-established":"no-interim-deficit",
  unfundedShortfall:commonResidual<0,remainingStock:0,disposedStock:closingStock,
  claim:"conditional-project-residual-not-issuer-equity",marketImplied:false,scientificAcceptance:false,
  formula:"opening undistributed cash + salvage + working-capital release - tax - debt - interest - non-common claims - retirement - remediation - transaction costs - offline holding costs"};
}
