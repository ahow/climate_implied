import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { semanticsCompletionGateError,type SemanticsGateEvidence } from "./field-semantics-gates";
import ts from "typescript";
import * as XLSX from "xlsx";
import * as finite from "../shared/finiteExportSchemas";
import { requireHistoricalType, revisedHistoryType } from "../shared/historicalTypes";
import { indicatorFieldSpecs } from "../shared/indicatorFieldSemantics";
import { bindExportColumns,bindNestedOutput,requireOutputSemantic } from "../shared/outputFieldSemantics";
import { describePersistedSummary,bindKnownPersistedSummary,FETCH_SUMMARY_CONTRACT } from "../server/dataIngestion/summaryContract";
import { BAND_LABELS,getBandIndex,getBandMidpoint } from "../server/climateValuation/decarbBandCalculator";
import { INDICATORS as serverRegistry } from "../server/dataIngestion/indicatorRegistry";

const sources={
  categoryTrend:["client/src/components/category-trend-chart.tsx","downloadRows"],
  indicatorCards:["client/src/components/indicator-cards.tsx","downloadRows"],
  valuationPE:["client/src/pages/climate-valuation.tsx","peDownloadRows"],
  indicatorDetail:["client/src/pages/data-management.tsx","downloadRows"],
  groupGap:["client/src/pages/decarb-gap-signal.tsx","timeseriesDownloadRows"],
  signalCumulative:["client/src/pages/decarb-signal.tsx","cumulativeReturnDownloadRows"],
} as const;
function source(path:string) {
  return ts.createSourceFile(path,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
}
function walk(node:ts.Node,visit:(n:ts.Node)=>void) {visit(node);ts.forEachChild(node,n=>walk(n,visit));}
function expressions(family:finite.FiniteExportFamily) {
  const [path,variable]=sources[family],file=source(path);
  let row="",bindings="";
  walk(file,node=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(file)===variable) row=node.initializer!.getText(file);
    if((ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node))&&node.tagName.getText(file)==="DownloadDataButton") {
      const attrs=node.attributes.properties;
      if(!attrs.some(p=>ts.isJsxAttribute(p)&&p.name.getText(file)==="rows"&&p.initializer?.getText(file)===`{${variable}}`)) return;
      const binding=attrs.find(p=>ts.isJsxAttribute(p)&&p.name.getText(file)==="fieldBindings") as ts.JsxAttribute;
      bindings=(binding.initializer as ts.JsxExpression).expression!.getText(file);
    }
  });
  assert.match(row,/^certifyFiniteExport\(/,path);
  assert.match(bindings,/^finiteExportBindings\(/,path);
  return {row,bindings,file};
}
/** Only trusted checked-in pure expressions are evaluated. No hooks, app,
 * database reads, network, private fixture or UI interaction is involved. */
function evaluate(expression:string,context:Record<string,unknown>) {
  context = { producerPayload: undefined, producerDerivation: undefined, ...context };
  const js=ts.transpileModule(`const value=(${expression});`,{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},
  }).outputText;
  return new Function(...Object.keys(context),`${js};return value;`)(...Object.values(context));
}
function productionFormatter(file:ts.SourceFile,name:string) {
  let expression="";
  walk(file,node=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name) expression=node.initializer!.getText(file);
    if(ts.isFunctionDeclaration(node)&&node.name?.text===name) expression=node.getText(file).replace(/^export\s+/,"");
  });
  assert.ok(expression,name);
  return evaluate(expression,{indicatorFieldSpecs});
}
function productionInitializer(file:ts.SourceFile,name:string) {
  let expression="";
  walk(file,node=>{
    if(ts.isVariableDeclaration(node)&&node.name.getText(file)===name) expression=node.initializer!.getText(file);
  });
  assert.ok(expression,name);
  return expression;
}
function valuationCases(file:ts.SourceFile) {
  const cases:Record<string,Record<string,string>>={};
  walk(file,node=>{
    if(!ts.isJsxSelfClosingElement(node)||node.tagName.getText(file)!=="AnalysisSection") return;
    const attrs=node.attributes.properties;
    const prefix=attrs.find(p=>ts.isJsxAttribute(p)&&p.name.getText(file)==="testIdPrefix") as ts.JsxAttribute;
    const chart=attrs.find(p=>ts.isJsxAttribute(p)&&p.name.getText(file)==="peChart") as ts.JsxAttribute;
    const key=(prefix.initializer as ts.StringLiteral).text;
    const object=(chart.initializer as ts.JsxExpression).expression as ts.ObjectLiteralExpression;
    cases[key]=Object.fromEntries(object.properties.flatMap(p=>
      ts.isPropertyAssignment(p)&&ts.isIdentifier(p.name)&&ts.isStringLiteral(p.initializer)?
        [[p.name.text,p.initializer.text]]:[]));
  });
  assert.deepEqual(Object.keys(cases).sort(),["ambition","carbon","sdg"]);
  return cases;
}
function normalize(row:Record<string,unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value??null]));
}

