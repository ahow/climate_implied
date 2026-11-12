import type { RequestHandler } from "express";
import { contentHash, createManifest } from "../calculation/analysisManifest";
import { legacyProducerPaths, legacyProducerScenario, type LegacyProducerPath } from "../../shared/legacyExportConsumer";
import { CALCULATION_VERSION, legacyContext } from "../../shared/calculationContract";
import { getAllHistoricalIndicators, getAllHistoricalIndicatorsWithNowcast, historicalInputContext } from "../calculation/historicalIndicators";
import { getCurrentIndicators, getCurrentIndicatorsFromHistorical, calculateEmissionsTrajectory, calculateTemperatureDistribution,
  getTemperatureStats, calculateSensitivityAnalysis } from "../calculation/forwardProjection";
import { calculateAllCategoryProjections, applyCategoryModifications, type Category } from "../calculation/categoryProjections";
import { getRecalculatedHistoricalTrend } from "../calculation/historicalRecalculation";
import { getCategoryHistoricalTrend } from "../calculation/categoryHistoricalTrend";
import { historicalTrajectoryMetrics } from "../calculation/historicalMetrics";
import { selectedTrajectoryThresholdContext } from "../calculation/thresholdDiagnostic";
import { calculationKey } from "../calculation/identity";
import { requestOverrides, runWithOverrideRows, type OverrideRow } from "../dataIngestion/requestOverrides";
import { captureCalculationSource, currentSourceArchiveId, loadMaterialArchive, saveLegacyExportMaterial } from "./materialInputs";
import { loadAnalysisResult, saveAnalysisResult } from "./results";
import { bindProducerIdentity, verifiedProducer } from "../producerDownload";
import { readCalculationSourceArtifact } from "./materialInputs";
import { calculateRegionalFromInputs, getRegionalCarbonIntensities, type IntensityResult } from "../calculation/regionalProjections";
import { loadRegionalInputs } from "./regional";
import { packRegional } from "./regionalContract";
// Capture alongside the loaded producer modules, not after a later on-disk
// edit. Old executions cannot be relabelled as a newly edited source release.
const supportedCodeArchiveId = currentSourceArchiveId();

