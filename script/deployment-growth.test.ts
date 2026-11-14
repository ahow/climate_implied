import {test} from "node:test";
import assert from "node:assert/strict";
import {freezeDeploymentGrowth,compileDeploymentGrowth,executeDeploymentCash,type DeploymentGrowthProtocol} from "../server/calculation/deploymentGrowth";
function fixture():DeploymentGrowthProtocol{
 const years=[2024,2025].map(year=>({year,utilization:1,pricePerServiceUsd:2,variableCostPerServiceUsd:1,
  fixedCashCostUsd:0,constructionCashUsd:20,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:0,
  cashTaxUsd:0,increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0}));
 return {version:"finite-owned-deployment-1",claim:"conditional-project-common-residual",quantity:"commissioned-owned-capacity",
  calendar:"UTC-civil",baselineQuantity:10,baselineOn:"2024-01-01",growthDomain:[0,.2],evidenceIds:["synthetic"],
  baselineBinding:{kind:"annual-commissioned-flow",unit:"MW",openingOperatingStock:0,constructionBasis:"only-declared-cohort-capital",
   horizon:[2024,2025],cutoff:"2024-01-01",availableAt:"2024-01-01",sourceId:"synthetic"},
  specification:{years,cohorts:years.map(y=>({id:String(y.year),commissionedYear:y.year,retiredYear:2030,
   installedUnits:10,annualDegradation:0,capacityUnit:"MW",serviceUnit:"MWh",servicePerInstalledUnitPerYear:365.25,
   dated:{commissionedOn:`${y.year}-01-01`,retiredOn:"2030-01-01",degradationDayBasis:365.25},evidenceIds:["synthetic"]})),
   timing:"utc-civil-day-service",currency:"USD",boundary:"conditional-project-FCFE-not-whole-equity",evidenceIds:["synthetic"]},
  commissioning:years.map(y=>({cohortId:String(y.year),on:`${y.year}-01-01`,capitalOn:`${y.year}-01-01`,capitalUsdPerUnit:2,maximumUnits:12,ownedFraction:1,evidenceIds:["synthetic"]}))};
}
test("physical growth changes commissioned units and capital, not price or stationary law",()=>{
 const f=freezeDeploymentGrowth(fixture()),a=compileDeploymentGrowth(f,0),b=compileDeploymentGrowth(f,.1);
 assert.equal(a.specification.cohorts[1].installedUnits,10);assert.equal(b.specification.cohorts[1].installedUnits,11);
 assert.equal(b.capitalRequirements[1].usd,22);assert.equal(b.specification.years[1].constructionCashUsd,22);
 assert.equal(b.specification.years[1].pricePerServiceUsd,2);
 // Existing adapter is annual service prorated by actual civil-year days,
 // not a daily service rate multiplied by ACT/365.25.
 assert.ok(Math.abs(b.model.rows[0].service-3652.5)<1e-8);
 assert.ok(Math.abs(a.model.rows[1].service-7305)<1e-8);
 assert.ok(Math.abs(b.model.rows[1].service-7670.25)<1e-8);
 assert.equal(b.conditionalPeriodicProjectValueUsd,null);assert.equal(b.inverse,null);
 assert.equal(b.specification.cohorts[0].installedUnits,10);
 assert.throws(()=>compileDeploymentGrowth(f,.3),/domain/);
 f.protocol.baselineQuantity=11;assert.throws(()=>compileDeploymentGrowth(f,.1),/Changed/);
});
test("construction stock, missing horizon and future source are not interchangeable with commissioned flow",()=>{
 const a=fixture();a.specification.years[0].constructionCashUsd=30;assert.throws(()=>freezeDeploymentGrowth(a),/construction baseline/);
 const b=fixture();b.baselineBinding.openingOperatingStock=5;assert.throws(()=>freezeDeploymentGrowth(b),/baseline/);
 const c=fixture();c.baselineBinding.availableAt="2024-02-01";assert.throws(()=>freezeDeploymentGrowth(c),/prospective/);
 const d=fixture();d.baselineBinding.horizon[1]=2026;assert.throws(()=>freezeDeploymentGrowth(d),/horizon/);
 const e=fixture();e.baselineBinding.unit="vehicle";assert.throws(()=>freezeDeploymentGrowth(e),/baseline/);
});
test("missing capital, partial ownership and unmatched dates cannot be inferred",()=>{
 const p=fixture();p.commissioning[0].capitalUsdPerUnit=NaN;assert.throws(()=>freezeDeploymentGrowth(p),/capital/);
 const q=fixture();(q.commissioning[0] as any).ownedFraction=.5;assert.throws(()=>freezeDeploymentGrowth(q),/ownership/);
 const r=fixture();r.commissioning[1].on="2025-02-30";assert.throws(()=>freezeDeploymentGrowth(r));
});
test("executed dated capital funding and collections reconcile once, not annual net cash at guessed dates",()=>{
 const f=freezeDeploymentGrowth(fixture()),growth=.1;
 const values=[{year:2024,cost:3652.5,capital:20},{year:2025,cost:7670.25,capital:22}];
 const accounts:any={definitionHash:f.definitionHash,growth,interest:"explicit-zero",recovery:"none",ownership:"full-common-claim",
  declaration:{version:"dated-project-cash-1",valuationOn:"2024-01-01",discountRate:.1,convention:"ACT/365.25",claimantId:"fixture"},
  ledger:{version:"cohort-cash-ledger-1",currency:"USD",claimantId:"fixture",claim:"declared-project-common-distribution-not-whole-equity",
   distributionRightsEvidenceId:"synthetic",years:values.map(v=>({year:v.year,openingReceivables:0,closingReceivables:0,collections:2*v.cost,
    openingOtherWorkingCapital:0,closingOtherWorkingCapital:0,openingUnpaidTax:0,closingUnpaidTax:0,taxAccrual:0,
    openingDebt:0,closingDebt:0,openingNonCommonLiability:0,closingNonCommonLiability:0,nonCommonAccrual:0,
    operatingFixedCash:0,holdingCash:0,transactionCash:0,openingCash:0,closingCash:0,commonContribution:v.capital,commonDistribution:v.cost,evidenceIds:["synthetic"]}))},
  timing:values.flatMap(v=>["construction","commonContribution","collections","variableCost","commonDistribution"].map(component=>({
   year:v.year,component,allocations:[{on:`${v.year}-${["construction","commonContribution"].includes(component)?"01-01":"12-31"}`,fraction:1,evidenceIds:["synthetic"]}]}))),
  accrual:{version:"dated-accrual-2",claimantId:"fixture",payables:values.map(v=>({year:v.year,opening:0,closing:0})),
   operatingSettlements:{otherWorkingCapitalBasis:"excludes-receivables-payables-and-tax",alreadyCashPaidComponents:["construction"],
    years:values.map(v=>({year:v.year,variableCost:v.cost,energyCost:0,evidenceIds:["synthetic"]}))},
   entries:values.flatMap(v=>[{id:String(v.year),on:`${v.year}-12-31`,kind:"revenue",usd:2*v.cost,evidenceIds:["synthetic"]},
    {id:`cost-${v.year}`,on:`${v.year}-12-31`,kind:"payable",component:"variableCost",usd:v.cost,evidenceIds:["synthetic"]}])}};
 const r=executeDeploymentCash(f,growth,accounts);
 assert.ok(r.cash.accrualDays.every(d=>Math.abs(d.cash)<1e-8));
 assert.equal(r.cash.reconciledCashRows[0].commonNetCash,3632.5);
 assert.equal(r.cash.reconciledCashRows[1].commonNetCash,7648.25);
 assert.equal(r.conditionalPeriodicProjectValueUsd,null);
 const bad=structuredClone(accounts);bad.ledger.years[0].commonContribution=0;
 assert.throws(()=>executeDeploymentCash(f,growth,bad),/cash|fund|balance/i);
 for(const key of ["interest","recovery","ownership"]){const b=structuredClone(accounts);b[key]="unsupported";assert.throws(()=>executeDeploymentCash(f,growth,b),/unsupported/);}
});
