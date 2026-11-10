import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { cvAnalysisChunks, cvAnalysisSnapshots } from "../../shared/schema";
import { packAnalysisResult, unpackAnalysisResult } from "./resultContract";
import { snapshotsAvailable } from "./store";
import { createManifest } from "../calculation/analysisManifest";
import { loadMaterialArchive } from "./materialInputs";
import { resolveSnapshot, loadSnapshot } from "./store";
import { loadOverlay } from "./overlays";

export async function saveAnalysisResult(manifest: ReturnType<typeof createManifest>, result: unknown) {
  const packed = packAnalysisResult(manifest, result);
  await db.transaction(async tx => {
    if (!await snapshotsAvailable(tx)) throw new Error("Immutable analysis archive is unavailable");
    const inserted = await tx.insert(cvAnalysisSnapshots).values({
      id: packed.id, kind: "analysis-result", companyCount: 0, observationCount: 1,
      chunkCount: 1, parentId: manifest.snapshotHashes[0],
      sourceNote: "Completed JSON response; replay is stored-output retrieval, not independent recalculation or validation",
    }).onConflictDoNothing().returning();
    if (inserted.length) await tx.insert(cvAnalysisChunks).values({
      snapshotId: packed.id, ordinal: 0, payload: packed.payload,
    });
  });
  return packed.id;
}
export async function loadAnalysisResult(id: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid analysis result identity");
  if (!await snapshotsAvailable()) throw new Error("Immutable analysis archive is unavailable");
  const [header] = await db.select().from(cvAnalysisSnapshots).where(and(
    eq(cvAnalysisSnapshots.id, id), eq(cvAnalysisSnapshots.kind, "analysis-result")));
  if (!header || header.chunkCount !== 1 || header.observationCount !== 1)
    throw new Error("Analysis result not found");
  const chunks = await db.select().from(cvAnalysisChunks).where(eq(cvAnalysisChunks.snapshotId, id));
  if (chunks.length !== 1 || chunks[0].ordinal !== 0) throw new Error("Incomplete analysis result");
  const payload=unpackAnalysisResult(id, chunks[0].payload);
  const materialId=payload.manifest.settings.materialInputsId;
  if(materialId !== undefined) {
    if(typeof materialId!=="string") throw new Error("Invalid material identity");
    const material=await loadMaterialArchive(materialId,"material-inputs");
    if(material.sourceArchive!==payload.manifest.codeVersion ||
      material.workbook!==payload.manifest.snapshotHashes[0])
      throw new Error("Conflicting material manifest");
    await loadMaterialArchive(material.sourceArchive,"calculation-source");
    const baseline=await resolveSnapshot(material.workbook);
    if(!baseline) throw new Error("Missing material workbook");
    await loadSnapshot(baseline);
    for(const overlayId of material.overlays) {
      const overlay=await loadOverlay(overlayId);
      if(!material.cutoff || overlay.entries.some(e=>e.availableAt>material.cutoff))
        throw new Error("Future material overlay");
    }
    if(JSON.stringify(material.overlays)!==JSON.stringify(payload.manifest.snapshotHashes.slice(1,1+material.overlays.length)))
      throw new Error("Conflicting overlay order");
  }
  return { ...payload, id, recordedAt: header.createdAt,
    materialReplayState: materialId === undefined ? "legacy-result-without-material-bundle" : "referenced-material-archives-verified",
    replayMeaning: "Stored output, not a recalculation; immutable workbook inputs do not establish original publication vintages" };
}
