import {test} from "node:test";
import assert from "node:assert/strict";
import {fundedTransportFixture} from "./fundedTransportFixture";
import {projectCompanyCohorts} from "../server/calculation/companyCohortProjection";
import {freezeFundedDeploymentTransition,evaluateFundedDeploymentTransition} from "../server/calculation/fundedDeploymentTransition";
test("earned funded version executes the same physical prefix and refuses advance revenue",()=>{
 const company=fundedTransportFixture(),input=company.scenarios[0].fundedTransition;
 const frozen=freezeFundedDeploymentTransition(input);
 const result=projectCompanyCohorts(company),r=result.members[0].fundedTransition;
 assert.equal(r.version,"funded-finite-gregorian-join-3-earned");
 assert.equal(r.finite.recognitionAssessment.version,"earned-service-prefix-1");
 assert.ok(r.finite.recognitionAssessment.checks.every((c:any)=>c.recognizedUsd<=c.earnedThroughDayUsd+1e-8));
 const early=structuredClone(input);early.debt.accrual.entries.find((e:any)=>e.kind==="revenue").on="2025-07-01";
 assert.throws(()=>evaluateFundedDeploymentTransition(freezeFundedDeploymentTransition(early)),/Recognition precedes modeled physical service/);
 const wrong=structuredClone(input);wrong.debt.recognitionLaw=undefined;
 assert.throws(()=>freezeFundedDeploymentTransition(wrong),/Recognition law/);
 assert.equal(frozen.definitionHash,r.definitionHash);assert.equal(r.inverse,null);
});
