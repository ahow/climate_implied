import test from "node:test";
import assert from "node:assert/strict";
import { contentHash } from "../server/calculation/analysisManifest";
import { adaptPairedResearchCorpus, type ResearchCorpus } from "../server/calculation/pairedResearchCorpus";
import { accountResearchPeriod, runPairedResearchPipeline, type PairedResearchProtocol } from "../server/calculation/pairedResearchPipeline";

// Explicit generated ENGINEERING fixtures, not issuers, provider histories or evidence.
function fixture(months = 36) {
  const spec = { model: "fixture-gordon", peer: "sector", target: "next-month" as const };
  const p: PairedResearchProtocol = {
    evidenceMode: "revised-history", primaryEndpoints: ["evaluation-r2", "signal-ic", "after-cost-long-short"],
    specifications: [spec, { ...spec, model: "fixture-reverse-dcf" }], expectedOrigins: [],
    frozenAt: "2019-01-01T00:00:00Z", evaluationStart: "2020-12-31T00:00:00Z",
    evaluationEnd: "2023-02-01T00:00:00Z", embargoDays: 2, blockLength: 1, repetitions: 200, seed: 123,
    currency: "USD", geography: "fixture-region", quantile: .25, weighting: "equal-within-sector",
    costBps: 25, sensitivityCostBps: [0, 50], borrowRateMultipliers: [0, 2], terminalStresses: [0, -.3, -1],
    disclosure: "locked retrospective evaluation (prior exposure: 2020 onward)",
  };
  const c: ResearchCorpus = { mode: "engineering-fixture", dataEnd: "2024-01-01T00:00:00Z", artifacts: [], periods: [] };
  let seed = 971;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 - .5; };
  const ids = Array.from({ length: 16 }, (_, i) => `engineering-${i}`);
  const stamp = (year: number, month: number, day = 1) => new Date(Date.UTC(year, month, day)).toISOString();
  const archive = (payload: unknown, origin: string) => {
    const hash = contentHash(payload);
    if (!c.artifacts.some(a => a.hash === hash)) c.artifacts.push({
      hash, payload, originUri: `engineering-fixture://${hash}`, capturedAt: origin, availableAt: origin, vintage: "engineering-fixture",
    });
    return hash;
  };
  const universeHash = archive([...ids].sort(), "2019-01-01T00:00:00Z");
  for (let m = 0; m < months; m++) {
    const origin = stamp(2020, m, 0), executionAt = stamp(2020, m), endAt = stamp(2020, m + 1);
    p.expectedOrigins.push(origin);
    const source = archive({ engineering: true, m, factor: rnd() }, origin);
    const definition = { currency: "USD", basis: "FCFE", horizonYears: 5, growthDefinition: "five-year-CAGR", nominal: true };
    const securities = ids.map((companyId, i) => {
      const growth = rnd();
      const executionPrice = m ? c.periods[m - 1].securities[i].endPrice : 100;
      const projectionManifest = archive({ companyId, model: spec.model, origin, definition, members: [{ id: "member", growth }] }, origin);
      const valuationManifest = archive({ companyId, model: spec.model, origin, definition, members: [{ id: "member", growth: 0 }] }, origin);
      return { companyId, numericId: i + 1, sector: i < 8 ? "sector-a" : "sector-b", marketCap: 100 + i,
        informationAvailableAt: origin,
        pair: { origin, companyId, peer: i < 8 ? "sector-a" : "sector-b", projectionManifest, valuationManifest,
          projectionDefinition: definition, valuationDefinition: definition, projectionAvailableAt: origin, valuationAvailableAt: origin,
          members: [{ id: "member", projectedGrowth: growth, impliedGrowth: 0 }] },
        controls: Array.from({ length: 7 }, rnd), baselineGrowth: rnd(), transitionDemand: rnd(), carbonDrag: rnd(), intensity: rnd(),
        executionPrice, executionFx: 1, endPrice: executionPrice * (1 + growth * .05 + rnd() * .01), endFx: 1,
        splitRatio: 1, dividends: 0, terminalProceeds: 0, lifecycle: "continuing" as const,
        borrowAvailable: true, borrowAnnualRate: .01, assumedBorrowAnnualRate: .03, sourceHashes: [source] };
    });
    c.periods.push({ specification: spec, origin, executionAt, endAt, outcomeAvailableAt: endAt, universeHash,
      expectedCompanyIds: ids, securities, cashAnnualRate: 0, financingAnnualRate: .04,
      factors: { currency: "USD", geography: "fixture-region", sourceHashes: [source],
        regionalDeveloped: [rnd() * .01], workbookUniverse: [rnd() * .01] } });
  }
  return { p, c };
}
const run = (f: ReturnType<typeof fixture>) => runPairedResearchPipeline(f.p, contentHash(f.p), f.c);

