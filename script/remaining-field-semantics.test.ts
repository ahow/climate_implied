import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bindNestedOutput, bindExportColumns, requireOutputSemantic, outputFieldSemantics } from "../shared/outputFieldSemantics";
import { remainingApiBindings } from "../shared/remainingFieldSemantics";
import { nativePathwayGasIds } from "../shared/nativePathwaySemantics";
import { nativeInventory, validateNativePair } from "../server/calculation/nativePathwayContract";
import * as XLSX from "xlsx";
import ts from "typescript";
import { deriveSignalConsumer } from "../shared/derivedConsumer";
import { resolve } from "node:path";
import { resolveOriginalResponseAlias } from "./response-alias-resolution";

const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
test("134 original slots close; unknown historical summary remains unresolved without denominator changes",()=>{
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields,1000);
  assert.equal(census.originalGapReconciliation.closedOriginalSlots,571);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots,1);
  assert.equal(census.originalGapReconciliation.originalPublicSlots,1001);
  assert.equal(census.originalGapReconciliation.publicSlotDenominatorDelta,census.supplementalSlotAccounting.addedPublicSlots);
  assert.deepEqual(census.supplementalSlotAccounting.removedOriginalSlots,[]);
  assert.equal(census.withheldFields.length,27);
  assert.equal(census.resolvedResponseAliases.length,4);
  assert.equal(census.originalGapReconciliation.originalSlots.length,1028);
  for(const [surface,prefix] of remainingApiBindings) {
    const family=census.originalGapReconciliation.families.find((f:{surface:string})=>f.surface===surface);
    assert.ok(family,prefix);
    assert.deepEqual(family.unbound.filter((f:{resolution:string})=>f.resolution!=="withheld-public-field").map((f:{field:string})=>f.field),
       prefix==="fetchRuns"?["runs[].summary"]:[],prefix);
  }
  assert.equal(new Set(outputFieldSemantics.map(f=>f.id)).size,outputFieldSemantics.length);
  assert.equal(census.completion,false,"Supplemental display/custom-sheet/chained-response coverage is not fully verified");
});

test("four original cache aliases retain explicit provenance through the production response clone",()=>{
  const aliases=["projectionResultCache","categoryCacheResult","historicalTrendCacheResult","categoryHistoricalTrendCache"];
  assert.deepEqual(census.resolvedResponseAliases.map((a:{expression:string})=>a.expression).sort(),[...aliases].sort());
  for(const alias of census.resolvedResponseAliases) {
    assert.equal(alias.responseExpression,`detachProjectionCacheResponse(${alias.expression})`);
    assert.deepEqual(alias.transparentWrapper,{
      source:"server/calculation/projectionCacheResponse.ts",name:"detachProjectionCacheResponse",
    });
  }
  const fixturePath=resolve("script/__response_alias_resolution_fixture__.ts");
  const helperPath=resolve("server/calculation/projectionCacheResponse.ts");
  const fixture=`
    import { detachProjectionCacheResponse as clone } from "../server/calculation/projectionCacheResponse";
    declare const res: {json(value: unknown): void};
    ${[...aliases,"freshResult"].map(name=>`declare const ${name}: {value:number};`).join("\n")}
    ${aliases.map(name=>`res.json(${name}); res.json(clone(${name}));`).join("\n")}
    res.json(clone(freshResult));
    res.json(clone({projectionResultCache}));
    res.json(clone(projectionResultCache, categoryCacheResult));
    function detachProjectionCacheResponse<T>(value:T):T {return value;}
    res.json(detachProjectionCacheResponse(projectionResultCache));
  `;
  const run=(helper:string)=>{
    const options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler};
    const host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host);
    host.getSourceFile=(file,version,onError,newFile)=>
      resolve(file)===fixturePath||resolve(file)===helperPath
        ? ts.createSourceFile(file,resolve(file)===fixturePath?fixture:helper,ts.ScriptTarget.ES2022,true)
        : get(file,version,onError,newFile);
    const program=ts.createProgram([fixturePath],options,host),checker=program.getTypeChecker();
    const found:ReturnType<typeof resolveOriginalResponseAlias>[]=[];
    const visit=(node:ts.Node):void=>{
      if(ts.isCallExpression(node)&&node.expression.getText()==="res.json")
        found.push(resolveOriginalResponseAlias(node.arguments[0],checker));
      ts.forEachChild(node,visit);
    };
    visit(program.getSourceFile(fixturePath)!);
    return found;
  };
  const genuine=run(readFileSync(helperPath,"utf8"));
  assert.deepEqual(genuine.slice(0,8).map(a=>a?.expression),aliases.flatMap(name=>[name,name]));
  assert.ok(genuine.slice(8).every(a=>a===undefined),"Fresh values, changed arguments, arity and same-named local functions must not earn original alias credit");
  const transformed=run("export function detachProjectionCacheResponse<T>(value:T):T {return {changed:true} as T;}");
  assert.equal(transformed.filter(Boolean).length,4,"A transforming wrapper must not resolve; only the four direct aliases remain");
});

