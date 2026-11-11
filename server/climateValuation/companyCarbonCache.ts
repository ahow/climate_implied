import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { canonical, calculationKey } from "../calculation/identity";
import { createManifest } from "../calculation/analysisManifest";
import { currentSourceArchiveId } from "../snapshots/materialInputs";
import { CALCULATION_VERSION, LEGACY_FINANCE } from "../../shared/calculationContract";

export interface CompanyCarbonSelection {
  workbook: string | null;
  overlays: string[];
  cutoff: string | null;
}
/** Analytical identity excludes cache state, response/archive creation clocks,
 * snapshot insertion timestamps and observer diagnostics. Source identity is
 * the SAME executable source/config archive used by production run manifests. */
export function companyCarbonCacheIdentity(inputs: unknown, settings: Record<string, unknown>,
  selection: CompanyCarbonSelection, sourceVersion = currentSourceArchiveId(), createdAt?: string) {
  const inputHash = createHash("sha256").update(canonical(inputs)).digest("hex");
  const manifest = createManifest({
    codeVersion: sourceVersion, modelVersion: CALCULATION_VERSION,
    snapshotHashes: [selection.workbook ?? inputHash, ...selection.overlays],
    scenario: "descriptive-valuation:/carbon-price",
    settings: { ...settings, effectiveInputHash: inputHash, selection,
      cacheContract: "company-carbon-cache-2", financeModel: LEGACY_FINANCE },
  }, createdAt);
  return {
    cacheKey: calculationKey("finance", { inputHash, calculatorManifestId: manifest.id },
      { cacheContract: "company-carbon-cache-2" }),
    datasetId: selection.workbook ?? inputHash,
    inputHash, sourceVersion, modelVersion: CALCULATION_VERSION, financeModelVersion: LEGACY_FINANCE.version,
    calculatorManifestId: manifest.id,
  };
}
export type CompanyCarbonIdentity = ReturnType<typeof companyCarbonCacheIdentity>;
export interface CompanyCarbonCacheBackend {
  get(key: string): Promise<unknown | undefined>;
  putIfAbsent(key: string, result: unknown): Promise<void>;
}
export interface CompanyCarbonCacheWitness {
  phase: "lookup-miss" | "lookup-hit" | "compute" | "write" | "bypass";
  identity: CompanyCarbonIdentity;
  observedAt: string;
}
const isolated = new AsyncLocalStorage<{
  backend: CompanyCarbonCacheBackend; observe: (witness: CompanyCarbonCacheWitness) => void;
}>();
/** Private test/DEV I/O substitution only. Not a query flag, public endpoint or
 * cache clear. The actual production calculator and cache branches still run. */
export function runWithIsolatedCompanyCarbonCache<T>(backend: CompanyCarbonCacheBackend,
  observe: (witness: CompanyCarbonCacheWitness) => void, work: () => T): T {
  if (process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "development")
    throw new Error("Isolated company cache requires explicit test/development environment");
  return isolated.run({ backend, observe }, work);
}
export function witnessCompanyCarbonCache(phase: CompanyCarbonCacheWitness["phase"], identity: CompanyCarbonIdentity) {
  isolated.getStore()?.observe({ phase, identity: structuredClone(identity), observedAt: new Date().toISOString() });
}
export async function readCompanyCarbonCache(identity: CompanyCarbonIdentity, productionRead: () => Promise<unknown | undefined>) {
  const scope = isolated.getStore();
  const value = scope ? await scope.backend.get(identity.cacheKey) : await productionRead();
  witnessCompanyCarbonCache(value === undefined ? "lookup-miss" : "lookup-hit", identity);
  return value;
}
export async function writeCompanyCarbonCache(identity: CompanyCarbonIdentity, value: unknown, productionWrite: () => Promise<void>) {
  const scope = isolated.getStore();
  if (scope) await scope.backend.putIfAbsent(identity.cacheKey, value);
  else await productionWrite();
  witnessCompanyCarbonCache("write", identity);
}
