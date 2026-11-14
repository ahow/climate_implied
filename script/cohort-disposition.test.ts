import test from "node:test";
import assert from "node:assert/strict";
import {assessCohortDisposition,compileDispositionSettlement,type CohortDisposition} from "../server/calculation/cohortDisposition";
import {settleTerminal,type TerminalSettlement} from "../server/calculation/terminalSettlement";
import {contentHash} from "../server/calculation/analysisManifest";
import type {CohortSpecification} from "../server/calculation/operatingCohorts";
test("dated residual stock and explicit unknown economics are conserved, never free salvage",()=>{
 const s:CohortSpecification={timing:"utc-civil-day-service",boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",evidenceIds:["fixture"],
 cohorts:[{id:"synthetic",commissionedYear:2027,retiredYear:2030,installedUnits:2,annualDegradation:.1,capacityUnit:"MW",serviceUnit:"MWh",servicePerInstalledUnitPerYear:100,evidenceIds:["fixture"]}],
 years:[{year:2027,utilization:.8,pricePerServiceUsd:10,variableCostPerServiceUsd:0,fixedCashCostUsd:0,constructionCashUsd:0,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:0,cashTaxUsd:0,increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0}]};
 for(const c of s.cohorts){c.retiredYear=2030;c.dated={commissionedOn:`${c.commissionedYear}-07-01`,retiredOn:"2030-01-01",degradationDayBasis:365.25};}
 const p:CohortDisposition={version:"cohort-disposition-1",stockBasis:"full-unit-before-ownership",specificationHash:contentHash(s),claimantId:"fixture",currency:"USD",
 assets:s.cohorts.map(c=>({cohortId:c.id,ownedFraction:.5,amountBasis:"owned-claim-USD",rightsEvidenceIds:c.evidenceIds,outcome:"dispose",on:"2028-03-01",
 cashOn:null,proceedsUsd:null,proceedsEvidenceIds:[],obligations:null,obligationCompletenessEvidenceIds:[]}))};
 const r=assessCohortDisposition(s,p,"fixture");assert.equal(r.rows[0].ownedUnits,s.cohorts[0].installedUnits/2);
 assert.equal(r.rows[0].ageDays,184);assert.equal(r.rows[0].serviceMultiplierAtCutoff,Math.pow(.9,184/365.25));
 assert.equal(r.cashPosted,false);assert.ok(r.missing.length>=2);assert.equal(r.periodicValueUsd,null);
 assert.throws(()=>assessCohortDisposition(s,{...p,assets:[] },"fixture"));
 assert.throws(()=>assessCohortDisposition(s,p,"swapped"));
 assert.throws(()=>assessCohortDisposition(s,{...p,specificationHash:"forged"},"fixture"));
 p.assets[0]={...p.assets[0],on:"2028-01-01",cashOn:"2028-02-29",proceedsUsd:100,proceedsEvidenceIds:["fixture"],obligationCompletenessEvidenceIds:["fixture"],
  obligations:[{id:"restoration",kind:"restoration",accruedOn:"2028-01-01",paidOn:"2028-03-01",usd:20,evidenceIds:["fixture"],alreadyAccrued:false},
   {id:"tax",kind:"tax",accruedOn:"2028-01-01",paidOn:"2028-03-01",usd:5,evidenceIds:["fixture"],alreadyAccrued:false}]};
 const closing={cash:0,receivables:0,payables:0,tax:0,otherWC:0,debt:0,nonCommon:0};
 const terminal:TerminalSettlement={version:"terminal-settlement-1",currency:"USD",claimantId:"fixture",physicalParentHash:"physical",
  accrualScope:"complete-declared-post-cutoff-schedule",priority:"common-after-declared-liabilities",opening:closing,
  events:[{id:"common",on:"2028-03-01",kind:"distribution",usd:75,evidenceIds:["fixture"]}]};
 const compiled=compileDispositionSettlement(s,p,terminal,closing);assert.ok(compiled.compiled);
 const cash=settleTerminal(compiled.compiled!,compiled.closing!,"physical","fixture","2028-01-01","2027-01-01",.1,["fixture"]);
 assert.equal(cash.commonNetCash,75);assert.equal(cash.subsequentAccruedCostUsd,25);
 assert.equal(compiled.recognition![0].assetSaleReceivableUsd,100); // no second 50% ownership multiplier
 p.assets[0].obligations![0].alreadyAccrued=true;
 assert.equal(compileDispositionSettlement(s,p,terminal,closing).compiled,null);
 p.version="cohort-disposition-2-rights";
 const sold=assessCohortDisposition(s,p,"fixture").rightsLedger![0];
 assert.equal(sold.openingOwnedUnits,1);assert.equal(sold.transferredOwnedUnits,1);
 assert.equal(sold.closingOwnedUnits,0);assert.equal(sold.closingGrossPhysicalUnits,2);
 assert.equal(sold.otherOwnersUnitsAfter,2);assert.equal(sold.authorityNotValidatedHere,true);
 assert.equal(sold.avoidedEmissions,null);
 p.assets[0].outcome="retire";
 const unauth=assessCohortDisposition(s,p,"fixture");assert.equal(unauth.rightsLedger![0].closingGrossPhysicalUnits,null);
 assert.ok(unauth.missing.some(r=>r.includes("not authority")));
 p.assets[0].retirementAuthorityEvidenceIds=["fixture"];
 assert.equal(assessCohortDisposition(s,p,"fixture").rightsLedger![0].closingGrossPhysicalUnits,null);
 p.assets[0].retirementBoundary="remove-physical-unit-and-end-owned-unit-rights";
 const retired=assessCohortDisposition(s,p,"fixture").rightsLedger![0];
 assert.equal(retired.retiredGrossUnits,2);assert.equal(retired.retiredOwnedUnits,1);assert.equal(retired.closingGrossPhysicalUnits,0);
 p.assets[0].obligations![0].alreadyAccrued=false;
 const retirementCash=compileDispositionSettlement(s,p,terminal,closing);
 assert.ok(retirementCash.compiled);
 assert.equal(settleTerminal(retirementCash.compiled!,retirementCash.closing!,"physical","fixture","2028-01-01","2027-01-01",.1,["fixture"]).commonNetCash,75);
 p.assets[0].outcome="retain";
 assert.equal(assessCohortDisposition(s,p,"fixture").rightsLedger![0].closingOwnedUnits,1);
 p.assets[0].outcome="dispose";
 p.assets[0].obligations![0].alreadyAccrued=true;
 p.assets[0].obligations![0].accruedOn="2027-12-31";
 closing.payables=20;
 terminal.openingObligations={version:"opening-obligations-1",closingHash:contentHash(closing),
  claimantId:"fixture",legalEntityId:"synthetic-entity",currency:"USD",asOf:"2028-01-01",
  items:[{id:"restoration",sourceId:"fixture",legalEntityId:"synthetic-entity",claimantId:"fixture",currency:"USD",
   accruedOn:"2027-12-31",account:"payables",openingUsd:20}],allocations:[]};
 const booked=compileDispositionSettlement(s,p,terminal,closing);assert.ok(booked.compiled);
 const bookedCash=settleTerminal(booked.compiled!,booked.closing!,"physical","fixture","2028-01-01","2027-01-01",.1,["fixture"]);
 assert.equal(bookedCash.commonNetCash,75);assert.equal(bookedCash.subsequentAccruedCostUsd,5);
 assert.equal(bookedCash.openingObligations!.rows[0].settledUsd,20);
 assert.equal(terminal.openingObligations.allocations.length,0);
});