test("native pathway dynamic domains bind every gas/checkpoint and exclude 2024 from the cumulative sum",()=>{
  const baseline=nativeInventory();
  assert.deepEqual(Object.keys(baseline).sort(),nativePathwayGasIds);
  // Self-contained synthetic accounting fixture, not scientific pathway evidence.
  const pair=["implemented-policies","announced-commitments"].map(scenario=>({
    scenario,source:{url:"https://example.org/accounting-fixture",revision:"synthetic-test-only",
      policyCutoff:"2024-12",includesLongTermPledges:true,processingStage:"raw"},
    unit:"Mt gas/year",years:Array.from({length:77},(_,i)=>2024+i),
    gases:Object.fromEntries(Object.entries(baseline).map(([gas,value])=>[gas,
      Array.from({length:77},(_,i)=>i===0?value:i)])),
    infilling:{CH4:{method:"Synthetic accounting fixture only",evidence:"https://example.org/fixture",
      sensitivity:"No scientific sensitivity claimed"}},
  }));
  const before=JSON.stringify(pair),response=validateNativePair(pair);
  assert.equal(JSON.stringify(pair),before);
  const fields=bindNestedOutput("nativePathway",response);
  assert.ok(fields.length>100);
  assert.equal(response.scenarios[0].annualNative[2030].CH4,6);
  assert.equal(response.scenarios[0].cumulative2025Through2100Mt.CH4,76*77/2);
  assert.match(requireOutputSemantic("nativePathway.scenarios[].infilling.CH4.evidence").formula,/syntax only/);
  assert.throws(()=>bindNestedOutput("nativePathway",{scenarios:[{annualNative:{2030:{unexpected:1}}}]}),/Unmapped/);
  const bad=structuredClone(pair); bad[0].gases.unexpected=Array(77).fill(0);
  assert.throws(()=>validateNativePair(bad),/Missing or unexpected/);
  assert.ok(bindNestedOutput("nativePathway",validateNativePair(pair.map(p=>({...p,infilling:{}})))).length>100);
});

test("operational decisions bind actual proposal fields without treating approval as scientific acceptance",()=>{
  const proposal={id:"test",indicatorKey:"evSalesSharePct",year:2024,value:0,source:"test fixture",
    sourceUrl:null,asOfDate:null,method:"manual",status:"approved",rawContext:null,note:null,
    runId:null,createdAt:new Date(0),decidedAt:null};
  assert.equal(bindNestedOutput("indicatorProposal",proposal).length,14);
  assert.equal(proposal.value,0);
  assert.match(requireOutputSemantic("indicatorProposal.status").meaning,/not scientific acceptance/);
  assert.match(requireOutputSemantic("carbonGroups.topTercileEmissions").scope,/Legacy missing scopes/);
  assert.match(requireOutputSemantic("targetBands.bands[].label").formula,/unreachable/);
  assert.match(requireOutputSemantic("targetBands.weightedAvgDecarbRate").formula,/not market-cap weighted/);
  assert.match(requireOutputSemantic("targetTerciles.growthPremium").formula,/not difference of rounded/);
  // Chained res.set(...).json(...) snapshot success branch is supplemental:
  // actual response must bind, but its additional fields are not original closure.
  assert.equal(bindNestedOutput("snapshotList",{status:"available",nextCursor:null,items:[{
    id:"a".repeat(64),kind:"workbook-baseline",companyCount:1,observationCount:2,createdAt:new Date(0),
  }]}).length,7);
  assert.equal(bindNestedOutput("snapshotList",{status:"not-provisioned",items:[],nextCursor:null}).length,3);
});

