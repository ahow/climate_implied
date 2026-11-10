import test from "node:test";
import assert from "node:assert/strict";
import {prepareProspectiveSignal} from "../server/calculation/prospectiveSignal";
const definition={currency:"USD",basis:"FCFE",horizonYears:5,growthDefinition:"five-year-CAGR",nominal:true};
const pair={origin:"2026-11-01T00:00:00Z",peer:"sector",projectionManifest:"a".repeat(64),valuationManifest:"b".repeat(64),
 projectionDefinition:definition,valuationDefinition:definition,projectionAvailableAt:"2026-10-31T00:00:00Z",valuationAvailableAt:"2026-10-31T00:00:00Z",
 members:[{id:"1",projectedGrowth:.03,impliedGrowth:.02}]};
const request={version:"prospective-paired-signal-1",protocolHash:"c".repeat(64),universeHash:"d".repeat(64),
 origin:pair.origin,executionNotBefore:"2026-11-12T00:00:00Z",outcomeNotBefore:"2026-12-12T00:00:00Z",
 expectedCompanyIds:["b","a"],pairs:[{...pair,companyId:"a"},{...pair,companyId:"b"}]};
test("prospective clock, full universe and input order cannot be forged into historical capture",()=>{
 const a=prepareProspectiveSignal(request,"2026-11-10T00:00:00Z");
 assert.equal(a.requestHash,prepareProspectiveSignal({...request,pairs:[...request.pairs].reverse()},"2026-11-11T00:00:00Z").requestHash);
 assert.throws(()=>prepareProspectiveSignal(request,"2026-11-12T00:00:00Z"),/precede/);
 assert.throws(()=>prepareProspectiveSignal(request,"2026-10-01T00:00:00Z"),/precede/);
 assert.throws(()=>prepareProspectiveSignal({...request,expectedCompanyIds:["a","c"]},"2026-11-10T00:00:00Z"),/universe/);
 assert.equal(a.scientificAcceptance,false);
});
