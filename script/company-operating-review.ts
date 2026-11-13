/** Workspace operator boundary only. No public approval route and no auto-approval. */
import {readFileSync,writeFileSync,mkdirSync,realpathSync,statSync} from "node:fs";
import {resolve,dirname,sep} from "node:path";
import {readRetainedFinite} from "../server/snapshots/companyOperatingReview";
import {finiteCompanyDocument,finiteCompanyWorkbook} from "../server/finiteCompanyDocument";
import {db} from "../server/db";
import {stageCompanyOperating,stageCompanySourcePacket,decideCompanyOperatingInTransaction,projectReviewedCompany} from "../server/snapshots/companyOperatingReview";
const [action,arg,extra,output]=process.argv.slice(2);
try{
  if(action==="finite-json"||action==="finite-xlsx"){
    if(!arg||!extra||!output)throw Error("Explicit decision, cutoff and private output required");
    const root=resolve("generated-artifacts/private-exports"),file=resolve(output);
    if(!file.startsWith(root+sep)||dirname(file)!==root)throw Error("Finite exports require a direct file under generated-artifacts/private-exports");
    mkdirSync(root,{recursive:true,mode:0o700});
    if(realpathSync(root)!==root||(statSync(root).mode&0o077)!==0)throw Error("Private export directory must be nonsymlinked and owner-only");
    const document=finiteCompanyDocument(await readRetainedFinite(arg,extra));
    const bytes=action==="finite-json"?Buffer.from(JSON.stringify(document,null,2)):finiteCompanyWorkbook(document);
    writeFileSync(file,bytes,{flag:"wx",mode:0o600});
    console.log(JSON.stringify({documentId:document.id,bytes:bytes.length,private:true,scientificAcceptance:false}));
  }else if(action==="stage-sources"){
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
