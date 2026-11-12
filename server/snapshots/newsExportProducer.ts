import { buildClimateNewsResult, newsSourceRelease, type ClimateNewsResult } from "../newsApi/newsService";
import { contentHash, createManifest } from "../calculation/analysisManifest";
import { captureCalculationSource, currentSourceArchiveId, saveLegacyExportMaterial, loadMaterialArchive } from "./materialInputs";
import { saveAnalysisResult, loadAnalysisResult } from "./results";
import { verifiedProducer } from "../producerDownload";
import type { LegacyProducerStore } from "./legacyExportProducer";
export const NEWS_EXPORT_SCENARIO = "source-release:news-allocation-1";
const production: LegacyProducerStore = { captureSource: captureCalculationSource,
  saveMaterial: saveLegacyExportMaterial, saveResult: saveAnalysisResult, loadResult: loadAnalysisResult };
export function captureNewsExportInputs(result: ClimateNewsResult, months: number) {
  const release = newsSourceRelease(result);
  if (release.cacheKey !== `climate_news_${months}m`) throw new Error("News release window conflicts");
  return { version: "news-export-inputs-1", release, months, queryTime: new Date().toISOString(),
    volume: structuredClone(result.volume), sample: structuredClone(result.recentArticles),
    dateRange: structuredClone(result.dateRange),
    model: "news-allocation-extrapolation-1-not-a-climate-model",
    seed: null, seedMeaning: "Deterministic retained allocation; no random sampling run is claimed",
    sourceMeaning: "Complete consumed provider-derived volume/sample release, not original upstream response bytes or per-article population classifications" };
}
type NewsInput = ReturnType<typeof captureNewsExportInputs>;
export function replayNewsExport(input: NewsInput) {
  if (input.version !== "news-export-inputs-1" ||
    input.release.timezone !== Intl.DateTimeFormat().resolvedOptions().timeZone ||
    input.release.cacheKey !== `climate_news_${input.months}m`)
    throw new Error("News release/collection timezone/window conflicts; no timezone substitution");
  return buildClimateNewsResult(input.volume, input.sample, input.dateRange.start, input.dateRange.end);
}
export async function retainNewsExport(input: NewsInput, result: unknown, store = production) {
  if (contentHash(replayNewsExport(input)) !== contentHash(result)) throw new Error("News whole release replay conflicts");
  const sourceArchive = await store.captureSource(), inputId = await store.saveMaterial(input);
  const material = { version: "news-export-material-1", sourceArchive, inputId };
  const materialInputsId = await store.saveMaterial(material);
  if (inputId !== contentHash(input) || materialInputsId !== contentHash(material)) throw new Error("News material identity conflicts");
  const manifest = createManifest({ codeVersion: sourceArchive, modelVersion: input.model, snapshotHashes: [inputId],
    scenario: NEWS_EXPORT_SCENARIO, settings: { materialInputsId, months: input.months, queryTime: input.queryTime } });
  const id = await store.saveResult(manifest, result);
  return verifiedProducer(id, await store.loadResult(id), result);
}
export async function verifyNewsExportMaterial(id: string, manifest: any, result: unknown,
  load: (id: string, kind: "material-inputs" | "calculation-source") => Promise<any> = loadMaterialArchive,
  sourceId = currentSourceArchiveId()) {
  const material = await load(id, "material-inputs"), source = await load(material.sourceArchive, "calculation-source");
  const input: NewsInput = await load(material.inputId, "material-inputs");
  if (contentHash(material) !== id || contentHash(source) !== material.sourceArchive ||
    material.version !== "news-export-material-1" || material.sourceArchive !== manifest.codeVersion ||
    sourceId !== manifest.codeVersion || contentHash(input) !== material.inputId ||
    manifest.modelVersion !== input.model || manifest.scenario !== NEWS_EXPORT_SCENARIO ||
    manifest.settings.months !== input.months || manifest.settings.queryTime !== input.queryTime ||
    contentHash(manifest.snapshotHashes) !== contentHash([material.inputId]) ||
    contentHash(replayNewsExport(input)) !== contentHash(result)) throw new Error("News release material/code/query/result replay conflicts");
}
