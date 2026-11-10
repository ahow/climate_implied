import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { projectCompanyMembers } from "./companyProjection";
const evidenceSchema=z.array(z.object({
  path:z.string().startsWith("/"),valueHash:z.string().regex(/^[a-f0-9]{64}$/),
  sourceArchiveId:z.string().regex(/^[a-f0-9]{64}$/),
  availableAt:z.string().datetime(),basis:z.enum(["observed","assumption","revised-history"]),
}).strict());
export function materialLeaves(value:unknown,path=""): Record<string,unknown> {
  if(value!==null && typeof value==="object")
    return Object.fromEntries(Object.entries(value).flatMap(([k,v])=>
      Object.entries(materialLeaves(v,`${path}/${k.replace(/~/g,"~0").replace(/\//g,"~1")}`))));
  return {[path]:value};
}
/** Requires evidence for every leaf, including currency, operating geography,
 * member assumptions and attribution adjustments. Does not verify publishers. */
export function validateCompanyInputEvidence(input:unknown,evidence:unknown,cutoff:string) {
  z.string().datetime().parse(cutoff);
  const rows=evidenceSchema.parse(evidence).sort((a,b)=>a.path.localeCompare(b.path));
  const leaves=materialLeaves(input), paths=new Set(rows.map(r=>r.path));
  if(paths.size!==rows.length || rows.length!==Object.keys(leaves).length)
    throw new Error("Missing or duplicate material-input evidence");
  for(const row of rows) {
    if(!Object.hasOwn(leaves,row.path) || contentHash(leaves[row.path])!==row.valueHash)
      throw new Error("Conflicting material-input evidence");
    if(new Date(row.availableAt)>new Date(cutoff)) throw new Error("Future material input");
  }
  return { evidenceHash:contentHash(rows),sourceArchiveIds:Array.from(new Set(rows.map(r=>r.sourceArchiveId))).sort(),
    evidenceBasis:rows.some(r=>r.basis==="revised-history") ? "revised-history" : "source-asserted-not-independently-verified" };
}
export function projectCompanyAsOf(input:unknown,evidence:unknown,cutoff:string) {
  const manifest=validateCompanyInputEvidence(input,evidence,cutoff);
  return {...projectCompanyMembers(input),inputEvidence:manifest,informationCutoff:cutoff,
    scientificAcceptance:false,
    remainingGate:"Source archive IDs must be resolved and reviewed before historical or investment acceptance"};
}
