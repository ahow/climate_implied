import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { packOverlay, unpackOverlay, targetEvidenceSchema } from "../server/snapshots/overlayContract";
import { targetInputSemantics } from "../shared/targetInputSemantics";
import { bindNestedOutput, outputFieldSemantics } from "../shared/outputFieldSemantics";

const entry={companyId:1,field:"emissionTarget2050",kind:"target",value:-.5,unit:"fractional-change",
  observationDate:"2020-02-01",availableAt:"2020-02-02",source:"Synthetic engineering evidence only",
  approvalEvidence:"Synthetic review declaration",historyBasis:"revised-history",
  targetEvidence:{baseYear:2015,targetYear:2050,accountingScope:"scope1+scope2",unit:"fractional-change",
    publishedAt:"2020-01-31",sourceLocator:"test source page 1",sourceExcerpt:"Synthetic 50% scope 1+2 reduction from 2015 to 2050"}};
test("all actual target entry leaves bind as INPUT and round-trip content identity",()=>{
  const packed=packOverlay([entry]);
  const restored=unpackOverlay(packed.id,JSON.parse(JSON.stringify(packed.payload)));
  const definitions=bindNestedOutput("targetInput",restored.entries[0]);
  assert.equal(definitions.length,17);
  assert.ok(definitions.every(f=>f.role==="Input"));
  assert.equal(targetInputSemantics.length,18);
  assert.deepEqual(restored.entries[0],entry);
  for(const field of ["baseYear","publishedAt","sourceLocator","sourceExcerpt"] as const) {
    const changed={...entry,targetEvidence:{...entry.targetEvidence,
      [field]:field==="baseYear"?2016:field==="publishedAt"?"2020-01-30":"changed evidence"}};
    assert.notEqual(packOverlay([changed]).id,packed.id);
  }
  assert.ok(targetInputSemantics.every(f=>outputFieldSemantics.includes(f)));
});
test("contract rejects unsupported boundaries, missing base years, invalid publication and percent units",()=>{
  for(const patch of [{baseYear:undefined},{baseYear:2050},{baseYear:2021},
    {targetYear:2040},{accountingScope:"scope3"},{unit:"percent"},{sourceExcerpt:""},
    {publishedAt:"2020-01-31T00:00:00Z"}]) {
    assert.equal(targetEvidenceSchema.safeParse({...entry.targetEvidence,...patch}).success,false);
  }
  assert.throws(()=>packOverlay([{...entry,value:-1}]));
  assert.throws(()=>packOverlay([{...entry,targetEvidence:undefined}]));
  assert.throws(()=>packOverlay([{...entry,targetEvidence:{...entry.targetEvidence,publishedAt:"2020-02-02"}}]));
  assert.match(targetInputSemantics.find(f=>f.id==="targetInput.annualDecarbRate")!.formula,/2050 - targetEvidence.baseYear/);
});
test("read-only disclosure uses existing actual registry; definitions and displays do not close original slots",()=>{
  const routes=readFileSync("server/routes.ts","utf8");
  assert.match(routes,/qualifiedFields:outputFieldSemantics/);
  const ui=readFileSync("client/src/components/target-input-disclosure.tsx","utf8");
  assert.match(ui,/queryKey:\["\/api\/calculation\/field-semantics"\]/);
  assert.doesNotMatch(ui,/useMutation|<Input|<Button|method:\s*["']POST/);
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  assert.equal(census.originalGapReconciliation.currentPublicSlots,1001);
  assert.equal(census.originalGapReconciliation.publicSlotDenominatorDelta,0);
  assert.equal(census.originalGapReconciliation.closedOriginalSlots,437);
  assert.equal(census.fullyBoundFields,866);
  assert.ok(census.displayBindings.some((f:{id:string})=>f.id==="targetInput.value"));
  assert.equal(census.resolvedResponseAliases.length,4);
  assert.equal(census.withheldFields.length,27);
});
