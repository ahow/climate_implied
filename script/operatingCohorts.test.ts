import test from "node:test";
import assert from "node:assert/strict";
import {calculateOperatingCohorts,reconcileCohortIssuerCash,type CohortSpecification} from "../server/calculation/operatingCohorts";
const fixture=():CohortSpecification=>({
 boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",
 timing:"commission-at-year-start-retire-before-year-service",evidenceIds:["synthetic"],
 cohorts:[{id:"a",commissionedYear:2027,retiredYear:2029,installedUnits:2,
  annualDegradation:.1,capacityUnit:"MW",serviceUnit:"MWh",servicePerInstalledUnitPerYear:100,
  evidenceIds:["synthetic"]}],
 years:[2027,2028,2029].map(year=>({year,utilization:.5,pricePerServiceUsd:10,
  variableCostPerServiceUsd:2,fixedCashCostUsd:20,constructionCashUsd:100,
  maintenanceCashUsd:5,replacementCashUsd:0,decommissioningCashUsd:0,cashTaxUsd:30,
  increaseOperatingWorkingCapitalUsd:10,interestCashUsd:4,debtRaisedUsd:50,debtRepaidUsd:15,nonCommonCashUsd:6}))
});
test("independent stock/service/cash oracle; retirement excludes service; no perpetual stock inference",()=>{
 const r=calculateOperatingCohorts(fixture());
 assert.deepEqual(r.rows.map(y=>y.service),[100,90,0]);
 assert.deepEqual(r.rows.map(y=>[y.opening,y.added,y.retired,y.closing]),[[0,2,0,2],[2,0,0,2],[2,0,2,0]]);
 assert.equal(r.rows[0].fcfe,660);assert.equal(r.terminal.value,null);
});
test("new replacement cohort adds stock once; exact future contribution and degradation",()=>{
 const x=fixture();x.cohorts.push({...x.cohorts[0],id:"b",commissionedYear:2029,retiredYear:2032});
 const r=calculateOperatingCohorts(x);assert.equal(r.rows[2].service,100);
 assert.deepEqual([r.rows[2].opening,r.rows[2].added,r.rows[2].retired,r.rows[2].closing],[2,2,2,2]);
});
test("EV vehicle-km and storage delivered-kWh continue separately, not installed generation or avoided emissions",()=>{
 for(const [capacityUnit,serviceUnit,annual] of [["vehicle","vehicle-km",10000],["kWh-storage","kWh-delivered",300]] as const){
  const x=fixture();Object.assign(x.cohorts[0],{capacityUnit,serviceUnit,servicePerInstalledUnitPerYear:annual});
  const r=calculateOperatingCohorts(x);
  assert.equal(r.serviceUnit,serviceUnit);assert.equal(r.rows[0].service,annual);
  assert.equal(r.rows[1].service,annual*.9);assert.equal(r.rows[2].service,0);
  assert.equal(r.terminal.value,null);
 }
});
test("missing cash, mixed service, unsupported stock mapping and gapped years refuse",()=>{
 const x=fixture();delete (x.years[0] as any).cashTaxUsd;assert.throws(()=>calculateOperatingCohorts(x),/No inferred/);
 const y=fixture();y.cohorts[0].serviceUnit="vehicle-km";assert.throws(()=>calculateOperatingCohorts(y),/Incompatible/);
 const z=fixture();z.years[1].year=2030;assert.throws(()=>calculateOperatingCohorts(z),/ordered/);
});
test("actual existing accrual-to-FCFE engine agrees with independent project cash in every year",()=>{
 const c=fixture();c.cohorts[0].retiredYear=2035;
 c.years=Array.from({length:5},(_,i)=>({...c.years[0],year:2027+i}));
 const accounting={symbol:"ENGINEERING",cik:"0000000001",security:"synthetic only",currency:"USD",
  referenceDate:"2026-11-10",frozenAt:"2026-11-10T12:00:00Z",firstYear:2027,baseFcfe:0,
  boundary:"whole-issuer-common-equity",unresolvedAccountingClaims:[],
  evidence:[{id:"synthetic",kind:"frozen-analyst-assumption",rationale:"Independent engineering oracle only",
   availableAt:"2026-11-10T12:00:00Z",sha256:"a".repeat(64)}],
  years:c.years.map(y=>({year:y.year,cashFlowDate:`${y.year}-12-31`,evidenceIds:["synthetic"],
   nonClimateRevenue:0,climateRevenue:1,operatingMarginBeforeClimateCostsAndCredits:.5,
   climateOperatingCost:0,recognizedPolicyCredit:0,cashPolicyCredit:0,depreciation:.00001,
   otherNonCash:0,openingReceivables:0,closingReceivables:0,increaseOtherOperatingWorkingCapital:0,
   interestPaid:0,cashTax:0,otherOperatingCash:0,capitalSpend:0,debtProceeds:0,debtRepayments:0,nonCommonCashClaims:0}))};
 const r=reconcileCohortIssuerCash(c,accounting);
 r.cash.years.forEach((y,i)=>assert.ok(Math.abs(y.fcfe*1e6-r.physical.rows[i].fcfe)<1e-9));
 assert.equal(r.valuation,null);
 accounting.years[0].cashPolicyCredit=1;
 assert.throws(()=>reconcileCohortIssuerCash(c,accounting),/Separate/);
});
