import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bindNestedOutput, bindExportColumns, requireOutputSemantic, outputFieldSemantics } from "../shared/outputFieldSemantics";
import { INDICATORS } from "../server/dataIngestion/indicatorRegistry";

const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
test("operational GET families bind all actual typed leaves without new public slots",()=>{
  for(const [path,count] of [
    ["/api/news/climate",19],["/api/data/indicators",18],["/api/data/indicator/:key",31],
    ["/api/cv/uploads",8],["/api/cv/upload/:id/status",8],
  ] as const) {
    const family=census.originalGapReconciliation.families.find((f:{surface:string})=>f.surface===`API GET "${path}"`);
    assert.equal(family.total,count,path);
    assert.equal(family.bound,count,path);
    assert.deepEqual(family.unbound,[]);
  }
  assert.equal(census.originalGapReconciliation.originalPublicSlots,1001);
  assert.equal(census.originalGapReconciliation.publicSlotDenominatorDelta,census.supplementalSlotAccounting.addedPublicSlots);
  assert.deepEqual(census.supplementalSlotAccounting.removedOriginalSlots,[]);
   assert.equal(census.originalGapReconciliation.closedOriginalSlots,571);
   assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots,1);
  assert.equal(new Set(outputFieldSemantics.map(f=>f.id)).size,outputFieldSemantics.length);
});

test("operational bindings preserve empty collections, unknown provenance and dates",()=>{
  const detail={def:INDICATORS[0],series:[],proposals:[]};
  const before=JSON.stringify(detail);
  assert.equal(bindNestedOutput("indicatorDetail",detail).length,11);
  assert.equal(JSON.stringify(detail),before);
  assert.equal(bindNestedOutput("indicatorInventory",{indicators:[],baselineYear:2024,latestYear:2026}).length,3);
  const news={volume:[],sentiment:[],topicBreakdown:[],recentArticles:[],totalArticles:0,
    dateRange:{start:"2025-01-01",end:"2026-01-01"}};
  assert.equal(bindNestedOutput("news",news).length,7);
  assert.throws(()=>bindNestedOutput("news",{unreviewed:1}),/Unmapped/);
  assert.throws(()=>bindNestedOutput("indicatorDetail",{proposals:[{unknown:1}]}),/Unmapped/);
  assert.equal(bindNestedOutput("upload",{id:1,filename:"retained.xlsx",status:"failed",
    companiesCount:null,timePeriodsCount:null,errorMessage:"parse failed",createdAt:new Date(0),completedAt:null}).length,8);
});

test("news definitions disclose estimator defaults rather than relabel estimates as observations",()=>{
  assert.match(requireOutputSemantic("news.sentiment[].positive").formula,/0\.4/);
  assert.match(requireOutputSemantic("news.sentiment[].negative").formula,/0\.15/);
  assert.match(requireOutputSemantic("news.topicBreakdown[].count").formula,/0\.05/);
  assert.match(requireOutputSemantic("news.sentiment[].avgSentiment").formula,/>= 5/);
  assert.match(requireOutputSemantic("news.recentArticles[].sentiment").formula,/\?\? null/);
  assert.match(requireOutputSemantic("news.dateRange.end").asOfRule,/no fetchedAt/);
  const bindings=bindExportColumns([{"Positive (%)":40}],{
    "Positive (%)":{id:"news.sentiment[].positive",transform:"total > 0 ? Math.round(positive / total * 100) : 0"},
  });
  assert.equal(bindings[0].unit,"estimated articles");
  assert.match(bindings[0].Transformation,/100/);
});

test("export closure requires exact literal binding or certified production finite schema, never mere wildcard inventory",()=>{
  assert.equal(census.verifiedExportBindings.length,127,"Prior103 plus22 exact read-only diff columns and2 historical evidence-type columns; supplemental disclosures, no new original closure");
  const diff = census.verifiedExportBindings.filter((b:{surface:string}) =>
    b.surface.startsWith("XLSX client/src/components/readonly-version-diff.tsx:"));
  assert.equal(diff.length,22);
  assert.deepEqual(diff.map((b:{field:string;id:string})=>[b.field,b.id]).sort(), [
    ["[].From","readonlyDiff.from"],["[].To","readonlyDiff.to"],["[].Kind","readonlyDiff.kind"],
    ["[].Domain","readonlyDiff.domain"],["[].Field","readonlyDiff.field"],["[].Added","readonlyDiff.added"],
    ["[].Removed","readonlyDiff.removed"],["[].Changed","readonlyDiff.changed"],
    ["[].Before content SHA-256","readonlyDiff.beforeHash"],["[].After content SHA-256","readonlyDiff.afterHash"],
    ["[].Approval state","readonlyDiff.approvalState"],["[].History basis","readonlyDiff.historicalBasis"],
    ["[].From","readonlyDiff.from"],["[].To","readonlyDiff.to"],["[].Result ID","readonlyDiff.resultId"],
    ["[].Manifest ID","readonlyDiff.manifestId"],["[].Scenario","readonlyDiff.scenario"],
    ["[].Recorded at","readonlyDiff.recordedAt"],["[].Relation","readonlyDiff.relation"],
    ["[].Historical type code","readonlyDiff.historicalTypeCode"],["[].Historical type label","readonlyDiff.historicalTypeLabel"],
    ["[].Result scan scope","readonlyDiff.affectedMeaning"],
  ].sort());
  const history = census.verifiedExportBindings.filter((b:{surface:string;field:string}) =>
    b.surface.startsWith("XLSX client/src/components/historical-trend-chart.tsx:") &&
      ["[].Historical type code","[].Historical type label"].includes(b.field));
  assert.deepEqual(history.map((b:{field:string;id:string})=>[b.field,b.id]).sort(), [
    ["[].Historical type code","historical.historicalTypeCode"],
    ["[].Historical type label","historical.historicalTypeLabel"],
  ]);
  assert.equal(census.verifiedExportBindings.length - diff.length - history.length,103);
  assert.equal(census.originalGapReconciliation.originalPublicSlots,1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields,1000);
  for(const binding of census.verifiedExportBindings) {
    assert.ok(binding.transform.length>0);
    assert.ok(requireOutputSemantic(binding.id));
    assert.ok(census.fields.some((field:{surface:string;field:string;resolution:string})=>
      field.surface===binding.surface&&field.field===binding.field&&field.resolution==="typed-field"));
    assert.notEqual(binding.field,"[].*");
  }
  assert.deepEqual(census.unresolvedDynamicKeys,[]);
  assert.equal(census.certifiedFiniteExports.length,6);
  assert.equal(census.originalGapReconciliation.originalSlotIdentitiesUnchanged,true);
  assert.deepEqual(census.supplementalWorkbookInventory.map((s:{sheet:string})=>s.sheet),
    ["Semantics","Identity","Ledger","FullResult"]);
  assert.equal(census.families.find((f:{surface:string})=>f.surface==="XLSX server/calculation/companyProjectionReplay.ts:Ledger").bound,22);
});
