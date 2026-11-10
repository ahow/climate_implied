import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { summarizeEnsemble } from "../server/calculation/ensemble";
import { evaluateHoldout } from "../server/calculation/evaluation";
import { historicalValidation } from "../server/calculation/historicalValidation";
import { auditVintages } from "../server/calculation/vintageAudit";
import { evaluateSignal } from "../server/calculation/signalResearch";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { evidenceApiBindings, evidenceFieldSemantics } from "../shared/evidenceFieldSemantics";

function check(prefix:string,response:unknown,count:number) {
  const before=JSON.stringify(response);
  assert.equal(bindNestedOutput(prefix,response).length,count);
  assert.equal(JSON.stringify(response),before);
  assert.throws(()=>bindNestedOutput(prefix,{unreviewed:1}),/Unmapped/);
}
const ensemble={baseline:"1850-1900",memberIds:["a","b"],years:[2020,2021],temperature:[[1,3],[2,4]]};
test("ensemble exact quantiles, strict exceedance and bin mass bind without changing response",()=>{
  const response=summarizeEnsemble(ensemble);
  check("ensembleSummary",response,23);
  assert.equal(response.headline.median,3);
  assert.equal(response.headline.p10,2.2);
  assert.equal(response.headline.probabilityAbove2,.5);
  assert.equal(response.density.reduce((s,r)=>s+r.probability,0),1);
  const degenerate=summarizeEnsemble({...ensemble,temperature:[[2,2],[2,2]]});
  assert.equal(degenerate.density[0].count,2);
  assert.equal(degenerate.density[0].upper-degenerate.density[0].lower,1);
  assert.match(requireOutputSemantic("ensembleSummary.density[].probability").meaning,/NOT probability density/);
});
test("holdout and reference-window calculations bind all submitted-evidence leaves",()=>{
  const response=evaluateHoldout({
    frozenAt:"2019-01-01",trainingEnd:"2019-12-31",holdoutStart:"2020-01-01",
    baseline:"persistence",maxDeteriorationFraction:0,nominalCoverage:.9,coverageTolerance:.1,
  },Array.from({length:5},()=>({origin:"2020-01-01",inputsAvailableThrough:"2019-12-31",
    targetYear:2021,actual:2,candidate:3,persistence:4,trend:3,lower:1,upper:3,revisedHistory:true})));
  check("holdoutEvaluation",response,9);
  assert.equal(response.mae,1); assert.equal(response.baselineMAE,2);
  assert.equal(response.pointInTime,false); assert.equal(response.passed,false);
  const history=historicalValidation({ensemble,simulationKind:"total",reference:{
    source:"https://example.org/test-evidence",kind:"total",baseline:"1850-1900",
    startYear:2020,endYear:2021,lower:1,upper:3,
  }});
  check("historyValidation",history,14);
  assert.equal(history.median,2.5); assert.equal(history.fractionWithinReferenceRange,.5);
});
test("vintage completeness does not grant certification and duplicate/missing failures overlap",()=>{
  const row={companyId:1,decisionDate:"2020-01-01",publicationDate:null,universeKnownAt:null,
    returnEnd:"2021-01-01",returnValue:null,corporateActionsVerified:false,delistingTreatmentVerified:false};
  const response=auditVintages([row,row]);
  check("vintageAudit",response,14);
  assert.equal(response.counts.duplicates,1);
  assert.equal(response.counts.missingPublication,2);
  assert.equal(response.certified,false);
  const complete=auditVintages([{...row,publicationDate:"2019-01-01",universeKnownAt:"2019-01-01",
    returnValue:0,corporateActionsVerified:true,delistingTreatmentVerified:true}]);
  assert.equal(complete.evidenceComplete,true); assert.equal(complete.certified,false);
});
test("conditional signal modes bind readback and retain deterministic coefficients/bootstrap",()=>{
  const fixture={frozenAt:"2010-01-01",splitDate:"2020-01-01",minimumMseImprovement:.1,specificationCount:1,
    rows:Array.from({length:40},(_,i)=>({date:i<25?"2015-01-01":`2021-${String(i-24).padStart(2,"0")}-01`,
      publishedAt:"2014-01-01",outcomeAvailableAt:i<25?"2016-01-01":"2023-01-01",
      controls:[Math.sin(i)],signal:Math.cos(i),outcome:Math.sin(i)+3*Math.cos(i)}))};
  fixture.rows.slice(25).forEach((r,i)=>{r.date=`2021-${String(1+i%12).padStart(2,"0")}-01`;});
  for(const evidenceMode of ["point-in-time","revised-history"])
    for(const uncertainty of ["independent-rows","date-blocks"]) {
      const input={...fixture,evidenceMode,uncertainty};
      const result=evaluateSignal(input);
      check("signalEvaluation",result,13);
      assert.deepEqual(result,evaluateSignal(input));
      assert.equal(result.trainingCount,25); assert.equal(result.holdoutDates,12);
      assert.equal(result.coefficients.length,3);
      if(evidenceMode==="revised-history") assert.match(result.decision,/^exploratory/);
    }
});
test("original API cohort closure is exact and backed by real route bindings",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const routes=readFileSync("server/routes.ts","utf8");
  assert.equal(evidenceFieldSemantics.length,73);
  for(const {surface,prefix} of evidenceApiBindings) {
    const family=census.families.find((f:{surface:string})=>f.surface===surface);
    const expected=evidenceFieldSemantics.filter(f=>f.id.startsWith(`${prefix}.`)).length;
    assert.equal(family.total,expected); assert.equal(family.bound,expected);
    assert.deepEqual(family.unbound,[]);
    assert.ok(routes.includes(`bindNestedOutput("${prefix}",response)`));
  }
  assert.equal(census.originalGapReconciliation.publicSlotDenominatorDelta,0);
  assert.equal(census.resolvedResponseAliases.length,4);
  assert.equal(census.withheldFields.length,27);
});
