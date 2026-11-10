import test from "node:test";
import assert from "node:assert/strict";
import {pairedCompanyGap,rankPairedCompanyGaps} from "../server/calculation/pairedCompanyGap";
const definition={currency:"USD",basis:"FCFE",horizonYears:5,growthDefinition:"five-year-CAGR",nominal:true};
const input={origin:"2026-01-01T00:00:00Z",companyId:"a",peer:"sector",projectionManifest:"a".repeat(64),valuationManifest:"b".repeat(64),
 projectionDefinition:definition,valuationDefinition:definition,projectionAvailableAt:"2025-12-31T00:00:00Z",valuationAvailableAt:"2025-12-31T00:00:00Z",
 members:[{id:"1",projectedGrowth:0,impliedGrowth:0},{id:"2",projectedGrowth:10,impliedGrowth:100},{id:"3",projectedGrowth:11,impliedGrowth:1}]};
test("paired median differs from difference of medians; nulls never silently selected",()=>{
 const result=pairedCompanyGap(input);assert.equal(result.medianPairedGap,0);
 assert.equal(pairedCompanyGap({...input,members:[...input.members,{id:"4",projectedGrowth:null,impliedGrowth:0}]}).medianPairedGap,null);
 assert.throws(()=>pairedCompanyGap({...input,valuationDefinition:{...definition,horizonYears:3}}),/Incompatible/);
 assert.throws(()=>pairedCompanyGap({...input,valuationAvailableAt:"2027-01-01T00:00:00Z"}),/Future/);
});
test("peer ranks preserve ties and additive invariance; missing peers withhold scores",()=>{
 const a=pairedCompanyGap(input),b=pairedCompanyGap({...input,companyId:"b",members:input.members.map(m=>({...m,projectedGrowth:m.projectedGrowth+1}))});
 assert.deepEqual(rankPairedCompanyGaps([b,a]).map(r=>r.score),[-1,1]);
 const shifted=[a,b].map(r=>({...r,medianPairedGap:r.medianPairedGap!+100}));
 assert.deepEqual(rankPairedCompanyGaps(shifted).map(r=>r.score),[-1,1]);
 assert.deepEqual(rankPairedCompanyGaps([a,{...b,medianPairedGap:null}]).map(r=>r.score),[null,null]);
 assert.deepEqual(rankPairedCompanyGaps([a,{...a,companyId:"b"}]).map(r=>r.score),[0,0]);
});
