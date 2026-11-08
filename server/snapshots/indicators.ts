import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisChunks, cvAnalysisSnapshots, indicatorValues } from "../../shared/schema";
import { snapshotsAvailable } from "./store";
import { packIndicators, unpackIndicators } from "./indicatorContract";

/** Operator capture only: GET requests never write to the archive. */
export async function captureApprovedIndicators() {
  if (!await snapshotsAvailable()) throw new Error("Immutable snapshot storage is not provisioned");
  return db.transaction(async tx => {
    const rows = await tx.select().from(indicatorValues).where(eq(indicatorValues.status, "approved"));
    const packed = packIndicators(rows);
    const inserted = await tx.insert(cvAnalysisSnapshots).values({
      id: packed.id, kind: "indicator-overrides", companyCount: 0,
      observationCount: rows.length, chunkCount: 1,
      sourceNote: "Approved indicator capture; collection/approval dates do not establish original publication vintages",
    }).onConflictDoNothing().returning();
    if (inserted.length) await tx.insert(cvAnalysisChunks).values({
      snapshotId: packed.id, ordinal: 0, payload: packed.payload,
    });
    return { id: packed.id, observations: rows.length, created: inserted.length > 0 };
  }, { isolationLevel: "repeatable read" });
}
export async function loadIndicatorSnapshot(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid indicator snapshot identity");
  if (!await snapshotsAvailable()) throw new Error("Immutable snapshot storage is not provisioned");
  const [header] = await db.select().from(cvAnalysisSnapshots).where(and(
    eq(cvAnalysisSnapshots.id, id), eq(cvAnalysisSnapshots.kind, "indicator-overrides")));
  if (!header || header.chunkCount !== 1) throw new Error("Indicator snapshot not found");
  const chunks = await db.select().from(cvAnalysisChunks)
    .where(eq(cvAnalysisChunks.snapshotId, id)).orderBy(asc(cvAnalysisChunks.ordinal));
  if (chunks.length !== 1 || chunks[0].ordinal !== 0) throw new Error("Incomplete indicator snapshot");
  const rows = unpackIndicators(id, chunks[0].payload);
  if (rows.length !== header.observationCount) throw new Error("Indicator snapshot count mismatch");
  return rows;
}