export function captureLegacyInputs(path: LegacyProducerPath, query: Record<string, unknown>, revision: string,
  regional: Record<string, IntensityResult> | null = null) {
  const context = requestOverrides.getStore();
  if (!context) throw new Error("Actual approved indicator request context is absent");
  return structuredClone({ version: "legacy-export-inputs-1", path, query, revision,
    history: getAllHistoricalIndicatorsWithNowcast(), approved: Array.from(context.values.values()) as OverrideRow[],
    indicatorHash: context.hash, sourceReleaseMeaning: "Actual effective curated/approved/nowcast inputs at query time; not original availability",
    queryTime: new Date().toISOString(), model: CALCULATION_VERSION, regional });
}
export type LegacyInputs = ReturnType<typeof captureLegacyInputs>;
export function replayLegacyProducer(input: LegacyInputs): unknown {
  if (input.version !== "legacy-export-inputs-1" || !legacyProducerPaths.includes(input.path) ||
    input.model !== CALCULATION_VERSION || !input.history.length) throw new Error("Unsupported legacy retained input contract");
  if (input.query.indicatorSnapshotId !== undefined && input.query.indicatorSnapshotId !== input.indicatorHash)
    throw new Error("Legacy exact selected approved-source query conflicts");
  if (input.path === "/api/projection/regions" && input.query.regionalSnapshotId !== undefined &&
    (!input.regional || input.query.regionalSnapshotId !== packRegional(input.regional).id))
    throw new Error("Legacy exact selected regional source query conflicts");
  return runWithOverrideRows(input.approved, () => historicalInputContext.run(input.history, () => {
    if (requestOverrides.getStore()!.hash !== input.indicatorHash) throw new Error("Captured approved source hash conflicts");
    switch (input.path) {
      case "/api/projection/regions": {
        if (!input.regional) throw new Error("Actual consumed regional intensity release unavailable");
        const indicators = getCurrentIndicators();
        const present = getAllHistoricalIndicators().some(row => row.year === 2024);
        return calculateRegionalFromInputs(indicators, input.regional, present ? undefined : region => selectedTrajectoryThresholdContext([],
          typeof input.query.regionalSnapshotId === "string" ? input.revision :
            calculationKey("selected-regional-inputs", { baseIndicators: indicators, intensities: input.regional }),
          typeof input.query.regionalSnapshotId === "string" ? calculationKey("selected-regional-trajectory", input.regional, { region }) :
            calculationKey("selected-regional-trajectory", indicators, { region, runs: 1000 })));
      }
      case "/api/indicators/historical": return getAllHistoricalIndicatorsWithNowcast();
      case "/api/projection/categories": return calculateAllCategoryProjections();
      case "/api/projection/historical-trend": return getRecalculatedHistoricalTrend();
      case "/api/projection/categories/historical-trend": return getCategoryHistoricalTrend();
    }
    const history = getAllHistoricalIndicatorsWithNowcast(), latest = history.at(-1)!;
    let indicators = getCurrentIndicatorsFromHistorical(latest);
    const startYear = latest.year;
    if (input.path === "/api/projection/sensitivity") return calculateSensitivityAnalysis(indicators, startYear);
    const category = typeof input.query.category === "string" ? input.query.category : "all";
    if (["technology", "policy", "corporate", "socioeconomic", "financial", "emissions"].includes(category))
      indicators = applyCategoryModifications(indicators, category as Category);
    const trajectory = calculateEmissionsTrajectory(indicators, startYear, 2100, 10000);
    const pdf = calculateTemperatureDistribution(trajectory, 10000), stats = getTemperatureStats(pdf, trajectory);
    const inputHash = calculationKey("effective-projection", indicators, { startYear, endYear: 2100, runs: 10000, category });
    const context = selectedTrajectoryThresholdContext(getAllHistoricalIndicators().some(r => r.year === 2024) ? trajectory : [], input.revision, inputHash);
    const { reductionRate, netZeroYear, legacyFixed5Gt, thresholdDiagnostic } = historicalTrajectoryMetrics(trajectory, context);
    return {
      calculation: { ...legacyContext(startYear, category), inputHash, inputRevision: input.revision, runs: 10000,
        seeds: { emissions: startYear * 12345, temperaturePdf: 42 * 12345, temperatureSummary: 99 * 12345 },
        warnings: ["Legacy scientific assumptions retained; RNG corrected only. Not scientifically validated.",
          "Temperature still resamples median cumulative emissions; coherent propagation is deferred to Package 3.",
          "Input observation and availability dates, GWP, GDP basis and currency are not yet reconciled."] },
      emissionsTrajectory: trajectory,
      temperatureDistribution: { median: stats.median, mean: stats.mean, p10: stats.p10, p90: stats.p90, pdf },
      indicators, metrics: { reductionRate, temperatureRise: stats.median, netZeroYear, legacyFixed5Gt, thresholdDiagnostic,
        emissionsStart: trajectory[0].p50, emissionsDecadeLater: trajectory[10].p50, emissions2100: trajectory.at(-1)!.p50 },
    };
  }));
}
export interface LegacyProducerStore {
  captureSource(): Promise<string>;
  saveMaterial(payload: unknown): Promise<string>;
  saveResult(manifest: ReturnType<typeof createManifest>, result: unknown): Promise<string>;
  loadResult(id: string): Promise<any>;
}
const production: LegacyProducerStore = {
  captureSource: captureCalculationSource, saveMaterial: saveLegacyExportMaterial,
  saveResult: saveAnalysisResult, loadResult: loadAnalysisResult,
};
export async function retainLegacyProducer(input: LegacyInputs, result: unknown, store = production) {
  const data = JSON.parse(JSON.stringify(result));
  // Fail storage availability before an expensive second model execution.
  // An archive outage must not delay ordinary results behind avoidable replay.
  const sourceArchive = await store.captureSource();
  if (sourceArchive !== supportedCodeArchiveId) throw new Error("Legacy producer source release differs from loaded implementation");
  if (contentHash(replayLegacyProducer(input)) !== contentHash(data)) throw new Error("Legacy completed response conflicts with full captured-input replay");
  const inputId = await store.saveMaterial(input);
  if (inputId !== contentHash(input)) throw new Error("Conflicting legacy input identity");
  const material = { version: "legacy-export-material-1", inputId, sourceArchive, path: input.path, model: input.model };
  const materialInputsId = await store.saveMaterial(material);
  if (materialInputsId !== contentHash(material)) throw new Error("Conflicting legacy material identity");
  const manifest = createManifest({ codeVersion: sourceArchive, modelVersion: input.model,
    snapshotHashes: [inputId], scenario: legacyProducerScenario(input.path),
    settings: { materialInputsId, query: input.query, queryTime: input.queryTime,
      runMeaning: "Exact retained legacy conditional producer; seeded emissions and median-PDF propagation unchanged" } });
  const id = await store.saveResult(manifest, data);
  return verifiedProducer(id, await store.loadResult(id), data);
}
export async function verifyLegacyExportMaterial(id: string, manifest: Omit<ReturnType<typeof createManifest>, "createdAt">, result: unknown,
  load: (id: string, kind: "material-inputs" | "calculation-source") => Promise<any> = loadMaterialArchive,
  sourceId = supportedCodeArchiveId) {
  const material = await load(id, "material-inputs");
  if (contentHash(material) !== id || material.version !== "legacy-export-material-1" ||
    material.sourceArchive !== manifest.codeVersion || material.sourceArchive !== sourceId)
    throw new Error("Legacy retained code/material unavailable, corrupt or unsupported release");
  const source = await load(material.sourceArchive, "calculation-source");
  if (contentHash(source) !== material.sourceArchive) throw new Error("Legacy retained code archive corrupt");
  const input: LegacyInputs = await load(material.inputId, "material-inputs");
  if (contentHash(input) !== material.inputId || material.path !== input.path ||
    manifest.scenario !== legacyProducerScenario(input.path) || manifest.modelVersion !== input.model ||
    contentHash(manifest.snapshotHashes) !== contentHash([material.inputId]) ||
    contentHash(manifest.settings.query) !== contentHash(input.query) || manifest.settings.queryTime !== input.queryTime ||
    contentHash(replayLegacyProducer(input)) !== contentHash(result))
    throw new Error("Legacy retained whole producer/material/query replay conflicts");
}
/** Ordinary results remain available when persistence/replay is unavailable.
 * A failed retention cannot manufacture provenance, blank the data, or certify
 * a cache entry whose complete replay differs from the captured input. */
