import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisChunks, cvAnalysisSnapshots } from "../../shared/schema";
import { snapshotsAvailable } from "../snapshots/store";
import {
  FETCH_SUMMARY_KIND, unverifiedFetchSummary, type FetchSummaryEvidence,
} from "../../shared/fetchSummarySemantics";
import {
  packFetchSummaryManifest, verifyFetchSummaryManifest,
  type SummaryProducer, type SummaryRun,
} from "./summaryContract";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Called ONLY by the prospective producer's existing finish transaction.
 * No archive backfill, DDL, cadence change, collection trigger or GET-side write.
 * Existing provisioned append-only snapshot/chunk storage is reused.
 */
export async function archiveFetchSummary(tx:Transaction,run:SummaryRun,producer:SummaryProducer) {
  if(!await snapshotsAvailable(tx)) {
    console.warn("[fetch-summary-archive] immutable storage not provisioned; retained summary remains unverified");
    return unverifiedFetchSummary("Immutable snapshot storage is not provisioned; raw summary retained without provenance");
  }
  const packed=packFetchSummaryManifest(run,producer);
  const inserted=await tx.insert(cvAnalysisSnapshots).values({
    id:packed.id,kind:FETCH_SUMMARY_KIND,parentId:run.id,
    companyCount:0,observationCount:1,chunkCount:1,
    sourceNote:"Prospective ingestion producer provenance only; not source publication vintage or scientific acceptance",
  }).onConflictDoNothing().returning();
  if(inserted.length) await tx.insert(cvAnalysisChunks).values({
    snapshotId:packed.id,ordinal:0,payload:packed.manifest,
  });
  // Verify even on conflict; an existing incomplete/corrupt archive is an error,
  // never a successful provenance claim.
  const [header]=await tx.select().from(cvAnalysisSnapshots).where(eq(cvAnalysisSnapshots.id,packed.id));
  const chunks=await tx.select().from(cvAnalysisChunks)
    .where(eq(cvAnalysisChunks.snapshotId,packed.id)).orderBy(asc(cvAnalysisChunks.ordinal));
  if(!header || header.kind!==FETCH_SUMMARY_KIND || header.parentId!==run.id ||
    header.chunkCount!==1 || header.observationCount!==1 ||
    chunks.length!==1 || chunks[0].ordinal!==0)
    throw new Error("Missing or conflicting prospective summary archive");
  return verifyFetchSummaryManifest(run,packed.id,chunks[0].payload);
}

/** Read-only sidecars keyed by run ID. Original run objects are not rewritten. */
export async function loadFetchSummaryEvidence(runs:readonly SummaryRun[]):Promise<Record<string,FetchSummaryEvidence>> {
  const result:Record<string,FetchSummaryEvidence>={};
  if(runs.length===0) return result;
  if(!await snapshotsAvailable()) {
    for(const run of runs) result[run.id]=unverifiedFetchSummary(
      "Immutable snapshot storage is not provisioned; raw summary retained without provenance");
    return result;
  }
  for(const run of runs) {
    try {
      const headers=await db.select().from(cvAnalysisSnapshots).where(and(
        eq(cvAnalysisSnapshots.kind,FETCH_SUMMARY_KIND),eq(cvAnalysisSnapshots.parentId,run.id)));
      if(headers.length===0) {
        result[run.id]=unverifiedFetchSummary("No prospective producer manifest for this run; historical raw JSON is unverified");
        continue;
      }
      if(headers.length!==1 || headers[0].chunkCount!==1 || headers[0].observationCount!==1)
        throw new Error("Conflicting or incomplete producer manifest headers");
      const chunks=await db.select().from(cvAnalysisChunks)
        .where(eq(cvAnalysisChunks.snapshotId,headers[0].id)).orderBy(asc(cvAnalysisChunks.ordinal));
      if(chunks.length!==1 || chunks[0].ordinal!==0) throw new Error("Incomplete producer manifest chunks");
      result[run.id]=verifyFetchSummaryManifest(run,headers[0].id,chunks[0].payload);
    } catch(error) {
      result[run.id]=unverifiedFetchSummary(`Producer manifest verification failed: ${
        error instanceof Error ? error.message : String(error)}`);
    }
  }
  return result;
}
