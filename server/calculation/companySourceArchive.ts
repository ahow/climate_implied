import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { validateCompanyInputEvidence } from "./companyProjectionAsOf";

const hash=z.string().regex(/^[a-f0-9]{64}$/);
const instant=z.string().datetime();
export const companySourceSchema=z.object({
  version:z.literal("company-operating-source-1"),
  companyId:z.string().min(1),isin:z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/),
  url:z.string().url().refine(s=>s.startsWith("https://"),"HTTPS source required"),
  publisher:z.string().min(1),publishedAt:instant.nullable(),retrievedAt:instant,
  publishedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  content:z.string().min(1),contentHash:hash,
  licence:z.string().min(1),
  claims:z.array(z.object({
    path:z.string().startsWith("/"),valueHash:hash,locator:z.string().min(1),
    unit:z.string().min(1),period:z.string().min(1),geography:z.string().min(1),
    basis:z.enum(["observed","assumption","revised-history"]),
    availableAt:instant,method:z.string().min(1),dependencies:z.array(z.string()),
    value:z.unknown().optional(),
  }).strict()).min(1),
}).strict();

/** Content identity is distinct from publisher authenticity and owner approval. */
export function packCompanySource(value:unknown) {
  const source=companySourceSchema.parse(value);
  if(contentHash(source.content)!==source.contentHash) throw new Error("Source content hash mismatch");
  if(source.publishedAt&&Date.parse(source.publishedAt)>Date.parse(source.retrievedAt)) throw new Error("Publication after retrieval");
  if(source.publishedDate&&(!Number.isFinite(Date.parse(source.publishedDate))||
    new Date(source.publishedDate).toISOString().slice(0,10)!==source.publishedDate||
    source.publishedDate>source.retrievedAt.slice(0,10))) throw new Error("Invalid publication calendar date");
  if(source.publishedDate&&source.publishedAt&&source.publishedAt.slice(0,10)!==source.publishedDate)
    throw new Error("Conflicting publication date and timestamp");
  if(new Set(source.claims.map(c=>c.path)).size!==source.claims.length) throw new Error("Duplicate source claim");
  for(const claim of source.claims) {
    if(Object.hasOwn(claim,"value")&&contentHash(claim.value)!==claim.valueHash) throw new Error("Claim value hash mismatch");
    if(Date.parse(claim.availableAt)>Date.parse(source.retrievedAt) || (source.publishedAt&&Date.parse(claim.availableAt)<Date.parse(source.publishedAt)))
      throw new Error("Conflicting source availability");
    if(source.publishedDate&&claim.availableAt.slice(0,10)<source.publishedDate) throw new Error("Claim predates publication date");
    if(!source.publishedAt&&claim.basis==="observed")
      throw new Error("Unknown publication cannot certify observed historical availability");
  }
  source.claims.sort((a,b)=>a.path.localeCompare(b.path));
  return {id:contentHash(source),payload:source};
}
export function unpackCompanySource(id:string,value:unknown) {
  hash.parse(id);
  const parsed=packCompanySource(value);
  if(parsed.id!==id) throw new Error("Corrupt company source archive");
  return parsed.payload;
}
type EvidenceRow={path:string;valueHash:string;sourceArchiveId:string;availableAt:string;basis:string};
/** Resolve EVERY source, including assumption evidence. No current-source fallback. */
export async function resolveCompanySourceEvidence(input:unknown,evidence:unknown,cutoff:string,
  identity:{companyId:string;isin:string},
  load:(id:string)=>Promise<unknown>) {
  const manifest=validateCompanyInputEvidence(input,evidence,cutoff);
  const sources=new Map<string,ReturnType<typeof unpackCompanySource>>();
  for(const id of manifest.sourceArchiveIds) sources.set(id,unpackCompanySource(id,await load(id)));
  // unpackCompanySource already rejects duplicate paths. Indexing preserves that
  // strict contract while avoiding a quadratic scan over large retained inputs.
  const claimsByArchive=new Map(Array.from(sources,([id,source])=>[id,new Map(source.claims.map(c=>[c.path,c]))]));
  for(const row of evidence as EvidenceRow[]) {
    const source=sources.get(row.sourceArchiveId)!;
    if(source.companyId!==identity.companyId||source.isin!==identity.isin)
      throw new Error("Source company identity mismatch");
    const claim=claimsByArchive.get(row.sourceArchiveId)!.get(row.path);
    if(!claim||claim.valueHash!==row.valueHash||Date.parse(claim.availableAt)!==Date.parse(row.availableAt)||claim.basis!==row.basis)
      throw new Error("Missing or conflicting archived claim");
    if(source.publishedAt&&Date.parse(source.publishedAt)>Date.parse(cutoff)) throw new Error("Future source publication");
    if(source.publishedDate&&source.publishedDate>cutoff.slice(0,10)) throw new Error("Future source publication date");
  }
  return {...manifest,archiveHashes:Array.from(sources.keys()).sort(),
    originalVintageProven:false as const,
    evidenceWarning:"Resolved content and reviewed claims do not independently establish historical publication or calibrated coefficients"};
}
