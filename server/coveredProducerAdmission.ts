import {contentHash} from "./calculation/analysisManifest";
import {calculateCoveredPhysicalPaths,type CoveredPathInput} from "./calculation/coveredPhysicalPaths";
import {cleanCoveredAdapter,publicEconomicBridgeAdapters} from "./producerReserveApi";
import {captureEconomicBridgeClosure,verifyEconomicBridgeDocument,type EconomicBridgeArchiveReader} from "./economicBridgeIdentity";
import type {EconomicBridgeDocument} from "../shared/economicBridgeSchema";
/** Captured alongside the actual registered producer, not supplied by a caller. */
const release=captureEconomicBridgeClosure(publicEconomicBridgeAdapters);
export async function admitCurrentCoveredProducer(document:EconomicBridgeDocument,input:CoveredPathInput,
 archive?:EconomicBridgeArchiveReader){
 // Existing current-code/source/material/result verifier recomputes the trusted
 // registered producer. Rehashing a forged caller object cannot satisfy it.
 if(document.key!=="cleanCovered")throw Error("Unsupported producer; no cross-analysis identity borrowing");
 const verified=await verifyEconomicBridgeDocument(document,cleanCoveredAdapter,release,archive);
 const actual=verified.report as ReturnType<typeof cleanCoveredAdapter.execute> & {
  source:{sha256:string;unitId:string;year:number;generationMWh:number;geography:string;captureBound:string};
  covered:{scenarios:{id:string;assumptions:unknown;rows:unknown[]}[];population:string[];years:number[]};
 };
 const source=actual.source;
 const payload={version:"epa-egrid-observed-activity-1",sourceHash:source.sha256,unitId:source.unitId,
  year:source.year,unit:"MWh",activity:source.generationMWh,geography:source.geography};
 const parent={hash:contentHash(payload),payload};
 if(contentHash(input.parents)!==contentHash([parent])||
  contentHash(input.population)!==contentHash(actual.covered.population)||
  contentHash(input.years)!==contentHash(actual.covered.years)||
  !Number.isFinite(Date.parse(input.cutoff))||Date.parse(input.cutoff)<Date.parse(source.captureBound)||
  Date.parse(input.cutoff)>Date.now())
  throw Error("Missing/swapped/future producer population, source or parent");
 // This producer admits only its observed source case, not caller-authored
 // future intensity/ownership/scenario substitutions.
 const expected=actual.covered.scenarios[0].rows[0] as Record<string,unknown>;
 const {emissionsTonnes,lineage,formula,...cell}=expected;
 if(input.scenarios.length!==1||input.scenarios[0].cells.length!==1||
    input.scenarios[0].id!==actual.covered.scenarios[0].id||
    contentHash(input.scenarios[0].assumptions)!==contentHash(actual.covered.scenarios[0].assumptions)||
    contentHash(input.cells)!==contentHash([cell])||
    contentHash(input.scenarios[0].cells[0])!==contentHash(cell))
  throw Error("Unpublished activity/intensity/ownership requires a different authenticated producer");
 return {...calculateCoveredPhysicalPaths(input),producerIdentity:verified.identity.id,
  producerAuthenticated:true,sourceApproved:false,acceptedIssuerUniverse:false,
  admissionScope:"Current registered observation producer only; future cohort/retained approval integration remains unavailable"};
}
