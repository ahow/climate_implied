import test from "node:test";
import assert from "node:assert/strict";
import {admitCurrentCoveredProducer} from "../server/coveredProducerAdmission";
import {cleanCoveredAdapter,publicEconomicBridgeAdapters} from "../server/producerReserveApi";
import {executeEconomicBridge,captureEconomicBridgeClosure} from "../server/economicBridgeIdentity";
import {contentHash} from "../server/calculation/analysisManifest";
import type {CoveredPathInput} from "../server/calculation/coveredPhysicalPaths";
async function fixture(){
 const document=await executeEconomicBridge(cleanCoveredAdapter,captureEconomicBridgeClosure(publicEconomicBridgeAdapters));
 const r=document.report as any,s=r.source,scenario=r.covered.scenarios[0];
 const {emissionsTonnes,lineage,formula,...cell}=scenario.rows[0];
 const payload={version:"epa-egrid-observed-activity-1",sourceHash:s.sha256,unitId:s.unitId,
  year:s.year,unit:"MWh",activity:s.generationMWh,geography:s.geography};
 const input:CoveredPathInput={cutoff:s.captureBound,population:r.covered.population,years:r.covered.years,
  parents:[{hash:contentHash(payload),payload}],cells:[cell],
  scenarios:[{id:scenario.id,assumptions:scenario.assumptions,cells:[cell]}]};
 return{document,input};
}
test("actual registered producer admission, not a caller rehashed payload; never confers issuer approval",async()=>{
 const {document,input}=await fixture(),r=await admitCurrentCoveredProducer(document,input);
 assert.equal(r.producerAuthenticated,true);assert.equal(r.sourceApproved,false);
 assert.equal(r.scenarios[0].rows![0].emissionsTonnes,1772288.37547776);
});
test("forged, swapped, missing and future parent/domain/assumption inputs refuse",async()=>{
 const f=await fixture();
 for(const mutate of [
  (x:typeof f)=>{(x.document.report as any).observed.generationMWh++;},
  (x:typeof f)=>{x.input.parents=[];},
  (x:typeof f)=>{x.input.population=["different"];},
  (x:typeof f)=>{x.input.cutoff="2099-01-01T00:00:00Z";},
  (x:typeof f)=>{x.input.scenarios[0].assumptions={ownerAccepted:true};},
  (x:typeof f)=>{x.input.scenarios[0].cells[0].intensity++;},
 ]){const x=structuredClone(f);mutate(x);await assert.rejects(()=>admitCurrentCoveredProducer(x.document,x.input));}
});
