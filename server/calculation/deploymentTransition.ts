import {contentHash} from "./analysisManifest";
import {freezeDeploymentGrowth,executeDeploymentCash,type DeploymentGrowthProtocol} from "./deploymentGrowth";
import {evaluateGregorianRenewal,type GregorianRenewalDeclaration} from "./gregorianRenewal";

/** Separate prospective join contract: the published periodic law is unchanged.
 * This first branch refuses unsettled item obligations, partial rights and sales.
 * Equal aggregate service is never sufficient to join two different fleets. */
export interface DeploymentTransition {
 version:"finite-gregorian-join-1";
 deployment:DeploymentGrowthProtocol;
 growth:number;
 accounts:Parameters<typeof executeDeploymentCash>[2];
 periodic:GregorianRenewalDeclaration;
 joinOn:string;
 rights:{cohortId:string;slot:string;entity:string;ownedFraction:1;evidenceIds:string[]}[];
 capitalReturns:{on:string;usd:number;evidenceIds:string[]}[];
 obligations:"none-open";dispositions:"no-sales-or-withdrawals";
}
export function freezeDeploymentTransition(input:DeploymentTransition){
 if(input.version!=="finite-gregorian-join-1")throw Error("Exact finite join version required");
 const p=structuredClone(input);
 validateTransitionBoundary(p);
 return {definitionHash:contentHash(p),input:p};
}
export type TransitionBoundaryInput=Omit<DeploymentTransition,"accounts"|"version">&{
 version:string;accounts:Pick<DeploymentTransition["accounts"],"definitionHash"|"growth"|"ledger"|"declaration"|"timing"|"accrual">};
export function validateTransitionBoundary(p:TransitionBoundaryInput){
 const f=freezeDeploymentGrowth(p.deployment);
 if(p.accounts.definitionHash!==f.definitionHash||
  p.accounts.growth!==p.growth||p.obligations!=="none-open"||p.dispositions!=="no-sales-or-withdrawals"||
  p.joinOn!==`${p.deployment.specification.years.at(-1)!.year+1}-01-01`||
  p.periodic.datedAccounting.declaration.valuationOn!==p.joinOn||
  p.accounts.declaration.discountRate!==p.periodic.discountRate||
  p.accounts.ledger.claimantId!==p.periodic.cashLedger.claimantId||
  p.deployment.specification.currency!==p.periodic.specification.currency)
  throw Error("Explicit matched transition date, source, claim and supported obligation policy required");
 if(p.deployment.specification.cohorts.some(c=>c.dated!.retiredOn<p.joinOn))
  throw Error("Prior retirement/removal needs an explicit disposition bridge; service withdrawal is not destruction");
 const controls=(y:DeploymentGrowthProtocol["specification"]["years"][number])=>({
  utilization:y.utilization,price:y.pricePerServiceUsd,variableCost:y.variableCostPerServiceUsd,
  chargePrice:y.chargeEnergyPriceUsdPerKwh??null});
 if(contentHash(controls(p.deployment.specification.years.at(-1)!))!==contentHash(controls(p.periodic.specification.years[0])))
  throw Error("Nonstationary service/price/cost boundary unsupported");
 for(const id of p.periodic.specification.evidenceIds)
  if(!p.deployment.evidenceIds.includes(id))throw Error("Periodic dependency outside frozen transition sources");
 const initial=p.accounts.ledger.years[0];
 if(!initial||["openingCash","openingDebt","openingReceivables","openingUnpaidTax","openingOtherWorkingCapital","openingNonCommonLiability"]
  .some(k=>(initial as unknown as Record<string,number>)[k]!==0)||p.accounts.accrual.payables[0]?.opening!==0)
  throw Error("This transition requires zero initial accounts and explicit dated funding; inherited opening balances unsupported");
 const evidence=(ids:string[])=>ids.length>0&&ids.every(id=>p.deployment.evidenceIds.includes(id));
 if(p.rights.length!==p.deployment.specification.cohorts.length||
  new Set(p.rights.map(r=>r.cohortId)).size!==p.rights.length||
  p.rights.some(r=>r.ownedFraction!==1||!r.entity||!r.slot||!evidence(r.evidenceIds)||
   !p.deployment.specification.cohorts.some(c=>c.id===r.cohortId)))
  throw Error("Every transition cohort requires independent full-claim rights");
 if(new Set(p.capitalReturns.map(v=>v.on)).size!==p.capitalReturns.length||
  p.capitalReturns.some(v=>!Number.isFinite(v.usd)||v.usd<0||!evidence(v.evidenceIds)||
   !/^\d{4}-\d{2}-\d{2}$/.test(v.on)||!Number.isFinite(Date.parse(v.on))||new Date(v.on).toISOString().slice(0,10)!==v.on||
   v.on<p.accounts.declaration.valuationOn||v.on>=p.joinOn))
  throw Error("Explicit unique capital-return allocation required");
}
export function evaluateDeploymentTransition(frozen:ReturnType<typeof freezeDeploymentTransition>){
 if(contentHash(frozen.input)!==frozen.definitionHash)throw Error("Changed pre-execution transition definition");
 freezeDeploymentTransition(frozen.input);
 const p=frozen.input;
 const finite=executeDeploymentCash(freezeDeploymentGrowth(p.deployment),p.growth,p.accounts);
 return joinExecutedDeployment(p,finite,frozen.definitionHash);
}
/** Called only after an executable finite adapter has checked its cash events.
 * The public evaluators never accept a caller-supplied finite result. */
