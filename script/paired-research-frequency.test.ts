import test from "node:test";
import assert from "node:assert/strict";
import { contentHash } from "../server/calculation/analysisManifest";
import { reconcilePortfolioFrequency, type FrequencyCell, type PortfolioStream } from "../server/calculation/pairedResearchFrequency";
import { runPairedResearchPipeline, type PairedResearchProtocol } from "../server/calculation/pairedResearchPipeline";
import { adaptPairedResearchCorpus, type ResearchCorpus } from "../server/calculation/pairedResearchCorpus";

// GENERATED ENGINEERING ARITHMETIC ONLY. These are not retained historical observations.
const stamp = (m: number, day = 1) => new Date(Date.UTC(2020, m, day)).toISOString();
function fixture(count = 2, costBps = 25) {
  const specification = { model: "engineering-only", peer: "sector", target: "12-month" as const };
  const c: ResearchCorpus = { mode: "engineering-fixture", dataEnd: stamp(count + 11), periods: [], artifacts: [] };
  const archive = (payload: unknown, availableAt = "2018-01-01T00:00:00.000Z") => {
    const hash = contentHash(payload);
    if (!c.artifacts.some(a => a.hash === hash)) c.artifacts.push({
      hash, payload: structuredClone(payload), availableAt, capturedAt: availableAt, originUri: `engineering-only://${hash}`, vintage: "engineering-fixture",
    });
    return hash;
  };
  const schedule = { initialCapital: count * 10 + 100, deployments: Array.from({ length: count }, (_, m) => ({
    id: `cohort-${m}`, origin: stamp(m, 0), executionAt: stamp(m), maturityAt: stamp(m + 12), capital: 10,
  })) };
  const definition = (provider: "Kenneth French Data Library" | "workbook-universe") => ({
    names: ["engineering-factor"], constructionHash: archive({ provider, engineeringOnly: true }),
    provider, currencyConversion: "engineering-only identity USD", valuesConvention: "decimal-monthly-factor-returns" as const,
  });
  const cell: FrequencyCell = { specification, streamId: "engineering-stream", schedule,
    regionalDeveloped: definition("Kenneth French Data Library"), workbookUniverse: definition("workbook-universe") };
  const stream: PortfolioStream = { id: cell.streamId, specification: { ...specification }, scheduleHash: contentHash(schedule), entries: [], marks: [], months: [] };
  const entryCost = 20 * costBps / 10000;
  const selections = schedule.deployments.map(d => ({
    origin: d.origin, executionAt: d.executionAt, endAt: d.maturityAt, weights: { long: 1, short: -1 },
    executionQuotes: { long: { price: 10, fx: 1 }, short: { price: 10, fx: 1 } },
  }));
  for (const d of schedule.deployments) {
    const e = { id: d.id, trades: [
      { companyId: "long", units: 1, price: 10, fx: 1 }, { companyId: "short", units: -1, price: 10, fx: 1 },
    ], restrictedCash: 5, costBps, tradingCost: entryCost };
    stream.entries.push({ ...e, sourceHash: archive({ ...e, origin: d.origin, executionAt: d.executionAt }) });
  }
  const rate = { annualRate: 0, availableAt: "2018-01-01T00:00:00.000Z" };
  const rateHash = archive(rate);
  let reserve = schedule.initialCapital;
  for (let m = 0; m <= count + 11; m++) {
    const openingReserve = reserve;
    const sleeves = schedule.deployments.flatMap((d, j) => {
      const age = m - j;
      if (age < 0 || age > 12) return [];
      const exitCost = 32 * costBps / 10000;
      const positions: Record<string, number> = age === 12 ? {} : { long: 10 + age, short: -10 };
      const values = { id: d.id, cash: age === 12 ? 22 - entryCost + .96 - exitCost : 5 - entryCost + .08 * age,
        restrictedCash: age === 12 ? 0 : 5, positions, settlement: age === 12 };
      if (age === 0) reserve -= 10;
      if (age === 12) reserve += values.cash;
      return [{ ...values, sourceHashes: [archive({ at: stamp(m), ...values })] }];
    });
    stream.marks.push({ at: stamp(m), reserveInterest: 0, sleeves,
      ...(m ? { reserveAccrual: { fromAt: stamp(m - 1), toAt: stamp(m), openingReserve,
        ...rate, sourceHash: rateHash } } : {}) });
    if (!m) continue;
    const books = schedule.deployments.flatMap((d, j) => {
      const age = m - j;
      if (age < 1 || age > 12) return [];
      const actions = [
        { kind: "dividend" as const, companyId: "long", perShare: .2, fx: 1 },
        { kind: "dividend" as const, companyId: "short", perShare: .1, fx: 1 },
        { kind: "borrow" as const, companyId: "short", available: true, observedFee: .02, hypotheticalFee: null },
        { kind: "collateral" as const, amount: age === 12 ? -5 : 0 },
        { kind: "financing" as const, expense: 0 }, { kind: "interest" as const, cashAmount: 0 },
      ];
      const payload = { startAt: stamp(m - 1), endAt: stamp(m), cash: 5 - entryCost + .08 * (age - 1),
        restrictedCash: 5, units: { long: 1, short: -1 },
        events: actions.map(action => ({ at: stamp(m), action, sourceHash: archive({ at: stamp(m), action }) })),
        endMarks: { long: { price: 10 + age, fx: 1 }, short: { price: 10, fx: 1 } } };
      return [{ id: d.id, book: { ...payload, coverageSourceHash: archive(payload) },
        liquidationTrades: age === 12 ? [
          { companyId: "long", units: -1, price: 22, fx: 1 }, { companyId: "short", units: 1, price: 10, fx: 1 },
        ] : [], costBps, tradingCost: age === 12 ? 32 * costBps / 10000 : 0 }];
    });
    const regionalDeveloped = [.01 * Math.sin(m * 1.13)], workbookUniverse = [.02 * Math.cos(m * .73)];
    const factorSource = (which: "regionalDeveloped" | "workbookUniverse", values: number[]) => archive({
      fromAt: stamp(m - 1), toAt: stamp(m), frequency: "calendar-month", currency: "USD", geography: "engineering-region",
      definition: cell[which], values,
    });
    const payload = { fromAt: stamp(m - 1), toAt: stamp(m), books, factors: {
      frequency: "calendar-month" as const, currency: "USD", geography: "engineering-region", riskFreeReturn: 0,
      regionalDeveloped, workbookUniverse,
      regionalSourceHash: factorSource("regionalDeveloped", regionalDeveloped),
      workbookSourceHash: factorSource("workbookUniverse", workbookUniverse),
      riskFreeSourceHash: archive({ fromAt: stamp(m - 1), toAt: stamp(m), currency: "USD", return: 0 }),
    } };
    stream.months.push({ ...payload, sourceHash: archive(payload) });
  }
  const context = { artifacts: c.artifacts, dataEnd: c.dataEnd, mode: c.mode, currency: "USD", geography: "engineering-region",
    costBps, expectedOrigins: selections.map(s => s.origin), selections };
  const p: PairedResearchProtocol = {
    evidenceMode: "revised-history", primaryEndpoints: ["evaluation-r2", "signal-ic", "after-cost-long-short"],
    specifications: [specification], expectedOrigins: context.expectedOrigins, frozenAt: "2018-01-01T00:00:00.000Z",
    evaluationStart: stamp(0), evaluationEnd: c.dataEnd, embargoDays: 2, blockLength: 12, repetitions: 200, seed: 123,
    currency: "USD", geography: "engineering-region", quantile: .25, weighting: "equal-within-sector",
    costBps: 25, sensitivityCostBps: [0, 10, 25, 50, 100], borrowRateMultipliers: [0, 1, 2], terminalStresses: [0, -.3, -1],
    disclosure: "locked retrospective evaluation (prior exposure: 2020 onward)",
    portfolioFrequency: { version: "simultaneous-monthly-sleeves-v1", frequency: "calendar-month",
      returnConvention: "net-total-nav-minus-dated-risk-free", entryCostTiming: "charged-at-deployment-in-first-month", cells: [cell] },
  };
  const ids = ["short", "middle-a", "middle-b", "long"];
  const universeHash = archive(ids.slice().sort());
  const pairedDefinition = { currency: "USD", basis: "FCFE", horizonYears: 5, growthDefinition: "five-year-CAGR", nominal: true };
  for (const d of schedule.deployments) {
    const securities = ids.map((companyId, i) => {
      const growth = (i + 1) * .01;
      const paired = (value: number) => archive({ companyId, model: specification.model, origin: d.origin,
        definition: pairedDefinition, members: [{ id: "member", growth: value }] });
      return { companyId, numericId: i + 1, sector: "engineering-sector", marketCap: 100, informationAvailableAt: d.origin,
        pair: { companyId, origin: d.origin, peer: "engineering-sector", projectionManifest: paired(growth), valuationManifest: paired(0),
          projectionDefinition: pairedDefinition, valuationDefinition: pairedDefinition,
          projectionAvailableAt: d.origin, valuationAvailableAt: d.origin,
          members: [{ id: "member", projectedGrowth: growth, impliedGrowth: 0 }] },
        controls: [0, 0, 0, 0, 0, 0, 0], baselineGrowth: 0, transitionDemand: 0, carbonDrag: 0, intensity: 0,
        executionPrice: 10, executionFx: 1, endPrice: companyId === "long" ? 22 : 10, endFx: 1,
        splitRatio: 1, dividends: companyId === "long" ? 2.4 : companyId === "short" ? 1.2 : 0,
        terminalProceeds: 0, lifecycle: "continuing" as const, borrowAvailable: true, borrowAnnualRate: .024,
        assumedBorrowAnnualRate: .024, sourceHashes: [archive({ engineeringOnly: "endpoint-not-monthly" })] };
    });
    c.periods.push({ specification, origin: d.origin, executionAt: d.executionAt, endAt: d.maturityAt,
      outcomeAvailableAt: d.maturityAt, universeHash, expectedCompanyIds: ids, securities,
      cashAnnualRate: 0, financingAnnualRate: 0, factors: { currency: "USD", geography: "engineering-region",
        sourceHashes: [archive({ engineeringOnly: "undated-old-factors" })], regionalDeveloped: [0], workbookUniverse: [0] } });
  }
  c.portfolioStreams = [stream];
  return { cell, stream, context, c, p, archive };
}
const reconcile = (f: ReturnType<typeof fixture>) => reconcilePortfolioFrequency(f.cell, f.stream, f.context);
const run = (f: ReturnType<typeof fixture>) => runPairedResearchPipeline(f.p, contentHash(f.p), f.c);
const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
// Rebind deliberately edited engineering receipts to test accounting refusals,
// rather than stopping at the independent payload-integrity gate.
function rebindMonth(f: ReturnType<typeof fixture>, index: number) {
  const month = f.stream.months[index];
  for (const b of month.books) {
    const { coverageSourceHash, ...payload } = b.book;
    b.book.coverageSourceHash = f.archive(payload);
  }
  const { sourceHash, ...payload } = month;
  month.sourceHash = f.archive(payload);
}
function rebindEntry(f: ReturnType<typeof fixture>, index: number) {
  const e = f.stream.entries[index], d = f.cell.schedule.deployments.find(d => d.id === e.id)!;
  const { sourceHash, ...payload } = e;
  e.sourceHash = f.archive({ ...payload, origin: d.origin, executionAt: d.executionAt });
}

