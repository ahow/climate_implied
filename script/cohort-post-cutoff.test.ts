import test from "node:test";
import assert from "node:assert/strict";
import {contentHash} from "../server/calculation/analysisManifest";
import {calculatePostCutoff,type PostCutoffInterval} from "../server/calculation/cohortPostCutoff";
import type {CohortSpecification} from "../server/calculation/operatingCohorts";
import type {CohortDisposition} from "../server/calculation/cohortDisposition";
import type {TerminalSettlement} from "../server/calculation/terminalSettlement";
function fixture(degradation=0){
 const y={year:2027,utilization:1,pricePerServiceUsd:0,variableCostPerServiceUsd:0,fixedCashCostUsd:0,constructionCashUsd:0,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:0,cashTaxUsd:0,increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0,chargeEnergyPriceUsdPerKwh:0};
 const spec:CohortSpecification={boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",timing:"utc-civil-day-service",evidenceIds:["fixture"],years:[y],
  cohorts:[{id:"battery",commissionedYear:2027,retiredYear:2030,installedUnits:2,annualDegradation:degradation,capacityUnit:"kWh-storage",serviceUnit:"kWh-delivered",servicePerInstalledUnitPerYear:366,
   evidenceIds:["fixture"],dated:{commissionedOn:"2027-01-01",retiredOn:"2030-01-01",degradationDayBasis:365.25,roundTripEfficiency:.8}}]};
 const p:CohortDisposition={version:"cohort-disposition-2-rights",specificationHash:contentHash(spec),claimantId:"claim",currency:"USD",stockBasis:"full-unit-before-ownership",
  assets:[{cohortId:"battery",ownedFraction:.5,amountBasis:"owned-claim-USD",rightsEvidenceIds:["fixture"],outcome:"dispose",on:"2028-03-01",cashOn:"2028-07-01",proceedsUsd:100,proceedsEvidenceIds:["fixture"],obligationCompletenessEvidenceIds:["fixture"],
   obligations:[{id:"tax",kind:"tax",accruedOn:"2028-03-01",paidOn:"2028-03-01",usd:5,evidenceIds:["fixture"],alreadyAccrued:false}]}]};
 const service=Array.from({length:60},(_,j)=>(1-degradation)**((365+j)/365.25)).reduce((a,b)=>a+b,0);
 const x:PostCutoffInterval={version:"post-cutoff-interval-1",priorSpecificationHash:contentHash(spec),claimantId:"claim",cashBasis:"owned-service-and-owned-nonvolume-cash",workingCapitalBasis:"otherWC-excludes-AR-AP-tax",
  inputClassification:"declared-conditional-forecast",coverageFrom:"2028-01-01",coverageThrough:"2028-12-31",
  years:[{...y,year:2028,pricePerServiceUsd:10,variableCostPerServiceUsd:2,chargeEnergyPriceUsdPerKwh:1}],
  events:[{id:"revenue",on:"2028-02-29",kind:"revenue-accrual",usd:10*service,evidenceIds:["fixture"]},
   {id:"variable",on:"2028-02-29",kind:"payable-accrual",component:"variableCost",costBasis:"other-operating",usd:2*service,evidenceIds:["fixture"]},
   {id:"energy",on:"2028-02-29",kind:"payable-accrual",component:"energyCost",costBasis:"other-operating",usd:service/.8,evidenceIds:["fixture"]},
   {id:"fund",on:"2028-02-29",kind:"contribution",usd:5,evidenceIds:["fixture"]},
   {id:"collection",on:"2028-06-01",kind:"receivables",usd:10*service,evidenceIds:["fixture"]},
   {id:"payment",on:"2028-06-01",kind:"payables",usd:2*service+service/.8,evidenceIds:["fixture"]},
   {id:"common",on:"2028-07-01",kind:"distribution",usd:100+6.75*service,evidenceIds:["fixture"]}]};
 const closing={cash:0,receivables:0,payables:0,tax:0,otherWC:0,debt:0,nonCommon:0};
 const terminal:TerminalSettlement={version:"terminal-settlement-1",currency:"USD",claimantId:"claim",physicalParentHash:"parent",accrualScope:"complete-declared-post-cutoff-schedule",priority:"common-after-declared-liabilities",opening:closing,events:[]};
 return {spec,p,x,closing,terminal,service};
}
const run=(f:ReturnType<typeof fixture>)=>calculatePostCutoff(f.spec,f.p,f.x,f.terminal,f.closing,"parent","2028-01-01",.1);
test("delayed leap-day storage service, separate sale AR and common cash reconcile",()=>{
 const r=run(fixture());assert.ok(Math.abs(r.ownedExposure.rows[0].service-60)<1e-10);
 assert.ok(Math.abs(r.ownedExposure.rows[0].chargeEnergyKwh!-75)<1e-10);
 assert.ok(Math.abs(r.cash.commonNetCash-500)<1e-9);
 assert.ok(Math.abs(r.cash.presentCommonCashUsd-(505/1.1**(182/365.25)-5/1.1**(59/365.25)))<1e-9);
 assert.equal(r.cash.operatingRevenueAccruedUsd,600);assert.equal(r.cash.assetReceivablesRecognizedUsd,100);
 assert.equal(r.assessment.rightsLedger![0].closingOwnedUnits,0);assert.equal(r.assessment.rightsLedger![0].closingGrossPhysicalUnits,2);
 assert.ok(r.grossOperatingExposure.rows[0].service>r.ownedExposure.rows[0].service);
});
test("degrading partial ownership uses daily age, not restarted age or annual net cash",()=>{
 const f=fixture(.1),r=run(f);assert.ok(Math.abs(r.ownedExposure.rows[0].service-f.service)<1e-10);
 assert.ok(Math.abs(r.cash.commonNetCash-(95+6.75*f.service))<1e-9);
});
test("delayed interval refuses missing funding, early recognition and borrowed coverage",()=>{
 for(const mutate of [
  (f:ReturnType<typeof fixture>)=>{f.x.events=f.x.events.filter(e=>e.id!=="fund");},
  (f:ReturnType<typeof fixture>)=>{f.x.events[0].on="2028-01-01";},
  (f:ReturnType<typeof fixture>)=>{f.x.priorSpecificationHash="swapped";},
  (f:ReturnType<typeof fixture>)=>{f.x.coverageThrough="2028-02-28";},
  (f:ReturnType<typeof fixture>)=>{f.x.claimantId="other";}
 ]){const f=fixture();mutate(f);assert.throws(()=>run(f));}
});
test("delayed opening liability payment does not become another operating expense",()=>{
 const f=fixture();f.closing.payables=20;
 f.terminal.openingObligations={version:"opening-obligations-1",closingHash:contentHash(f.closing),claimantId:"claim",legalEntityId:"entity",currency:"USD",asOf:"2028-01-01",
  items:[{id:"booked",sourceId:"fixture",legalEntityId:"entity",claimantId:"claim",currency:"USD",accruedOn:"2027-12-31",account:"payables",openingUsd:20}],allocations:[]};
 f.p.assets[0].obligations!.push({id:"booked",kind:"restoration",accruedOn:"2027-12-31",paidOn:"2028-03-01",usd:20,evidenceIds:["fixture"],alreadyAccrued:true});
 f.x.events.find(e=>e.id==="fund")!.usd=25;
 const r=run(f);assert.equal(r.cash.commonNetCash,480);assert.equal(r.cash.subsequentAccruedCostUsd,200);
 assert.equal(r.cash.openingObligations!.newExpenseUsd,0);
});
test("delayed default and residual restoration preserve losses instead of forcing positive cash",()=>{
 const f=fixture();f.x.events.find(e=>e.id==="collection")!.usd=500;f.x.events.find(e=>e.id==="common")!.usd=405;
 f.x.events.push({id:"default",on:"2028-05-01",kind:"receivable-default",usd:100,evidenceIds:["fixture"]});
 assert.equal(run(f).cash.commonNetCash,400);
 const g=fixture();
 g.p.assets[0].obligations!.push({id:"restore",kind:"restoration",accruedOn:"2028-05-01",paidOn:"2028-05-01",usd:1000,evidenceIds:["fixture"],alreadyAccrued:false});
 g.x.events.push({id:"extra-funding",on:"2028-04-30",kind:"contribution",usd:1000,evidenceIds:["fixture"]});
 assert.equal(run(g).cash.commonNetCash,-500);
});
test("capital and otherWC have separate dated cash treatment, not duplicate operating expense",()=>{
 const f=fixture();f.x.years[0].constructionCashUsd=10;
 f.x.events.push({id:"early",on:"2028-01-01",kind:"contribution",usd:40,evidenceIds:["fixture"]},
  {id:"capital",on:"2028-01-01",kind:"capital-spend",component:"construction",usd:10,evidenceIds:["fixture"]},
  {id:"wc-invest",on:"2028-01-01",kind:"otherWC-invest",usd:30,evidenceIds:["fixture"]},
  {id:"wc-release",on:"2028-06-01",kind:"otherWC",usd:30,evidenceIds:["fixture"]});
 f.x.events.find(e=>e.id==="common")!.usd=535;
 const r=run(f);assert.equal(r.cash.commonNetCash,490);assert.equal(r.cash.capitalSpentUsd,10);
 assert.equal(r.cash.subsequentAccruedCostUsd,200);assert.equal(r.cash.closing.otherWC,0);
});
test("prior-retired ownership is independently source-bound, never borrowed from a survivor",()=>{
 const f=fixture(),old=structuredClone(f.spec.cohorts[0]);old.id="old";old.commissionedYear=2025;old.retiredYear=2027;
 old.dated!.commissionedOn="2025-01-01";old.dated!.retiredOn="2027-01-01";
 f.spec.cohorts.push(old);f.p.specificationHash=contentHash(f.spec);f.x.priorSpecificationHash=contentHash(f.spec);
 assert.throws(()=>run(f),/ownership/);
 f.x.priorRetiredOwnership=[{cohortId:"old",specificationHash:contentHash(f.spec),ownedFraction:.25,evidenceIds:["fixture"]}];
 assert.equal(run(f).cash.commonNetCash,500);
 for(const change of [
  (o:any)=>{o.specificationHash="borrowed";},(o:any)=>{o.evidenceIds=["unmatched"];},
  (o:any)=>{o.cohortId="battery";}
 ]){const g=structuredClone(f);change(g.x.priorRetiredOwnership![0]);assert.throws(()=>run(g),/matched/);}
 f.x.priorRetiredOwnership.push({...f.x.priorRetiredOwnership[0]});assert.throws(()=>run(f),/matched/);
});
