import {test} from "node:test";
import assert from "node:assert/strict";
import {renewalTransportFixture} from "./renewalTransportFixture";
import {freezeDeploymentGrowth} from "../server/calculation/deploymentGrowth";
import {freezeDeploymentTransition,evaluateDeploymentTransition} from "../server/calculation/deploymentTransition";
export function transitionFixture(){
 const periodic:any=renewalTransportFixture().scenarios[0].renewal,ids=periodic.specification.evidenceIds;
 const spec=structuredClone(periodic.specification);
 spec.cohorts=[spec.cohorts[0]];spec.years=[{...spec.years[0],year:2025,constructionCashUsd:10,replacementCashUsd:0}];
 const deployment:any={version:"finite-owned-deployment-1",claim:"conditional-project-common-residual",quantity:"commissioned-owned-capacity",
  calendar:"UTC-civil",baselineQuantity:1,baselineOn:"2025-07-01",growthDomain:[0,.2],specification:spec,evidenceIds:ids,
  baselineBinding:{kind:"annual-commissioned-flow",unit:"kWh-storage",openingOperatingStock:0,constructionBasis:"only-declared-cohort-capital",
   horizon:[2025,2025],cutoff:"2025-07-01",availableAt:"2025-01-01",sourceId:ids[0]},
  commissioning:[{cohortId:"asset-2025",on:"2025-07-01",capitalOn:"2025-07-01",capitalUsdPerUnit:10,maximumUnits:2,ownedFraction:1,evidenceIds:ids}]};
 const service=10*184/365,revenue=service*10,energy=service/.8,distribution=revenue-energy;
 const f=freezeDeploymentGrowth(deployment);
 const accounts:any={definitionHash:f.definitionHash,growth:0,interest:"explicit-zero",recovery:"none",ownership:"full-common-claim",
  ledger:{...periodic.cashLedger,years:[{...periodic.cashLedger.years[0],year:2025,collections:revenue,commonContribution:10,commonDistribution:distribution}]},
  declaration:{...periodic.datedAccounting.declaration,valuationOn:"2025-07-01"},
  timing:["collections","energyCost","construction","commonContribution","commonDistribution"].map(component=>({year:2025,component,
   allocations:[{on:["construction","commonContribution"].includes(component)?"2025-07-01":"2025-12-31",fraction:1,evidenceIds:ids}]})),
  accrual:{version:"dated-accrual-2",claimantId:periodic.cashLedger.claimantId,payables:[{year:2025,opening:0,closing:0}],
   operatingSettlements:{otherWorkingCapitalBasis:"excludes-receivables-payables-and-tax",alreadyCashPaidComponents:["construction"],
    years:[{year:2025,variableCost:0,energyCost:energy,evidenceIds:ids}]},
   entries:[{id:"revenue",on:"2025-12-31",kind:"revenue",usd:revenue,evidenceIds:ids},
    {id:"energy",on:"2025-12-31",kind:"payable",component:"energyCost",usd:energy,evidenceIds:ids}]}};
 return {version:"finite-gregorian-join-1" as const,deployment,growth:0,accounts,periodic,joinOn:"2026-01-01",
  rights:[structuredClone(periodic.wholeStateCycle.rights[0])],capitalReturns:[],obligations:"none-open" as const,dispositions:"no-sales-or-withdrawals" as const};
}
test("actual half-year storage, accrued energy, funded cash and full before-event state join",()=>{
 const f=transitionFixture(),r=evaluateDeploymentTransition(freezeDeploymentTransition(f));
 const expected=(10*184/365*8.75)/1.1**(183/365.25)-10;
 assert.ok(Math.abs(r.finite.cash.finiteCommonCashPvUsd-expected)<1e-8);
 assert.equal(r.join.paidCapital,10);
 assert.ok(Math.abs(r.conditionalProjectValueUsd-(expected+r.periodic.conditionalPeriodicProjectValueUsd/1.1**(184/365.25)))<1e-8);
 assert.equal(r.inverse,null);assert.equal(r.marketImplied,false);
 const bad=structuredClone(f);bad.rights[0].entity="wrong-owner";
 assert.throws(()=>evaluateDeploymentTransition(freezeDeploymentTransition(bad)),/rights mismatch/);
 const drift=structuredClone(f);drift.periodic.specification.years[0].utilization=.9;
 assert.throws(()=>freezeDeploymentTransition(drift),/Nonstationary/);
 const funding=structuredClone(f);funding.accounts.ledger.years[0].commonContribution=0;
 assert.throws(()=>evaluateDeploymentTransition(freezeDeploymentTransition(funding)),/balance|fund|cash/i);
 const unpaid=structuredClone(f);unpaid.accounts.accrual.payables[0].closing=1;
 unpaid.accounts.accrual.operatingSettlements.years[0].energyCost-=1;
 unpaid.accounts.ledger.years[0].closingCash=1;
 assert.throws(()=>evaluateDeploymentTransition(freezeDeploymentTransition(unpaid)),/financial boundary/);
 const late=structuredClone(f);late.accounts.timing.find((t:any)=>t.component==="collections").allocations[0].on="2026-01-02";
 assert.throws(()=>evaluateDeploymentTransition(freezeDeploymentTransition(late)),/timing/);
 const obligations=structuredClone(f);(obligations as any).obligations="assumed-zero";
 assert.throws(()=>freezeDeploymentTransition(obligations),/policy/);
});