test("all35 finite-domain cases execute ACTUAL production row builders and bindings with XLSX readback",()=>{
  const cases=finite.finiteExportDomainCases();
  assert.equal(cases.length,35);
  const covered=new Set<string>();
  for(const c of cases) {
    const {row,bindings,file}=expressions(c.family);
    const context:Record<string,unknown>={...finite,requireHistoricalType};
    switch(c.family) {
      case "categoryTrend": {
        context.CATEGORY_KEYS=finite.categoryExportKeys;
        context.CATEGORY_NAMES=finite.categoryExportNames;
        context.config={metricKey:c.settings.metric};
        context.data=[{year:2024,isNowcast:false,...revisedHistoryType,...Object.fromEntries(finite.categoryExportKeys.map((key,i)=>
          [key,{median:i===0?null:1.5,reductionRate:0,netZeroYear:i===0?null:2050}]))}];
        break;
      }
      case "indicatorCards": {
        const configured:string[]=[];
        walk(file,node=>{
          if(ts.isVariableDeclaration(node)&&node.name.getText(file)==="CARD_CONFIG"&&node.initializer&&ts.isArrayLiteralExpression(node.initializer))
            for(const item of node.initializer.elements) if(ts.isObjectLiteralExpression(item)) {
              const property=item.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(file)==="key") as ts.PropertyAssignment;
              configured.push((property.initializer as ts.StringLiteral).text);
            }
        });
        assert.deepEqual(configured.slice().sort(),indicatorFieldSpecs.map(s=>s[0]).sort());
        context.INDICATORS=indicatorFieldSpecs.map(([key])=>({key}));
        context.historicalData=[{year:2024,isNowcast:true,...Object.fromEntries(indicatorFieldSpecs.map(([key],i)=>
          [key,i===0?0:key==="evGrowthRate"?undefined:.125]))}];
        break;
      }
      case "valuationPE": {
        const chart=valuationCases(file)[c.settings.case!];
        context.testIdPrefix=c.settings.case;
        context.peChart=chart;
        context.formatTooltipDate=productionFormatter(file,"formatTooltipDate");
        context.chartData=[
          {date:Date.UTC(2024,0,1),[chart.highKey]:12.34,[chart.lowKey]:undefined},
          {date:Date.UTC(2024,1,1),[chart.highKey]:0,[chart.lowKey]:-1},
        ];
        context.isLoading=false;
        context.error=null;
        context.roundedPE=productionFormatter(file,"roundedPE");
        context.currentRows=evaluate(productionInitializer(file,"currentRows"),context);
        break;
      }
      case "indicatorDetail": {
        context.def=serverRegistry.find(def=>def.key===c.settings.key);
        context.series=[{year:2024,value:0,isNowcast:false,source:"Synthetic engineering fixture",
          method:"manual",asOfDate:null}];
        const availability=productionFormatter(file,"indicatorDetailAvailability")({def:context.def,series:context.series,proposals:[]});
        assert.equal(availability.hasDefinition,true,"Actual registered definition must pass the actual presentation guard");
        context.hasDefinition=availability.hasDefinition;
        context.series=availability.usableSeries;
        break;
      }
      case "groupGap":
        context.measure=c.settings.measure;
        context.formatDateLabel=productionFormatter(file,"formatDateLabel");
        context.chartData=[{date:Date.UTC(2024,0,1),impliedRate:0},{date:Date.UTC(2024,1,1),impliedRate:null},
          {date:Date.UTC(2024,2,1),impliedRate:-2.5}];
        break;
      case "signalCumulative":
        context.backtestSignal=c.settings.signal;
        context.backtestChartData=[{date:"2024-01",benchmark:-2.5,portfolio:undefined},
          {date:"2024-02",benchmark:0,portfolio:0}];
        break;
    }
    const rows=evaluate(row,context) as Record<string,unknown>[];
    const actualBindings=evaluate(bindings,context);
    const metadata=bindExportColumns(rows,actualBindings);
    assert.deepEqual(actualBindings,finite.finiteExportBindings(c.family,c.settings));
    assert.ok(metadata.every(m=>m.formula&&m.unit&&m.id));
    const book=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),"Actual production rows");
    XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(metadata.map(m=>({...m,dependencies:m.dependencies.join(",")}))),"Bindings");
    const decoded=XLSX.read(XLSX.write(book,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
    assert.deepEqual(XLSX.utils.sheet_to_json(decoded.Sheets["Actual production rows"],{defval:null}),rows.map(normalize),c.family);
    assert.equal(XLSX.utils.sheet_to_json(decoded.Sheets.Bindings).length,Object.keys(actualBindings).length);
    if(c.family==="indicatorCards") {
      assert.equal(rows[0][finite.indicatorExportColumn("renewableCapacityGW")],0);
      assert.equal(rows[0][finite.indicatorExportColumn("renewableGrowthRate")],.125,"Fraction must not be multiplied100");
      assert.match(finite.indicatorExportColumn("renewableGrowthRate"),/fraction\/year/);
    }
    if(c.family==="indicatorDetail") assert.equal(rows[0][finite.indicatorValueColumn(c.settings.key)],0);
    covered.add(c.family);
  }
  assert.equal(covered.size,6);
});
test("actual valuation and indicator export preparation withholds pending/error/missing-evidence rows without zero substitution",()=>{
  const {row,file}=expressions("valuationPE");
  const chart=valuationCases(file).carbon;
  const base={
    ...finite,testIdPrefix:"carbon",peChart:chart,formatTooltipDate:productionFormatter(file,"formatTooltipDate"),
    roundedPE:productionFormatter(file,"roundedPE"),chartData:[{date:0,[chart.highKey]:null,[chart.lowKey]:0},{date:NaN,[chart.highKey]:5,[chart.lowKey]:6}],
    isLoading:false,error:null,
  };
  for(const state of [{isLoading:true},{error:new Error("engineering-read-refusal")}]) {
    const context={...base,...state};
    const currentRows=evaluate(productionInitializer(file,"currentRows"),context);
    assert.deepEqual(evaluate(row,{...context,currentRows}),[]);
  }
  const currentRows=evaluate(productionInitializer(file,"currentRows"),base);
  const ready=evaluate(row,{...base,currentRows});
  assert.equal(ready.length,1,"No date is inferred for the invalid-date observation");
  assert.equal(ready[0][`${chart.highLabel} P/E (x)`],undefined,"Null P/E never becomes zero");
  assert.equal(ready[0][`${chart.lowLabel} P/E (x)`],0,"Explicit zero P/E remains zero");
  const detail=expressions("indicatorDetail");
  const def=serverRegistry[0];
  const series=[{year:2024,value:0,isNowcast:false,source:"Synthetic engineering fixture",method:"manual",asOfDate:null}];
  assert.deepEqual(evaluate(detail.row,{...finite,def,series,hasDefinition:false}),[],"Missing label/unit definition cannot export unlabeled values");
});

