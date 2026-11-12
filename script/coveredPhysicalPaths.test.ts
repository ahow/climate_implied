import test from "node:test";
import assert from "node:assert/strict";
import {calculateCoveredPhysicalPaths,type CoveredPathInput,type PhysicalCell} from "../server/calculation/coveredPhysicalPaths";
import {contentHash} from "../server/calculation/analysisManifest";
function fixture():CoveredPathInput{
 const source={hash:"a".repeat(64),locator:"explicit synthetic engineering cell",publishedAt:"2024-01-01T00:00:00Z",year:2023,periodStart:"2023-01-01",periodEnd:"2023-12-31",geography:"fixture-region",unit:"MWh",kind:"observed" as const};
 const cell:PhysicalCell={parentYearPointer:"/year",parentUnitPointer:"/unit",parentActivityPointer:"/activity",issuer:"fixture-owner",unitId:"fixture-unit",year:2023,geography:"fixture-region",scope:"1",gas:"CO2",activity:100,activityUnit:"MWh",intensity:0.5,intensityDenominator:"MWh",intensityNumerator:"tonnes-native-gas",ownership:0.8,basis:"full-unit-before-ownership",channel:"operational",activitySource:source,intensitySource:{...source,unit:"tonnes-CO2/MWh",gas:"CO2",scope:"1"},parentResultHash:"b".repeat(64)};
 cell.parentActivityPointer="/activity";
 const payload={activity:100,year:2023,unit:"MWh"};
 cell.parentResultHash=contentHash(payload);
 return {cutoff:"2024-02-01T00:00:00Z",population:[cell.issuer],years:[2023],parents:[{hash:cell.parentResultHash,payload}],cells:[cell],scenarios:[{id:"declared-a",assumptions:{meaning:"synthetic engineering only"},cells:[cell]}]};
}
test("actual activity/intensity/ownership accounting is traceable and cannot confer physical acceptance",()=>{
 const r=calculateCoveredPhysicalPaths(fixture());assert.equal(r.scenarios[0].rows![0].emissionsTonnes,40);
 assert.equal(r.ranges[0].min,40);assert.equal(r.expanded,null);assert.equal(r.scientificAcceptance,false);
 assert.equal(r.scenarios[0].rows![0].lineage.activity.locator,"explicit synthetic engineering cell");
});
test("all declared sets remain in range denominator; missing set withholds bounds",()=>{
 const x=fixture();x.scenarios.push({id:"missing",assumptions:{reason:"not observed"},cells:[]});
 const r=calculateCoveredPhysicalPaths(x);assert.equal(r.ranges[0].min,null);assert.deepEqual(r.ranges[0].missingScenarioIds,["missing"]);
});
test("future, mismatched units, duplicate cells and over-owned units refuse",()=>{
 for(const mutate of [
  (x:CoveredPathInput)=>{x.scenarios[0].cells[0].intensitySource.publishedAt="2025-01-01T00:00:00Z";},
  (x:CoveredPathInput)=>{x.scenarios[0].cells[0].intensityDenominator="boe";},
  (x:CoveredPathInput)=>{x.scenarios[0].cells.push(x.scenarios[0].cells[0]);},
  (x:CoveredPathInput)=>{x.scenarios[0].cells[0].ownership=1.1;},
  (x:CoveredPathInput)=>{x.scenarios[0].cells[0].intensitySource.gas="CH4";},
  (x:CoveredPathInput)=>{delete (x.scenarios[0].cells[0] as any).intensitySource;},
 ]){const x=fixture();mutate(x);const r=calculateCoveredPhysicalPaths(x);assert.equal(r.scenarios[0].status,"unavailable");assert.equal(r.ranges[0].min,null);}
});
test("shared owners apply identical unit basis once; conflicting bases refuse",()=>{
 const x=fixture(),a=x.scenarios[0].cells[0],b=structuredClone(a);b.issuer="second";b.ownership=.2;
 x.population.push(b.issuer);x.cells.push(b);x.scenarios[0].cells.push(b);
 assert.equal(calculateCoveredPhysicalPaths(x).ranges[0].min,50);
 b.activity=110;assert.equal(calculateCoveredPhysicalPaths(x).scenarios[0].status,"unavailable");
});
