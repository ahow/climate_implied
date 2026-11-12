import { sql } from "drizzle-orm";
import { db } from "../db";
import { contentHash } from "../calculation/analysisManifest";
import { snapshotsAvailable } from "./store";
import { requestOverrides } from "../dataIngestion/requestOverrides";
import { getAllHistoricalIndicatorsWithNowcast } from "../calculation/historicalIndicators";
import { calculationSourceArtifact } from "./calculationSourceArtifact";

function sourceBundle() {
  return calculationSourceArtifact();
}
export function currentSourceArchiveId() { return sourceBundle().id; }
/** Read-only access to the existing source/config archive representation.
 * Static public references identify checked-in bytes, not database persistence
 * or an executed model. Never call the persistence helpers from their GETs. */
export function readCalculationSourceArtifact() {
  return structuredClone(sourceBundle());
}
/** Reuse the existing private immutable source archive; no new storage/schema. */
export async function captureCalculationSource() {
  const source = sourceBundle();
  await save("calculation-source", source.payload);
  return source.id;
}
export async function saveReadonlyDiffMaterial(payload: unknown) {
  return save("readonly-diff-material", payload);
}
/** Versioned legacy input/material envelopes reuse the established private
 * material-inputs kind; no new table, resource, publication or DDL. */
export async function saveLegacyExportMaterial(payload: unknown) {
  return save("material-inputs", payload);
}
export async function saveNativeCandidateArchive(kind: "native-candidate-inputs" | "native-candidate-material", payload: unknown) {
  return save(kind, payload);
}
async function save(kind:string,payload:unknown) {
  const id=contentHash(payload);
  await db.transaction(async tx=>{
    if(!await snapshotsAvailable(tx)) throw new Error("Material input archive unavailable");
    const inserted=await tx.execute(sql`INSERT INTO cv_analysis_snapshots
      (id,kind,company_count,observation_count,chunk_count,source_note)
      VALUES (${id},${kind},0,1,1,'Consumed material inputs and source version; revised history')
      ON CONFLICT(id) DO NOTHING RETURNING id`);
    if(inserted.rows.length) await tx.execute(sql`INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload)
      VALUES (${id},0,${JSON.stringify(payload)}::jsonb)`);
  });
  return id;
}
export async function captureMaterialInputs(input: {
  workbook:string; overlays:string[]; cutoff:string|null; readsIndicators:boolean;
}) {
  const source=sourceBundle();
  await save("calculation-source",source.payload);
  const override=requestOverrides.getStore();
  const approvedValues= input.readsIndicators ? Array.from(override?.values.values() ?? []) : [];
  if(input.readsIndicators && !override) throw new Error("Indicator request context absent");
  if(input.cutoff && approvedValues.some(v=>v.asOfDate && v.asOfDate.slice(0,10)>input.cutoff!))
    throw new Error("Indicator source availability exceeds cutoff");
  const effectiveHistoricalIndicators = input.readsIndicators ? getAllHistoricalIndicatorsWithNowcast() : null;
  if(input.cutoff && effectiveHistoricalIndicators?.some(row=>row.year>Number(input.cutoff!.slice(0,4))))
    throw new Error("Effective indicator year exceeds information cutoff");
  const payload={ version:"material-inputs-1",...input,sourceArchive:source.id,
    approvedValues,indicatorHash:override?.hash ?? null,effectiveHistoricalIndicators,
    asOfMeaning:"UTC end-of-day source/approval cutoff; revised-history workbook, not certified original vintages",
    nonConsumed:["provider quotes","unapproved financial proposals","news","unselected regional scenario"] };
  return { id:await save("material-inputs",payload),sourceId:source.id };
}
export async function loadMaterialArchive(id:string,kind:"material-inputs"|"calculation-source"|"readonly-diff-material"|"native-candidate-inputs"|"native-candidate-material") {
  if(!/^[a-f0-9]{64}$/.test(id) || !await snapshotsAvailable()) throw new Error("Material archive unavailable");
  const rows=await db.execute(sql`SELECT s.chunk_count,c.ordinal,c.payload FROM cv_analysis_snapshots s
    JOIN cv_analysis_chunks c ON c.snapshot_id=s.id WHERE s.id=${id} AND s.kind=${kind}`);
  if(rows.rows.length!==1 || rows.rows[0].ordinal!==0 || rows.rows[0].chunk_count!==1 ||
    contentHash(rows.rows[0].payload)!==id) throw new Error("Missing or corrupt material archive");
  return rows.rows[0].payload as any;
}
