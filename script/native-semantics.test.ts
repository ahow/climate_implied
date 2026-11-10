import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {bindNestedOutput} from "../shared/outputFieldSemantics";
import {nativeOutputSemantics,nativeGasIds} from "../shared/nativeOutputSemantics";
import {candidateInventory,constantScenario,illustrativeScenario,projectNativeEmissions,projectInventoryEmissions} from "../server/calculation/emissionsCandidate";
import {resolveEmissionsInputs} from "../server/calculation/emissionsInputs";
import {bindExportColumns} from "../shared/outputFieldSemantics";
import * as XLSX from "xlsx";
import {nativeExportRow,nativeExportBindings} from "../shared/nativeExport";
test("overflow rejects before JSON can silently turn infinity into unavailable null",()=>{
 assert.throws(()=>projectNativeEmissions({...constantScenario,renewableAdditionsGW:Number.MAX_VALUE}),/Nonfinite electricity balance/);
 assert.throws(()=>projectInventoryEmissions(constantScenario,2024,
   [{gas:"SF6",sector:"2",nativeMt:Number.MAX_VALUE,gwp100:10000}]),/Nonfinite native\/reporting aggregate/);
});
test("native gas and sector columns survive XLSX without aggregate/unit substitution",()=>{
 const point=projectNativeEmissions(constantScenario).trajectory[0];
 const row=Object.fromEntries(Object.entries(point.nativeMt).map(([gas,value])=>[gas,value]));
 const bindings=Object.fromEntries(Object.keys(row).map(gas=>[gas,{id:`native.result.trajectory[].nativeMt.${gas}`,transform:"Identity"}]));
 const metadata=bindExportColumns([row],bindings);
 assert.equal(metadata.length,26);
 assert.ok(metadata.every(m=>m.unit===`Mt ${m.Column}/year`));
 const book=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet([row]),"Native masses");
 const decoded=XLSX.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}));
 assert.deepEqual(XLSX.utils.sheet_to_json(decoded.Sheets["Native masses"]),[row]);
 const actualExport=nativeExportRow(point);
 assert.equal(bindExportColumns([actualExport],nativeExportBindings).length,35);
 assert.equal(actualExport["CO2 (Mt gas/year)"],point.nativeMt.CO2);
 assert.equal(nativeExportRow({year:2024})["CO2 (Mt gas/year)"],null);
 const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
 const exportFields=census.fields.filter((e:any)=>e.surface.startsWith("XLSX client/src/components/emissions-candidate-review.tsx:"));
 assert.equal(exportFields.length,35);
 assert.deepEqual(exportFields.map((f:any)=>f.field.slice(3)).sort(),Object.keys(actualExport).sort());
});
test("native schema has exact definitions except declared dynamic gas/sector keys",()=>{
 const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
 const entries=census.fields.filter((e:any)=>e.surface.includes('"/api/emissions/candidate"'));
 assert.equal(entries.length,187);
 const absent=entries.filter((e:any)=>!nativeOutputSemantics.some(f=>f.id===`native.${e.field}`)).map((e:any)=>e.field);
 assert.deepEqual(absent.sort(),["result.trajectory[].nativeMt.*","result.trajectory[].sectorsGtCO2e.*"]);
 assert.equal(new Set(nativeOutputSemantics.map(f=>f.id)).size,nativeOutputSemantics.length);
});
test("three actual scenario builders bind all emitted leaves without probability claims",()=>{
 const inputs=resolveEmissionsInputs();
 for(const scenario of [constantScenario,illustrativeScenario,inputs.diagnostic]){
   const body={promotion:"blocked",inventory:candidateInventory(),inputs,result:projectNativeEmissions(scenario)};
   const definitions=bindNestedOutput("native",body);
   assert.equal(definitions.length,152);
   assert.equal(body.result.temperature,null);
   assert.ok(definitions.every(d=>d.uncertainty.includes("Deterministic")||d.uncertainty.includes("Deterministic".toLowerCase())||d.uncertainty.includes("no sampling")));
 }
 assert.deepEqual([...new Set(candidateInventory().cells.map(c=>c.gas))].sort(),[...nativeGasIds].sort());
 assert.throws(()=>bindNestedOutput("native",{result:{trajectory:[{nativeMt:{inventedGas:1}}]}}),/Unmapped/);
});
