import {z} from "zod";
import {contentHash} from "./analysisManifest";
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const inputSchema=z.object({
 origin:z.string().datetime(),companyId:z.string().min(1),peer:z.string().min(1),
 projectionManifest:hash,valuationManifest:hash,
 projectionDefinition:z.object({currency:z.string(),basis:z.enum(["FCFE","FCFF"]),horizonYears:z.number().positive(),growthDefinition:z.string(),nominal:z.boolean()}).strict(),
 valuationDefinition:z.object({currency:z.string(),basis:z.enum(["FCFE","FCFF"]),horizonYears:z.number().positive(),growthDefinition:z.string(),nominal:z.boolean()}).strict(),
 projectionAvailableAt:z.string().datetime(),valuationAvailableAt:z.string().datetime(),
 members:z.array(z.object({id:z.string().min(1),projectedGrowth:z.number().finite().nullable(),impliedGrowth:z.number().finite().nullable()}).strict()).min(1),
}).strict();
/** Contract-level assembly, not proof that caller-supplied archives are authentic.
 * Missing members remain visible and prevent scoring; never silently select survivors.
 */
export function pairedCompanyGap(input:unknown){
 const x=inputSchema.parse(input);
 if(contentHash(x.projectionDefinition)!==contentHash(x.valuationDefinition)) throw new Error("Incompatible growth definitions");
 if([x.projectionAvailableAt,x.valuationAvailableAt].some(d=>Date.parse(d)>Date.parse(x.origin))) throw new Error("Future origin input");
 if(new Set(x.members.map(m=>m.id)).size!==x.members.length) throw new Error("Duplicate paired member");
 const members=[...x.members].sort((a,b)=>a.id.localeCompare(b.id)).map(m=>({...m,
   gap:m.projectedGrowth===null||m.impliedGrowth===null?null:m.projectedGrowth-m.impliedGrowth}));
 if(members.some(m=>m.gap!==null&&!Number.isFinite(m.gap))) throw new Error("Nonfinite gap");
 const missing=members.filter(m=>m.gap===null).map(m=>m.id);
 const sorted=members.map(m=>m.gap).filter((g):g is number=>g!==null).sort((a,b)=>a-b);
 const n=sorted.length;
 const median=missing.length?null:n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2;
 return {companyId:x.companyId,peer:x.peer,origin:x.origin,members,missingMembers:missing,
  medianPairedGap:median,contractHash:contentHash(x),status:missing.length?"unavailable-incomplete-pairs":"conditional-paired-gap",
  historicalEligible:false,scientificAcceptance:false,
  remainingGate:"Resolve immutable manifests, original availability and frozen family before historical evaluation; this pure contract does not authenticate evidence"};
}
/** Average ranks preserve ties. A singleton has no cross-sectional signal. */
export function rankPairedCompanyGaps(rows:ReturnType<typeof pairedCompanyGap>[]){
 if(new Set(rows.map(r=>r.companyId)).size!==rows.length) throw new Error("Duplicate issuer");
 if(new Set(rows.map(r=>r.origin)).size>1) throw new Error("Mixed origins");
 return [...rows].sort((a,b)=>a.companyId.localeCompare(b.companyId)).map(row=>{
  const peers=rows.filter(r=>r.peer===row.peer);
  if(peers.length<2||peers.some(r=>r.medianPairedGap===null)) return {...row,score:null,scoreStatus:"unavailable-incomplete-peer-group"};
  const value=row.medianPairedGap!;
  const lower=peers.filter(r=>r.medianPairedGap!<value).length;
  const tied=peers.filter(r=>r.medianPairedGap===value).length;
  return {...row,score:2*(lower+(tied-1)/2)/(peers.length-1)-1,scoreStatus:"conditional-within-peer-rank"};
 });
}
