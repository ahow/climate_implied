import {test} from "node:test";
import assert from "node:assert/strict";
import {freezeDeploymentGrowth} from "../server/calculation/deploymentGrowth";
import {freezeDeploymentDebt,executeDeploymentDebt} from "../server/calculation/deploymentDebt";
function fixture():any{
 const ids=["synthetic-contract"],interest=365/365.25,distribution=90-interest;
 const year={year:2024,utilization:1,pricePerServiceUsd:1,variableCostPerServiceUsd:0,fixedCashCostUsd:0,
  constructionCashUsd:10,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:0,cashTaxUsd:0,
  increaseOperatingWorkingCapitalUsd:0,interestCashUsd:interest,debtRaisedUsd:10,debtRepaidUsd:10,nonCommonCashUsd:0};
 const frozen=freezeDeploymentGrowth({version:"finite-owned-deployment-1",claim:"conditional-project-common-residual",
  quantity:"commissioned-owned-capacity",calendar:"UTC-civil",baselineQuantity:1,baselineOn:"2024-01-01",growthDomain:[0,.1],evidenceIds:ids,
  baselineBinding:{kind:"annual-commissioned-flow",unit:"MW",openingOperatingStock:0,constructionBasis:"only-declared-cohort-capital",
   horizon:[2024,2024],cutoff:"2024-01-01",availableAt:"2024-01-01",sourceId:ids[0]},
  specification:{years:[year],currency:"USD",boundary:"conditional-project-FCFE-not-whole-equity",timing:"utc-civil-day-service",evidenceIds:ids,
   cohorts:[{id:"asset",commissionedYear:2024,retiredYear:2026,installedUnits:1,annualDegradation:0,capacityUnit:"MW",serviceUnit:"MWh",servicePerInstalledUnitPerYear:100,
    dated:{commissionedOn:"2024-01-01",retiredOn:"2026-01-01",degradationDayBasis:365.25},evidenceIds:ids}]},
  commissioning:[{cohortId:"asset",on:"2024-01-01",capitalOn:"2024-01-01",capitalUsdPerUnit:10,maximumUnits:2,ownedFraction:1,evidenceIds:ids}]});
 return {version:"dated-deployment-debt-1",frozen,growth:0,ownership:"full",recoveries:"none",openingObligations:"none",
  loan:{id:"loan",borrower:"project",lender:"conditional-lender",currency:"USD",rate:.1,basis:"ACT/365.25",priority:"contractual-before-common",rightsEvidenceId:ids[0],
   draws:[{on:"2024-01-01",usd:10}],repayments:[{on:"2024-12-31",usd:10}]},
  declaration:{version:"dated-project-cash-1",valuationOn:"2024-01-01",discountRate:.1,convention:"ACT/365.25",claimantId:"project"},
  ledger:{version:"cohort-cash-ledger-1",currency:"USD",claimantId:"project",claim:"declared-project-common-distribution-not-whole-equity",
   distributionRightsEvidenceId:ids[0],years:[{year:2024,collections:100,openingReceivables:0,closingReceivables:0,openingOtherWorkingCapital:0,closingOtherWorkingCapital:0,
    openingUnpaidTax:0,closingUnpaidTax:0,taxAccrual:0,openingDebt:0,closingDebt:0,openingNonCommonLiability:0,closingNonCommonLiability:0,nonCommonAccrual:0,
    operatingFixedCash:0,holdingCash:0,transactionCash:0,openingCash:0,closingCash:0,commonContribution:0,commonDistribution:distribution,evidenceIds:ids}]},
  timing:["construction","debtRaised","collections","interest","debtRepaid","commonDistribution"].map(component=>({year:2024,component,
   allocations:[{on:["construction","debtRaised"].includes(component)?"2024-01-01":"2024-12-31",fraction:1,evidenceIds:ids}]})),
  accrual:{version:"dated-accrual-2",claimantId:"project",payables:[{year:2024,opening:0,closing:0}],
   operatingSettlements:{otherWorkingCapitalBasis:"excludes-receivables-payables-and-tax",alreadyCashPaidComponents:["construction"],
    years:[{year:2024,variableCost:0,energyCost:0,evidenceIds:ids}]},
   entries:[{id:"revenue",on:"2024-12-31",kind:"revenue",usd:100,evidenceIds:ids},
    {id:"interest",on:"2024-12-31",kind:"payable",component:"interest",usd:interest,evidenceIds:ids}]}};
}
test("leap-year daily debt finances capital once and pays principal plus interest before common cash",()=>{
 const x=fixture(),f=freezeDeploymentDebt(x),r=executeDeploymentDebt(f);
 assert.ok(Math.abs(r.loanYears[0].interest-365/365.25)<1e-8);
 assert.ok(Math.abs(r.cash.finiteCommonCashPvUsd-(90-365/365.25)/1.1**(365/365.25))<1e-8);
 assert.equal(r.loanYears[0].closing,0);assert.equal(r.conditionalPeriodicProjectValueUsd,null);
 const early=fixture();early.loan.repayments[0].usd=11;assert.throws(()=>executeDeploymentDebt(freezeDeploymentDebt(early)),/precedes/);
 const late=fixture();late.timing[1].allocations[0].on="2024-01-02";assert.throws(()=>executeDeploymentDebt(freezeDeploymentDebt(late)),/fund|balance|shortfall/i);
 const prepaid=fixture();prepaid.accrual.entries[1].on="2024-01-01";
 assert.throws(()=>executeDeploymentDebt(freezeDeploymentDebt(prepaid)),/precedes daily/);
 const inherited=fixture();inherited.ledger.years[0].openingCash=10;
 assert.throws(()=>freezeDeploymentDebt(inherited),/Inherited/);
 for(const key of ["ownership","recoveries","openingObligations"]){const a=fixture();a[key]="unsupported";assert.throws(()=>freezeDeploymentDebt(a),/unsupported/);}
 f.input.loan.rate=.2;assert.throws(()=>executeDeploymentDebt(f),/Changed/);
});
