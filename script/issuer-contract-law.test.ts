import{test}from"node:test";
import assert from"node:assert/strict";
import{originalCfContractFacts,metsDiscoveryBoundary,extractAmendedSolarPolicy,solarPolicyConstraints,
  type SolarGateInput}from"../server/calculation/issuerContractLawInputs";
// Synthetic tiny source fixtures; no private corpus/network or old kernel dependencies.
const ira=`SEC. 13502. sold during calendar year 2030, 75 percent;
sold during calendar year 2031, 50 percent; sold during calendar year 2032, 25 percent;
sold after December 31, 2032, 0 percent`;
const obbba=`SEC. 70514. in the case of any solar energy component
during calendar year 2026, 50 percent; during calendar year 2027, 60 percent;
during calendar year 2028, 70 percent; during calendar year 2029, 80 percent;
after December 31, 2029, 85 percent; in the case of any wind energy component;
same manufacturing facility as the primary; not less than 65 percent; beginning after December 31, 2026;
MATERIAL ASSISTANCE FROM PROHIBITED FOREIGN ENTITIES`;
const notice=`Notice 2026-15 interim guidance; Eligible Component MACR cannot be less than 50%;
Total Direct Material Costs`;
const issuer=`with material assistance from; phase down beginning in 2030`;
const input:SolarGateInput={calendarSaleYear:2027,calendarTaxpayer:true,claimPath:"embedded-primary-component",
  usProductionAndEligibleSale:null,pfeEntityAndControlClear:null,sameManufacturingFacility:null,
  secondaryDirectMaterialCostShareFromUsPrimaryEligibleComponents:null,totalDirectMaterialCosts:null,
  pfeDirectMaterialCosts:null,costAttributionEvidenceValidated:null};
test("Actual-source-bound legal calendar is not assumed company eligibility or cash",()=>{
  const p=extractAmendedSolarPolicy(ira,obbba,notice,issuer),r=solarPolicyConstraints(p,input);
  assert.equal(r.solarMacrMinimum,.6);assert.equal(r.maximumPfeDirectCostFraction,.4);
  assert.equal(r.embedded65PercentRuleApplies,true);assert.equal(r.status,"unresolved-source-inputs");
  assert.equal(r.creditCashUsd,null);assert.equal(r.currentCompanyEligibilityCertified,false);
  assert.equal(solarPolicyConstraints(p,{...input,calendarSaleYear:2033}).status,"statutory-phaseout-zero");
});
test("65% rule is for embedded primary claim path, not all direct module claims",()=>{
  const p=extractAmendedSolarPolicy(ira,obbba,notice,issuer);
  const good={...input,usProductionAndEligibleSale:true,pfeEntityAndControlClear:true,costAttributionEvidenceValidated:true,
    totalDirectMaterialCosts:100,pfeDirectMaterialCosts:40,sameManufacturingFacility:true,
    secondaryDirectMaterialCostShareFromUsPrimaryEligibleComponents:.64};
  assert.equal(solarPolicyConstraints(p,good).status,"fails-specified-source-framework");
  assert.equal(solarPolicyConstraints(p,{...good,claimPath:"direct-module-sale"}).status,"conditionally-passes-specified-framework");
  assert.equal(solarPolicyConstraints(p,{...good,secondaryDirectMaterialCostShareFromUsPrimaryEligibleComponents:.65}).status,"conditionally-passes-specified-framework");
  assert.equal(solarPolicyConstraints(p,{...good,pfeDirectMaterialCosts:41,claimPath:"direct-module-sale"}).status,"fails-specified-source-framework");
});
test("Malformed costs, unexamined fiscal years and changed source thresholds refuse",()=>{
  const p=extractAmendedSolarPolicy(ira,obbba,notice,issuer);
  assert.throws(()=>solarPolicyConstraints(p,{...input,totalDirectMaterialCosts:0,pfeDirectMaterialCosts:0}),/denominator/);
  assert.throws(()=>solarPolicyConstraints(p,{...input,calendarTaxpayer:false as any}),/calendar taxpayers/);
  assert.throws(()=>extractAmendedSolarPolicy(ira,obbba.replace("60 percent","55 percent"),notice,issuer),/source clause/);
});
test("Original CF metric announcement versus short-ton annual is retained as source conflict",()=>{
  const a=`October 12, 2022 up to 2 million metric tons of CO2 emissions annually;
  Donaldsonville, Louisiana; Vermilion Parish; ExxonMobil has signed an agreement with EnLink Midstream;
  125K-acre CO2 storage location`;
  const annual=`References to tons refer to short tons and references to tonnes refer to metric tons.
  capacity to dehydrate and compress up to 2 million tons per year of CO2`;
  const exhibit=`secure geologic storage it owns in Vermilion Parish;
  ExxonMobil has signed an agreement with EnLink Midstream`;
  const r=originalCfContractFacts(a,annual,exhibit);
  assert.equal(r.crossDocumentMassLabelConflict,true);assert.equal(r.contractFeePerTonne,null);
  assert.equal(r.annual2022ReportedCapacity.unit,"short tons/year");
  assert.equal(r.announcementCapacityUpper.unit,"metric tonnes/year");
  assert.equal(r.storageInjectionPermitId,null);assert.equal(r.contractTermYears,null);
});
test("METS sign-in discovery is not permit/site crosswalk or auth attempt",()=>{
  const r=metsDiscoveryBoundary("Your METS online account https://manage-emissions-reporting.service.gov.uk/landing",
    "main-IFRZ7ZHG.js","Sign in to installations; Create an installations sign in");
  assert.equal(r.clientSignInBoundaryObserved,true);assert.equal(r.exactUkEts11402DocumentRetrieved,false);
  assert.equal(r.permitSiteCrosswalk,null);assert.equal(r.authenticationAttempted,false);
});
