import { AsyncLocalStorage } from "node:async_hooks";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisChunks, cvAnalysisSnapshots, cvCompanies, cvTimeSeries, type CvCompany, type CvTimeSeries } from "../../shared/schema";
import { packDataset, unpackDataset, type DatasetChunk } from "./contract";

export type SnapshotHeader = typeof cvAnalysisSnapshots.$inferSelect;
export const snapshotContext = new AsyncLocalStorage<SnapshotHeader>();

export async function snapshotsAvailable() {
  const result = await db.execute(sql`SELECT to_regclass('public.cv_analysis_snapshots') IS NOT NULL
    AND to_regclass('public.cv_analysis_chunks') IS NOT NULL
    AND (SELECT count(*) FROM pg_trigger WHERE tgname IN
      ('cv_snapshot_header_immutable','cv_snapshot_chunk_immutable',
       'cv_snapshot_header_truncate','cv_snapshot_chunk_truncate','cv_snapshot_chunk_insert')
       AND NOT tgisinternal AND tgenabled='O') = 5 AS ready`);
  return result.rows[0]?.ready === true;
}
export async function resolveSnapshot(id?: string) {
  if (id && !/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid snapshot identity");
  if (!await snapshotsAvailable()) {
    if (id) throw new Error("Snapshot storage is not provisioned");
    return undefined;
  }
  const [row] = id
    ? await db.select().from(cvAnalysisSnapshots).where(eq(cvAnalysisSnapshots.id, id))
    : await db.select().from(cvAnalysisSnapshots).where(eq(cvAnalysisSnapshots.kind, "workbook-baseline"))
      .orderBy(desc(cvAnalysisSnapshots.createdAt), asc(cvAnalysisSnapshots.id)).limit(1);
  if (id && !row) throw new Error("Snapshot not found");
  return row;
}
export async function loadSnapshot(header: SnapshotHeader) {
  const chunks = await db.select().from(cvAnalysisChunks)
    .where(eq(cvAnalysisChunks.snapshotId, header.id)).orderBy(asc(cvAnalysisChunks.ordinal));
  if (chunks.length !== header.chunkCount || chunks.some((c, i) => c.ordinal !== i))
    throw new Error("Incomplete snapshot chunks");
  const result = unpackDataset(header.id, chunks.map(c => c.payload as DatasetChunk));
  if (result.companies.length !== header.companyCount || result.timeSeries.length !== header.observationCount)
    throw new Error("Snapshot population mismatch");
  return result;
}
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function persist(tx: Transaction, companies: CvCompany[], rows: CvTimeSeries[], sourceNote: string, sourceUploadId?: number) {
  // A schema without immutability guards is not adequate, even if reads work.
  const guards = await tx.execute(sql`SELECT count(*)::int AS n FROM pg_trigger
    WHERE tgname IN ('cv_snapshot_header_immutable','cv_snapshot_chunk_immutable',
      'cv_snapshot_header_truncate','cv_snapshot_chunk_truncate','cv_snapshot_chunk_insert')
      AND NOT tgisinternal AND tgenabled = 'O'`);
  if (Number(guards.rows[0]?.n) !== 5) throw new Error("Database immutability guards are not installed");
  const packed = packDataset(companies, rows);
  const inserted = await tx.insert(cvAnalysisSnapshots).values({
    id: packed.id, kind: "workbook-baseline", sourceUploadId: sourceUploadId ?? null,
    companyCount: packed.companyCount, observationCount: packed.observationCount,
    chunkCount: packed.chunks.length, sourceNote,
  }).onConflictDoNothing().returning();
  if (inserted.length) for (let i = 0; i < packed.chunks.length; i++)
    await tx.insert(cvAnalysisChunks).values({ snapshotId: packed.id, ordinal: i, payload: packed.chunks[i] });
  return { id: packed.id, companyCount: packed.companyCount, observationCount: packed.observationCount, created: !!inserted.length };
}
export async function captureCurrentWorkbook() {
  return db.transaction(async tx => {
    const companies = await tx.select().from(cvCompanies);
    const rows = await tx.select().from(cvTimeSeries);
    return persist(tx, companies, rows, "Existing revised workbook database; stored precision retained; original source precision and publication vintages not reconstructed");
  }, { isolationLevel: "repeatable read" });
}
export async function saveImportedWorkbook(companies: CvCompany[], rows: CvTimeSeries[], note: string) {
  return db.transaction(tx => persist(tx, companies, rows, note), { isolationLevel: "repeatable read" });
}
