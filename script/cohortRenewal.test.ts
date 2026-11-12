import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePeriodicRenewal,type RenewalDeclaration} from "../server/calculation/cohortRenewal";
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
