import test from "node:test";
import assert from "node:assert/strict";
import {calculateOperatingCohorts,type CohortSpecification} from "../server/calculation/operatingCohorts";
import {freezeCohortGrowthDeck} from "../server/calculation/cohortGrowthInverse";
function input():CohortSpecification{return {
 boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",timing:"utc-civil-day-service",evidenceIds:["engineering"],
 cohorts:[{id:"solar",commissionedYear:2023,retiredYear:2030,installedUnits:2,annualDegradation:0,
 capacityUnit:"MW",serviceUnit:"MWh",servicePerInstalledUnitPerYear:100,evidenceIds:["engineering"],
 dated:{commissionedOn:"2023-01-01",retiredOn:"2030-01-01",degradationDayBasis:365.25}}],
 years:[{year:2024,utilization:1,pricePerServiceUsd:1,variableCostPerServiceUsd:0,fixedCashCostUsd:0,
 constructionCashUsd:0,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:0,cashTaxUsd:0,
 increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0}],
 liquidation:{version:"cohort-liquidation-1",policy:"finite-liquidation",currency:"USD",
 cashBoundary:"undistributed-at-cutoff",openingCashDistributionOn:"2025-01-01",postHorizonService:"none-offline",transactionCostsUsd:2,holdingCostsUsd:3,
 discountRate:.1,evidenceIds:["engineering"],opening:{cash:10,workingCapital:20,unpaidTax:5,debt:30,nonCommonLiability:4},
 subsequentAccrual:{tax:1,interest:2,remediation:1},
 dispositions:[{cohortId:"solar",units:2,on:"2025-07-01",retirementLiability:7,remediationLiability:8}],
 payments:([
 ["salvage",100,"solar"],["working-capital-release",20],["tax",6],["debt-principal",30],["interest",2],
 ["non-common",4],["retirement",7,"solar"],["remediation",9,"solar"],["transaction-cost",2],["holding-cost",3],
 ] as const).map(([kind,usd,cohortId],i)=>({id:String(i),on:"2025-07-01",kind,usd,...(cohortId?{cohortId}:{}),evidenceIds:["engineering"]}))}
};}
test("independent finite stock/cash/discount oracle; no cost-free terminal or whole-equity claim",()=>{
 const r=calculateOperatingCohorts(input()),l=r.liquidation!;
 assert.equal(r.version,"operating-cohorts-3-liquidation");
 assert.ok(Math.abs(r.rows[0].fcfe-200)<1e-9);
 assert.equal(l.disposedStock,2);assert.equal(l.remainingStock,0);
 assert.equal(l.stockAtValuation,2);assert.equal(l.liquidationCompleteOn,"2025-07-01");
 assert.equal(r.terminal.remainingStock,2);assert.equal(r.terminal.stockAfterLiquidation,0);
 // 100+20-6-30-2-4-7-9-2-3 =57; opening undistributed cash10.
 assert.equal(l.commonResidual,67);
 assert.ok(Math.abs(l.presentResidual-(10+57/1.1**(181/365.25)))<1e-9);
 assert.equal(r.terminal.value,null);assert.equal(l.marketImplied,false);
 assert.equal(calculateOperatingCohorts({...input(),liquidation:undefined}).version,"operating-cohorts-2-dated");
});
test("complete balances, actual payment dates, ownership, evidence and explicit zeros are enforced",()=>{
 const bad:( (x:CohortSpecification)=>void)[]=[
 x=>x.liquidation!.opening.workingCapital=21,
 x=>x.liquidation!.dispositions[0].units=1,
 x=>x.liquidation!.payments[0].on="2024-12-31",
 x=>x.liquidation!.payments[0].evidenceIds=["forged"],
 x=>x.liquidation!.payments.push({...x.liquidation!.payments[0]}),
 x=>x.liquidation!.payments=x.liquidation!.payments.filter(v=>v.kind!=="salvage"),
 x=>delete (x.liquidation as any).holdingCostsUsd,
 x=>delete (x.liquidation as any).openingCashDistributionOn,
 x=>x.liquidation!.payments[0].on="2025-02-30",
 x=>x.liquidation!.payments[0].on="2025-06-30",
 ];
 for(const mutate of bad){const x=input();mutate(x);assert.throws(()=>calculateOperatingCohorts(x));}
 const x=input();x.liquidation!.payments[0].usd=0;
 const r=calculateOperatingCohorts(x).liquidation!;assert.equal(r.commonResidual,-33);assert.equal(r.unfundedShortfall,true);
});
test("payment order cannot change analytical identity; no duplicate annual WC deduction",()=>{
 const x=input(),a=calculateOperatingCohorts(x).liquidation!;
 x.liquidation!.payments.reverse();const b=calculateOperatingCohorts(x).liquidation!;
 assert.deepEqual(a.rows,b.rows);assert.equal(a.presentResidual,b.presentResidual);
 assert.notEqual(a.inputHash,b.inputHash); // submitted material ordering remains attributable
 const early=input();early.liquidation!.payments.find(p=>p.kind==="tax")!.on="2025-01-01";
 const e=calculateOperatingCohorts(early).liquidation!;
 assert.equal(e.peakInterimFundingRequired,6);assert.equal(e.fundingSource,"not-established");
});
test("annual polynomial inversion refuses dated liquidation rather than dropping its cash",()=>{
 assert.throws(()=>freezeCohortGrowthDeck({projects:[input()],baseCommissionYear:2023,valuationYear:2024,
  discountRate:"0.1",targetProjectCashPvUsd:"100",lowerOnePlusGrowth:"0.5",upperOnePlusGrowth:"2",
  absoluteParameterWidth:"0.0001",maxNodes:1000,rationale:"Engineering exclusion boundary",
  law:"proportional-replication-of-each-commissioning-cohort-cash-and-service"}),/liquidation.*polynomial/);
});