test("two overlapping cohorts hand-reconcile entry and exit costs, dividends, short liability, collateral and reserve", () => {
  const f = fixture(), r = reconcile(f);
  near(r.accounting[0].nav, 119.95);
  near(r.accounting[1].nav, 120.98);
  near(r.accounting[1].restrictedCash, 10);
  near(r.accounting[1].positions.long, 21);
  near(r.accounting[1].positions.short, -20);
  near(r.rows[0].netReturn, 120.98 / 120 - 1); // initial .05 NEVER dropped
  near(r.rows[0].tradingCost, .1);
  near(r.accounting.at(-1)!.nav, 145.66); // 100 reserve + 2*(10 + 12 + .96 - .05 - .08)
  near(r.accounting.at(-1)!.restrictedCash, 0);
  assert.deepEqual(r.accounting.at(-1)!.positions, {});
  near(r.rows.reduce((nav, row) => nav * (1 + row.netReturn), 120), 145.66);
});

test("zero explicit trading cost independently recovers gross-of-trading, not free borrow", () => {
  const zero = reconcile(fixture(2, 0)), paid = reconcile(fixture(2, 25));
  near(zero.accounting.at(-1)!.nav, 146.4 - .48); // 24*.02 observed borrow expense
  near(zero.accounting.at(-1)!.nav - paid.accounting.at(-1)!.nav, 2 * (20 + 32) * .0025);
  near(paid.rows.reduce((s, r) => s + r.tradingCost, 0), .26);
});