test("concurrent/repeated frozen requests retain incomplete family cells and paired uncertainty", async () => {
  const f = fixture(), before = contentHash(f);
  const results = await Promise.all(Array.from({ length: 3 }, async () => run(f)));
  results.forEach(r => {
    assert.deepEqual(r, results[0]);
    assert.equal(r.family.familySize, 6);
    assert.equal(r.family.unavailableHypotheses, 6);
  });
  assert.equal(contentHash(f), before);
});

test("frozen long-only variants require origin eligibility and liquidity, never defaults", () => {
  const f = fixture();
  f.p.longOnlyVariants = [{ sectorNeutral: true, maxActiveWeight: .1, participation: .1, capital: 100, rebalanceMonths: 3 }];
  const r = run(f).specifications[0].longOnlyVariants[0] as { unavailable: string };
  assert.match(r.unavailable, /Missing origin eligibility/);
});
test("cutoff ignores unused future archives but rejects future artifacts used by complete dates", () => {
  const f = fixture();
  f.c.dataEnd = f.c.periods[20].endAt;
  const baseline = run(f);
  const future = f.c.artifacts.find(a => a.hash === f.c.periods[30].securities[0].sourceHashes[0])!;
  future.availableAt = "2030-01-01T00:00:00Z";
  future.capturedAt = future.availableAt;
  assert.deepEqual(run(f), { ...baseline, corpusHash: contentHash(f.c),
    trackBAdmission: { ...baseline.trackBAdmission, corpusHash: contentHash(f.c) } });
  const used = f.c.artifacts.find(a => a.hash === f.c.periods[15].securities[0].sourceHashes[0])!;
  used.capturedAt = "2030-01-01T00:00:00Z";
  assert.throws(() => run(f), /Artifact beyond corpus cutoff/);
});
test("incomplete outcomes do not relax origin-relative future signal gates", () => {
  const f = fixture(); f.c.dataEnd = f.c.periods[20].endAt;
  const raw = f.c.periods[30].securities[0].pair as { projectionManifest: string };
  const a = f.c.artifacts.find(a => a.hash === raw.projectionManifest)!;
  a.availableAt = f.c.periods[30].executionAt;
  assert.throws(() => run(f), /Future origin artifact/);
});

test("orchestrates frozen full family, ranks, dated accounting, inference, ablations and separate kernel without fixture acceptance", () => {
  const r = run(fixture());
  assert.equal(r.family.familySize, 6);
  assert.equal(r.family.unavailableHypotheses, 6);
  assert.equal(r.scientificAcceptance, false);
  assert.equal(r.efficacy, "WITHHELD");
  assert.equal(r.trackBAdmission.periods.length, 72);
  assert.ok(r.trackBAdmission.periods.every(period => period.status === "unavailable" && period.result === null));
  assert.ok(r.trackBAdmission.periods.some(period => period.reasons.some(reason => reason.code === "missing-period")));
  assert.ok(r.trackBAdmission.periods.some(period => period.reasons.some(reason => reason.code === "missing-stage9-lineage")));
  assert.ok(r.trackBAdmission.periods.some(period => period.reasons.some(reason => reason.code === "missing-original-filing")));
  const s = r.specifications[0];
  assert.equal(s.trajectories[0].accounting.length, 24);
  assert.equal(s.trajectories[0].error, undefined);
  assert.equal(Object.keys(s.ablations).length, 4);
  assert.equal(Object.keys(s.attribution).length, 2);
  assert.ok("estimate" in (s.endpoints["signal-ic"] as object));
  assert.ok("estimate" in (s.endpoints["evaluation-r2"] as object));
  assert.ok("estimate" in (s.endpoints["after-cost-long-short"] as object));
  assert.equal(r.specifications[1].missing[0], "No retained origin periods");
  for (const a of s.trajectories[0].accounting) {
    assert.equal(a.grossExposure, 2); assert.equal(a.netExposure, 0);
    assert.ok(Math.abs(a.tradingCost - a.tradedNotional * .0025) < 1e-12);
    assert.ok(Math.abs(a.endNav - a.endCash - a.holdings.reduce((n, h) => n + h.endValue, 0)) < 1e-12);
  }
});