export function legacyExportProducerMiddleware(store = production): RequestHandler {
  return async (req, res, next) => {
    const path = req.path as LegacyProducerPath;
    if (req.method !== "GET" || !legacyProducerPaths.includes(path)) return next();
    let input: LegacyInputs;
    try {
      const regional = path === "/api/projection/regions" ? typeof req.query.regionalSnapshotId === "string"
        ? await loadRegionalInputs(req.query.regionalSnapshotId) : await getRegionalCarbonIntensities() : null;
      input = captureLegacyInputs(path, req.query, String(res.locals.calculationRevision ?? "effective-indicator-history"), regional);
    }
    catch (error) {
      res.set("X-Producer-Binding-Status", "unavailable-no-producer-attestation");
      res.set("X-Producer-Binding-Error", error instanceof Error ? error.message : "Actual inputs unavailable");
      return next();
    }
    const json = res.json.bind(res);
    res.json = body => {
      if (res.statusCode >= 400) return json(body);
      void retainLegacyProducer(input, body, store).then(proof => {
        bindProducerIdentity(res, proof);
        res.set("X-Producer-Binding-Status", "retained-whole-producer-verified");
      }).catch(error => {
        res.set("X-Producer-Binding-Status", "unavailable-no-producer-attestation");
        res.set("X-Producer-Binding-Error", error instanceof Error ? error.message : "Retention unavailable");
      }).then(() => json(body));
      return res;
    };
    historicalInputContext.run(input.history, next);
  };
}
