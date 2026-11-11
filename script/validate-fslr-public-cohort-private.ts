import{readFileSync,mkdirSync,writeFileSync}from"node:fs";
import{createHash}from"node:crypto";import assert from"node:assert/strict";
import{getConditionalCompanySummary}from"../shared/companyConditionalData";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Separate mandatory private projection validation only");
const root="generated-artifacts/company-operating-corpus";
const cashRoot=`${root}/issuer-cash-collections-v1/2026-11-11T12-43-41-504Z`;
const integratedRoot=`${root}/fslr-cohort-integrated-v1/2026-11-11T13-46-14-298Z`;
const inputs=[
  {path:`${cashRoot}/report.json`,sha256:"b820f14174658cf2d97b774576ddff09962ec27117e99a4a2523000b13c774b1"},
  {path:`${cashRoot}/frozen-before-calculation.json`,sha256:"ac22dc0319b06890dca2ecf853348d0d2f26b8f5595efc7f51fef5dfd46b31ea"},
  {path:`${integratedRoot}/report.json`,sha256:"b7dddd17e1667a9f62b173fae225c9a4da320f9157c8e23385eb648297494982"},
  {path:`${integratedRoot}/frozen-before-calculation.json`,sha256:"d9885a31f12d72528b72aff8b286262d94f0f350c91289e6b464ca36247bc735"}
];
const hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
for(const i of inputs)assert.equal(hash(i.path),i.sha256);
const cash=JSON.parse(readFileSync(inputs[0].path,"utf8")),integrated=JSON.parse(readFileSync(inputs[2].path,"utf8")),
  frozen=JSON.parse(readFileSync(inputs[3].path,"utf8"));
const expected:Record<string,number|null>={
  cohortTransferFace:cash.fslr.cash.totalFaceUsd,cohortTransferCash:cash.fslr.cash.totalObservedTransferCashUsd,
  cohortFaceCashDifference:cash.fslr.cash.totalFaceLessContractProceedsUsd,
  cohortTreasuryCash:cash.fslr.treasuryCashOnly.cashUsd,
  cohortSelectedCash:cash.fslr.totalSelectedObservedTransferPlusTreasuryCashUsd,
  cohortRemainingClaims:cash.fslr.cash.finalIdentifiedContractProceedsOutstandingUsd,
  cohortIncludingFiservFace:cash.fslr.cash.totalFaceUsd+frozen.legacy.fiserv.faceUsd,
  cohortIncludingFiservProceeds:cash.fslr.cash.totalObservedTransferCashUsd+frozen.legacy.fiserv.proceedsUsd,
  cohortIncludingFiservDifference:cash.fslr.cash.totalFaceLessContractProceedsUsd+
    frozen.legacy.fiserv.faceUsd-frozen.legacy.fiserv.proceedsUsd,
  cohortIncludingFiservCash:cash.fslr.totalSelectedObservedTransferPlusTreasuryCashUsd+frozen.legacy.fiserv.cashUsd,
  cohortHistoricalCreditCash:integrated.history.selected2024CreditCashUsd,
  cohortCfoRemainder:integrated.history.cfoLessSelectedCreditCashUsd,
  cohortUnallocatedGrantBridge:integrated.history.unallocatedGrantBridgeResidualUsd,
  cohortGrantBookCfoResidual:integrated.history.cashflowVersusBookMovementUnattributedUsd,
  cohortUsEligibleWatts:frozen.assumptions.actualUsEligibleWatts,
  cohortPriorCreditCash2026:integrated.cases[0].source2026PriorCreditCashUsd,
  cohortPreCutoffReservePv:integrated.cases[0].finiteCashDeltaPvUsd,
  cohortPostCutoffVisaPv:integrated.cases[1].finiteCashDeltaPvUsd
};
const company=getConditionalCompanySummary("FSLR").companies[0],facts=company.facts.filter(f=>f.id.startsWith("cohort"));
assert.equal(facts.length,18);assert.equal(Object.keys(expected).length,18);
for(const f of facts)assert.equal(f.value,expected[f.id],`Source-qualified private projection ${f.id}`);
assert.equal(integrated.cases[0].referenceDate,"2025-02-21");
assert.equal(company.experimentVersion,"fslr-paid-spare-capacity-post-credit-1");
assert.ok(company.informationContext.includes(integrated.version));
assert.equal(company.qualifiedOriginalIssuers,0);assert.equal(company.qualifiedOriginalPairs,0);
const out=`${root}/fslr-public-cohort-v1`;mkdirSync(out,{recursive:true});
writeFileSync(`${out}/private-projection-receipt.json`,JSON.stringify({validatedAt:new Date().toISOString(),inputs,
  staticSourceHashes:["shared/companyConditionalData.ts","shared/companyConditionalSemantics.ts","script/company-conditional-api.test.ts",
    "script/validate-fslr-public-cohort-private.ts"].map(path=>({path,sha256:hash(path)})),
  publicScalarsVerified:18,privateSourceOrIssuerKernelsExecuted:0,rawPrivateExport:false,qualifiedOriginalIssuers:0},null,2)+"\n");
console.log(JSON.stringify({privateProjectionValidation:"pass",immutableArtifactHashesVerified:4,publicScalarsVerified:18,
  sourceCutoffIsRevisedHistory:true,oldReferenceDatePreserved:true,originalQualifiedIssuers:0,rawPrivateExport:false,oldKernelExecutions:0}));
