import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bindNestedOutput, bindExportColumns, outputFieldSemantics, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { earningsYieldGapPp } from "../client/src/lib/valuation-claims";
import * as XLSX from "xlsx";
import { fieldSemantics } from "../shared/fieldSemantics";
import { legacyContext } from "../shared/calculationContract";
import { financialProviderStatus } from "../server/financialData/status";
import { diagnosticMetadataBindings } from "../shared/diagnosticMetadataSemantics";

test("65 existing metadata leaves close without denominator or withheld changes",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  for(const [index,count] of [27,24,14].entries()) {
    const family=census.families.find((f:{surface:string})=>f.surface===diagnosticMetadataBindings[index].surface);
    assert.equal(family.total,count);
    assert.equal(family.bound,count);
  }
  assert.equal(census.fullyBoundFields,866);
  assert.equal(census.originalGapReconciliation.closedOriginalSlots,437);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots,135);
  assert.equal(census.originalGapReconciliation.publicSlotDenominatorDelta,0);
  assert.equal(census.withheldFields.length,27);
  assert.equal(census.resolvedResponseAliases.length,4);
  assert.equal(census.completion,false);
});

test("actual dictionary and cached startup status bind without triggering provider requests",()=>{
  const response={version:"core-fields-1",coverage:"Core fields only; additional output fields remain unreconciled",
    fields:fieldSemantics,qualifiedFields:outputFieldSemantics};
  const before=JSON.stringify(response);
  assert.equal(bindNestedOutput("semanticRegistry",response).length,24);
  assert.equal(JSON.stringify(response),before);
  const status=financialProviderStatus();
  const statusBefore=JSON.stringify(status);
  assert.ok(bindNestedOutput("financialProvider",status).every(f=>f.id.startsWith("financialProvider.")));
  assert.equal(JSON.stringify(status),statusBefore);
  assert.equal(status.approvedUpdatesEnabled,false);
  assert.match(requireOutputSemantic("financialProvider.quote.timestamp").unit,/seconds/);
  assert.match(requireOutputSemantic("financialProvider.checkedAt").formula,/ISO/);
  assert.throws(()=>bindNestedOutput("financialProvider",{secret:"never accepted"}),/Unmapped/);
});

test("legacy context remains characterization with unknown availability and unverified units",()=>{
  const context=legacyContext(2026,"all");
  assert.equal(bindNestedOutput("calculationContract",context).length,18);
  assert.equal(context.informationAvailableAt,null);
  assert.equal(context.observationYear,null);
  assert.equal(context.validation,"characterization-only");
  assert.equal(context.units.currency,null);
  assert.equal(context.seed,2026*12345);
  for(const prefix of ["calculationContract.","semanticRegistry.","financialProvider."])
    for(const field of outputFieldSemantics.filter(f=>f.id.startsWith(prefix))) {
      assert.ok(field.formula.length>0);
      assert.ok(field.unit.length>0);
      assert.match(field.status,/no scientific/);
    }
});

test("actual comparison export bindings preserve signed pp and blank absent values in XLSX",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const bindings=census.verifiedExportBindings.filter((b:{id:string})=>b.id.startsWith("signalComparison."));
  assert.equal(bindings.length,4);
  const row={
    Date:"Jan 2026",
    "Carbon intensity group earnings-yield gap (pp)":earningsYieldGapPp(20,10),
    "SDG group earnings-yield gap (pp)":earningsYieldGapPp(null,10),
    "Ambition group earnings-yield gap (pp)":undefined,
  };
  assert.equal(row["Carbon intensity group earnings-yield gap (pp)"],5);
  const metadata=bindExportColumns([row],Object.fromEntries(bindings.map((b:{field:string;id:string;transform:string})=>
    [b.field.slice(3),{id:b.id,transform:b.transform}])));
  assert.equal(metadata.length,4);
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet([row]),"Comparison");
  const decoded=XLSX.read(XLSX.write(workbook,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  const rows=XLSX.utils.sheet_to_json(decoded.Sheets.Comparison,{defval:null});
  assert.deepEqual(rows,[{...row,"Ambition group earnings-yield gap (pp)":null}]);
  assert.match(requireOutputSemantic("signalComparison.carbonIntensity").scope,/not carbon price/);
});