test("new literal export bindings read back observed zero and null provenance without numeric invention",()=>{
  const row={Year:2024,"Value (%)":0,Type:"Sourced (observed)",Source:"fixture",Method:"manual","As Of Date":""};
  const bindings={
    Year:{id:"indicatorDetail.series[].year",transform:"Identity"},
    "Value (%)":{id:"indicatorDetail.series[].value",transform:"Identity; selected def.key"},
    Type:{id:"indicatorDetail.series[].isNowcast",transform:"false -> Sourced (observed)"},
    Source:{id:"indicatorDetail.series[].source",transform:"Identity"},
    Method:{id:"indicatorDetail.series[].method",transform:"Identity"},
    "As Of Date":{id:"indicatorDetail.series[].asOfDate",transform:"null -> empty text"},
  };
  assert.equal(bindExportColumns([row],bindings).length,6);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([row]),"Data");
  const decoded=XLSX.read(XLSX.write(wb,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
  assert.deepEqual(XLSX.utils.sheet_to_json(decoded.Sheets.Data),[row]);
  assert.ok(census.displayExpressionInventory.length>500);
  assert.ok(census.supplementalWorkbookInventory.some((b:{sheet:string})=>b.sheet==="Semantics"));
  assert.deepEqual(census.families.find((f:{surface:string})=>f.surface.includes("data-management.tsx")).unbound,[]);
  assert.equal(census.certifiedFiniteExports.find((s:{family:string})=>s.family==="indicatorDetail").domainCases.length,22);
});

test("actual conditional-spread export rows and bindings agree with comparison both off and on",()=>{
  const source=ts.createSourceFile("page.tsx",readFileSync("client/src/pages/decarb-gap-signal.tsx","utf8"),
    ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let rowsExpression="",bindingsExpression="";
  const visit=(node:ts.Node):void=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(source)==="cumulativeReturnDownloadRows")
      rowsExpression=node.initializer!.getText(source);
    if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(source)==="DownloadDataButton"&&
      node.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="filename"&&p.initializer?.getText(source)==='"backtest-cumulative-return"')) {
      const binding=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="fieldBindings") as ts.JsxAttribute;
      bindingsExpression=(binding.initializer as ts.JsxExpression).expression!.getText(source);
    }
    ts.forEachChild(node,visit);
  };
  visit(source);
  assert.ok(rowsExpression&&bindingsExpression);
  // Evaluate only these trusted, pure, checked-in production expressions:
  // no app/server/collector is started and no private data is read.
  const evaluate=(expression:string,points:object[],compare:boolean)=>{
    const consumer=deriveSignalConsumer([{series:[
      {date:"2024-01",benchmarkCumulative:.975,portfolioCumulative:null},
    ]},{series:[{date:"2024-01",benchmarkCumulative:1,portfolioCumulative:1}]}],
      "gap-cumulative","carbon_intensity");
    const js=ts.transpileModule(`const evaluate=(backtestChartData,compareGap,measureInfo,cumulativeConsumer)=>(${expression});`,
      {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
    return new Function(`${js};return evaluate;`)()(points,compare,{label:"Carbon Intensity"},consumer);
  };
  const points=[{date:"2024-01",benchmark:-2.5,portfolio:undefined,valuation:0}];
  for(const compare of [false,true]) {
    const rows=evaluate(rowsExpression,points,compare);
    const bindings=evaluate(bindingsExpression,points,compare);
    const metadata=bindExportColumns(rows,bindings);
    assert.equal(metadata.length,compare?4:3);
    assert.equal(Object.hasOwn(rows[0],"Legacy peer-yield ranking cumulative return (%)"),compare);
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Actual");
    const decoded=XLSX.read(XLSX.write(wb,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
    const roundtrip=XLSX.utils.sheet_to_json<Record<string,unknown>>(decoded.Sheets.Actual,{defval:null})[0];
    assert.equal(roundtrip["Benchmark Cumulative Return (%)"],-2.5);
    assert.equal(roundtrip["Carbon Intensity-Driven Cumulative Return (%)"],null);
    if(compare) assert.equal(roundtrip["Legacy peer-yield ranking cumulative return (%)"],0);
  }
});
