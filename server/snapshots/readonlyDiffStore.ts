import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisChunks, cvAnalysisSnapshots } from "../../shared/schema";
import { snapshotsAvailable } from "./store";
import type { ReadonlyDiffRepository } from "../readonlyDiffApi";
import type { DiffArchive } from "./readonlyDiffContract";
import { loadAnalysisResult } from "./results";

/** Explicit immutable identities only. No collectors, writes or latest-version lookup. */
export const readonlyDiffRepository: ReadonlyDiffRepository = {
  async load(id, kind) {
    if (!/^[a-f0-9]{64}$/.test(id) || !await snapshotsAvailable()) throw new Error("Archive unavailable");
    const [header] = await db.select().from(cvAnalysisSnapshots).where(and(
      eq(cvAnalysisSnapshots.id, id), eq(cvAnalysisSnapshots.kind, kind)));
    if (!header) throw new Error("Requested version not found");
    const chunks = await db.select().from(cvAnalysisChunks)
      .where(eq(cvAnalysisChunks.snapshotId, id)).orderBy(asc(cvAnalysisChunks.ordinal));
    if (chunks.length !== header.chunkCount || chunks.some((c,i) => c.ordinal !== i))
      throw new Error("Missing or corrupt chunks");
    return { id, kind, chunks: chunks.map(c => c.payload), companyCount: header.companyCount,
      observationCount: header.observationCount } as DiffArchive;
  },
  async results(after) {
    if (!await snapshotsAvailable()) throw new Error("Archive unavailable");
    const headers = await db.select().from(cvAnalysisSnapshots).where(and(
      eq(cvAnalysisSnapshots.kind, "analysis-result"), after ? gt(cvAnalysisSnapshots.id, after) : undefined))
      .orderBy(asc(cvAnalysisSnapshots.id)).limit(21);
    const page = headers.slice(0, 20);
    const items: { id: string; payload: unknown; recordedAt: string }[] = [];
    // Sequential, bounded validation avoids loading many retained workbooks in parallel.
    for (const h of page) {
      await loadAnalysisResult(h.id);
      const chunks = await db.select().from(cvAnalysisChunks).where(eq(cvAnalysisChunks.snapshotId, h.id));
      if (h.chunkCount !== 1 || h.observationCount !== 1 || chunks.length !== 1 || chunks[0].ordinal !== 0)
        throw new Error("Missing or corrupt archived analysis");
      items.push({ id: h.id, payload: chunks[0].payload, recordedAt: h.createdAt.toISOString() });
    }
    return { items, nextCursor: headers.length > 20 ? page[page.length - 1].id : null };
  },
};