test("a dated split carries changed units through monthly books without manufacturing NAV or turnover", () => {
  const f = fixture(1), baseline = reconcile(f);
  for (let i = 0; i < f.stream.months.length; i++) {
    const b = f.stream.months[i].books[0], at = f.stream.months[i].toAt;
    if (i === 0) {
      const action = { kind: "split" as const, companyId: "long", ratio: 2 };
      b.book.events.unshift({ at, action, sourceHash: f.archive({ at, action }) });
    } else b.book.units.long = 2;
    b.book.endMarks.long.price /= 2;
    for (const e of b.book.events) {
      if (e.action.kind === "dividend" && e.action.companyId === "long") {
        e.action.perShare = .1;
        e.sourceHash = f.archive({ at: e.at, action: e.action });
      }
    }
    for (const t of b.liquidationTrades) if (t.companyId === "long") { t.units = -2; t.price = 11; }
    rebindMonth(f, i);
  }
  const split = reconcile(f);
  assert.deepEqual(split.rows, baseline.rows);
  near(split.accounting.at(-1)!.nav, 122.83); // 100 reserve + settled 22.83
});

test("versioned pipeline joins monthly simultaneous returns to two dated factor sets, never repeated annual endpoints", () => {
  const f = fixture(25), r = run(f), s = r.specifications[0];
  assert.equal((s.portfolioEvidence as { rows: unknown[] }).rows.length, 36);
  assert.equal(s.trajectories[0].error, "Portfolio periods require contiguous nonoverlapping holding windows");
  for (const name of ["regionalDeveloped", "workbookUniverse"]) {
    const a = s.attribution[name] as { estimate: number; frequency: string; observations: number; improvement95: number[] };
    assert.ok(Number.isFinite(a.estimate));
    assert.equal(a.frequency, "calendar-month"); assert.equal(a.observations, 36); assert.equal(a.improvement95.length, 2);
  }
  assert.ok("estimate" in (s.endpoints["after-cost-long-short"] as object));
  assert.equal(r.family.unavailableHypotheses, 3);
  assert.equal(r.efficacy, "WITHHELD"); assert.equal(r.authenticityVerified, false); assert.equal(r.investmentEvidence, false);
  assert.deepEqual(run(f), r);
});

