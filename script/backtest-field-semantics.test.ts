import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { walkForward } from "../server/climateValuation/walkForward";
import { buildBacktestResponse } from "../shared/backtest";
import { bindNestedOutput, bindExportColumns, requireOutputSemantic } from "../shared/outputFieldSemantics";

test("actual walk-forward results bind both API formats without changing numeric payload",()=>{
  const monthly=new Map(Array.from({length:14},(_,i)=>[
    `${2020+Math.floor(i/12)}-${String(i%12+1).padStart(2,"0")}`,
    [{companyId:1,marketCap:100,monthlyReturn:i%2 ? 0.02 : -0.01},
      {companyId:2,marketCap:200,monthlyReturn:i%2 ? -0.01 : 0.03}],
  ]));
  const scores=new Map([...monthly.keys()].map(month=>[month,new Map([[1,1],[2,-1]])]));
  const actual=walkForward(monthly,scores,0.02,10);
  const response=buildBacktestResponse(actual.series,actual.annualizedTE,actual.lastTilt,
    "carbon_intensity","absolute",2,"expanding_past_only");
  response.summary.accounting=actual.accounting;
  const before=JSON.stringify(response);
  assert.equal(bindNestedOutput("backtest",response).length,34);
  assert.equal(bindNestedOutput("backtest",response.series).length,15);
  assert.equal(JSON.stringify(response),before);
  assert.ok(actual.series.slice(0,12).every(row=>row.tiltScale===0));
  assert.equal(actual.series[0].tradedNotional,1);
  assert.equal(actual.series[0].costFraction,0.001);
  assert.match(requireOutputSemantic("backtest.trackingError").formula,/denominator n/);
  assert.match(requireOutputSemantic("backtest.summary.accounting.totalCostFraction").meaning,/not compounded/);
  assert.throws(()=>bindNestedOutput("backtest",{series:[{unknown:1}]}),/Unmapped/);
});

test("unavailable and short histories bind explicit null/empty states",()=>{
  for(const series of [[],[{date:"2024-01",benchmarkReturn:0,portfolioReturn:0,
    benchmarkCumulative:1,portfolioCumulative:1,activeReturn:0,trackingError:0,overweightCount:0,underweightCount:0}]]) {
    const response=buildBacktestResponse(series,0,null,"sdg_exposure","absolute",2,"expanding_past_only");
    assert.ok(bindNestedOutput("backtest",response).length);
    assert.equal(response.summary.realizedTrackingErrorPct,null);
    assert.equal(response.summary.calibrationPeriod,null);
  }
});

test("download metadata validates exact selected dynamic labels and percent transformations",()=>{
  const rows=[{Date:"2024-01","Selected Portfolio Cumulative Return (%)":2}];
  const bound=bindExportColumns(rows,{
    Date:{id:"backtest.date",transform:"Identity UTC YYYY-MM"},
    "Selected Portfolio Cumulative Return (%)":{id:"backtest.portfolioCumulative",transform:"Math.round((wealth-1)*10000)/100"},
  });
  assert.equal(bound[1].unit,"wealth multiple");
  assert.match(bound[1].Transformation,/wealth-1/);
  assert.throws(()=>bindExportColumns(rows,{Date:{id:"backtest.date",transform:"Identity"}}),/Unmapped/);
  for(const page of ["decarb-signal","decarb-gap-signal"]) {
    const code=readFileSync(`client/src/pages/${page}.tsx`,"utf8");
    assert.match(code,/rows=\{cumulativeReturnDownloadRows\}\s+fieldBindings=/);
    assert.match(code,/rows=\{activeReturnDownloadRows\}\s+fieldBindings=/);
  }
});

test("49 original backtest slots close without denominator reduction or changing strict gate",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  const family=census.families.find((f:{surface:string})=>f.surface==='API GET "/api/cv/backtest"');
  assert.equal(family.total,49);
  assert.equal(family.bound,49);
  assert.deepEqual(family.unbound,[]);
  assert.equal(census.fullyBoundFields,586);
  assert.equal(census.comparableSlotAccounting.actualUniqueSlots,1028);
  assert.equal(census.originalGapReconciliation.closedOriginalSlots,157);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots,415);
  assert.equal(census.displayBindings.filter((b:{id:string})=>b.id.startsWith("backtest.")).length,15);
  assert.equal(census.completion,false);
});
