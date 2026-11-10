import {sql} from "drizzle-orm";
import {db} from "../db";
import {snapshotsAvailable} from "./store";
import {contentHash} from "../calculation/analysisManifest";
import {prepareProspectiveSignal,prospectiveSignalRequestSchema} from "../calculation/prospectiveSignal";
/** Operator-only append into existing immutable storage; no DDL or approval. */
export async function captureProspectiveSignalInTransaction(tx:Pick<typeof db,"execute">,input:unknown){
 if(!await snapshotsAvailable(tx))throw new Error("Immutable signal archive unavailable");
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('prospective-paired-signal'))`);
 const request=prospectiveSignalRequestSchema.parse(input);
 const previous=await tx.execute(sql`SELECT s.id,c.payload FROM cv_analysis_snapshots s JOIN cv_analysis_chunks c ON c.snapshot_id=s.id
  WHERE s.kind='prospective-paired-signal' AND c.payload->>'protocolHash'=${request.protocolHash}
  AND c.payload->>'universeHash'=${request.universeHash} AND c.payload->>'origin'=${request.origin}`);
 if(previous.rows.length>1)throw new Error("Conflicting prospective captures");
 if(previous.rows.length){
  const old=previous.rows[0].payload as ReturnType<typeof prepareProspectiveSignal>;
  if(contentHash(old)!==previous.rows[0].id||old.requestHash!==prepareProspectiveSignal(request,old.capturedAt).requestHash)throw new Error("Conflicting prospective signal; cannot overwrite");
  return {id:String(previous.rows[0].id),payload:old,repeated:true};
 }
 const clock=await tx.execute(sql`SELECT clock_timestamp() AS now`);
 const payload=prepareProspectiveSignal(request,new Date(clock.rows[0].now as string).toISOString());
 const id=contentHash(payload);
 await tx.execute(sql`INSERT INTO cv_analysis_snapshots(id,kind,company_count,observation_count,chunk_count,source_note)
 VALUES(${id},'prospective-paired-signal',${payload.signals.length},1,1,'Prospective submitted signal; no scientific or owner approval')`);
 await tx.execute(sql`INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload) VALUES(${id},0,${JSON.stringify(payload)}::jsonb)`);
 return {id,payload,repeated:false};
}
export const captureProspectiveSignal=(input:unknown)=>db.transaction(tx=>captureProspectiveSignalInTransaction(tx,input));