test("legacy annual/unbound streams remain unavailable, frozen hash and version cannot be silently refit", () => {
  const f = fixture(25);
  delete f.p.portfolioFrequency; delete f.c.portfolioStreams;
  assert.match(JSON.stringify(run(f).specifications[0].endpoints["after-cost-long-short"]), /explicitly bound monthly/);
  assert.throws(() => runPairedResearchPipeline(f.p, "a".repeat(64), f.c), /protocol hash mismatch/);
  (f.p as any).portfolioFrequency = { version: "unknown" };
  assert.throws(() => run(f));
});

test("missing origins/holdings and reused streams cannot select away frozen family cells", () => {
  let f = fixture(25); f.c.periods.splice(4, 1);
  let r = run(f);
  assert.match(JSON.stringify(r.specifications[0].endpoints["after-cost-long-short"]), /Incomplete declared corpus/);
  assert.equal(r.family.unavailableHypotheses, 3);
  f = fixture(); f.context.expectedOrigins.push(stamp(80));
  assert.throws(() => reconcile(f), /Incomplete frozen sleeve origins/);
  f = fixture(); f.p.portfolioFrequency!.cells.push(f.cell);
  assert.throws(() => run(f), /Duplicate frequency cell/);
  f = fixture(); f.stream.specification.model = "other";
  assert.throws(() => reconcile(f), /binding mismatch/);
});

