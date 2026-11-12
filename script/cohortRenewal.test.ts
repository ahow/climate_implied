import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePeriodicRenewal,type RenewalDeclaration} from "../server/calculation/cohortRenewal";
import {reconcileCohortCash,type CohortCashLedger} from "../server/calculation/cohortCashLedger";
import {calculateOperatingCohorts} from "../server/calculation/operatingCohorts";
export function renewalFixture():RenewalDeclaration{
 return {version:"periodic-renewal-1",claim:"conditional-project-common-residual",cycleYears:1,discountRate:0.1,
 openingAgeStock:[1],closingAgeStock:[1],openingDebtUsd:0,closingDebtUsd:0,
 openingWorkingCapitalUsd:0,closingWorkingCapitalUsd:0,openingUnpaidTaxUsd:0,closingUnpaidTaxUsd:0,
 replacementCostPerUnitUsd:10,evidenceIds:["engineering-only"],
 specification:{boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",
 timing:"commission-at-year-start-retire-before-year-service",evidenceIds:["engineering-only"],
 cohorts:[2023,2024,2025].map(year=>({id:String(year),commissionedYear:year,retiredYear:year+1,
 installedUnits:1,annualDegradation:0,capacityUnit:"MW",serviceUnit:"MWh",
 servicePerInstalledUnitPerYear:10,evidenceIds:["engineering-only"]})),
 years:[2024,2025].map(year=>({year,utilization:1,pricePerServiceUsd:10,variableCostPerServiceUsd:0,
 fixedCashCostUsd:0,constructionCashUsd:0,maintenanceCashUsd:0,replacementCashUsd:10,
 decommissioningCashUsd:0,cashTaxUsd:0,increaseOperatingWorkingCapitalUsd:0,
 interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0}))}};
}
const fixture=renewalFixture;
test("explicit one-year renewal pays replacement once; independent annuity oracle",()=>{
 const r=evaluatePeriodicRenewal(fixture());
 assert.equal(r.model.rows[0].fcfe,90);
 assert.ok(Math.abs(r.conditionalPeriodicProjectValueUsd-900)<1e-9);
 assert.equal(r.marketImplied,false);
});
test("free replacement, mismatched renewal and hidden financing refuse",()=>{
 let x=fixture();x.specification.years.forEach(y=>y.replacementCashUsd=0);
 assert.throws(()=>evaluatePeriodicRenewal(x),/reconciliation/);
 x=fixture();x.specification.years[1].pricePerServiceUsd=11;
 assert.throws(()=>evaluatePeriodicRenewal(x),/reconciliation/);
 x=fixture();x.specification.years.forEach(y=>y.debtRaisedUsd=1);
 assert.throws(()=>evaluatePeriodicRenewal(x),/reconciliation/);
 x=fixture();x.discountRate=0;assert.throws(()=>evaluatePeriodicRenewal(x),/declaration/);
});
test("finite transition funds construction and hands over exact surviving stock and balances",()=>{
 const x=fixture();
 const spec=structuredClone(x.specification);
 spec.years=[{...spec.years[0],year:2023,constructionCashUsd:100,replacementCashUsd:0}];
 spec.cohorts=spec.cohorts.filter(c=>c.commissionedYear===2023);
 x.transition={specification:spec,openingDebtUsd:0,openingWorkingCapitalUsd:0};
 const r=evaluatePeriodicRenewal(x);
 assert.equal(r.transition!.model.rows[0].fcfe,0);
 assert.ok(Math.abs(r.transition!.combinedConditionalProjectPv-900/1.1)<1e-9);
 x.transition.specification.cohorts[0].annualDegradation=.1;
 assert.throws(()=>evaluatePeriodicRenewal(x),/surviving cohorts/);
});
function cashLedger():CohortCashLedger{
 return {version:"cohort-cash-ledger-1",currency:"USD",claimantId:"engineering-project",
 claim:"declared-project-common-distribution-not-whole-equity",distributionRightsEvidenceId:"engineering-only",
 years:[2024,2025].map(year=>({year,openingReceivables:0,closingReceivables:0,collections:100,
 openingOtherWorkingCapital:0,closingOtherWorkingCapital:0,openingUnpaidTax:0,closingUnpaidTax:0,taxAccrual:0,
 openingDebt:0,closingDebt:0,openingNonCommonLiability:0,closingNonCommonLiability:0,nonCommonAccrual:0,
 operatingFixedCash:0,holdingCash:0,transactionCash:0,openingCash:0,closingCash:0,
 commonContribution:0,commonDistribution:90,evidenceIds:["engineering-only"]}))};
}
test("declared common cash reconciles receivables once and preserves the periodic oracle",()=>{
 const x=fixture();x.cashLedger=cashLedger();
 assert.ok(Math.abs(evaluatePeriodicRenewal(x).conditionalPeriodicProjectValueUsd-900)<1e-9);
 const l=cashLedger(),s=structuredClone(x.specification);
 s.years[0].increaseOperatingWorkingCapitalUsd=5;s.years[1].increaseOperatingWorkingCapitalUsd=-5;
 Object.assign(l.years[0],{closingReceivables:5,collections:95,commonDistribution:85});
 Object.assign(l.years[1],{openingReceivables:5,collections:105,commonDistribution:95});
 const rows=reconcileCohortCash(calculateOperatingCohorts(s),l,s.evidenceIds);
 assert.deepEqual(rows.map(r=>r.commonNetCash),[85,95]);
 l.years[0].collections=100;
 assert.throws(()=>reconcileCohortCash(calculateOperatingCohorts(s),l,s.evidenceIds),/reconciliation/);
});
test("negative renewal requires explicit contributions; no distributions from unfunded cash",()=>{
 const x=fixture();x.cashLedger=cashLedger();x.replacementCostPerUnitUsd=200;
 x.specification.years.forEach(y=>y.replacementCashUsd=200);
 x.cashLedger.years.forEach(y=>{y.commonDistribution=0;y.commonContribution=100;});
 const r=evaluatePeriodicRenewal(x);
 assert.ok(Math.abs(r.conditionalPeriodicProjectValueUsd+1000)<1e-9);
 x.cashLedger.years[0].commonContribution=0;
 assert.throws(()=>evaluatePeriodicRenewal(x),/Unfunded/);
});
test("claim evidence, omitted cash fields and unpaid tax inconsistencies refuse",()=>{
 const x=fixture();x.cashLedger=cashLedger();
 x.cashLedger.distributionRightsEvidenceId="not-retained";
 assert.throws(()=>evaluatePeriodicRenewal(x),/evidence/);
 x.cashLedger=cashLedger();x.cashLedger.years[0].taxAccrual=1;
 assert.throws(()=>evaluatePeriodicRenewal(x),/reconciliation/);
 x.cashLedger=cashLedger();delete (x.cashLedger.years[0] as any).collections;
 assert.throws(()=>evaluatePeriodicRenewal(x),/collections/);
});
test("dated full-year storage renewal accounts for charge losses and cash once",()=>{
 const x=fixture();x.specification.timing="utc-civil-day-service";
 x.specification.cohorts.forEach(c=>{
  c.capacityUnit="kWh-storage";c.serviceUnit="kWh-delivered";
  c.dated={commissionedOn:`${c.commissionedYear}-01-01`,retiredOn:`${c.retiredYear}-01-01`,
   degradationDayBasis:365.25,roundTripEfficiency:.8};
 });
 x.specification.years.forEach(y=>y.chargeEnergyPriceUsdPerKwh=2);
 const r=evaluatePeriodicRenewal(x);
 assert.ok(Math.abs(r.model.rows[0].chargeEnergyKwh!-12.5)<1e-9);
 assert.ok(Math.abs(r.model.rows[0].contributions[0].lossKwh!-2.5)<1e-9);
 assert.ok(Math.abs(r.conditionalPeriodicProjectValueUsd-650)<1e-9);
 x.specification.cohorts[1].dated!.commissionedOn="2024-01-02";
 assert.throws(()=>evaluatePeriodicRenewal(x),/partial-day/);
});
