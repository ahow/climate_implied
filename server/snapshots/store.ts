import { AsyncLocalStorage } from "node:async_hooks";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisChunks, cvAnalysisSnapshots, cvCompanies, cvTimeSeries, type CvCompany, type CvTimeSeries } from "../../shared/schema";
import { packDataset, unpackDataset, type DatasetChunk } from "./contract";
import { snapshotSelection } from "./requestContract";
import { snapshotGuardQuery, guardRowsValid } from "./guards";

export type SnapshotHeader = typeof cvAnalysisSnapshots.$inferSelect;
export const snapshotContext = new AsyncLocalStorage<SnapshotHeader>();
// Private replay injection: same immutable contract/calculators, no database fallback.
// Not bound to any HTTP input or public control.
const replayWorkbookContext = new AsyncLocalStorage<{
  id: string; data: ReturnType<typeof unpackDataset>;
}>();
export function runWithReplayWorkbook<T>(bundle: { id: string; chunks: DatasetChunk[] }, work: () => T): T {
  // Validate and detach ONCE at the private replay boundary, not once per
  // calculator. A retained workbook can exceed 100 MB; repeatedly cloning and
  // canonical-hashing all its chunks dominates a nine-calculator recovery.
  // Never cache by ID globally: concurrent replay scopes may not share state.
  const data = unpackDataset(bundle.id, structuredClone(bundle.chunks));
  return replayWorkbookContext.run({ id: bundle.id, data }, work);
}

export async function snapshotsAvailable(connection: Pick<typeof db, "execute"> = db) {
  const result = await connection.execute(snapshotGuardQuery);
  return guardRowsValid(result.rows);
}
export async function resolveSnapshot(id?: string) {
  snapshotSelection(id);
  if (!await snapshotsAvailable()) {
    if (id) throw new Error("Snapshot storage is not provisioned");
    return undefined;
  }
  const [row] = id
    ? await db.select().from(cvAnalysisSnapshots).where(eq(cvAnalysisSnapshots.id, id))
    : await db.select().from(cvAnalysisSnapshots).where(eq(cvAnalysisSnapshots.kind, "workbook-baseline"))
      .orderBy(desc(cvAnalysisSnapshots.createdAt), asc(cvAnalysisSnapshots.id)).limit(1);
  if (id && !row) throw new Error("Snapshot not found");
  if (row && row.kind !== "workbook-baseline") throw new Error("Requested snapshot is not a workbook");
  return row;
}
export async function loadSnapshot(header: SnapshotHeader) {
  const replay = replayWorkbookContext.getStore();
  if (replay) {
    if (replay.id !== header.id) throw new Error("Replay workbook selection mismatch");
    // Each consumer still gets detached mutable rows/dates; sorting, overlay
    // application or carry-forward cannot poison subsequent reads.
    const result = {
      companies: structuredClone(replay.data.companies),
      timeSeries: replay.data.timeSeries.map(row => ({ ...row, date: new Date(row.date) })),
    };
    if (result.companies.length !== header.companyCount || result.timeSeries.length !== header.observationCount)
      throw new Error("Replay snapshot population mismatch");
    return result;
  }
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
  if (!await snapshotsAvailable(tx)) throw new Error("Database immutability guards are not installed");
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