test("source, cutoff, future reserve input, monthly frequency and boundary substitutions refuse", () => {
  let f = fixture(); f.c.artifacts.find(a => a.hash === f.stream.months[0].sourceHash)!.payload = {};
  assert.throws(() => reconcile(f), /hash-mismatched/);
  f = fixture(); f.context.dataEnd = stamp(12);
  assert.throws(() => reconcile(f), /cutoff|Future monthly/);
  f = fixture();
  f.c.artifacts.find(a => a.hash === f.stream.marks[1].reserveAccrual!.sourceHash)!.availableAt = stamp(1);
  assert.throws(() => reconcile(f), /Future or non-original/);
  f = fixture(); (f.stream.months[0].factors as any).frequency = "12-month";
  assert.throws(() => adaptPairedResearchCorpus(f.c));
  f = fixture(); f.stream.marks[1].at = stamp(1, 2);
  assert.throws(() => reconcile(f), /bound|first-of-month/);
  f = fixture(); f.stream.months[0].factors.regionalDeveloped[0] = 1.2;
  assert.throws(() => reconcile(f), /not bound/);
});

test("missing explicit zero rates/costs, unexplained vanished holdings and mark cash gaps refuse", () => {
  let f = fixture(); delete f.stream.marks[1].reserveAccrual;
  assert.throws(() => reconcile(f), /explicit reserve rate/);
  f = fixture(); f.stream.entries[0].tradingCost = 0;
  assert.throws(() => reconcile(f), /not bound|reconciliation/);
  f = fixture(); f.stream.months[0].books[0].book.units.long = 0;
  rebindMonth(f, 0);
  assert.throws(() => reconcile(f), /Lifecycle units discontinuity/);
  f = fixture(); f.stream.marks[1].sleeves[0].cash += 1;
  assert.throws(() => reconcile(f), /not bound/);
});

test("explicit cash/borrow/collateral coverage and no duplicate lifecycle outcome survive receipt rebinding", () => {
  let f = fixture();
  f.stream.months[0].books[0].book.events = f.stream.months[0].books[0].book.events.filter(e => e.action.kind !== "financing");
  rebindMonth(f, 0);
  assert.throws(() => reconcile(f), /explicit financing/);
  f = fixture();
  f.stream.months[0].books[0].book.events = f.stream.months[0].books[0].book.events.filter(e => e.action.kind !== "borrow");
  rebindMonth(f, 0);
  assert.throws(() => reconcile(f), /Missing borrow coverage/);
  f = fixture();
  f.stream.months[0].books[0].book.events = f.stream.months[0].books[0].book.events.filter(e => e.action.kind !== "collateral");
  rebindMonth(f, 0);
  assert.throws(() => reconcile(f), /Missing explicit short collateral/);
  f = fixture();
  f.stream.months[1].books[0].book.events.push(f.stream.months[0].books[0].book.events[0]);
  rebindMonth(f, 1);
  assert.throws(() => reconcile(f), /Duplicate lifecycle/);
});

