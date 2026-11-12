import { readFileSync } from "node:fs";
import { contentHash, createManifest } from "../calculation/analysisManifest";
import { calculationKey } from "../calculation/identity";
import { candidateInventory, constantScenario, illustrativeScenario, projectInventoryEmissions, EMISSIONS_ENGINE_VERSION } from "../calculation/emissionsCandidate";
import { resolveEmissionsInputs } from "../calculation/emissionsInputs";
import { getAllHistoricalIndicators, type HistoricalIndicatorData } from "../calculation/historicalIndicators";
import { nativeCandidateResidualDiagnostics } from "../calculation/nativeThresholdDiagnostics";
import { nativeResidualDiagnosticsSchema } from "../../shared/nativeThresholdSchema";
import { NATIVE_PRODUCER_SCENARIO, nativeScenarios, type NativeScenario } from "../../shared/nativeConsumer";
import { captureCalculationSource, loadMaterialArchive, saveNativeCandidateArchive } from "./materialInputs";
import { saveAnalysisResult, loadAnalysisResult } from "./results";
import { verifiedProducer } from "../producerDownload";
import { requestOverrides, type OverrideRow } from "../dataIngestion/requestOverrides";
import { getOverrideMeta } from "../dataIngestion/overrideStore";
import { INDICATORS } from "../dataIngestion/indicatorRegistry";
import { packIndicators } from "./indicatorContract";

