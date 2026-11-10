/** Workspace operator boundary only. No public approval route and no auto-approval. */
import {readFileSync} from "node:fs";
import {db} from "../server/db";
import {stageCompanyOperating,stageCompanySourcePacket,decideCompanyOperatingInTransaction,projectReviewedCompany} from "../server/snapshots/companyOperatingReview";
const [action,arg,extra]=process.argv.slice(2);
try{
  if(action==="stage-sources"){
    const x=JSON.parse(readFileSync(arg,"utf8"));
    console.log(await stageCompanySourcePacket(x.identity,x.sources,x.remainingGaps));
  }else if(action==="stage"){
    const x=JSON.parse(readFileSync(arg,"utf8"));
    console.log(await stageCompanyOperating(x.input,x.evidence,x.sources,x.identity,x.cutoff));
  }else if(action==="approve"||action==="reject"){
    if(!extra) throw new Error("Explicit financial review ID required; no identity approval is created");
    console.log(await db.transaction(tx=>decideCompanyOperatingInTransaction(tx,arg,action==="approve"?"approved":"rejected",extra)));
  }else if(action==="project"){
    if(!extra) throw new Error("Explicit as-of cutoff required");
    console.log(JSON.stringify(await projectReviewedCompany(arg,extra)));
  }else throw new Error("Usage: stage-sources <packet.json> | stage <proposal.json> | approve/reject <proposalId> <financialReviewId> | project <decisionId> <cutoff>");
  process.exit(0);
}catch(error){console.error(error instanceof Error?error.message:"Operating review failed");process.exit(1);}