test("finite schemas reject unknown cases/keys, duplicate indicators and every row-level mismatch",()=>{
  assert.throws(()=>finite.finiteExportBindings("indicatorDetail",{}),/Unknown indicator export key: undefined/);
  for(const [family,settings] of [
    ["categoryTrend",{metric:"new-unsupported-metric"}],["indicatorCards",{keys:["unregistered"]}],
    ["indicatorCards",{keys:["evGrowthRate","evGrowthRate"]}],["valuationPE",{case:"other"}],
    ["indicatorDetail",{key:"unregistered"}],["groupGap",{measure:"other"}],["signalCumulative",{signal:"other"}],
  ] as [finite.FiniteExportFamily,finite.FiniteExportSettings][])
    assert.throws(()=>finite.finiteExportBindings(family,settings));
  const settings={signal:"carbon_intensity"};
  const rows=[{Date:"2024-01","Benchmark Cumulative Return (%)":0,
    "Carbon Intensity Portfolio Cumulative Return (%)":0}];
  assert.equal(finite.certifyFiniteExport("signalCumulative",rows,settings),rows);
  assert.throws(()=>finite.certifyFiniteExport("signalCumulative",[{...rows[0],extra:1}],settings),/mismatch/);
  assert.throws(()=>finite.certifyFiniteExport("signalCumulative",[rows[0],{Date:"2024-02"}],settings),/mismatch/);
  assert.throws(()=>finite.certifyFiniteExport("signalCumulative",[{...rows[0],"Benchmark Cumulative Return (%)":Infinity}],settings),/Invalid/);
  assert.throws(()=>finite.certifyFiniteExport("signalCumulative",[{...rows[0],"Benchmark Cumulative Return (%)":"0"}],settings),/Invalid/);
  assert.throws(()=>finite.certifyFiniteExport("signalCumulative",[{...rows[0],Date:"2024-13"}],settings),/Invalid/);
  assert.throws(()=>finite.certifyFiniteExport("signalCumulative",[{...rows[0],"Benchmark Cumulative Return (%)":{invented:1}}],settings),/Invalid/);
});