test("factor source/currency/provider construction and complete monthly evaluation boundary are mandatory", () => {
  let f = fixture();
  f.stream.months[0].factors.currency = "EUR"; rebindMonth(f, 0);
  assert.throws(() => reconcile(f), /geography\/currency mismatch/);
  f = fixture(); f.cell.regionalDeveloped.provider = "workbook-universe";
  assert.throws(() => reconcile(f), /provider binding/);
  f = fixture(25); f.p.evaluationStart = stamp(0, 2);
  assert.match(JSON.stringify(run(f).specifications[0].endpoints["after-cost-long-short"]), /exact retained evaluation boundaries/);
  f = fixture(25); f.p.blockLength = 11;
  assert.throws(() => run(f), /Blocks shorter than outcome horizon/);
});

test("unknown borrow preserves explicitly assumed nonzero-fee research accounting and labelled inference, never acceptance", () => {
  const f = fixture(25), baseline = run(f);
  for (let i = 0; i < f.stream.months.length; i++) {
    for (const b of f.stream.months[i].books) {
      for (const e of b.book.events) if (e.action.kind === "borrow") {
        e.action.available = null; e.action.observedFee = null; e.action.hypotheticalFee = .02;
        e.sourceHash = f.archive({ at: e.at, action: e.action });
      }
    }
    rebindMonth(f, i);
  }
  for (const period of f.c.periods) for (const s of period.securities) if (s.companyId === "short") {
    s.borrowAvailable = null; s.borrowAnnualRate = null; s.assumedBorrowAnnualRate = .024;
  }
  const r = run(f), bridge = r.specifications[0].portfolioEvidence;
  assert.ok("rows" in bridge);
  if (!("rows" in bridge)) return;
  assert.equal(bridge.hypothetical, true);
  assert.match(bridge.label, /hypothetical-research/);
  assert.equal(bridge.rows.length, 36);
  assert.ok(bridge.rows.every(row => row.hypothetical));
  const original = baseline.specifications[0].portfolioEvidence;
  assert.ok("rows" in original);
  if ("rows" in original) assert.deepEqual(bridge.accounting, original.accounting);
  const endpoint = r.specifications[0].endpoints["after-cost-long-short"] as {
    estimate: number; hypothetical: boolean; accountingLabel: string;
  };
  assert.ok(Number.isFinite(endpoint.estimate));
  assert.equal(endpoint.hypothetical, true); assert.match(endpoint.accountingLabel, /hypothetical/);
  assert.equal(r.authenticityVerified, false); assert.equal(r.investmentEvidence, false);
  assert.equal(r.scientificAcceptance, false); assert.equal(r.efficacy, "WITHHELD");
  assert.equal(r.family.unavailableHypotheses, 3);
  assert.equal(r.family.tests.filter(t => t.passed).length, 0);
});

test("source-bound entry trades must match selected period execution prices, FX and identities, not merely dollar weights", () => {
  let f = fixture();
  f.stream.entries[0].trades[0].price = 5; f.stream.entries[0].trades[0].units = 2;
  rebindEntry(f, 0); // Identical +10 dollar weight, different actual quote/units.
  assert.throws(() => reconcile(f), /Entry execution price differs/);
  f = fixture();
  f.stream.entries[0].trades[0].fx = 2; f.stream.entries[0].trades[0].units = .5;
  rebindEntry(f, 0);
  assert.throws(() => reconcile(f), /Entry execution FX differs/);
  f = fixture();
  f.stream.entries[0].trades[0].companyId = "undeclared";
  rebindEntry(f, 0);
  assert.throws(() => reconcile(f), /Entry trade identity/);
});

test("execution receipts may become available after signal origin but not after execution", () => {
  let f = fixture();
  const e = f.stream.entries[0], d = f.cell.schedule.deployments[0];
  f.c.artifacts.find(a => a.hash === e.sourceHash)!.availableAt = d.executionAt;
  assert.equal(reconcile(f).rows.length, 13);
  f = fixture();
  f.c.artifacts.find(a => a.hash === f.stream.entries[0].sourceHash)!.availableAt = stamp(1);
  assert.throws(() => reconcile(f), /Future or non-original frequency input/);
});
