import assert from "node:assert/strict";
import { test } from "node:test";
import { SeededRandom, randomNormalFrom } from "../server/calculation/random";
import { calculationKey } from "../server/calculation/identity";
import { legacyContext, orderCalculationRows, quantity } from "../shared/calculationContract";
import { calculateEmissionsTrajectory, calculateTemperatureDistribution, getTemperatureStats } from "../server/calculation/forwardProjection";
import { computeDecarbGapScores } from "../server/climateValuation/decarbGapCalculator";
import { getLatestTimeSeriesPerCompany } from "../server/climateValuation/sharedUtils";
import { computeMonthlyReturns, computeBenchmarkReturn, computeSignalScores } from "../server/climateValuation/backtestCalculator";
import { convertAll } from "../server/climateValuation/decarbConversion";
import { inputs, companies, rows, backtestSettings } from "./fixtures/calculationInputs";
import { expected } from "./fixtures/calculationExpected";
import { MemStorage } from "../server/storage";

test("RNG is repeatable, seed-sensitive, open-interval, without old parameter cycle", () => {
  const a = new SeededRandom(2024 * 12345), b = new SeededRandom(2024 * 12345);
  const c = new SeededRandom(2025 * 12345);
  const tuples = new Set<string>();
  let different = false;
  for (let i = 0; i < 10000; i++) {
    const tuple = [];
    for (let j = 0; j < 14; j++) {
      const value = a.next();
      assert.equal(value, b.next());
      different ||= value !== c.next();
      assert.ok(value > 0 && value < 1);
      tuple.push(value);
    }
    tuples.add(tuple.join(","));
  }
  assert.equal(tuples.size, 10000);
  assert.ok(different);
  assert.ok(Number.isFinite(randomNormalFrom({ next: () => 0 }, 0, 1)));
  assert.throws(() => new SeededRandom(NaN));
});

test("content identities ignore object key order, include values/settings/version, reject NaN", () => {
  const key = calculationKey("test", { a: 1, b: 2 }, { seed: 1 });
  assert.equal(key, calculationKey("test", { b: 2, a: 1 }, { seed: 1 }));
  assert.notEqual(key, calculationKey("test", { a: 2, b: 2 }, { seed: 1 }));
  assert.notEqual(key, calculationKey("test", { a: 1, b: 2 }, { seed: 2 }));
  assert.notEqual(key, calculationKey("test", { a: 1, b: 2 }, { seed: 1 }, "future-version"));
  assert.throws(() => calculationKey("test", { value: NaN }));
});

test("unavailable quantities and legacy unknown conventions stay explicit", () => {
  assert.equal(quantity(null, "GtCO2").status, "unavailable");
  assert.equal(quantity(0, "GtCO2").status, "available");
  assert.throws(() => quantity(Infinity, "GtCO2"));
  assert.equal(legacyContext(2026, "all").observationYear, null);
  assert.equal(legacyContext(2026, "all").units.gwpBasis, "unspecified-legacy");
});

test("projection rejects missing indicators and invalid horizons/runs", () => {
  assert.throws(() => calculateEmissionsTrajectory({ ...inputs, carbonIntensity: undefined } as any));
  assert.throws(() => calculateEmissionsTrajectory(inputs, 2026, 2024));
  assert.throws(() => calculateEmissionsTrajectory(inputs, 2024, 2030, 0));
});

test("fast trajectory fixture is repeatable and seed-sensitive (characterization only)", () => {
  const a = calculateEmissionsTrajectory(inputs, 2024, 2034, 100, 123);
  assert.deepEqual(a, calculateEmissionsTrajectory(inputs, 2024, 2034, 100, 123));
  assert.notDeepEqual(a, calculateEmissionsTrajectory(inputs, 2024, 2034, 100, 124));
  assert.equal(a.length, 11);
  for (const row of a) {
    assert.ok(Object.values(row).every(Number.isFinite));
    assert.ok(row.p10 <= row.p25 && row.p25 <= row.p50 && row.p50 <= row.p75 && row.p75 <= row.p90);
  }
});

