import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
import references from "../server/calculation/data/catReferences.json";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { driverFieldSpecs, driverConsumerFieldSpecs, driverSourceProposalSpecs, referenceFieldSpecs } from "../shared/researchFieldSemantics";
import { companySummarySpecs } from "../shared/companySummarySemantics";
import { carryForwardEmissions, computeImputationStats } from "../server/climateValuation/emissionsCarryForward";
import type { CvTimeSeries } from "../shared/schema";
import XLSX from "xlsx";
import { createHash } from "node:crypto";
import { readWorkbookNumeric } from "../server/climateValuation/workbookMissingness";
import { ALL_COMMITMENTS_LABEL } from "../shared/referenceScenarioLabels";

test("all actual research and pinned reference leaves bind without numerical modification",()=>{
  const response={status:"evidence-gaps-explicit",indicators:driverEvidenceRegistry()};
  const original=JSON.stringify(response);
  const driver=bindNestedOutput("driverRegistry",response);
  assert.equal(response.indicators.length,22);
  assert.equal(driver.length,92,"Prior90 plus two exact native declaration/receipt trace leaves; not original closure");
  for (const field of ["mechanismDeclarations", "dependencyReceipt"]) {
    const semantic = requireOutputSemantic(`driverRegistry.indicators[].actualConsumers.stage5.${field}`);
    assert.ok(driver.some(row => row.id === semantic.id), field);
  }
  assert.equal(driverSourceProposalSpecs.length,36);
  assert.equal(response.indicators.filter(row=>row.sourceMetadataProposal===null).length,14,
    "Prior six plus two CAT supplemental source-product proposals; proposal presence is not approved input, source vintage or scientific acceptance");
  for (const [field, meaning, formula, unit] of driverSourceProposalSpecs) {
    const semantic=requireOutputSemantic(`driverRegistry.${field}`);
    assert.equal(semantic.meaning,meaning);
    assert.equal(semantic.formula,formula);
    assert.equal(semantic.unit,unit);
    assert.ok(driver.some(row=>row.id===semantic.id),field);
  }
  assert.equal(new Set(driver.map(f=>f.id)).size,driverFieldSpecs.length);
  assert.equal(JSON.stringify(response),original);
  const reference=bindNestedOutput("publishedReference",references);
  assert.equal(reference.length,28);
  assert.equal(reference.length,referenceFieldSpecs.length);
  assert.ok(response.indicators.every(row=>row.centralModelEligible===false && row.informationAvailableAt===null));
  assert.ok(response.indicators.every(row=>row.admission==="not-admitted"));
  for (const row of response.indicators) {
    assert.equal(row.legacyRole,row.role==="mechanism-input"?"candidate-mechanism-input":row.role);
  }
  for (const field of ["indicators[].legacyRole","indicators[].admission"]) {
    const spec=driverFieldSpecs.find(([path])=>path===field)!;
    assert.ok(spec,`Exact role/admission definition required: ${field}`);
    const semantic=requireOutputSemantic(`driverRegistry.${field}`);
    assert.equal(semantic.meaning,spec[1]);
    assert.equal(semantic.formula,spec[2]);
    assert.equal(semantic.unit,spec[3]);
    assert.ok(driver.some(d=>d.id===semantic.id));
  }
  assert.match(requireOutputSemantic("driverRegistry.indicators[].role").formula,/curatedDriverRole/);
  assert.match(requireOutputSemantic("driverRegistry.indicators[].legacyRole").meaning,/compatibility/);
  assert.match(requireOutputSemantic("driverRegistry.indicators[].admission").formula,/centralModelEligible remains false for all 22/);
  assert.match(requireOutputSemantic("publishedReference.scenarios[].emissions[].low").meaning,/NOT a probability/);
  assert.match(requireOutputSemantic("driverRegistry.indicators[].sourceProvenance.retainedInputHash").formula,/contentHash/);
  assert.throws(()=>bindNestedOutput("driverRegistry",{indicators:[{unreviewed:1}]}),/Unmapped/);
  assert.throws(()=>bindNestedOutput("publishedReference",{newValue:1}),/Unmapped/);
  assert.equal(driverConsumerFieldSpecs.length,20);
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
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["date", "scope1", "scope2", "scope3"],
    ["2024-01", 10, null, 30], ["2024-02", null, 20, null], ["2024-02", null, null, null],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "ObservedScopes");
  const sourceId = createHash("sha256").update(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })).digest("hex");
  observations.forEach((row, index) => Object.assign(row, { sourceCells: Object.fromEntries(
    ["scope1Emissions", "scope2Emissions", "scope3Emissions"].map((field, col) => {
      const address = XLSX.utils.encode_cell({ r: index + 1, c: col + 1 });
      return [field, readWorkbookNumeric(sourceId, "ObservedScopes", address, sheet[address]).source];
    }),
  ) }));
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
  // Prior54 plus35 object leaves. Nullable parent is an additional runtime
  // binding, not another typed API leaf or frozen-original closure.
  for(const [path,count] of [["/api/research/driver-registry",91],["/api/reference-scenarios",28],
    ["/api/cv/summary",21],["/api/cv/dimensions",2]] as const) {
    const family=census.families.find((f:{surface:string})=>f.surface===`API GET "${path}"`);
    assert.equal(family.total,count);
    assert.equal(family.bound,count);
    assert.deepEqual(family.unbound,[]);
  }
  const displays=census.displayBindings.filter((b:{id:string})=>/^(driverRegistry|publishedReference)\./.test(b.id));
  assert.equal(displays.length,14,"Original13 displays plus the explicitly bound commitments table header");
  const referenceSource="client/src/components/published-scenario-references.tsx";
  const driverSource="client/src/components/driver-evidence-disclosure.tsx";
  const headerExpression='{ALL_COMMITMENTS_LABEL}<br /><span className="text-xs font-normal">Optimistic single value</span>';
  const header=displays.filter((b:{expression:string})=>b.expression===headerExpression);
  assert.equal(header.length,1,"Exactly one new shared-label table-header consumer");
  const originalDisplays=displays.filter((b:{expression:string})=>b.expression!==headerExpression);
  assert.deepEqual(originalDisplays.map((b:{source:string;id:string;expression:string;bound:boolean})=>
    [b.source,b.id,b.expression,b.bound]),[
    [referenceSource,"publishedReference.scenarios[].label","{scenario.label}",true],
    [referenceSource,"publishedReference.scenarios[].publishedName","CAT: {scenario.publishedName}",true],
    [referenceSource,"publishedReference.scenarios[].temperatureMedianC","{scenario.temperatureMedianC.toFixed(1)}°C",true],
    [referenceSource,"publishedReference.scenarios[].definition","{scenario.definition}",true],
    [driverSource,"driverRegistry.status",'{registry.data.status ?? "Registry status not returned"}',true],
    [driverSource,"driverRegistry.indicators[].id","{indicator.id}",true],
    [driverSource,"driverRegistry.indicators[].definition",'{indicator.definition || "Definition not supplied"}',true],
    [driverSource,"driverRegistry.indicators[].publisher",'{indicator.publisher || "Not supplied"}',true],
    [driverSource,"driverRegistry.indicators[].rawUnit",'{indicator.rawUnit || "Not supplied"}',true],
    [driverSource,"driverRegistry.indicators[].role",'{indicator.role || "Not supplied"}',true],
    [driverSource,"driverRegistry.indicators[].evidenceState",'{indicator.evidenceState || "Not supplied"}',true],
    [driverSource,"driverRegistry.indicators[].centralModelEligible",'{indicator.centralModelEligible === false ? "No" : "Not verified"}',true],
    [driverSource,"driverRegistry.indicators[].reason",'{indicator.reason || "Not supplied"}',true],
  ],"All original13 exact source/field/expression bindings remain intact");
  assert.deepEqual([header[0].source,header[0].id,header[0].expression,header[0].bound],
    [referenceSource,"publishedReference.scenarios[].label",headerExpression,true]);
  const cardLabel=originalDisplays.find((b:{expression:string})=>b.expression==="{scenario.label}");
  assert.deepEqual(requireOutputSemantic(header[0].id),requireOutputSemantic(cardLabel.id),
    "Shared header and existing card use the identical registered descriptor");
  assert.equal(ALL_COMMITMENTS_LABEL,
    references.scenarios.find(s=>s.id==="all-announced-commitments")!.label,
    "Shared header label equals the actual API reference label");
  for(const display of displays) assert.ok(requireOutputSemantic(display.id));
  const routes=readFileSync("server/routes.ts","utf8");
  assert.match(routes,/bindNestedOutput\("driverRegistry", response\)/);
  assert.match(routes,/bindNestedOutput\("publishedReference", catReferences\)/);
});
