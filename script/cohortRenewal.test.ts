import test from "node:test";
import assert from "node:assert/strict";
import {evaluatePeriodicRenewal,type RenewalDeclaration} from "../server/calculation/cohortRenewal";
import {reconcileCohortCash,valueDatedProjectCash,deriveDatedProjectCash,type CashTiming,type CohortCashLedger,type DatedProjectCash} from "../server/calculation/cohortCashLedger";
import {calculateOperatingCohorts} from "../server/calculation/operatingCohorts";
import {reconcileDatedAccruals,type AccrualSchedule} from "../server/calculation/cohortCashLedger";
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
test("dated common cash uses actual leap-day offsets and refuses interim deficits",()=>{
 const model=calculateOperatingCohorts(fixture().specification),ledger=cashLedger();
 const d:DatedProjectCash={version:"dated-project-cash-1",valuationOn:"2024-01-01",discountRate:.1,convention:"ACT/365.25",
 claimantId:ledger.claimantId,events:[2024,2025].flatMap(year=>[
 {id:`cash${year}`,on:`${year}-06-30`,kind:"project-net-cash" as const,usd:90,evidenceIds:["engineering-only"]},
 {id:`distribution${year}`,on:`${year}-07-01`,kind:"common-distribution" as const,usd:90,evidenceIds:["engineering-only"]}])};
 const r=valueDatedProjectCash(model,ledger,d,["engineering-only"]);
 assert.ok(Math.abs(r.finiteCommonCashPvUsd-(90/1.1**(182/365.25)+90/1.1**(547/365.25)))<1e-9);
 d.events[1].on="2024-01-02";
 assert.throws(()=>valueDatedProjectCash(model,ledger,d,["engineering-only"]),/funding shortfall/);
 d.events[1].on="2024-02-30";
 assert.throws(()=>valueDatedProjectCash(model,ledger,d,["engineering-only"]),/valid UTC/);
});
test("component cash derives collections and replacement without a second AR deduction",()=>{
 const s=fixture().specification,l=cashLedger();
 s.years[0].increaseOperatingWorkingCapitalUsd=5;s.years[1].increaseOperatingWorkingCapitalUsd=-5;
 Object.assign(l.years[0],{closingReceivables:5,collections:95,commonDistribution:85});
 Object.assign(l.years[1],{openingReceivables:5,collections:105,commonDistribution:95});
 const model=calculateOperatingCohorts(s);
 const timing:CashTiming[]=[2024,2025].flatMap(year=>(["collections","replacement","commonDistribution"] as const).map(component=>({
  year,component,allocations:[{on:`${year}-07-01`,fraction:1,evidenceIds:["engineering-only"]}]})));
 const declaration={version:"dated-project-cash-1" as const,valuationOn:"2024-01-01",discountRate:.1,
  convention:"ACT/365.25" as const,claimantId:l.claimantId};
 const result=deriveDatedProjectCash(model,l,declaration,timing,["engineering-only"]);
 assert.deepEqual(result.days.map(d=>d.commonNet),[85,95]);
 assert.deepEqual(result.days.map(d=>d.closingCash),[0,0]);
 assert.throws(()=>deriveDatedProjectCash(model,l,declaration,timing.slice(1),["engineering-only"]),/Missing dated/);
 timing[1].allocations[0].on="2024-01-02";
 assert.throws(()=>deriveDatedProjectCash(model,l,declaration,timing,["engineering-only"]),/funding shortfall/);
});
test("dated revenue and capital accrual precede distinct settlements and reconcile balances",()=>{
 const model=calculateOperatingCohorts(fixture().specification),l=cashLedger();
 const timing:CashTiming[]=[2024,2025].flatMap(year=>(["collections","replacement","commonDistribution"] as const).map(component=>({
 year,component,allocations:[{on:`${year}-07-01`,fraction:1,evidenceIds:["engineering-only"]}]})));
 const a:AccrualSchedule={version:"dated-accrual-1",claimantId:l.claimantId,
 payables:[2024,2025].map(year=>({year,opening:0,closing:0})),
 entries:[2024,2025].flatMap(year=>[
 {id:`r${year}`,on:`${year}-06-01`,kind:"revenue" as const,usd:100,evidenceIds:["engineering-only"]},
 {id:`p${year}`,on:`${year}-06-02`,kind:"payable" as const,usd:10,evidenceIds:["engineering-only"]}])};
 const d={version:"dated-project-cash-1" as const,valuationOn:"2024-01-01",discountRate:.1,convention:"ACT/365.25" as const,claimantId:l.claimantId};
 const result=reconcileDatedAccruals(model,l,d,timing,a,["engineering-only"]);
 assert.equal(result.accrualDays[0].receivables,100);
 assert.equal(result.accrualDays[1].payables,10);
 assert.equal(result.accrualDays[2].receivables,0);
 assert.equal(result.accrualDays[2].cash,0);
 const integrated=fixture();integrated.cashLedger=l;
 integrated.datedAccounting={declaration:d,timing,accrual:a};
 const retained=evaluatePeriodicRenewal(integrated);
 assert.equal(retained.version,"renewal-3-finite-dated-accounting");
 assert.equal(retained.conditionalPeriodicProjectValueUsd,null);
 assert.equal(retained.datedAccounting!.accrualDays[2].cash,0);
 a.entries[1].on="2024-08-01";
 assert.throws(()=>reconcileDatedAccruals(model,l,d,timing,a,["engineering-only"]),/precedes/);
});
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