test("full-horizon characterization fixture has reproducible finite legacy summaries", () => {
  const trajectory = calculateEmissionsTrajectory(inputs, 2024, 2100, 300);
  const pdf = calculateTemperatureDistribution(trajectory, 300);
  const stats = getTemperatureStats(pdf, trajectory);
  assert.equal(trajectory.at(-1)?.year, 2100);
  assert.deepEqual(stats, getTemperatureStats(pdf, trajectory));
  assert.ok(stats.p10 <= stats.median && stats.median <= stats.p90);
  for (const point of expected.points) {
    const actual = trajectory.find(row => row.year === point.year)!;
    assert.ok(Math.abs(actual.emissions - point.emissions) < 1e-9);
    assert.ok(Math.abs(actual.cumulativeEmissions - point.cumulative) < 1e-9);
  }
  for (const key of ["median", "mean", "p10", "p90"] as const) {
    assert.ok(Math.abs(stats[key] - expected.temperature[key]) < 1e-9);
  }
  // This does not certify physical validity or coherent ensemble propagation.
});

test("sorting removes row-order dependence from latest-input signals and identities", () => {
  const ordered = orderCalculationRows(rows);
  const reversed = orderCalculationRows([...rows].reverse());
  assert.deepEqual(ordered, reversed);
  assert.equal(calculationKey("finance", ordered, backtestSettings), calculationKey("finance", reversed, backtestSettings));
  const map = (data: typeof rows) => new Map(companies.map(c => [c.id, data.filter(r => r.companyId === c.id)]));
  const scores = (data: typeof rows) => [...computeSignalScores(companies, "carbon_intensity", map(data))];
  assert.deepEqual(scores(rows), scores([...rows].reverse()));
  assert.throws(() => orderCalculationRows([{ companyId: 1, date: new Date("invalid") }]));
});

test("synthetic gap scores are order-invariant including ties; common projection only shifts gaps", () => {
  const latest = getLatestTimeSeriesPerCompany(orderCalculationRows(rows));
  const score = (cs: typeof companies, rate: number) =>
    [...computeDecarbGapScores(cs, latest, rate, "sector_relative", 0.08)].sort(([a], [b]) => a - b);
  assert.deepEqual(score(companies, 2.5), score([...companies].reverse(), 4));
  assert.deepEqual(score(companies, 2.5), expected.gapScores);
  const tied = new Map([...latest].map(([id, row]) => [id, { ...row, peRatio: 20 }]));
  const tieScores = (cs: typeof companies) =>
    [...computeDecarbGapScores(cs, tied, 2.5, "sector_relative", 0.08)].sort(([a], [b]) => a - b);
  assert.deepEqual(tieScores(companies), tieScores([...companies].reverse()));
});

test("synthetic monthly returns and benchmark agree with hand calculation", () => {
  const grouped = new Map(companies.map(c => [c.id, rows.filter(r => r.companyId === c.id)]));
  const monthly = computeMonthlyReturns(grouped);
  assert.equal(monthly.size, 2);
  for (const data of monthly.values()) assert.ok(Math.abs(computeBenchmarkReturn(data) - 0.02) < 1e-12);
  // Legacy exclusions/quarter lag/in-sample fitting remain for Package 7.
});

test("legacy finance conversion remains unchanged by physical-model refactoring", () => {
  const zero = convertAll(0);
  assert.equal(zero.cumulativeEmissionsGt, Math.round(60.3 * 77));
  assert.equal(zero.impliedTemperature, 3.19);
  assert.equal(zero.netZeroYear, null);
  assert.equal(convertAll(2).impliedTemperature, 2.17);
});

test("cache lookups cannot reuse a result after input, settings or version changes", async () => {
  const storage = new MemStorage();
  const key = calculationKey("projection", inputs, { runs: 100 });
  await storage.setProjectionCache({ cacheKey: key, projectionYear: 2024, resultData: { marker: "original" } });
  assert.ok(await storage.getProjectionCache(key));
  assert.equal(await storage.getProjectionCache(calculationKey("projection", { ...inputs, carbonIntensity: 0.4 }, { runs: 100 })), undefined);
  assert.equal(await storage.getProjectionCache(calculationKey("projection", inputs, { runs: 101 })), undefined);
  assert.equal(await storage.getProjectionCache(calculationKey("projection", inputs, { runs: 100 }, "future-version")), undefined);
  await storage.clearProjectionCaches();
  assert.equal(await storage.getProjectionCache(key), undefined);
});
