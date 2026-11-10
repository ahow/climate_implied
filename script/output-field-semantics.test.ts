import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { outputFieldSemantics,bindOutputFields,requireOutputSemantic,bindExportColumns,bindNestedOutput } from "../shared/outputFieldSemantics";
import * as XLSX from "xlsx";
import { indicatorFieldSpecs } from "../shared/indicatorFieldSemantics";
test("all historical/category response leaves bind, without treating reconstructions as issued forecasts",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  for(const [path,prefix,count,originalCount] of [["/api/projection/categories","category",33,15],["/api/projection/historical-trend","historical",25,7],["/api/projection/categories/historical-trend","categoryHistory",149,23]] as const) {
    const fields=census.fields.filter((e:any)=>e.surface.includes(`"${path}"`)&&e.field.startsWith("[]."));
    assert.equal(fields.length,count);
    assert.equal(census.originalGapReconciliation.families.find((f:any)=>f.surface===`API GET "${path}"`).total,originalCount);
    for(const field of fields) assert.ok(requireOutputSemantic(`${prefix}.${field.field.slice(3)}`));
  }
});
test("all declared global projection leaf fields bind, including nested quantiles and metadata",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const fields=census.fields.filter((e:any)=>e.surface.includes('"/api/projection"')&&e.field!=="$");
  assert.ok(fields.length>60);
  for(const field of fields) assert.ok(requireOutputSemantic(`projection.${field.field}`),field.field);
  assert.throws(()=>bindNestedOutput("projection",{metrics:{unknown:0}}),/Unmapped/);
  assert.throws(()=>bindNestedOutput("projection",{unknown:[]}),/Unmapped/);
  assert.throws(()=>bindNestedOutput("projection",{unknown:{}}),/Unmapped/);
  const paths=bindNestedOutput("projection",{metrics:{netZeroYear:null},emissionsTrajectory:[{year:2026,p50:1},{year:2027,p50:2}]});
  assert.equal(paths.length,3);
});
test("all sensitivity response fields bind; bracket medians must not masquerade as calibrated quantiles",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const fields=census.fields.filter((e:any)=>e.surface.includes('"/api/projection/sensitivity"')&&e.field.startsWith("[]."));
  assert.equal(fields.length,10);
  for(const field of fields) assert.ok(requireOutputSemantic(`sensitivity.${field.field.slice(3)}`));
  const ui=readFileSync("client/src/components/sensitivity-chart.tsx","utf8");
  assert.ok(!ui.includes("Low Scenario P10"));
  assert.match(requireOutputSemantic("sensitivity.p10Temperature").formula,/min\(/);
});
import { calculateTemperatureDistribution,getTemperatureStats } from "../server/calculation/forwardProjection";
test("all regional response fields bind with explicit PPP/nominal and nonregional-warming qualifications",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const fields=census.fields.filter((e:any)=>e.surface.includes('"/api/projection/regions"')&&e.field.startsWith("[]."));
  assert.equal(fields.length,28);
  assert.equal(census.originalGapReconciliation.families.find((f:any)=>f.surface==='API GET "/api/projection/regions"').total,10);
  for(const field of fields) assert.ok(requireOutputSemantic(`regional.${field.field.slice(3)}`));
  assert.match(requireOutputSemantic("regional.carbonIntensityBasis").meaning,/not interchangeable/);
  assert.match(requireOutputSemantic("regional.netZeroYear").meaning,/NOT net zero/);
});
test("missing or invalid temperature inputs cannot manufacture zero summaries or NaN densities",()=>{
  assert.throws(()=>calculateTemperatureDistribution([]),/requires/);
  assert.throws(()=>getTemperatureStats([],[]),/requires/);
  const row={year:2100,emissions:0,p10:0,p25:0,p50:0,p75:0,p90:0,cumulativeEmissions:1};
  assert.throws(()=>calculateTemperatureDistribution([row],0),/positive/);
  assert.throws(()=>calculateTemperatureDistribution([row],10,NaN),/positive/);
  assert.throws(()=>getTemperatureStats([],[{...row,cumulativeEmissions:NaN}]),/requires/);
});
test("all 22 retained indicator inputs plus row metadata bind; documented clamps equal existing code",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const fields=census.fields.filter((e:any)=>e.surface.includes('"/api/indicators/historical"')&&e.field.startsWith("[]."));
  assert.equal(fields.length,24);
  for(const field of fields) assert.ok(requireOutputSemantic(`indicator.${field.field.slice(3)}`));
  const source=readFileSync("server/calculation/historicalIndicators.ts","utf8");
  assert.ok(source.includes("const fitWindow = 3"));
  assert.ok(source.includes("decayRate: number = 0.5"));
  assert.ok(source.includes("Math.pow(1 - decayRate, y)"));
  for(const [key,,,,lo,hi] of indicatorFieldSpecs) assert.ok(source.includes(`${key}: [${lo}, ${hi}]`),key);
});
test("qualified field IDs and exact export transforms survive XLSX; unknown columns fail",()=>{
  const rows=bindExportColumns([{Date:"Jan 2024",PE:12}],{
    Date:{id:"sdg.date",transform:"ISO date to month/year label"},PE:{id:"sdg.cleanPE",transform:"Identity"},
  }).map(row=>({...row,dependencies:row.dependencies.join(", ")}));
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Bindings");
  const restored=XLSX.read(XLSX.write(wb,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets.Bindings),rows);
  assert.throws(()=>bindExportColumns([{Unknown:0}],{}),/Unmapped/);
});
test("API and download type census must be regenerated when source fields change",()=>{
  execFileSync(process.execPath,["--import","tsx","script/field-semantics-census.ts","--check"],{stdio:"pipe",timeout:60000});
});
test("every actual typed SDG response field has a complete qualified definition",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const fields=census.fields.filter((e:any)=>e.surface.includes('"/api/cv/sdg-growth"')&&e.field.startsWith("[].")&&e.resolution==="typed-field");
  assert.equal(fields.length,14);
  assert.equal(census.originalGapReconciliation.families.find((f:any)=>f.surface==='API GET "/api/cv/sdg-growth"').bound,11);
  for(const entry of fields) {
    const semantic=requireOutputSemantic(`sdg.${entry.field.slice(3)}`);
    for(const key of ["meaning","formula","unit","source","period","geography","status","missingness","uncertainty","scope","asOfRule"] as const)
      assert.ok(semantic[key].trim(),`${semantic.id}: missing ${key}`);
  }
  assert.throws(()=>bindOutputFields("sdg",[{inventedOutput:0}]),/Unmapped/);
  assert.equal(new Set(outputFieldSemantics.map(f=>f.id)).size,outputFieldSemantics.length);
});
test("every actual typed PE comparison field is bound, with exact aggregate rather than mean semantics",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const fields=census.fields.filter((e:any)=>e.surface.includes('"/api/cv/pe-comparison"')&&e.field.startsWith("[].")&&e.resolution==="typed-field");
  assert.equal(fields.length,10);
  for(const field of fields) assert.ok(requireOutputSemantic(`pe.${field.field.slice(3)}`));
  assert.match(requireOutputSemantic("pe.topTercileAvgPE").meaning,/not mean/);
});
test("threshold semantics never substitute an arbitrary future date or physical net zero",()=>{
  assert.ok(!readFileSync("client/src/components/category-comparison.tsx","utf8").includes('"Net-Zero Year"'));
  assert.ok(!readFileSync("client/src/pages/methodology.tsx","utf8").includes("The net zero year is the year when cumulative emission reductions reach 95%"));
  const semantic=requireOutputSemantic("legacy.threshold5GtYear");
  assert.match(semantic.meaning,/NOT net zero/);
  assert.match(semantic.missingness,/never replace with 2200/);
  for(const file of ["historical-trend-chart","category-trend-chart"]) {
    const text=readFileSync(`client/src/components/${file}.tsx`,"utf8");
    assert.equal(text.includes("value = 2200"),false);
    assert.equal(text.includes("netZeroYear || 2200"),false);
  }
});
