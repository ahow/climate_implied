import test from "node:test";
import assert from "node:assert/strict";
import {reconcileRenewalFamily} from "../server/calculation/renewalFamily";
test("declared family retains missing, no-root and unsupported sets without silently narrowing the range",()=>{
 const scenario=(id:string)=>({id,renewal:{claim:"conditional",version:"gregorian-renewal-1",cashLedger:{claimantId:"same"},
  datedAccounting:{declaration:{valuationOn:"2026-01-01"}}},specification:{currency:"USD",cohorts:[{serviceUnit:"kWh-delivered"}]}});
 const input={scenarios:["a","b","c"].map(scenario),renewalFamily:{declaredSets:["a","b","c","d"],missing:[{id:"d",reason:"No supported physical source"}]}};
 const members=["unique-supported-affine-root","no-root","unsupported"].map((status,i)=>({id:["a","b","c"][i],renewal:{conditionalPeriodicProjectValueUsd:100+i},renewalInverse:{status}}));
 const r=reconcileRenewalFamily(input,members);assert.equal(r.declared,4);assert.equal(r.rows.length,4);
 assert.deepEqual(r.unavailableSets,["d"]);assert.equal(r.groups[0].min,100);assert.equal(r.groups[0].max,102);
 assert.deepEqual(r.rows.map(x=>x.inverseStatus),["unique-supported-affine-root","no-root","unsupported","unavailable"]);
 assert.throws(()=>reconcileRenewalFamily({...input,renewalFamily:{...input.renewalFamily,missing:[]}},members),/explicit reason/);
});
