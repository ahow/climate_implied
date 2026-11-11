import assert from "node:assert/strict";
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { runWithReplayWorkbook, snapshotContext } from "../server/snapshots/store";
import { overlayContext } from "../server/snapshots/overlays";
import { unpackOverlay } from "../server/snapshots/overlayContract";
import { calculateTotalBasedCarbonPrice } from "../server/climateValuation/carbonPriceCalculator";
import { runWithIsolatedCompanyCarbonCache, type CompanyCarbonCacheWitness } from "../server/climateValuation/companyCarbonCache";
import { contentHash } from "../server/calculation/analysisManifest";
import { canonical } from "../server/calculation/identity";
import { publicValuationResult } from "../server/calculation/publicValuationContract";

/** Read-only retained workbook + existing retained synthetic engineering overlay
 * selections, ONE actual production calculator. Never the old nine-path study.
 * No DB URL, live queries, cache clears, archives, approvals or HTTP server. */
if (process.env.NODE_ENV !== "development" || process.env.DATABASE_URL)
  throw new Error("Requires explicit NODE_ENV=development with DATABASE_URL removed");
const source = "generated-artifacts/overlay-replay/inputs-77e6a05320e664e34a6d5ec4c1a0144ba532b7a6b5cb6cddc1144e0c95253626.json";
const bytes = readFileSync(source), captured = JSON.parse(bytes.toString("utf8"));
assert.equal(captured.workbook.id, "271caaddc11350f1def50a1a379ac8689bbff745b7efa805e5fcd8146b6d45ac");
const financial = captured.overlays[0], sdg = captured.overlays[2];
assert.match(financial.payload.entries[0].source, /synthetic perturbation/);
const selections = [
  { label: "retained-baseline", overlays: [] },
  { label: "retained-financial-engineering-overlay", overlays: [financial] },
  { label: "retained-financial-plus-sdg-engineering-overlays", overlays: [financial, sdg] },
];
const cache = new Map<string, string>();
const backendOperations: { operation: string; key: string; hit?: boolean }[] = [];
const backend = {
  get: async (key: string) => {
    const hit = cache.has(key); backendOperations.push({ operation: "get", key, hit });
    return hit ? JSON.parse(cache.get(key)!) : undefined;
  },
  putIfAbsent: async (key: string, result: unknown) => {
    backendOperations.push({ operation: "put-if-absent", key });
    if (!cache.has(key)) cache.set(key, JSON.stringify(result));
  },
};
const records: any[] = [];
async function run(selection: typeof selections[number], temperature: "cold" | "warm") {
  const witness: CompanyCarbonCacheWitness[] = [];
  const calculate = () => calculateTotalBasedCarbonPrice(0, "absolute", false, true, 5, "carbon_intensity");
  const result = await snapshotContext.run(captured.header, () =>
    runWithIsolatedCompanyCarbonCache(backend, event => witness.push(event), () =>
      selection.overlays.length ? overlayContext.run({
        ids: selection.overlays.map((o: any) => o.id), cutoff: captured.cutoff,
        overlays: selection.overlays.map((o: any) => unpackOverlay(o.id, o.payload)),
      }, calculate) : calculate()));
  assert.ok(result.length, "No empty result may stand in for a real cache witness");
  assert.deepEqual(witness.map(e => e.phase),
    temperature === "cold" ? ["lookup-miss", "compute", "write"] : ["lookup-hit"]);
  const publicPayload = JSON.parse(JSON.stringify(publicValuationResult(result)));
  const record = { selection: selection.label, temperature, rows: result.length,
    rawCalculatorPayloadHash: createHash("sha256").update(canonical(result)).digest("hex"),
    publicAnalyticalPayloadHash: contentHash(publicPayload),
    identity: witness[0].identity, witness };
  records.push(record);
  return record;
}
await runWithReplayWorkbook(captured.workbook, async () => {
  const cold = [];
  for (const selection of selections) cold.push(await run(selection, "cold"));
  const warm = await Promise.all(selections.map(selection => run(selection, "warm")));
  for (let i = 0; i < selections.length; i++) {
    assert.equal(cold[i].rawCalculatorPayloadHash, warm[i].rawCalculatorPayloadHash);
    assert.equal(cold[i].publicAnalyticalPayloadHash, warm[i].publicAnalyticalPayloadHash);
    assert.deepEqual(cold[i].identity, warm[i].identity);
  }
  assert.equal(new Set(cold.map(record => record.identity.cacheKey)).size, 3);
  assert.equal(new Set(cold.map(record => record.identity.calculatorManifestId)).size, 3);
  // Carbon-intensity inference does not consume SDG grouping: equal analytical
  // values from DIFFERENT retained selections must still have distinct identity.
  assert.equal(cold[1].publicAnalyticalPayloadHash, cold[2].publicAnalyticalPayloadHash);
  assert.notEqual(cold[0].identity.inputHash, cold[1].identity.inputHash);
  // The retained one-cell perturbation need not affect a selected/winsorized
  // peer aggregate. Do not fabricate a changed analytical result to claim
  // isolation: genuine misses and different selection identities prove it.
  const returned = await run(selections[0], "warm");
  assert.deepEqual(returned.identity, cold[0].identity);
});
assert.deepEqual(backendOperations.filter(e => e.operation === "get").map(e => e.hit),
  [false, false, false, true, true, true, true]);
assert.equal(backendOperations.filter(e => e.operation === "put-if-absent").length, 3);
assert.equal(cache.size, 3);
mkdirSync("generated-artifacts/company-cache-witness", { recursive: true, mode: 0o700 });
const directory = mkdtempSync(resolve("generated-artifacts/company-cache-witness/witness-"));
const evidence = {
  criterion: "S02-009", exactClause: "Cold and warm caches return identical values and identities.",
  actualCalculator: "calculateTotalBasedCarbonPrice", passed: true,
  source, sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  workbookId: captured.workbook.id, companies: captured.header.companyCount, observations: captured.header.observationCount,
  retainedOverlayStatus: "Existing retained synthetic engineering perturbations only; NOT issuer/owner/scientific approvals",
  backend: "isolated private JSON-serialized cache; actual calculator lookup/compute/write/return branches",
  backendOperations, records, databaseQueries: 0, productionCacheClears: 0, httpRequests: 0,
  otherEightCalculatorPathsRerun: false,
  analyticalIdentityExclusions: ["cache phase/hit", "observedAt", "manifest createdAt", "snapshot createdAt/insertion transaction"],
  limitations: [
    "This directly witnesses company carbon-price calculator caching, not all application caches.",
    "Production PostgreSQL storage/transport and HTTP material/result archive middleware were not exercised.",
    "Other company calculators have no cross-request result cache; local backtest ranking memoization is outside this witness.",
    "No original publication-vintage, scientific, investment or production-deployment acceptance is implied.",
  ],
};
writeFileSync(`${directory}/evidence.json`, JSON.stringify(evidence, null, 2), { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ passed: true, evidence: `${directory}/evidence.json`, workbookId: captured.workbook.id,
  sourceSha256: evidence.sourceSha256, coldMisses: 3, warmHits: 4, computations: 3, writes: 3,
  selections: records.filter(record => record.temperature === "cold").map(({ selection, rows, identity, publicAnalyticalPayloadHash }) =>
    ({ selection, rows, identity, publicAnalyticalPayloadHash })),
  databaseQueries: 0, productionCacheClears: 0, oldNinePathRerun: false }, null, 2));
