import test from "node:test";
import assert from "node:assert/strict";
import { packDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext, type SnapshotHeader } from "../server/snapshots/store";
import { overlayContext } from "../server/snapshots/overlays";
import { packOverlay } from "../server/snapshots/overlayContract";
import { calculateTotalBasedCarbonPrice } from "../server/climateValuation/carbonPriceCalculator";
import { companyCarbonCacheIdentity, runWithIsolatedCompanyCarbonCache,
  type CompanyCarbonCacheWitness } from "../server/climateValuation/companyCarbonCache";
import { canonical } from "../server/calculation/identity";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { contentHash } from "../server/calculation/analysisManifest";

function fixture(multiplier = 1, irregular = false) {
  // Synthetic ENGINEERING fixture only; never a real issuer claim or DB row.
  const companies = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1, isin: `engineering-${i}`, name: `Engineering ${i}`, sector: "test",
    subSector: null, industry: null, geography: "US", sdgAlignmentScore: null, emissionTarget2050: null,
  }));
  const timeSeries = companies.flatMap(company => [2020, 2021]
    .filter(year => !irregular || year === (company.id <= 3 ? 2021 : 2020)).map(year => ({
    id: company.id * 10 + year, companyId: company.id, date: new Date(`${year}-01-01`),
    marketCap: multiplier * (100 + company.id * 10), netProfit: 10 + company.id,
    priceEarnings: 10, scope1Emissions: company.id * 25, scope2Emissions: company.id * 2,
    scope3Emissions: null, totalReturnIndex: 100,
  })));
  const packed = packDataset(companies as any, timeSeries as any);
  const header = { id: packed.id, companyCount: companies.length, observationCount: timeSeries.length,
    chunkCount: packed.chunks.length } as SnapshotHeader;
  return { packed, header };
}
function backend() {
  const entries = new Map<string, string>(), reads: { key: string; hit: boolean }[] = [], writes: string[] = [];
  return { entries, reads, writes,
    get: async (key: string) => {
      reads.push({ key, hit: entries.has(key) });
      return entries.has(key) ? JSON.parse(entries.get(key)!) : undefined;
    },
    putIfAbsent: async (key: string, result: unknown) => {
      writes.push(key); if (!entries.has(key)) entries.set(key, JSON.stringify(result));
    },
  };
}
test("actual calculator executes miss/compute/write then JSONB-like hit, without DB credentials", async () => {
  const prior = process.env.NODE_ENV; process.env.NODE_ENV = "test";
  try {
    const a = fixture(1, true), store = backend(), events: CompanyCarbonCacheWitness[] = [];
    await runWithReplayWorkbook(a.packed, () => snapshotContext.run(a.header, () =>
      runWithIsolatedCompanyCarbonCache(store, event => events.push(event), async () => {
        const cold = await calculateTotalBasedCarbonPrice(0, "absolute", false, false, 5);
        assert.ok(cold.length);
        assert.deepEqual(cold.map(row => row.date.getUTCFullYear()), [2020, 2021],
          "Cold ordering must match warm ordering when first company lacks earlier dates");
        const coldCanonical = canonical(cold);
        const warm = await calculateTotalBasedCarbonPrice(0, "absolute", false, false, 5);
        assert.equal(canonical(warm), coldCanonical);
        assert.deepEqual(warm, cold);
        assert.equal(contentHash(JSON.parse(JSON.stringify(publicValuationResult(warm)))),
          contentHash(JSON.parse(JSON.stringify(publicValuationResult(cold)))));
        assert.deepEqual(events.map(e => e.phase), ["lookup-miss", "compute", "write", "lookup-hit"]);
        assert.deepEqual(events[0].identity, events[3].identity);
        assert.deepEqual(store.reads.map(row => row.hit), [false, true]);
        assert.equal(store.writes.length, 1);
        cold[0].topTercileMarketCap = -999;
        const warmAgain = await calculateTotalBasedCarbonPrice(0, "absolute", false, false, 5);
        assert.equal(canonical(warmAgain), coldCanonical, "caller mutation cannot poison serialized cache");
      })));
  } finally { if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior; }
});
test("retained no-op overlay identity cannot alias identical effective inputs; distinct datasets cannot cross-hit", async () => {
  const prior = process.env.NODE_ENV; process.env.NODE_ENV = "test";
  try {
    const a = fixture(), b = fixture(2), store = backend(), identities: CompanyCarbonCacheWitness[] = [];
    const noOp = packOverlay([{
      companyId: 1, observationDate: "2020-01-01", availableAt: "2020-01-01",
      field: "marketCap", value: 110, kind: "financial", unit: "USD million",
      source: "synthetic engineering no-op", approvalEvidence: "TEST ONLY not approval", historyBasis: "revised-history",
    }]);
    const run = (value: ReturnType<typeof fixture>, overlay = false) => runWithReplayWorkbook(value.packed, () =>
      snapshotContext.run(value.header, () => runWithIsolatedCompanyCarbonCache(store, event => identities.push(event), () =>
        overlay ? overlayContext.run({ ids: [noOp.id], cutoff: "2021-01-01", overlays: [noOp.payload] },
          () => calculateTotalBasedCarbonPrice(0, "absolute", false, false, 5)) :
          calculateTotalBasedCarbonPrice(0, "absolute", false, false, 5))));
    const original = await run(a);
    const noOpResult = await run(a, true);
    assert.equal(canonical(original), canonical(noOpResult));
    const misses = identities.filter(e => e.phase === "lookup-miss");
    assert.equal(misses[0].identity.inputHash, misses[1].identity.inputHash);
    assert.notEqual(misses[0].identity.cacheKey, misses[1].identity.cacheKey);
    assert.notEqual(misses[0].identity.calculatorManifestId, misses[1].identity.calculatorManifestId);
    const different = await run(b);
    assert.notEqual(canonical(different), canonical(original));
    const [aWarm, bWarm] = await Promise.all([run(a), run(b)]);
    assert.equal(canonical(aWarm), canonical(original));
    assert.equal(canonical(bWarm), canonical(different));
    assert.deepEqual(store.reads.map(row => row.hit), [false, false, false, true, true]);
    assert.equal(store.entries.size, 3);
  } finally { if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior; }
});
test("clock and witness diagnostics cannot enter analytical identity; ordered selections/source/model/settings do", () => {
  const selection = { workbook: "a".repeat(64), overlays: ["b".repeat(64), "c".repeat(64)], cutoff: "2024-12-31" };
  const early = companyCarbonCacheIdentity({ value: 1 }, { method: "absolute" }, selection, "code-1", "2020-01-01T00:00:00Z");
  const late = companyCarbonCacheIdentity({ value: 1 }, { method: "absolute" }, selection, "code-1", "2030-01-01T00:00:00Z");
  assert.deepEqual(early, late);
  assert.notEqual(early.cacheKey, companyCarbonCacheIdentity({ value: 1 }, { method: "absolute" },
    { ...selection, overlays: [...selection.overlays].reverse() }, "code-1").cacheKey);
  assert.notEqual(early.cacheKey, companyCarbonCacheIdentity({ value: 1 }, { method: "absolute" }, selection, "code-2").cacheKey);
  assert.notEqual(early.cacheKey, companyCarbonCacheIdentity({ value: 1 }, { method: "sector_relative" }, selection, "code-1").cacheKey);
  assert.equal("createdAt" in early, false);
  assert.equal("observedAt" in early, false);
});
test("private cache I/O substitution is unavailable in production", () => {
  const prior = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  try {
    assert.throws(() => runWithIsolatedCompanyCarbonCache(backend(), () => undefined, () => undefined),
      /explicit test\/development/);
  } finally { if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior; }
});