test("actual runs handler preserves every raw summary JSON value; optional known-producer interpretation never replaces it",async()=>{
  const input={perAdapter:[{id:"zero-rows",values:0},{id:"failed",values:0,error:"Synthetic fixture"}],error:"Outer fixture"};
  const original=JSON.stringify(input),envelope=describePersistedSummary(input);
  assert.equal(JSON.stringify(input),original);
  assert.equal(envelope.contract,FETCH_SUMMARY_CONTRACT);
  assert.equal(envelope.availability,"available");
  assert.deepEqual(envelope.claims,input);
  assert.equal(envelope.claims.perAdapter[0].values,0);
  assert.equal(envelope.provenance,"unverified","Matching JSON shape alone does not establish producer provenance");
  assert.deepEqual(bindKnownPersistedSummary(input),[]);
  assert.equal(describePersistedSummary({perAdapter:[]}).availability,"available");
  const historical=[null,0,false,"old format",[],{}, {perAdapter:[],extra:"unrecognised"},
    {perAdapter:[{id:"x",values:-1}]},{perAdapter:[{id:"x",values:.5}]},
    {perAdapter:[{id:"",values:0}]},{perAdapter:[{id:"x",values:0,unexpected:true}]}];
  for(const unknown of historical) {
    const before=JSON.stringify(unknown),result=describePersistedSummary(unknown);
    assert.equal(JSON.stringify(unknown),before);
    assert.equal(result.availability,"unavailable");
    assert.equal(result.claims,null);
    assert.match(result.reason,/raw JSON remains available unchanged/);
    assert.deepEqual(bindKnownPersistedSummary(unknown),[]);
  }
  assert.equal(describePersistedSummary(undefined).availability,"unavailable");
  const opaqueArchiveText=' { "legacy": true, "spacing": " preserved " } \n';
  const archivedBytes=Buffer.from(opaqueArchiveText,"utf8");
  assert.equal(describePersistedSummary(opaqueArchiveText).availability,"unavailable");
  assert.deepEqual(Buffer.from(opaqueArchiveText,"utf8"),archivedBytes,"Opaque archived text bytes are never rewritten");
  assert.match(requireOutputSemantic("fetchRuns.runs[].summary").unit,/retained JSON value/);
  const ui=source("client/src/pages/data-management.tsx");
  let labelExpression="";
  walk(ui,node=>{
    if(ts.isFunctionDeclaration(node)&&node.name?.text==="runSummaryClaimLabel") labelExpression=node.getText(ui);
  });
  const label=evaluate(labelExpression,{describePersistedSummary});
  assert.match(label(input),/Schema-compatible.*unverified/);
  assert.match(label({legacy:"unrecognised"}),/unavailable.*raw.*unchanged/);
  assert.match(label("invalid JSON"),/unavailable.*raw.*unchanged/);
  const file=readFileSync("server/routes.ts","utf8");
  assert.doesNotMatch(file,/serializePersistedSummary|X-Summary-Contract|summary:\s*JSON\.stringify/);
  const runs=[input,...historical,opaqueArchiveText].map((summary,i)=>({id:String(i),summary}));
  let handlerExpression="";
  const routes=source("server/routes.ts");
  walk(routes,node=>{
    if(ts.isCallExpression(node)&&node.expression.getText(routes)==="app.get"&&
      node.arguments[0]?.getText(routes)==='"/api/data/runs"') handlerExpression=node.arguments[1].getText(routes);
  });
  const handler=evaluate(handlerExpression,{getRecentRuns:async(limit:number)=>{
    assert.equal(limit,10);return runs;
  },loadFetchSummaryEvidence:async(selected:typeof runs)=>{
    assert.strictEqual(selected,runs);
    return Object.fromEntries(runs.map(run=>[run.id,{
      availability:"unverified",manifestId:null,manifest:null,reason:"No prospective fixture manifest",
    }]));
  }});
  let wire:{runs:typeof runs}|undefined;
  await handler({}, {json:(body:{runs:typeof runs})=>{wire=body;}});
  assert.strictEqual(wire!.runs,runs,"Actual production handler forwards the original run array unchanged");
  for(let i=0;i<runs.length;i++) assert.strictEqual(wire!.runs[i].summary,runs[i].summary);
  assert.deepEqual(JSON.parse(JSON.stringify(wire)).runs.map((r:{summary:unknown})=>r.summary),
    runs.map(r=>r.summary),"Every unknown historical JSON value survives actual response serialization");
  assert.doesNotMatch(readFileSync("server/dataIngestion/summaryContract.ts","utf8"),/db\.(update|delete|insert)|UPDATE indicator/i);
});

