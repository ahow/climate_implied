import{test}from"node:test";import assert from"node:assert/strict";
import{observedPermitBoundary,qualifyRoseTracker}from"../server/calculation/issuerFinancialFollowupInputs";
test("Synthetic application or hearing does not become an observed permit",()=>{
  for(const applicationStatus of ["Hearing","Application","Draft"])
    assert.equal(observedPermitBoundary({applicationStatus,approvalDate:null,finalPermitDocumentVerified:false}).observedFinalPermitVerified,false);
});
test("Current observed permit requires actual dated final-document verification",()=>{
  assert.equal(observedPermitBoundary({applicationStatus:"Approved",approvalDate:"2025-01-01",finalPermitDocumentVerified:false}).observedFinalPermitVerified,false);
  assert.equal(observedPermitBoundary({applicationStatus:"Approved",approvalDate:"2025-01-01",finalPermitDocumentVerified:true}).observedFinalPermitVerified,true);
});
test("Conditional future assumption is not prohibited or relabelled observed",()=>{
  const r=observedPermitBoundary({applicationStatus:"Hearing",approvalDate:null,finalPermitDocumentVerified:false});
  assert.equal(r.conditionalForwardPermissionAssumptionStillPossible,true);assert.equal(r.observedFinalPermitVerified,false);
});
test("Source adapter has no fallback to generic EPAindex or guessed Rosecounty",()=>{
  assert.throws(()=>qualifyRoseTracker("Generic ClassVIindex; no specific source row"),/Exact dated original/);
});