test("zero explicit expenses recover gross; 25bp applies to both legs, not half turnover", () => {
  const { c } = fixture(1), t = c.periods[0];
  t.securities.forEach(s => s.borrowAnnualRate = 0);
  const weights = { "engineering-0": 1, "engineering-1": -1 };
  const zero = accountResearchPeriod(t, weights, {}, 0, 1);
  const paid = accountResearchPeriod(t, weights, {}, 25, 1);
  assert.ok(Math.abs(zero.netReturn - zero.grossReturn) < 1e-12);
  assert.equal(paid.tradedNotional, 2); assert.equal(paid.tradingCost, .005);
  assert.ok(Math.abs(zero.netReturn - paid.netReturn - .005) < 1e-12);
});

test("split, FX, distributions, short liability, financing and terminal settlement reconcile", () => {
  const { c } = fixture(1), t = c.periods[0], s = t.securities[0];
  Object.assign(s, { endPrice: 50, splitRatio: 2, endFx: 1.1, dividends: 2, borrowAnnualRate: 0 });
  const long = accountResearchPeriod(t, { [s.companyId]: 2 }, {}, 25, 1);
  assert.ok(long.financing < 0);
  assert.ok(Math.abs(long.grossReturn - .244) < 1e-12);
  const short = accountResearchPeriod(t, { [s.companyId]: -1 }, {}, 0, 1);
  assert.ok(Math.abs(short.shortDividendLiability - .022) < 1e-12);
  Object.assign(s, { lifecycle: "delisted", terminalProceeds: 20 });
  const settled = accountResearchPeriod(t, { [s.companyId]: 1 }, {}, 0, 1);
  assert.equal(settled.holdings[0].endValue, 0);
  assert.ok(Math.abs(settled.holdings[0].settlementCash - .22) < 1e-12);
  const stress = accountResearchPeriod(t, { [s.companyId]: 1 }, {}, 0, 1, -1);
  assert.equal(stress.holdings[0].settlementCash, 0);
  const continuing = accountResearchPeriod(t, { "engineering-1": 1 }, {}, 0, 1, -1);
  assert.ok(continuing.holdings[1].endValue > 0);
  assert.throws(() => accountResearchPeriod(t, {}, { missing: 1 }, 25, 1), /disappeared/);
});

test("future execution returns cannot change earlier selected units and weights", () => {
  const f = fixture(), a = run(f);
  f.c.periods[20].securities.forEach(s => s.endPrice *= 1.2);
  f.c.periods[21].securities.forEach((s, i) => s.executionPrice = f.c.periods[20].securities[i].endPrice);
  const b = run(f);
  assert.deepEqual(a.specifications[0].trajectories[0].accounting.slice(0, 8),
    b.specifications[0].trajectories[0].accounting.slice(0, 8));
  assert.deepEqual(a.specifications[0].trajectories[0].accounting[8].holdings.map(h => [h.units, h.weight]),
    b.specifications[0].trajectories[0].accounting[8].holdings.map(h => [h.units, h.weight]));
});

test("missing universe members and missing specifications remain nonrejections", () => {
  const f = fixture(); f.c.periods[15].securities.pop();
  const r = run(f);
  assert.match(r.specifications[0].missing[0], /missing members/);
  assert.equal(r.family.unavailableHypotheses, 6);
  assert.equal(r.family.tests.filter(t => t.passed).length, 0);
});

