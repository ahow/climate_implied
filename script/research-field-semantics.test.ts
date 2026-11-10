import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
import references from "../server/calculation/data/catReferences.json";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { driverFieldSpecs, driverConsumerFieldSpecs, referenceFieldSpecs } from "../shared/researchFieldSemantics";
import { companySummarySpecs } from "../shared/companySummarySemantics";
import { carryForwardEmissions, computeImputationStats } from "../server/climateValuation/emissionsCarryForward";
import type { CvTimeSeries } from "../shared/schema";

test("all actual research and pinned reference leaves bind without numerical modification",()=>{
  const response={status:"evidence-gaps-explicit",indicators:driverEvidenceRegistry()};
  const original=JSON.stringify(response);
  const driver=bindNestedOutput("driverRegistry",response);
  assert.equal(response.indicators.length,22);
  assert.equal(driver.length,51);
  assert.equal(new Set(driver.map(f=>f.id)).size,driverFieldSpecs.length);
  assert.equal(JSON.stringify(response),original);
  const reference=bindNestedOutput("publishedReference",references);
  assert.equal(reference.length,28);
  assert.equal(reference.length,referenceFieldSpecs.length);
  assert.ok(response.indicators.every(row=>row.centralModelEligible===false && row.informationAvailableAt===null));
  assert.match(requireOutputSemantic("publishedReference.scenarios[].emissions[].low").meaning,/NOT a probability/);
  assert.match(requireOutputSemantic("driverRegistry.indicators[].sourceProvenance.retainedInputHash").formula,/contentHash/);
  assert.throws(()=>bindNestedOutput("driverRegistry",{indicators:[{unreviewed:1}]}),/Unmapped/);
  assert.throws(()=>bindNestedOutput("publishedReference",{newValue:1}),/Unmapped/);
  assert.equal(driverConsumerFieldSpecs.length,17);
  for(const [field,meaning,formula,unit,status] of driverConsumerFieldSpecs) {
    const semantic=requireOutputSemantic(`driverRegistry.${field}`);
    assert.equal(semantic.meaning,meaning);
    assert.equal(semantic.formula,formula);
    assert.equal(semantic.unit,unit);
    assert.equal(semantic.status,status);
  }
  assert.throws(()=>bindNestedOutput("driverRegistry",{indicators:[{
    actualConsumers:{stage5:{inventedConsumerFlag:true}}}]}),/Unmapped/);
});

test("company summary definitions bind dates, null upload and actual carry-forward results",()=>{
  const observations=[
    {companyId:1,date:new Date("2024-01-01"),scope1Emissions:10,scope2Emissions:null,scope3Emissions:30},
    {companyId:1,date:new Date("2024-02-01"),scope1Emissions:null,scope2Emissions:20,scope3Emissions:null},
    {companyId:2,date:new Date("2024-02-01"),scope1Emissions:null,scope2Emissions:null,scope3Emissions:null},
  ] as CvTimeSeries[];
  const imputation=computeImputationStats(carryForwardEmissions(observations));
  assert.deepEqual(imputation,{totalRecords:3,imputedRecords:1,imputedFraction:1/3,
    imputedByScope:{scope1:1,scope2:0,scope3:1}});
  const response={companiesCount:2,dateRange:{minDate:observations[0].date,maxDate:observations[1].date,recordCount:3},
    sectors:1,geographies:1,snapshotId:"test-snapshot",latestUpload:null,imputation};
  assert.equal(bindNestedOutput("companySummary",response).length,14);
  assert.equal(bindNestedOutput("companyDimensions",{sectors:[],geographies:["Global"]}).length,2);
  for(const [field] of companySummarySpecs) assert.ok(requireOutputSemantic(`companySummary.${field}`));
  assert.equal(computeImputationStats([]).imputedFraction,0);
  assert.throws(()=>bindNestedOutput("companySummary",{imputation:{unknown:1}}),/Unmapped/);
});

test("census counts exact response bindings and keeps explicit displays separate",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  assert.equal(census.originalGapReconciliation.originalPublicSlots,1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields,1000);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots,1);
  assert.equal(census.supplementalQualifiedChanges.companyCoverage.definitions,133);
  assert.equal(new Set(census.supplementalQualifiedChanges.companyCoverage.ids).size,133);
  for(const [path,count] of [["/api/research/driver-registry",51],["/api/reference-scenarios",28],
    ["/api/cv/summary",21],["/api/cv/dimensions",2]] as const) {
    const family=census.families.find((f:{surface:string})=>f.surface===`API GET "${path}"`);
    assert.equal(family.total,count);
    assert.equal(family.bound,count);
    assert.deepEqual(family.unbound,[]);
  }
  const displays=census.displayBindings.filter((b:{id:string})=>/^(driverRegistry|publishedReference)\./.test(b.id));
  assert.equal(displays.length,13);
  for(const display of displays) assert.ok(requireOutputSemantic(display.id));
  const routes=readFileSync("server/routes.ts","utf8");
  assert.match(routes,/bindNestedOutput\("driverRegistry", response\)/);
  assert.match(routes,/bindNestedOutput\("publishedReference", catReferences\)/);
});