test("134 of135 original gaps close; raw opaque summary stays unresolved and both strict gates still fail",()=>{
  const c=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
   const signatures=c.originalGapReconciliation.originalSlots.map((e:{key:string})=>e.key).sort();
  assert.equal(signatures.length,1028);
  assert.equal(createHash("sha256").update(JSON.stringify(signatures)).digest("hex"),
    "34c22e5313d2db68748af9576beb7d72c6b1817f2aa9c1ad77aa9866e1d92f79","Frozen40c524b original slot identities, not merely equal totals");
   assert.equal(c.originalGapReconciliation.originalFullyBoundFields,1000);
  assert.equal(c.originalGapReconciliation.closedOriginalSlots,571);
  assert.equal(c.originalGapReconciliation.remainingOriginalUnboundSlots,1);
   assert.equal(c.originalGapReconciliation.publicSlotDenominatorDelta,c.supplementalSlotAccounting.addedPublicSlots);
   assert.deepEqual(c.supplementalSlotAccounting.removedOriginalSlots,[]);
  assert.equal(c.originalGapReconciliation.originalCohortComplete,false);
  assert.equal(c.withheldFields.length,27);
  assert.equal(c.resolvedResponseAliases.length,4);
  assert.equal(c.certifiedFiniteExports.length,6);
  assert.equal(c.supplementalSummaryProducerDefinitions.length,5);
  assert.equal(c.certifiedFiniteExports.reduce((n:number,s:{domainCases:unknown[]})=>n+s.domainCases.length,0),35);
  assert.deepEqual(c.unresolvedTypes.map((e:{field:string})=>e.field),["runs[].summary"]);
  assert.deepEqual(c.unresolvedDynamicKeys,[]);
  assert.equal(c.completion,false,"Broader displays/custom sheets/chained branches are NOT claimed complete");
  assert.match(c.supplementalConcreteExportChanges.indicatorCardColumns,/eight newly concrete/);
  const evidence:SemanticsGateEvidence={
    baseline:false,closedOriginalSlots:c.originalGapReconciliation.closedOriginalSlots,
     fullyBoundFields:c.originalGapReconciliation.originalFullyBoundFields,publicSlots:c.originalGapReconciliation.originalPublicSlots,
    slotFingerprint:c.originalGapReconciliation.slotIdentityFingerprint,
    frozenOriginalSlotFingerprint:c.originalGapReconciliation.frozenOriginalSlotFingerprint,
    resolvedResponseAliases:c.resolvedResponseAliases.length,withheldFields:c.withheldFields.length,
  };
  assert.equal(evidence.publicSlots,1001);
  assert.equal(semanticsCompletionGateError("--require-original-complete",evidence),
    "Original cohort incomplete or original slot identity/alias/withholding contract changed");
  assert.match(semanticsCompletionGateError("--require-complete",evidence)!,/SEMANTICS INCOMPLETE: 1000\/1001/);
  const originalComplete={...evidence,closedOriginalSlots:572,fullyBoundFields:1001};
  assert.equal(semanticsCompletionGateError("--require-original-complete",originalComplete),null);
  assert.match(semanticsCompletionGateError("--require-complete",originalComplete)!,/supplemental.*not verified/);
  for(const mutation of [
    {baseline:true},{closedOriginalSlots:571},{fullyBoundFields:1000},
    {slotFingerprint:"changed"},{resolvedResponseAliases:3},{withheldFields:26},
  ]) assert.ok(semanticsCompletionGateError("--require-original-complete",{...originalComplete,...mutation}));
});