export function joinExecutedDeployment(p:TransitionBoundaryInput,
 finite:Pick<ReturnType<typeof executeDeploymentCash>,"physical"|"cash">,definitionHash:string){
 validateTransitionBoundary(p);
 // The existing engine proves its own full repeated physical/financial state.
 const periodic=evaluateGregorianRenewal(p.periodic),opening=periodic.wholeStateClosure.states[0];
 const end=finite.cash.accrualDays.at(-1);
 if(!end||finite.cash.derivedEvents.some(e=>e.on>=p.joinOn)||opening.on!==p.joinOn)
  throw Error("Transition events overlap periodic before-event boundary");
 const eq=(a:number,b:number)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))throw Error("Transition financial boundary mismatch");};
 const declared=p.accounts.ledger.years.at(-1)!;
 const declaredClosing:Record<string,number>={receivables:declared.closingReceivables,
  payables:p.accounts.accrual.payables.at(-1)!.closing,tax:declared.closingUnpaidTax,
  otherWC:declared.closingOtherWorkingCapital,debt:declared.closingDebt,nonCommon:declared.closingNonCommonLiability};
 for(const key of ["cash","receivables","payables","tax","otherWC","debt","nonCommon"]){
  eq(end[key],opening.financial[key]);
  // Require exactly zero *declared* liabilities, while executed floating sums
  // retain the existing reconciliation tolerance. Never round a booked debt away.
  if(key!=="cash"&&(declaredClosing[key]!==0||opening.financial[key]!==0))
   throw Error("Open item obligations/receivables require a supported item-level continuation");
 }
 const profile=(s:typeof finite.physical.specification,rights:DeploymentTransition["rights"])=>s.cohorts
  .filter(c=>c.dated!.commissionedOn<p.joinOn&&c.dated!.retiredOn>=p.joinOn).map(c=>{
   const r=rights.find(r=>r.cohortId===c.id);if(!r)throw Error("Missing surviving cohort rights");
   return {id:c.id,slot:r.slot,entity:r.entity,ownership:r.ownedFraction,units:c.installedUnits,
    commissionedOn:c.dated!.commissionedOn,retiredOn:c.dated!.retiredOn,degradation:c.annualDegradation,
    dayBasis:c.dated!.degradationDayBasis,efficiency:c.dated!.roundTripEfficiency??null,
    capacityUnit:c.capacityUnit,serviceUnit:c.serviceUnit,annualService:c.servicePerInstalledUnitPerYear};
  }).sort((a,b)=>a.id.localeCompare(b.id));
 if(contentHash(profile(finite.physical.specification,p.rights))!==contentHash(profile(p.periodic.specification,p.periodic.wholeStateCycle.rights as DeploymentTransition["rights"])))
  throw Error("Transition physical lineage/age/service/rights mismatch");
 let capital=0;
 for(const v of p.capitalReturns){
  const paid=finite.cash.derivedEvents.filter(e=>e.on===v.on&&e.component==="commonDistribution").reduce((a,e)=>a+e.usd,0);
  if(v.usd>paid||v.on>=p.joinOn)throw Error("Unfunded or overlapping capital return");
 }
 const capitalDates=Array.from(new Set([...finite.cash.derivedEvents.filter(e=>e.component==="commonContribution").map(e=>e.on),...p.capitalReturns.map(v=>v.on)])).sort();
 for(const on of capitalDates){
  capital+=finite.cash.derivedEvents.filter(e=>e.on===on&&e.component==="commonContribution").reduce((a,e)=>a+e.usd,0);
  capital-=p.capitalReturns.filter(v=>v.on===on).reduce((a,v)=>a+v.usd,0);
  if(capital<0)throw Error("Capital redeemed before its funding date");
 }
 eq(capital,opening.paidCapital);
 const elapsed=(Date.parse(p.joinOn)-Date.parse(p.accounts.declaration.valuationOn))/86400000/365.25;
 const continuationPv=periodic.conditionalPeriodicProjectValueUsd/(1+p.periodic.discountRate)**elapsed;
 return {version:p.version,definitionHash,finite,periodic,join:{on:p.joinOn,paidCapital:capital,financial:end},
  continuationPv,conditionalProjectValueUsd:finite.cash.finiteCommonCashPvUsd+continuationPv,
  formula:"finite dated common cash PV + already-funded periodic value discounted from exact join; no second opening asset/debt/cash deduction",
  inverse:null,marketImplied:false,scientificAcceptance:false};
}