test("same-close, hash substitution, changed models and undeclared specs reject", () => {
  let f = fixture(1); f.c.periods[0].executionAt = f.c.periods[0].origin;
  assert.throws(() => run(f), /strictly after/);
  f = fixture(1); f.c.artifacts[0].payload = ["substituted"];
  assert.throws(() => run(f), /hash mismatch/);
  f = fixture(1); (f.c.periods[0].securities[0].pair as any).members[0].projectedGrowth = 123;
  assert.throws(() => run(f), /not bound/);
  f = fixture(1); f.c.periods[0].specification = { ...f.c.periods[0].specification, model: "undeclared" };
  assert.throws(() => run(f), /not bound|outside frozen/);
  f = fixture(1);
  assert.throws(() => runPairedResearchPipeline(f.p, "a".repeat(64), f.c), /protocol hash mismatch/);
});

test("future inputs and revised substitutions cannot masquerade as origin archives", () => {
  let f = fixture(1); f.c.periods[0].securities[0].informationAvailableAt = "2025-01-01T00:00:00Z";
  assert.throws(() => run(f), /Future security/);
  f = fixture(1); f.c.mode = "point-in-time";
  f.c.artifacts.forEach(a => a.vintage = "revised");
  assert.throws(() => adaptPairedResearchCorpus(f.c), /original retained/);
});

test("unknown borrow is hypothetical, known unavailable borrow rejects and cannot earn spread support", () => {
  const f = fixture();
  f.c.periods.forEach(t => t.securities.forEach(s => { s.borrowAvailable = null; s.borrowAnnualRate = null; }));
  const r = run(f);
  assert.ok(r.specifications[0].trajectories[0].accounting.every(a => a.hypothetical));
  assert.match(JSON.stringify(r.specifications[0].endpoints["after-cost-long-short"]), /hypothetical/);
  const t = f.c.periods[0]; t.securities[0].borrowAvailable = false;
  assert.throws(() => accountResearchPeriod(t, { "engineering-0": -1 }, {}, 25, 1), /unavailable borrow/);
});

test("completed windows and purged training are enforced; terminal insolvency cannot restart", () => {
  const f = fixture(); f.c.dataEnd = f.c.periods[20].endAt;
  const r = run(f);
  assert.ok(r.specifications[0].missing.some(m => m.includes("incomplete outcome")));
  assert.equal(r.specifications[0].trainingDates, 11);
  const t = f.c.periods[0];
  Object.assign(t.securities[0], { lifecycle: "delisted", terminalProceeds: 0 });
  const a = accountResearchPeriod(t, { "engineering-0": 1 }, {}, 25, 1);
  assert.ok(a.insolvent); assert.deepEqual(a.drifted, {});
});

test("missing entire frozen date is not silently selected away; factor and execution reconciliation fail closed", () => {
  let f = fixture(); f.c.periods.splice(16, 1);
  let r = run(f);
  assert.ok(r.specifications[0].missing.some(m => m.includes("missing frozen origin")));
  assert.equal(r.family.tests.filter(t => t.passed).length, 0);
  f = fixture(); f.c.periods[15].securities.forEach(s => s.executionPrice *= 2);
  r = run(f);
  assert.match(r.specifications[0].trajectories[0].error!, /mark discontinuity/);
  f = fixture(); f.c.periods[0].factors.currency = "EUR";
  assert.throws(() => run(f), /geography\/currency/);
});

test("unchanged long-only kernel retains warm-up and capped past-only tilt", () => {
  const r = run(fixture());
  const kernel = r.specifications[0].longOnly as { result: { series: Array<{ tiltScale: number }> } };
  assert.equal(kernel.result.series.length, 36);
  assert.ok(kernel.result.series.slice(0, 12).every(r => r.tiltScale === 0));
  assert.ok(kernel.result.series.every(r => r.tiltScale >= 0 && r.tiltScale <= 5));
});