const engineFiles = [
  "server/calculation/emissionsCandidate.ts", "server/calculation/emissionsInputs.ts",
  "server/calculation/nativeMechanisms.ts",
  "server/calculation/nativeThresholdDiagnostics.ts", "server/calculation/thresholdDiagnostic.ts",
  "server/calculation/identity.ts", "shared/scientificEvidence.ts", "shared/driverAdmission.ts",
  "server/dataIngestion/indicatorRegistry.ts",
  "server/calculation/historicalIndicators.ts", "server/dataIngestion/overrideStore.ts",
  "server/dataIngestion/requestOverrides.ts", "server/snapshots/indicatorContract.ts",
  "shared/calculationContract.ts", "shared/thresholdDiagnostic.ts", "shared/nativeThresholdSchema.ts",
  "package.json", "package-lock.json", "tsconfig.json",
];
const released = Object.fromEntries(engineFiles.map(path => [path, readFileSync(path, "utf8")]));
export function captureNativeInputs() {
  const context = requestOverrides.getStore();
  const rows = context ? Array.from(context.values.values()) as OverrideRow[] :
    [2023, 2024].flatMap(year => INDICATORS.flatMap(({ key }) => {
      const value = getOverrideMeta(key, year);
      return value ? [{ ...value, indicatorKey: key, year }] : [];
    }));
  const approved = packIndicators(rows);
  if (context && approved.id !== context.hash) throw new Error("Native resolved approved-source context conflicts");
  return structuredClone({ version: "native-candidate-inputs-1", inventory: candidateInventory(),
    history: getAllHistoricalIndicators().filter(row => row.year === 2023 || row.year === 2024),
    indicatorSource: { hash: approved.id, rows: approved.payload.rows,
      state: context ? "actual-request-approved-source-records" : "actual-effective-cache-or-curated-source",
      meaning: "Captured source records, not new approval or proof of original availability; unoverridden dated values derive from archived historicalIndicators source" },
    sourceMeaning: "Actual effective dated inputs and captured public native inventory; not newly authenticated observations or original vintage" });
}
export function replayNativeCandidate(input: ReturnType<typeof captureNativeInputs>, scenario: NativeScenario) {
  if (input.version !== "native-candidate-inputs-1" || !Object.hasOwn(nativeScenarios, scenario) ||
    input.inventory.year !== 2024 || input.history.length !== 2 ||
    input.history.filter(row => row.year === 2023).length !== 1 || input.history.filter(row => row.year === 2024).length !== 1)
    throw new Error("Missing exact native inventory or dated input parents");
  const inputs = resolveEmissionsInputs(input.history as HistoricalIndicatorData[]);
  if (packIndicators(input.indicatorSource.rows).id !== input.indicatorSource.hash)
    throw new Error("Native dated source records conflict");
  for (const row of input.indicatorSource.rows) {
    if (row.year !== 2023 && row.year !== 2024) continue;
    const effective = input.history.find(h => h.year === row.year)!;
    if (Object.hasOwn(effective, row.indicatorKey) && (effective as any)[row.indicatorKey] !== row.value)
      throw new Error("Native captured effective input/source value conflict");
  }
  const selected = scenario === "dashboard" ? inputs.diagnostic : scenario === "transition" ? illustrativeScenario : constantScenario;
  const result = projectInventoryEmissions(selected, 2100, input.inventory.cells);
  // Preserve the global engine's original full-inventory calculation identity.
  result.key = calculationKey("native-emissions", input.inventory, { scenario: selected, endYear: 2100 }, EMISSIONS_ENGINE_VERSION);
  return { promotion: "blocked-pending-calibration-and-Packages-3-4", inventory: input.inventory, inputs, result,
    residualDiagnostics: nativeResidualDiagnosticsSchema.parse(nativeCandidateResidualDiagnostics(result, input.inventory)) };
}
export interface NativeCandidateStore {
  captureSource(): Promise<string>;
  saveArchive(kind: "native-candidate-inputs" | "native-candidate-material", payload: unknown): Promise<string>;
  saveResult: typeof saveAnalysisResult;
  loadResult: typeof loadAnalysisResult;
}
const production: NativeCandidateStore = {
  captureSource: captureCalculationSource, saveArchive: saveNativeCandidateArchive,
  saveResult: saveAnalysisResult, loadResult: loadAnalysisResult,
};
export async function retainNativeCandidate(input: ReturnType<typeof captureNativeInputs>, scenario: NativeScenario,
  response: unknown, store: NativeCandidateStore = production) {
  if (contentHash(response) !== contentHash(replayNativeCandidate(input, scenario))) throw new Error("Native response replay mismatch");
  const sourceArchive = await store.captureSource();
  const inputArchive = await store.saveArchive("native-candidate-inputs", input);
  if (inputArchive !== contentHash(input)) throw new Error("Native input writer identity mismatch");
  const material = { version: "native-candidate-material-1", sourceArchive, inputArchive, scenario,
    modelVersion: EMISSIONS_ENGINE_VERSION, endYear: 2100,
    seed: { applicability: "not-applicable-deterministic-no-random-sampling", value: null },
    memberId: "deterministic-native-scenario-not-an-ensemble-member",
    meaning: "Actual conditional native engine execution; not calibrated, a forecast, temperature model, original vintage or scientific acceptance" };
  const materialId = await store.saveArchive("native-candidate-material", material);
  if (materialId !== contentHash(material)) throw new Error("Native material writer identity mismatch");
  const manifest = createManifest({ codeVersion: sourceArchive, modelVersion: EMISSIONS_ENGINE_VERSION,
    scenario: NATIVE_PRODUCER_SCENARIO, snapshotHashes: [inputArchive],
    settings: { materialInputsId: materialId, nativeScenario: scenario, seed: material.seed, memberId: material.memberId, endYear: 2100 } });
  const id = await store.saveResult(manifest, response);
  return verifiedProducer(id, await store.loadResult(id), response);
}
export async function verifyNativeCandidateMaterial(id: string, manifest: Pick<ReturnType<typeof createManifest>,
  "codeVersion" | "modelVersion" | "snapshotHashes" | "settings">,
  result: unknown, load = loadMaterialArchive) {
  const material = await load(id, "native-candidate-material");
  if (contentHash(material) !== id || material.version !== "native-candidate-material-1" ||
    material.sourceArchive !== manifest.codeVersion || material.modelVersion !== manifest.modelVersion ||
    material.modelVersion !== EMISSIONS_ENGINE_VERSION || material.endYear !== 2100 ||
    contentHash([material.inputArchive]) !== contentHash(manifest.snapshotHashes) ||
    material.scenario !== manifest.settings.nativeScenario ||
    contentHash(material.seed) !== contentHash({ applicability: "not-applicable-deterministic-no-random-sampling", value: null }) ||
    contentHash(material.seed) !== contentHash(manifest.settings.seed) ||
    material.memberId !== "deterministic-native-scenario-not-an-ensemble-member" ||
    material.memberId !== manifest.settings.memberId || manifest.settings.endYear !== 2100)
    throw new Error("Native material/manifest conflict");
  const input = await load(material.inputArchive, "native-candidate-inputs");
  const code = await load(material.sourceArchive, "calculation-source");
  if (contentHash(input) !== material.inputArchive || contentHash(code) !== material.sourceArchive ||
    code.version !== "calculation-source-1" ||
    contentHash(JSON.parse(code.files?.["server/calculation/data/inventory2024.json"] ?? "null")) !== contentHash(input.inventory))
    throw new Error("Native captured source/input parent missing or corrupt");
  // Never re-tag an old/different engine with today's implementation. This
  // finite replay supports only identical archived model implementation bytes.
  for (const path of engineFiles) if (code.files?.[path] !== released[path])
    throw new Error(`Native archived engine differs from supported replay: ${path}`);
  if (contentHash(replayNativeCandidate(input, material.scenario)) !== contentHash(result))
    throw new Error("Native retained result differs from exact captured-input replay");
}
