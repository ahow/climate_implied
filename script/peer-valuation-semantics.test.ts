import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { CvCompany, CvTimeSeries } from "../shared/schema";
import { verifiedSyntheticImpliedRates as computePerCompanyImpliedDecarbRates, verifiedSyntheticGapScores as computeDecarbGapScores } from "./fixtures/verifiedSyntheticMoney";
import { verifiedSyntheticPE as positivePE } from "./fixtures/verifiedSyntheticMoney";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { bindNestedOutput, bindOutputFields, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { gordonBaselinePct, displayDiagnostic } from "../client/src/lib/valuation-claims";

test("peer definitions match actual positive-PE precedence, median, tie ranks and singleton handling",()=>{
  const companies=[1,2,3,4].map(id=>({id,name:`Test ${id}`,sector:id===4?"Singleton":"Peer"})) as CvCompany[];
  const rows=new Map(companies.map(c=>[c.id,{companyId:c.id,priceEarnings:c.id===3?null:20,marketCap:100,netProfit:5} as CvTimeSeries]));
  const actual=computePerCompanyImpliedDecarbRates(companies,rows,"sector_relative",0.08);
  assert.equal(actual.length,4);
  assert.ok(actual.every(r=>Math.abs(r.impliedGrowth-0.03)<1e-12 && r.impliedDecarbRate===0));
  assert.deepEqual([...computeDecarbGapScores(companies,rows,0,"sector_relative")],[[1,-1],[2,0],[3,1],[4,0]]);
  assert.equal(positivePE({priceEarnings:10,marketCap:100,netProfit:5}),10);
  assert.equal(positivePE({priceEarnings:-1,marketCap:100,netProfit:5}),20);
  assert.equal(positivePE({priceEarnings:null,marketCap:100,netProfit:0}),null);
  assert.match(requireOutputSemantic("peerValuation.topCompanies[].score").formula,/n-1/);
  assert.match(requireOutputSemantic("peerValuation.positiveSignalCount").meaning,/NOT positive score/);
  assert.match(requireOutputSemantic("peerValuation.topCompanies[].peerMedianGrowth").formula,/even n/);
});

test("actual filtered summary shape binds only public descriptive leaves without mutation",()=>{
  const company={companyId:1,companyName:"Test",sector:null,subSector:null,industry:null,pe:20,
    impliedGrowth:0.03,peerMedianGrowth:0.03,score:0,gap:0,impliedDecarbRate:0};
  const raw={companyCount:1,positiveSignalCount:0,negativeSignalCount:0,projectedRate:0,
    medianImpliedRate:0,meanImpliedRate:0,distribution:[{bucket:"test",count:1,midpoint:0}],
    topCompanies:[company],bottomCompanies:[company]};
  const filtered=publicValuationResult(raw,true);
  const before=JSON.stringify(filtered);
  assert.equal(bindNestedOutput("peerValuation",filtered).length,21);
  assert.equal(JSON.stringify(filtered),before);
  assert.throws(()=>bindNestedOutput("peerValuation",raw),/Unmapped/);
  assert.equal(bindNestedOutput("peerValuation",{companyCount:0,positiveSignalCount:0,negativeSignalCount:0,
    topCompanies:[],bottomCompanies:[]}).length,5);
  const history=publicValuationResult([{date:"2024-01-31",companyCount:1,projectedRate:0,
    medianImpliedRate:0,meanImpliedRate:0,p25ImpliedRate:0,p75ImpliedRate:0}],true) as object[];
  assert.equal(bindOutputFields("peerValuationHistory",history).length,2);
  assert.deepEqual(bindOutputFields("peerValuationHistory",[]),[]);
});

test("UI fixed-cost baseline is explicitly distinct from rounded API growth and unavailable remains explicit",()=>{
  assert.equal(gordonBaselinePct(20),3);
  assert.equal(displayDiagnostic(gordonBaselinePct(null),"%"),"Unavailable");
  assert.match(requireOutputSemantic("peerValuation.display.topCompanies.gordonBaselinePct").formula,/8-100\/api.pe/);
  assert.match(requireOutputSemantic("peerValuation.display.bottomCompanies.peerGapPp").formula,/api.impliedGrowth-api.peerMedianGrowth/);
  const route=readFileSync("server/routes.ts","utf8");
  assert.match(route,/bindNestedOutput\("peerValuation",filtered\)/);
  assert.match(route,/bindOutputFields\("peerValuationHistory",filtered\)/);
});

test("23 additional original slots close while all 15 existing withheld peer claims stay excluded",()=>{
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  for(const [path,total,bound,withheld] of [["summary",31,21,10],["timeseries",7,2,5]] as const) {
    const family=census.families.find((f:{surface:string})=>f.surface===`API GET "/api/cv/decarb-gap/${path}"`);
    assert.equal(family.total,total); assert.equal(family.bound,bound); assert.equal(family.withheld.length,withheld);
  }
   assert.equal(census.originalGapReconciliation.originalFullyBoundFields,1000);
  assert.equal(census.originalGapReconciliation.originalPublicSlots,1001);
   assert.equal(census.originalGapReconciliation.closedOriginalSlots,571);
   assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots,1);
  assert.equal(census.displayBindings.filter((b:{id:string})=>b.id.startsWith("peerValuation.")).length,11);
  assert.equal(census.completion,false);
});
