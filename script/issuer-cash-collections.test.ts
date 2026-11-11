import{test}from"node:test";
import assert from"node:assert/strict";
import{rebuildTaggedTransferCollections,extractFslrActualCollections,type TaggedTransfer}from"../server/calculation/issuerCashCollectionInputs";
// Synthetic source-independent cash fixtures. No private files or old kernel execution.
const fixture:TaggedTransfer={id:"synthetic2024",generationYear:2024,agreementYear:2024,
  agreementPeriod:"2024-12",buyer:null,faceUsd:105,contractProceedsUsd:100,
  receipts:[{period:"2024-12",year:2024,cashUsd:60},{period:"2025-Q1",year:2025,cashUsd:40}]};
test("Face, proceeds and different-year collections reconcile without second discount",()=>{
  const r=rebuildTaggedTransferCollections([fixture]);
  assert.equal(r.totalFaceLessContractProceedsUsd,5);assert.equal(r.totalObservedTransferCashUsd,100);
  assert.equal(r.years[0].closingIdentifiedContractProceedsUsd,40);
  assert.equal(r.years[1].openingIdentifiedContractProceedsUsd,40);
  assert.equal(r.years[1].closingIdentifiedContractProceedsUsd,0);
  assert.ok(r.years.every(y=>y.cashIdentityResidualUsd===0));
  assert.equal(r.reportedCfoOrFcfeAdjusted,false);assert.equal(r.proceedsAlreadyNetNoSecondDiscountDeduction,true);
  assert.equal(r.isEntireGovernmentGrantsGaapRollforward,false);
});
test("Cohort origin stays independent of collection year",()=>{
  const r=rebuildTaggedTransferCollections([fixture,{...fixture,id:"synthetic2025",generationYear:2025,agreementYear:2025,
    agreementPeriod:"2025",faceUsd:210,contractProceedsUsd:200,receipts:[{period:"2026",year:2026,cashUsd:200}]}]);
  assert.deepEqual(r.years.map(y=>y.observedCashCollectionsUsd),[60,40,200]);
  assert.deepEqual(r.years.map(y=>y.closingIdentifiedContractProceedsUsd),[40,200,0]);
});
test("Unknown/unreceived contractual balance remains outstanding, not invented cash",()=>{
  const r=rebuildTaggedTransferCollections([{...fixture,receipts:[fixture.receipts[0]]}]);
  assert.equal(r.finalIdentifiedContractProceedsOutstandingUsd,40);
  assert.equal(r.lotChecks[0].outstandingContractProceedsUsd,40);
});
test("Duplicate lots, overcollections and cash before contract refuse",()=>{
  assert.throws(()=>rebuildTaggedTransferCollections([fixture,fixture]),/uniquely tagged/);
  assert.throws(()=>rebuildTaggedTransferCollections([{...fixture,receipts:[{period:"2024",year:2024,cashUsd:101}]}]),/Cash exceeds/);
  assert.throws(()=>rebuildTaggedTransferCollections([{...fixture,receipts:[{period:"2023",year:2023,cashUsd:1}]}]),/cash period/);
});
test("Source adapter never falls back to generic receivables or assumed17c eligibility",()=>{
  assert.throws(()=>extractFslrActualCollections("Government grants receivable100","17c","17c"),/Missing original source/);
});
