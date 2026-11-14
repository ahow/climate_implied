import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePeriodicRenewal,type GregorianRenewalDeclaration} from "../server/calculation/cohortRenewal";
import {contentHash} from "../server/calculation/analysisManifest";
import {invertGregorianRenewal,type GregorianInverseProtocol} from "../server/calculation/gregorianInverse";
export function gregorianFixture(degradation=0):GregorianRenewalDeclaration{
 const ids=["conditional-engineering"],years=Array.from({length:800},(_,i)=>2026+i);
 const service=(year:number)=>{
  const begin=Date.UTC(year,0,1),end=Date.UTC(year+1,0,1),days=(end-begin)/86400000;let total=0;
  for(let t=begin;t<end;t+=86400000){
   const commission=t<Date.UTC(year,6,1)?Date.UTC(year-1,6,1):Date.UTC(year,6,1);
   total+=10/days*(1-degradation)**((t-commission)/86400000/365.25);
  }return total;
 };
 const amounts=new Map(years.map(y=>[y,service(y)]));
 const specification:GregorianRenewalDeclaration["specification"]={boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",timing:"utc-civil-day-service",evidenceIds:ids,
  cohorts:Array.from({length:801},(_,i)=>2025+i).map(y=>({id:`asset-${y}`,commissionedYear:y,retiredYear:y+1,installedUnits:1,annualDegradation:degradation,
   capacityUnit:"kWh-storage",serviceUnit:"kWh-delivered",servicePerInstalledUnitPerYear:10,evidenceIds:ids,
   dated:{commissionedOn:`${y}-07-01`,retiredOn:`${y+1}-07-01`,degradationDayBasis:365.25,roundTripEfficiency:.8}})),
  years:years.map(year=>({year,utilization:1,pricePerServiceUsd:10,variableCostPerServiceUsd:0,chargeEnergyPriceUsdPerKwh:1,fixedCashCostUsd:0,constructionCashUsd:0,
   maintenanceCashUsd:0,replacementCashUsd:10,decommissioningCashUsd:0,cashTaxUsd:0,increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0}))};
 return {version:"gregorian-renewal-1",claim:"conditional-project-common-residual",specification,discountRate:.1,
  futureLaw:{version:"declared-gregorian-repeat-1",classification:"conditional-stationary-assumption",periodYears:400,evidenceIds:ids},
  retirementPolicy:{completePhysicalRemovalAssumed:true,zeroSalvageAssumed:true,noUnmodelledLiabilitiesAssumed:true,evidenceIds:ids},
  replacementAccruals:years.map(y=>({cohortId:`asset-${y}`,accrualId:`capital-${y}`,usd:10})),
  cashLedger:{version:"cohort-cash-ledger-1",currency:"USD",claimantId:"engineering-claim",claim:"declared-project-common-distribution-not-whole-equity",distributionRightsEvidenceId:ids[0],
   years:years.map(year=>({year,openingReceivables:0,closingReceivables:0,collections:amounts.get(year)!*10,openingOtherWorkingCapital:0,closingOtherWorkingCapital:0,
    openingUnpaidTax:0,closingUnpaidTax:0,taxAccrual:0,openingDebt:0,closingDebt:0,openingNonCommonLiability:0,closingNonCommonLiability:0,nonCommonAccrual:0,
    operatingFixedCash:0,holdingCash:0,transactionCash:0,openingCash:0,closingCash:0,commonContribution:0,commonDistribution:8.75*amounts.get(year)!-10,evidenceIds:ids}))},
  datedAccounting:{declaration:{version:"dated-project-cash-1",valuationOn:"2026-01-01",discountRate:.1,convention:"ACT/365.25",claimantId:"engineering-claim"},
   timing:years.flatMap(year=>(["collections","replacement","energyCost","commonDistribution"] as const).map(component=>({year,component,allocations:[{on:`${year}-12-31`,fraction:1,evidenceIds:ids}]}))),
   accrual:{version:"dated-accrual-2",claimantId:"engineering-claim",payables:years.map(year=>({year,opening:0,closing:0})),
    operatingSettlements:{otherWorkingCapitalBasis:"excludes-receivables-payables-and-tax",alreadyCashPaidComponents:[],years:years.map(year=>({year,variableCost:0,energyCost:amounts.get(year)!/.8,evidenceIds:ids}))},
    entries:years.flatMap(year=>[{id:`revenue-${year}`,on:`${year}-12-31`,kind:"revenue" as const,usd:amounts.get(year)!*10,evidenceIds:ids},
     {id:`energy-${year}`,on:`${year}-12-31`,kind:"payable" as const,component:"energyCost" as const,usd:amounts.get(year)!/.8,evidenceIds:ids},
     {id:`capital-${year}`,on:`${year}-07-01`,kind:"payable" as const,component:"replacement" as const,usd:10,evidenceIds:ids}])}},
  wholeStateCycle:{version:"dated-whole-state-1",specificationHash:contentHash(specification),claimantId:"engineering-claim",
   boundaries:["2026-01-01","2426-01-01","2826-01-01"],openingPaidCapitalUsd:10,
   rights:specification.cohorts.map(c=>({cohortId:c.id,slot:"battery",entity:"conditional-owner",ownedFraction:1,evidenceIds:ids})),
   commonCash:years.map(year=>({on:`${year}-12-31`,contributionUsd:0,distributionUsd:8.75*amounts.get(year)!-10,capitalReturnedUsd:0,evidenceIds:ids}))}};
}
test("Gregorian law prices funded July replacements and leap/calendar cash without an annual polynomial",()=>{
 const x=gregorianFixture(),r=evaluatePeriodicRenewal(x);
 let expected=0;const start=Date.parse("2026-01-01");
 for(let y=2026;y<2426;y++)expected+=77.5/1.1**((Date.parse(`${y}-12-31`)-start)/86400000/365.25);
 expected/=1-1.1**(-146097/365.25);
 assert.ok(Math.abs(r.conditionalPeriodicProjectValueUsd!-expected)<1e-8);
 assert.equal(r.marketImplied,false);assert.equal(r.scientificAcceptance,false);
 const free=structuredClone(x);free.replacementAccruals.pop();assert.throws(()=>evaluatePeriodicRenewal(free),/replacement/);
});
test("degrading storage repeats only under the explicit complete calendar law",()=>{
 const x=gregorianFixture(.01),r=evaluatePeriodicRenewal(x);
 assert.ok(r.conditionalPeriodicProjectValueUsd!>0);assert.ok(r.conditionalPeriodicProjectValueUsd!<800);
 const drift=structuredClone(x);drift.wholeStateCycle.commonCash[0].capitalReturnedUsd=1;
 assert.throws(()=>evaluatePeriodicRenewal(drift),/drift/);
 const unfunded=structuredClone(x);unfunded.datedAccounting.timing.find(t=>t.component==="replacement")!.allocations[0].on="2026-01-01";
 assert.throws(()=>evaluatePeriodicRenewal(unfunded),/funding shortfall/);
});
test("same-claim full-domain affine inverse certifies its root and refuses unsupported funding domains",()=>{
 const x=gregorianFixture(),base=evaluatePeriodicRenewal(x).conditionalPeriodicProjectValueUsd!;
 const p:GregorianInverseProtocol={version:"gregorian-affine-price-inverse-1",baseInputHash:contentHash(x),claimantId:x.cashLedger.claimantId,
  valuationOn:"2026-01-01",targetKind:"conditional-project-common-cash",currency:"USD",targetValueUsd:base*82.5/77.5,
  priceDeltaDomain:[-1,1],residualToleranceUsd:1e-7,heldFixed:"all-physical-and-nonprice-inputs",taxBasis:"explicit-zero-tax-only"};
 const r=invertGregorianRenewal(x,p);assert.equal(r.status,"unique-supported-affine-root");assert.ok(Math.abs(r.roots[0]-.5)<1e-10);
 assert.equal(invertGregorianRenewal(x,{...p,targetValueUsd:1e9}).status,"no-root");
 assert.equal(invertGregorianRenewal(x,{...p,priceDeltaDomain:[-10,1]}).status,"unsupported");
 assert.equal(invertGregorianRenewal(x,{...p,baseInputHash:"borrowed"}).status,"unsupported");
 assert.equal(invertGregorianRenewal(x,{...p,priceDeltaDomain:[0,1e308]}).status,"unsupported");
});
