import { contentHash, createManifest } from "../calculation/analysisManifest";
import { compareReadonlyArchives, diffQuerySchema, type DiffArchive } from "./readonlyDiffContract";
import { unpackAnalysisResult } from "./resultContract";
import { revisedHistoryType } from "../../shared/historicalTypes";
import { READONLY_PRODUCER_SCENARIO, readonlyConsumerSchema } from "../../shared/readonlyConsumer";
import type { ReadonlyDiffRepository } from "../readonlyDiffApi";
import { captureCalculationSource, saveReadonlyDiffMaterial, loadMaterialArchive } from "./materialInputs";
import { saveAnalysisResult, loadAnalysisResult } from "./results";
import { verifiedProducer } from "../producerDownload";
import { readonlyDiffRepository } from "./readonlyDiffStore";

export type ReadonlyDiffInputs = {
  query: { from: string; to: string; kind: DiffArchive["kind"]; after?: string };
  before: DiffArchive; next: DiffArchive; page: Awaited<ReturnType<ReadonlyDiffRepository["results"]>>;
};
/** Closed source-to-safe-report replay, shared by production and archive load.
 * Raw archive bytes stay in the existing private material store, never exports. */
export function replayReadonlyDiff(input: ReadonlyDiffInputs) {
  const { after, ...query } = input.query;
  diffQuerySchema.parse(query);
  if (after !== undefined && !/^[a-f0-9]{64}$/.test(after)) throw new Error("Invalid diff cursor");
  if (input.page.items.length > 20 || input.page.items.some((item, index, rows) =>
    !/^[a-f0-9]{64}$/.test(item.id) || !Number.isFinite(Date.parse(item.recordedAt)) ||
    (index > 0 && item.id <= rows[index - 1].id) || after !== undefined && item.id <= after))
    throw new Error("Diff result scan page conflicts with exact cursor/order");
  if (input.page.nextCursor !== null &&
    (!input.page.items.length || input.page.nextCursor !== input.page.items.at(-1)!.id))
    throw new Error("Diff next cursor conflicts with scanned page");
  const diff = compareReadonlyArchives(query, input.before, input.next);
  const affectedAnalyses = input.page.items.flatMap(item => {
    const result = unpackAnalysisResult(item.id, item.payload);
    const references = [...result.manifest.snapshotHashes, result.manifest.settings.materialInputsId];
    if (!references.includes(query.from) && !references.includes(query.to)) return [];
    return [{ resultId: item.id, manifestId: result.manifest.id, scenario: result.manifest.scenario,
      recordedAt: item.recordedAt, ...revisedHistoryType,
      relation: references.includes(query.from) && references.includes(query.to) ? "consumed-both-versions" :
        references.includes(query.from) ? "consumed-before-version" : "consumed-after-version" }];
  });
  return readonlyConsumerSchema.parse({ ...diff, affectedAnalyses, scannedResults: input.page.items.length,
    nextCursor: input.page.nextCursor,
    affectedMeaning: "Exact archived dependency references on this page, not recomputed impacts or all possible consumers" });
}
export function readonlyDiffMaterial(input: ReadonlyDiffInputs, codeArchiveId: string) {
  if (!/^[a-f0-9]{64}$/.test(codeArchiveId)) throw new Error("Missing diff source archive");
  replayReadonlyDiff(input);
  return { version: "readonly-diff-material-1", sourceArchive: codeArchiveId, ...input,
    modelVersion: "readonly-source-comparison-1",
    meaning: "Deterministic source-cell comparison and exact paginated dependency scan, not climate/valuation model execution" };
}
export interface ReadonlyDiffProducerStore {
  captureSource(): Promise<string>;
  saveMaterial(payload: unknown): Promise<string>;
  saveResult: typeof saveAnalysisResult;
  loadResult: typeof loadAnalysisResult;
}
const retainedStore: ReadonlyDiffProducerStore = {
  captureSource: captureCalculationSource, saveMaterial: saveReadonlyDiffMaterial,
  saveResult: saveAnalysisResult, loadResult: loadAnalysisResult,
};
export async function retainReadonlyDiffProducer(input: ReadonlyDiffInputs, result: unknown,
  store: ReadonlyDiffProducerStore = retainedStore) {
  if (contentHash(result) !== contentHash(replayReadonlyDiff(input))) throw new Error("Diff result conflicts with source replay");
  const sourceArchive = await store.captureSource();
  const material = readonlyDiffMaterial(input, sourceArchive);
  const materialId = await store.saveMaterial(material);
  if (materialId !== contentHash(material)) throw new Error("Diff material writer returned conflicting identity");
  const manifest = createManifest({ codeVersion: sourceArchive, modelVersion: material.modelVersion,
    scenario: READONLY_PRODUCER_SCENARIO, snapshotHashes: [input.query.from, input.query.to],
    settings: { materialInputsId: materialId, query: input.query } });
  const id = await store.saveResult(manifest, result);
  return verifiedProducer(id, await store.loadResult(id), result);
}
export async function verifyReadonlyDiffMaterial(id: string, manifest: {
  codeVersion: string; modelVersion: string; snapshotHashes: string[]; settings: Record<string, unknown>;
}, result: unknown, loadReferenced: (id: string) => Promise<any>,
  loadArchive: typeof loadMaterialArchive = loadMaterialArchive,
  loadSource: ReadonlyDiffRepository["load"] = readonlyDiffRepository.load) {
  const material = await loadArchive(id, "readonly-diff-material");
  if (contentHash(material) !== id) throw new Error("Readonly diff material content hash mismatch");
  if (material.version !== "readonly-diff-material-1" || material.sourceArchive !== manifest.codeVersion ||
    material.modelVersion !== manifest.modelVersion ||
    contentHash(material.query) !== contentHash(manifest.settings.query) ||
    contentHash([material.query.from, material.query.to]) !== contentHash(manifest.snapshotHashes))
    throw new Error("Readonly diff material/manifest mismatch");
  const source = await loadArchive(material.sourceArchive, "calculation-source");
  if (contentHash(source) !== material.sourceArchive || source.version !== "calculation-source-1")
    throw new Error("Readonly diff code archive corrupt");
  if (contentHash(replayReadonlyDiff(material)) !== contentHash(result)) throw new Error("Readonly diff replay mismatch");
  for (const archived of [material.before, material.next]) {
    const current = await loadSource(archived.id, archived.kind);
    if (contentHash(current) !== contentHash(archived)) throw new Error("Readonly diff source parent changed");
  }
  // Verify that the actual referenced completed-result archives still exist;
  // embedded packed responses alone cannot substitute for missing parents.
  for (const item of material.page.items) {
    const loaded = await loadReferenced(item.id);
    if (contentHash({ version: loaded.version, manifest: loaded.manifest, result: loaded.result }) !== item.id ||
      contentHash(item.payload) !== item.id ||
      new Date(loaded.recordedAt).toISOString() !== item.recordedAt)
      throw new Error("Readonly diff scanned result differs from retained archive");
  }
}
