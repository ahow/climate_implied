import {sql} from "drizzle-orm";
import {db} from "../db";
import {snapshotsAvailable} from "./store";
import {contentHash} from "../calculation/analysisManifest";
import {packCompanySource,resolveCompanySourceEvidence} from "../calculation/companySourceArchive";
import {projectCompanyMembers} from "../calculation/companyProjection";
import {projectCompanyCohorts} from "../calculation/companyCohortProjection";
import {readCalculationSourceArtifact} from "./materialInputs";
import {renewalProducerBinding} from "../calculation/renewalProducer";
import {fundedProducerBinding} from "../calculation/fundedProducer";
type Connection=Pick<typeof db,"execute">;
async function lock(tx:Connection){
  if(!await snapshotsAvailable(tx)) throw new Error("Immutable operating review storage unavailable");
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('company-operating-review'))`);
}
async function save(tx:Connection,kind:string,payload:unknown){
  const id=contentHash(payload);
  const inserted=await tx.execute(sql`INSERT INTO cv_analysis_snapshots
    (id,kind,company_count,observation_count,chunk_count,source_note)
    VALUES(${id},${kind},1,1,1,'Company operating source/review; no automatic scientific acceptance')
    ON CONFLICT(id) DO NOTHING RETURNING id`);
  if(inserted.rows.length) await tx.execute(sql`INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload)
    VALUES(${id},0,${JSON.stringify(payload)}::jsonb)`);
  await load(tx,id,kind);
  return id;
}
async function load(tx:Connection,id:string,kind:string){
  if(!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid operating archive ID");
  const r=await tx.execute(sql`SELECT s.chunk_count,c.ordinal,c.payload FROM cv_analysis_snapshots s
    JOIN cv_analysis_chunks c ON c.snapshot_id=s.id WHERE s.id=${id} AND s.kind=${kind}`);
  if(r.rows.length!==1||r.rows[0].chunk_count!==1||r.rows[0].ordinal!==0||contentHash(r.rows[0].payload)!==id)
    throw new Error("Missing or corrupt operating archive");
  return r.rows[0].payload as any;
}
/** Bound to the actual computation and archived executable source, not a caller attestation.
 * This is private retained-result metadata, not a disclosure/owner approval. */
export function finiteProducerBinding(input:any,result:any,code:any){
 if(!input.scenarios?.some((s:any)=>s.finiteAccounting))return null;
 const paths=["server/calculation/operatingCohorts.ts","server/calculation/cohortCashLedger.ts",
  "server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts"];
 // Older immutable source bundles contain the rule inline. Do not demand a
 // later module from those stored records; new executable imports must be pinned.
 if(input.scenarios.some((s:any)=>s.finiteAccounting?.recognitionLaw)&&
  code.files?.["server/calculation/companyCohortProjection.ts"]?.includes('from "./cohortRecognition"'))
  paths.push("server/calculation/cohortRecognition.ts");
 if(input.scenarios.some((s:any)=>s.finiteAccounting?.terminal))paths.push("server/calculation/terminalSettlement.ts");
 if(input.scenarios.some((s:any)=>s.finiteAccounting?.terminal?.openingObligations))paths.push("server/calculation/terminalObligations.ts");
 if(input.scenarios.some((s:any)=>s.finiteAccounting?.postCutoff))paths.push("server/calculation/cohortPostCutoff.ts");
 if(input.scenarios.some((s:any)=>s.finiteAccounting?.assetDisposition))paths.push("server/calculation/cohortDisposition.ts");
 const moduleContentHashes=Object.fromEntries(paths.map(path=>{
  if(typeof code.files?.[path]!=="string"||!code.files[path].length)throw Error(`Missing finite executable module: ${path}`);
  return [path,contentHash(code.files[path])];
 }));
 const orderedMembers=input.scenarios.map((s:any,index:number)=>{
  const m=result.members[index];
  if(!m||m.id!==s.id)throw Error("Finite producer member ordering mismatch");
  if(!s.finiteAccounting)return {id:s.id,finite:false};
  const f=m.finiteAccounting;
  if(!f||f.physicalParentHash!==m.parentResultHash)throw Error("Finite physical parent mismatch");
  const law=s.finiteAccounting.recognitionLaw??null;
  if((f.recognitionAssessment?.version??null)!==law)throw Error("Finite recognition rule mismatch");
  return {id:s.id,finite:true,physicalParentHash:m.parentResultHash,
   inputHash:contentHash(s.finiteAccounting),cashResultHash:contentHash(f),recognitionLaw:law,
   recognitionAssessmentHash:contentHash(f.recognitionAssessment??null),modelVersion:f.version,
   periodicValue:f.periodicValueUsd,claim:s.finiteAccounting.ledger.claim,
   claimantId:s.finiteAccounting.ledger.claimantId};
 });
 if(result.members.length!==orderedMembers.length)throw Error("Unexpected finite producer members");
 return {version:"retained-finite-producer-1",codeId:contentHash(code),moduleContentHashes,orderedMembers,
  inputHash:contentHash(input),assumptionHash:contentHash(input.scenarios),resultHash:contentHash(result),
  approval:false,scientificAcceptance:false};
}
async function validateCohortProducer(tx:Connection,proposal:any,sourceIds:string[],mode:"stored"|"recalculate"="recalculate"){
 if(proposal.input?.version!=="company-cohort-input-1")return null;
 const p=proposal.producer;
 if(!p||p.modelVersion!=="company-cohort-projection-2"||p.inputVersion!==proposal.input.version||
   p.assumptionHash!==contentHash(proposal.input.scenarios)||p.inputHash!==contentHash(proposal.input)||
   contentHash(p.sourceIds)!==contentHash(sourceIds))throw Error("Missing/conflicting retained producer manifest");
 const code=await load(tx,p.codeId,"company-cohort-code");
 const result=await load(tx,p.resultId,"company-cohort-result");
 if(code.version!=="calculation-source-1"||typeof code.nodeVersion!=="string")
  throw Error("Unsupported retained code schema");
  if(p.modelVersion!==result.version||p.assumptionHash!==result.assumptionHash||
    contentHash(p.modelVersions)!==contentHash(result.modelVersions))
    throw Error("Retained cohort model/assumption manifest mismatch");
 if(mode==="recalculate"&&contentHash(code)!==readCalculationSourceArtifact().id)throw Error("Pinned cohort code unavailable in this executable; no current-code fallback");
 const finite=finiteProducerBinding(proposal.input,result,code);
 if(finite&&contentHash(finite)!==contentHash(p.finiteExecution))
  throw Error("Retained finite execution binding mismatch");
 const renewal=renewalProducerBinding(proposal.input,result,code);
 if(renewal&&contentHash(renewal)!==contentHash(p.renewalExecution))
  throw Error("Retained renewal execution binding mismatch");
 const funded=fundedProducerBinding(proposal.input,result,code);
 if(funded&&contentHash(funded)!==contentHash(p.fundedExecution))
  throw Error("Retained funded execution binding mismatch");
 if(mode==="recalculate"&&contentHash(projectCompanyCohorts(proposal.input))!==contentHash(result))throw Error("Retained cohort result mismatch");
 if(result.covered.scenarios.some((s:any)=>s.status!=="conditional"))
   throw Error("Incomplete cohort scenario domain cannot be admitted");
 return result;
}
/** Source-only packets are pending review, never executable projections. */
export async function stageCompanySourcePacketInTransaction(tx:Connection,identity:{companyId:string;isin:string},sources:unknown[],gaps:string[]){
  await lock(tx);
  if(!sources.length||!gaps.length||gaps.some(g=>typeof g!=="string"||!g.trim())) throw new Error("Explicit source evidence and remaining gaps required");
  const company=await tx.execute(sql`SELECT isin FROM cv_companies WHERE id=${identity.companyId}`);
  if(company.rows[0]?.isin!==identity.isin) throw new Error("Company identity conflict");
  const sourceIds=[];
  for(const item of sources){
    const source=packCompanySource(item);
    if(source.payload.companyId!==identity.companyId||source.payload.isin!==identity.isin) throw new Error("Source identity conflict");
    sourceIds.push(await save(tx,"company-operating-source",source.payload));
  }
  return save(tx,"company-operating-source-proposal",{version:"company-operating-source-proposal-1",identity,
    sourceArchiveIds:Array.from(new Set(sourceIds)).sort(),remainingGaps:[...gaps].sort(),
    status:"pending-owner-review-incomplete-operating-inputs",executable:false,scientificAcceptance:false});
}
export const stageCompanySourcePacket=(identity:{companyId:string;isin:string},sources:unknown[],gaps:string[])=>
  db.transaction(tx=>stageCompanySourcePacketInTransaction(tx,identity,sources,gaps));
export async function stageCompanyOperatingInTransaction(tx:Connection,input:any,evidence:unknown,sources:unknown[],identity:{companyId:string;isin:string},cutoff:string){
  await lock(tx);
  const company=await tx.execute(sql`SELECT isin FROM cv_companies WHERE id=${identity.companyId}`);
  if(company.rows[0]?.isin!==identity.isin||input?.companyId!==identity.companyId) throw new Error("Company identity conflict");
  const isCohort=input?.version==="company-cohort-input-1";
  if(isCohort&&input.cutoff!==cutoff)throw Error("Cohort cutoff mismatch");
  const cohortProjection=isCohort?projectCompanyCohorts(input):null;
  const projection=cohortProjection??projectCompanyMembers(input);
  if(!("members" in projection)) throw new Error("Company model unavailable");
  const ids=[];
  for(const source of sources){
    const packed=packCompanySource(source);
    ids.push(await save(tx,"company-operating-source",packed.payload));
  }
  const resolved=await resolveCompanySourceEvidence(input,evidence,cutoff,identity,id=>load(tx,id,"company-operating-source"));
  if(ids.some(id=>!resolved.archiveHashes.includes(id))) throw new Error("Unreferenced supplied source");
  const producer=cohortProjection?{
    codeId:await save(tx,"company-cohort-code",readCalculationSourceArtifact().payload),
    resultId:await save(tx,"company-cohort-result",projection),
    modelVersion:cohortProjection.version,inputVersion:input.version,
    assumptionHash:contentHash(input.scenarios),modelVersions:cohortProjection.modelVersions,inputHash:contentHash(input),
    sourceIds:resolved.archiveHashes,
    ...(input.scenarios.some((s:any)=>s.finiteAccounting)?{finiteExecution:finiteProducerBinding(input,projection,readCalculationSourceArtifact().payload)}:{}),
    ...(input.scenarios.some((s:any)=>s.renewal?.version==="gregorian-renewal-1")?{renewalExecution:renewalProducerBinding(input,projection,readCalculationSourceArtifact().payload)}:{}),
    ...(input.scenarios.some((s:any)=>s.fundedTransition)?{fundedExecution:fundedProducerBinding(input,projection,readCalculationSourceArtifact().payload)}:{}),
  }:null;
  return save(tx,"company-operating-proposal",{version:"company-operating-proposal-1",identity,input,evidence,cutoff,
    ...(producer?{producer}:{}),
    sourceArchiveIds:resolved.archiveHashes,status:"pending-owner-review",scientificAcceptance:false});
}
export async function decideCompanyOperatingInTransaction(tx:Connection,proposalId:string,decision:"approved"|"rejected",financialReviewId:string){
  if(!["approved","rejected"].includes(decision)) throw new Error("Invalid decision");
  await lock(tx);
  const proposal=await load(tx,proposalId,"company-operating-proposal");
  const previous=await tx.execute(sql`SELECT s.id FROM cv_analysis_snapshots s JOIN cv_analysis_chunks c ON c.snapshot_id=s.id
    WHERE s.kind='company-operating-decision' AND c.payload->>'proposalId'=${proposalId}`);
  if(previous.rows.length>1) throw new Error("Conflicting operating decisions");
  if(previous.rows.length){
    const old=await load(tx,String(previous.rows[0].id),"company-operating-decision");
    if(old.decision!==decision||old.financialReviewId!==financialReviewId) throw new Error("Conflicting decision; new proposal required");
    if(old.decision==="approved"){
      await load(tx,old.financialIdentityArchive,"company-operating-identity");
      await resolveCompanySourceEvidence(proposal.input,proposal.evidence,old.decidedAt,proposal.identity,id=>load(tx,id,"company-operating-source"));
      await validateCohortProducer(tx,proposal,proposal.sourceArchiveIds);
    }
    return {id:previous.rows[0].id,...old};
  }
  const now=await tx.execute(sql`SELECT transaction_timestamp() AS now`);
  const decidedAt=new Date(now.rows[0].now as string).toISOString();
  let financialReviewedAt:string|null=null;
  let financialIdentityArchive:string|null=null;
  if(decision==="approved"){
    const financial=await tx.execute(sql`SELECT status,payload,reviewed_at FROM financial_reviews WHERE id=${financialReviewId} FOR SHARE`);
    const row=financial.rows[0];
    if(row?.status!=="approved"||!(row.payload as any)?.identity||
      String((row.payload as any).identity.companyId)!==proposal.identity.companyId||
      (row.payload as any).identity.isin!==proposal.identity.isin||!row.reviewed_at)
      throw new Error("Existing owner-approved financial identity required");
    financialReviewedAt=new Date(row.reviewed_at as string).toISOString();
    if(Date.parse(financialReviewedAt)>Date.parse(decidedAt)) throw new Error("Future financial approval");
    financialIdentityArchive=await save(tx,"company-operating-identity",{
      version:"company-operating-identity-1",financialReviewId,reviewedAt:financialReviewedAt,payload:row.payload,status:"approved",
    });
    await resolveCompanySourceEvidence(proposal.input,proposal.evidence,decidedAt,proposal.identity,id=>load(tx,id,"company-operating-source"));
    await validateCohortProducer(tx,proposal,proposal.sourceArchiveIds);
  }
  const payload={version:"company-operating-decision-1",proposalId,decision,financialReviewId,financialIdentityArchive,financialReviewedAt,decidedAt,scientificAcceptance:false};
  return {id:await save(tx,"company-operating-decision",payload),...payload};
}
export async function projectReviewedCompanyInTransaction(tx:Connection,decisionId:string,cutoff:string,mode:"stored"|"recalculate"="recalculate"){
  await lock(tx);
  if(!["stored","recalculate"].includes(mode))throw Error("Explicit supported retrieval mode required");
  if(!Number.isFinite(Date.parse(cutoff))) throw new Error("Invalid cutoff");
  const decision=await load(tx,decisionId,"company-operating-decision");
  if(decision.decision!=="approved"||Date.parse(decision.decidedAt)>Date.parse(cutoff)||
    !decision.financialReviewedAt||Date.parse(decision.financialReviewedAt)>Date.parse(cutoff))
    throw new Error("Approval unavailable at requested cutoff");
  const proposal=await load(tx,decision.proposalId,"company-operating-proposal");
  const financial=await load(tx,decision.financialIdentityArchive,"company-operating-identity");
  if(financial.financialReviewId!==decision.financialReviewId||financial.reviewedAt!==decision.financialReviewedAt||
    String(financial.payload.identity.companyId)!==proposal.identity.companyId||financial.payload.identity.isin!==proposal.identity.isin)
    throw new Error("Conflicting archived financial identity");
  const sources=await resolveCompanySourceEvidence(proposal.input,proposal.evidence,cutoff,proposal.identity,id=>load(tx,id,"company-operating-source"));
  if(proposal.input?.version==="company-cohort-input-1"){
    const result=await validateCohortProducer(tx,proposal,sources.archiveHashes,mode);
    return {...result,operatingDecisionId:decisionId,financialReviewId:decision.financialReviewId,
      sourceEvidence:sources,producerManifest:proposal.producer,informationCutoff:cutoff,
      retrievalMode:mode,executionVerifiedNow:mode==="recalculate",scientificAcceptance:false};
  }
  return {...projectCompanyMembers(proposal.input),sourceEvidence:sources,operatingDecisionId:decisionId,
    financialReviewId:decision.financialReviewId,informationCutoff:cutoff,scientificAcceptance:false,
    historicalWarning:"Approval after the origin cannot be backdated; source resolution is not original-vintage or calibrated acceptance"};
}
export async function readRetainedFiniteInTransaction(tx:Connection,decisionId:string,cutoff:string,mode:"stored"|"recalculate"="stored",binding:"finiteExecution"|"renewalExecution"|"fundedExecution"="finiteExecution"){
 const instant=new Date(cutoff);
 if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(cutoff)||
  !Number.isFinite(instant.getTime())||instant.toISOString().slice(0,10)!==cutoff.slice(0,10)||
  (cutoff.length>10&&instant.toISOString().slice(0,19)!==cutoff.slice(0,19)))
  throw Error("Explicit valid UTC calendar cutoff required");
 const result=await projectReviewedCompanyInTransaction(tx,decisionId,cutoff,mode);
 if(!(result as any).producerManifest?.[binding])throw Error("Requested retained execution unavailable");
 const decision=await load(tx,decisionId,"company-operating-decision");
 const proposal=await load(tx,decision.proposalId,"company-operating-proposal");
 const computedResult=await load(tx,proposal.producer.resultId,"company-cohort-result");
 return {input:proposal.input,result,computedResult,decision,proposal,proposalId:decision.proposalId};
}
export const readRetainedFinite=(decisionId:string,cutoff:string,mode:"stored"|"recalculate"="stored")=>
 db.transaction(tx=>readRetainedFiniteInTransaction(tx,decisionId,cutoff,mode));
export const readRetainedRenewalInTransaction=(tx:Connection,id:string,cutoff:string,mode:"stored"|"recalculate"="stored")=>
 readRetainedFiniteInTransaction(tx,id,cutoff,mode,"renewalExecution");
export const readRetainedRenewal=(id:string,cutoff:string,mode:"stored"|"recalculate"="stored")=>
 db.transaction(tx=>readRetainedRenewalInTransaction(tx,id,cutoff,mode));
export const readRetainedFundedInTransaction=(tx:Connection,id:string,cutoff:string,mode:"stored"|"recalculate"="stored")=>
 readRetainedFiniteInTransaction(tx,id,cutoff,mode,"fundedExecution");
export const readRetainedFunded=(id:string,cutoff:string,mode:"stored"|"recalculate"="stored")=>
 db.transaction(tx=>readRetainedFundedInTransaction(tx,id,cutoff,mode));
export const stageCompanyOperating=(input:unknown,evidence:unknown,sources:unknown[],identity:{companyId:string;isin:string},cutoff:string)=>
  db.transaction(tx=>stageCompanyOperatingInTransaction(tx,input,evidence,sources,identity,cutoff));
export const projectReviewedCompany=(id:string,cutoff:string)=>
  db.transaction(tx=>projectReviewedCompanyInTransaction(tx,id,cutoff));
export async function listCompanyOperatingReviews(){
  if(!await snapshotsAvailable()) throw new Error("Operating review storage unavailable");
  const records=await db.execute(sql`SELECT id,kind FROM cv_analysis_snapshots
    WHERE kind IN ('company-operating-source-proposal','company-operating-proposal') ORDER BY id LIMIT 100`);
  const result=[];
  for(const row of records.rows){
    const proposal=await load(db,String(row.id),String(row.kind));
    const decisions=await db.execute(sql`SELECT s.id FROM cv_analysis_snapshots s JOIN cv_analysis_chunks c ON c.snapshot_id=s.id
      WHERE s.kind='company-operating-decision' AND c.payload->>'proposalId'=${String(row.id)}`);
    if(decisions.rows.length>1) throw new Error("Conflicting operating decisions");
    const decision=decisions.rows.length?await load(db,String(decisions.rows[0].id),"company-operating-decision"):null;
    result.push({
      proposalId:String(row.id),companyId:String(proposal.identity.companyId),isin:String(proposal.identity.isin),
      kind:String(row.kind),sourceArchiveIds:proposal.sourceArchiveIds as string[],
      remainingGaps:(proposal.remainingGaps??[]) as string[],
      decision:decision?(decision.decision as "approved"|"rejected"):"pending" as const,
      decidedAt:decision?String(decision.decidedAt):null,
      executable:row.kind==="company-operating-proposal"&&decision?.decision==="approved",
      scientificAcceptance:false as const,
    });
  }
  return result;
}
