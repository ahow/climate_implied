import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { semanticRows } from "../shared/fieldSemantics";
import { bindExportColumns, outputFieldSemantics, requireOutputSemantic } from "../shared/outputFieldSemantics";
import {
  certifySupplementalSheetRows, supplementalSheetBindings, supplementalSheetSemantics,
} from "../shared/supplementalSheetBindings";

test("actual metadata row builders have 31 concrete registered supplemental worksheet bindings",()=>{
  const definitions=semanticRows();
  const bindings=bindExportColumns([{"Year":2026}],{
    Year:{id:"indicator.year",transform:"Identity calendar year"},
  }).map(row=>({...row,dependencies:row.dependencies.join(", ")}));
  assert.equal(supplementalSheetSemantics.length,31);
  assert.equal(Object.keys(supplementalSheetBindings("Field semantics")).length,14);
  assert.equal(Object.keys(supplementalSheetBindings("Column bindings")).length,17);
  assert.strictEqual(certifySupplementalSheetRows("Field semantics",definitions),definitions);
  assert.strictEqual(certifySupplementalSheetRows("Column bindings",bindings),bindings);
  for(const [sheet,rows] of [["Field semantics",definitions],["Column bindings",bindings]] as const) {
    const map=supplementalSheetBindings(sheet);
    const concrete=Array.from(new Set(rows.flatMap(row=>Object.keys(row))));
    assert.deepEqual(Object.keys(map).sort(),concrete.sort());
    for(const column of concrete) assert.ok(requireOutputSemantic(map[column].id));
  }
  assert.equal(new Set(outputFieldSemantics.map(row=>row.id)).size,outputFieldSemantics.length);
});

test("supplemental metadata guards preserve actual workbook cells and explicit core-row omissions",()=>{
  const definitions=semanticRows(),core=definitions[0];
  assert.ok(!("Meaning" in core),"Legacy core omissions stay absent, not invented disclosures");
  const rows=certifySupplementalSheetRows("Field semantics",definitions);
  const workbook=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(rows),"Field semantics");
  const bytes=XLSX.write(workbook,{type:"buffer",bookType:"xlsx"});
  const decoded=XLSX.read(bytes,{type:"buffer"});
  const actual=XLSX.utils.sheet_to_json(decoded.Sheets["Field semantics"],{defval:null});
  assert.equal(actual.length,definitions.length);
  assert.equal((actual[0] as any).Meaning,null);
  assert.equal((actual[0] as any).Field,core.Field);
  for(const definition of supplementalSheetSemantics) {
    const row=(actual as any[]).find(row=>row.Field===definition.id);
    assert.ok(row,definition.id);
    assert.equal(row.Meaning,definition.meaning);
  }
  const raw=XLSX.utils.sheet_to_json(XLSX.utils.json_to_sheet(definitions),{header:1,defval:null});
  const guarded=XLSX.utils.sheet_to_json(XLSX.utils.json_to_sheet(rows),{header:1,defval:null});
  assert.deepEqual(guarded,raw,"No export values changed by metadata certification");
});

test("unsupported metadata columns, missing required cells, wrong identity and empty transforms fail closed",()=>{
  const core=semanticRows()[0];
  assert.throws(()=>certifySupplementalSheetRows("Field semantics",[{...core,unknown:"value"}]),/Unmapped/);
  const missing:any={...core};delete missing.Source;
  assert.throws(()=>certifySupplementalSheetRows("Field semantics",[missing]),/missing/);
  assert.throws(()=>certifySupplementalSheetRows("Field semantics",[{...core,Unit:null}]),/explicit text/);
  const row=bindExportColumns([{Year:2026}],{
    Year:{id:"indicator.year",transform:"Identity"},
  }).map(row=>({...row,dependencies:row.dependencies.join(", ")}))[0];
  assert.throws(()=>certifySupplementalSheetRows("Column bindings",[{...row,FieldID:"wrong"}]),/Conflicting/);
  assert.throws(()=>certifySupplementalSheetRows("Column bindings",[{...row,Transformation:""}]),/Conflicting/);
  const component=readFileSync("client/src/components/download-data-button.tsx","utf8");
  assert.match(component,/certifySupplementalSheetRows\("Field semantics",semanticRows\(\)\)/);
  assert.match(component,/certifySupplementalSheetRows\("Column bindings",\s*bindExportColumns/);
});
