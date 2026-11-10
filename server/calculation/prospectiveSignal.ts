import {z} from "zod";
import {contentHash} from "./analysisManifest";
import {pairedCompanyGap,rankPairedCompanyGaps} from "./pairedCompanyGap";
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const prospectiveSignalRequestSchema=z.object({
 version:z.literal("prospective-paired-signal-1"),protocolHash:hash,universeHash:hash,
 origin:z.string().datetime(),executionNotBefore:z.string().datetime(),outcomeNotBefore:z.string().datetime(),
 expectedCompanyIds:z.array(z.string().min(1)).min(2),pairs:z.array(z.unknown()).min(2),
}).strict();
/** Caller-supplied clock is supplied by the database transaction, never by CLI input. */
export function prepareProspectiveSignal(input:unknown,capturedAt:string){
 const x=prospectiveSignalRequestSchema.parse(input),now=z.string().datetime().parse(capturedAt);
 if(Date.parse(x.origin)>Date.parse(now)||Date.parse(now)>=Date.parse(x.executionNotBefore)||
   Date.parse(x.executionNotBefore)>=Date.parse(x.outcomeNotBefore)) throw new Error("Capture must precede execution and outcomes");
 const ids=[...x.expectedCompanyIds].sort();
 if(new Set(ids).size!==ids.length)throw new Error("Duplicate universe identity");
 const paired=x.pairs.map(p=>pairedCompanyGap(p));
 if(paired.some(p=>p.origin!==x.origin)||JSON.stringify(paired.map(p=>p.companyId).sort())!==JSON.stringify(ids))
  throw new Error("Incomplete or conflicting prospective universe");
 const signals=rankPairedCompanyGaps(paired);
 return {version:x.version,protocolHash:x.protocolHash,universeHash:x.universeHash,origin:x.origin,
  executionNotBefore:x.executionNotBefore,outcomeNotBefore:x.outcomeNotBefore,expectedCompanyIds:ids,
  requestHash:contentHash({...x,expectedCompanyIds:ids,pairs:[...paired].sort((a,b)=>a.companyId.localeCompare(b.companyId))}),
  capturedAt:now,signals,scientificAcceptance:false,ownerApproved:false,
  evidenceStatus:"prospective clock recorded; caller-supplied archive identities not independently authenticated"};
}
