import { AsyncLocalStorage } from "node:async_hooks";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisChunks, cvAnalysisSnapshots } from "../../shared/schema";
import { snapshotsAvailable } from "./store";
import { packOverlay, unpackOverlay, type CompanyOverlay } from "./overlayContract";
export const overlayContext = new AsyncLocalStorage<{ ids: string[]; cutoff: string; overlays: CompanyOverlay[] }>();

/** Archive already-reviewed input; this is not an approval operation. CLI caller
 * must provide real review evidence. No public write route is exposed. */
export async function captureOverlay(entries: unknown) {
  const packed = packOverlay(entries);
  await db.transaction(async tx => {
    if (!await snapshotsAvailable(tx)) throw new Error("Immutable overlay archive not provisioned");
    const inserted = await tx.insert(cvAnalysisSnapshots).values({
      id: packed.id, kind: "company-overlay", companyCount: new Set(packed.payload.entries.map(e => e.companyId)).size,
      observationCount: packed.payload.entries.length, chunkCount: 1,
      sourceNote: "Reviewed revised-history company overlay; dates are supplied evidence, not independent vintage certification",
    }).onConflictDoNothing().returning();
    if (inserted.length) await tx.insert(cvAnalysisChunks).values({
      snapshotId: packed.id, ordinal: 0, payload: packed.payload,
    });
  });
  return packed.id;
}
export async function loadOverlay(id: string, connection: Pick<typeof db, "execute" | "select"> = db) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid overlay ID");
  if (!await snapshotsAvailable(connection)) throw new Error("Immutable overlay archive not provisioned");
  const [header] = await connection.select().from(cvAnalysisSnapshots).where(and(
    eq(cvAnalysisSnapshots.id, id), eq(cvAnalysisSnapshots.kind, "company-overlay")));
  if (!header || header.chunkCount !== 1) throw new Error("Overlay archive unavailable");
  const chunks = await connection.select().from(cvAnalysisChunks).where(eq(cvAnalysisChunks.snapshotId, id));
  if (chunks.length !== 1 || chunks[0].ordinal !== 0) throw new Error("Incomplete overlay archive");
  const payload = unpackOverlay(id, chunks[0].payload);
  if (payload.entries.length !== header.observationCount) throw new Error("Overlay count mismatch");
  return payload;
}