test("registry-derived22 counts and honest band labels do not change any numeric band assignment or representative",()=>{
  assert.equal(indicatorFieldSpecs.length,22);
  assert.deepEqual(serverRegistry.map(s=>s.key).sort(),indicatorFieldSpecs.map(s=>s[0]).sort());
  for(const path of ["client/src/pages/dashboard.tsx","client/src/pages/methodology.tsx","client/src/components/driver-evidence-disclosure.tsx"])
    assert.match(readFileSync(path,"utf8"),/indicatorFieldSpecs\.length/);
  assert.doesNotMatch(readFileSync("client/src/pages/dashboard.tsx","utf8"),/20 real-world indicators/);
  assert.match(readFileSync("server/dataIngestion/indicatorRegistry.ts","utf8"),/export const INDICATORS:IndicatorDef\[\]=indicatorFieldSpecs\.map/);
  assert.match(readFileSync("client/src/components/indicator-cards.tsx","utf8"),/const INDICATORS:IndicatorConfig\[\]=indicatorFieldSpecs\.map/);
  assert.doesNotMatch(readFileSync("client/src/pages/data-management.tsx","utf8"),/data\?\.indicators\?\.length \?\? 0/);
  for(const [rate,index] of [[-2,0],[0,0],[.99,0],[1,1],[2,2],[3,3],[4,4],[5,5],[7,6],[9.99,6],[10,8],[20,8]])
    assert.equal(getBandIndex(rate),index);
  assert.deepEqual(Array.from({length:9},(_,i)=>getBandMidpoint(i)),[0,1.5,2.5,3.5,4.5,6,8.5,11.5,12]);
  assert.match(BAND_LABELS[0],/<1%.*0%/);
  assert.match(BAND_LABELS[7],/Unused/);
  assert.match(BAND_LABELS[8],/12%/);
   const dashboard=readFileSync("client/src/pages/dashboard.tsx","utf8");
   assert.match(dashboard,/Year emissions reach 5% of 2024/);
   assert.match(dashboard,/same selected trajectory's evidenced 2024 baseline/);
   assert.match(dashboard,/separate fixed-5gt-v1 legacy comparator is not 5% of 2024/);
   assert.match(dashboard,/Neither residual diagnostic is net zero/);
  assert.match(readFileSync("client/src/pages/methodology.tsx","utf8"),/5% residual is not physical net zero/);
});
