import test from "node:test";
import assert from "node:assert/strict";
import {calculateOperatingCohorts,type CohortSpecification} from "../server/calculation/operatingCohorts";
function input():CohortSpecification{return {
 boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",timing:"utc-civil-day-service",evidenceIds:["fixture"],
 cohorts:[{id:"storage",commissionedYear:2023,retiredYear:2024,installedUnits:1,
 annualDegradation:0,capacityUnit:"kWh-storage",serviceUnit:"kWh-delivered",servicePerInstalledUnitPerYear:366,
 evidenceIds:["fixture"],dated:{commissionedOn:"2023-12-01",retiredOn:"2024-07-01",degradationDayBasis:365.25,roundTripEfficiency:.8}}],
 years:[{year:2024,utilization:1,pricePerServiceUsd:2,variableCostPerServiceUsd:0,fixedCashCostUsd:0,
 constructionCashUsd:0,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:10,cashTaxUsd:0,
 increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0,
 chargeEnergyPriceUsdPerKwh:.1}]} }
test("legacy leap-year stock retires on exact day; charge/loss/service and cash reconcile",()=>{
 const r=calculateOperatingCohorts(input()).rows[0];
 assert.deepEqual([r.opening,r.added,r.retired,r.closing],[1,0,1,0]);
 assert.ok(Math.abs(r.service-182)<1e-10);
 assert.ok(Math.abs(r.chargeEnergyKwh!-227.5)<1e-10);
 assert.ok(Math.abs(r.contributions[0].lossKwh!-45.5)<1e-10);
 assert.ok(Math.abs(r.fcfe-(364-22.75-10))<1e-9);
});
test("missing energy economics, invalid civil date and false timing refuse",()=>{
 const a=input();delete a.years[0].chargeEnergyPriceUsdPerKwh;assert.throws(()=>calculateOperatingCohorts(a),/price/);
 const b=input();b.cohorts[0].dated!.retiredOn="2024-02-30";assert.throws(()=>calculateOperatingCohorts(b),/civil/);
 const c=input();c.timing="commission-at-year-start-retire-before-year-service";assert.throws(()=>calculateOperatingCohorts(c),/declaration/);
});
