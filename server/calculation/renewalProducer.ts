import {contentHash} from "./analysisManifest";
import {reconcileRenewalFamily} from "./renewalFamily";
/** Structural execution binding only. Stored validation never executes a model. */
export function renewalProducerBinding(input:any,result:any,code:any){
 if(!input.scenarios?.some((s:any)=>s.renewal?.version==="gregorian-renewal-1"))return null;
 const paths=["operatingCohorts","cohortCashLedger","renewalClosure","cohortRenewal","gregorianRenewal","gregorianInverse","renewalFamily","coveredPhysicalPaths","companySourceArchive","companyCohortProjection","renewalProducer"].map(n=>`server/calculation/${n}.ts`);
 paths.push("server/snapshots/companyOperatingReview.ts");
 const moduleContentHashes=Object.fromEntries(paths.map(p=>{
  if(typeof code.files?.[p]!=="string"||!code.files[p])throw Error("Missing renewal executable module");
  return [p,contentHash(code.files[p])];
 }));
 if(result.members.length!==input.scenarios.length)throw Error("Renewal population mismatch");
 if(contentHash(reconcileRenewalFamily(input,result.members))!==contentHash(result.renewalFamilyCoverage))
  throw Error("Renewal family coverage mismatch");
 const orderedMembers=input.scenarios.map((s:any,i:number)=>{
  const m=result.members[i];
  if(m.id!==s.id)throw Error("Renewal ordering mismatch");
  if(s.renewal?.version!=="gregorian-renewal-1")return {id:s.id,renewal:false};
  const r=m.renewal;
  if(!r||r.version!==s.renewal.version||r.inputHash!==contentHash(s.renewal)||
   r.futureLawHash!==contentHash(s.renewal.futureLaw)||
   (s.renewalInverse&&m.renewalInverse?.definitionHash!==contentHash({input:s.renewal,protocol:s.renewalInverse}))||
   (!s.renewalInverse&&m.renewalInverse))throw Error("Renewal law/domain/result mismatch");
  return {id:s.id,renewal:true,physicalParentHash:m.parentResultHash,specificationHash:contentHash(s.specification),
   inputHash:r.inputHash,lawHash:r.futureLawHash,claimantId:s.renewal.cashLedger.claimantId,
   ownershipHash:contentHash(s.renewal.wholeStateCycle.rights),calendar:"UTC-Gregorian/ACT365.25",currency:"USD",
   resultHash:contentHash(r),inverseHash:contentHash(m.renewalInverse??null),
   inverseDefinitionHash:m.renewalInverse?.definitionHash??null,
   parameter:"price shift, NOT implied deployment growth",modelVersion:r.version};
 });
 return {version:"retained-renewal-producer-1",codeId:contentHash(code),moduleContentHashes,orderedMembers,
  inputHash:contentHash(input),assumptionHash:contentHash(input.scenarios),resultHash:contentHash(result),familyHash:contentHash(result.renewalFamilyCoverage),
  approval:false,scientificAcceptance:false};
}
