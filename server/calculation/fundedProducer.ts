import {contentHash} from "./analysisManifest";
/** Structural retained binding only; stored retrieval never executes a model. */
export function fundedProducerBinding(input:any,result:any,code:any){
 if(!input.scenarios?.some((s:any)=>s.fundedTransition))return null;
 const paths=["analysisManifest","operatingCohorts","cohortCashLedger","deploymentGrowth","deploymentDebt",
  "deploymentTransition","fundedDeploymentTransition","gregorianRenewal","renewalClosure",
  "coveredPhysicalPaths","companyCohortProjection","fundedProducer"].map(n=>`server/calculation/${n}.ts`);
 paths.push("server/snapshots/companyOperatingReview.ts");
 if(input.scenarios.some((s:any)=>s.fundedTransition?.version==="funded-finite-gregorian-join-3-earned")||
  code.files?.["server/calculation/deploymentDebt.ts"]?.includes('from "./cohortRecognition"'))
  paths.push("server/calculation/cohortRecognition.ts");
 const moduleContentHashes=Object.fromEntries(paths.map(path=>{
  if(typeof code.files?.[path]!=="string"||!code.files[path])throw Error("Missing funded executable module");
  return [path,contentHash(code.files[path])];
 }));
 if(result.members?.length!==input.scenarios.length)throw Error("Funded producer population mismatch");
 const orderedMembers=input.scenarios.map((s:any,i:number)=>{
  const m=result.members[i];if(m.id!==s.id)throw Error("Funded producer order mismatch");
  if(!s.fundedTransition)return {id:s.id,funded:false};
  const x=s.fundedTransition,r=m.fundedTransition;
  if(!r||!["funded-finite-gregorian-join-2","funded-finite-gregorian-join-3-earned"].includes(r.version)||x.version!==r.version||
   r.definitionHash!==contentHash(x)||r.finite.physical.definitionHash!==contentHash(x.deployment)||
   r.finite.physical.growth!==x.growth||contentHash(r.finite.physical.specification)!==contentHash(s.specification)||
   r.periodic.inputHash!==contentHash(x.periodic)||r.periodic.futureLawHash!==contentHash(x.periodic.futureLaw)||
   r.inverse!==null||r.marketImplied!==false||r.scientificAcceptance!==false)
   throw Error("Funded source/domain/law/result mismatch");
  if(r.version==="funded-finite-gregorian-join-3-earned"&&r.finite.recognitionAssessment?.version!=="earned-service-prefix-1")
   throw Error("Funded physical recognition result missing");
  if(!/^[a-f0-9]{64}$/.test(m.parentResultHash))throw Error("Funded physical parent missing");
  return {id:s.id,funded:true,physicalParentHash:m.parentResultHash,modelVersion:r.version,
   definitionHash:r.definitionHash,specificationHash:contentHash(s.specification),resultHash:contentHash(r),
   claim:x.debt.ledger.claim,claimantId:x.debt.ledger.claimantId,
   ownershipHash:contentHash(x.rights),loanHash:contentHash(x.debt.loan),lawHash:r.periodic.futureLawHash,
   calendar:"UTC-civil/ACT365.25",currency:"USD",parameter:"finite physical growth; inverse unavailable"};
 });
 return {version:"retained-funded-producer-1",codeId:contentHash(code),moduleContentHashes,orderedMembers,
  inputHash:contentHash(input),assumptionHash:contentHash(input.scenarios),resultHash:contentHash(result),
  approval:false,scientificAcceptance:false};
}
