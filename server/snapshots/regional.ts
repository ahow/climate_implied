import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisSnapshots, cvAnalysisChunks } from "../../shared/schema";
import { snapshotsAvailable } from "./store";
import { packRegional, unpackRegional } from "./regionalContract";
import { snapshotSelection } from "./requestContract";
export async function captureRegionalInputs(input: unknown) {
  const packed = packRegional(input);
  return db.transaction(async tx => {
    if (!await snapshotsAvailable(tx)) throw new Error("Immutable archive not provisioned");
    const inserted = await tx.insert(cvAnalysisSnapshots).values({
      id: packed.id, kind: "regional-intensity", companyCount: 0, observationCount: 4,
      chunkCount: 1, sourceNote: packed.payload.source + "; " + packed.payload.observationVintage,
    }).onConflictDoNothing().returning();
    if (inserted.length) await tx.insert(cvAnalysisChunks).values({
      snapshotId: packed.id, ordinal: 0, payload: packed.payload,
    });
    return { id: packed.id, created: inserted.length > 0 };
  });
}
export async function loadRegionalInputs(id: string) {
  snapshotSelection(id);
  if (!await snapshotsAvailable()) throw new Error("Immutable archive not provisioned");
  const [header] = await db.select().from(cvAnalysisSnapshots).where(and(
    eq(cvAnalysisSnapshots.id, id), eq(cvAnalysisSnapshots.kind, "regional-intensity")));
  if (!header || header.chunkCount !== 1 || header.observationCount !== 4)
    throw new Error("Regional archive not found");
  const chunks = await db.select().from(cvAnalysisChunks).where(eq(cvAnalysisChunks.snapshotId, id))
    .orderBy(asc(cvAnalysisChunks.ordinal));
  if (chunks.length !== 1 || chunks[0].ordinal !== 0) throw new Error("Incomplete regional archive");
  return unpackRegional(id, chunks[0].payload);
}
