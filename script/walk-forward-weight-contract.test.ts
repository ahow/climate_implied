import test from "node:test";
import assert from "node:assert/strict";
import { walkForward, walkForwardEqualSectorStrategy, EQUAL_SECTOR_STRATEGY_CONTRACT } from "../server/climateValuation/walkForward";
import { markMonthlyMoneyUnavailable, MonetaryUnavailableError } from "../server/financialData/workbookMoneyConsumers";
import { verifiedSyntheticWalkForward } from "./fixtures/verifiedSyntheticMoney";
const rows = () => [{ companyId: 1, sector: "a", monthlyReturn: .1 }, { companyId: 2, sector: "a", monthlyReturn: -.1 },
  { companyId: 3, sector: "b", monthlyReturn: .04 }];
test("Explicit strategy fractions are constructed, not raw market caps with a currency bypass", () => {
  const data = new Map([["2020-02", rows()]]);
  const result = walkForwardEqualSectorStrategy(data, new Map(), .02, 25, EQUAL_SECTOR_STRATEGY_CONTRACT);
  assert.ok(Math.abs(result.series[0].benchmarkReturn - .02) < 1e-12, "one-quarter/one-quarter/one-half equal-sector benchmark");
  assert.ok(Math.abs(result.accounting.netCumulative - .9975 * 1.02) < 1e-12);
  assert.deepEqual(data.get("2020-02"), rows(), "No source/strategy input mutation");
  assert.throws(() => walkForwardEqualSectorStrategy(data, new Map(), .02, 25, undefined as any), /contract/);
  assert.throws(() => walkForwardEqualSectorStrategy(data, new Map(), .02, 25,
    { ...EQUAL_SECTOR_STRATEGY_CONTRACT, construction: "source-capitalisation" } as any), /contract/);
});
test("Source-cap inputs, user-supplied weight numbers and rejected money maps cannot impersonate the strategy contract", () => {
  for (const field of ["marketCap", "weightSource", "benchmarkWeight"]) {
    const data = new Map([["2020-02", rows().map(r => ({ ...r, [field]: 100 }))]]);
    assert.throws(() => walkForwardEqualSectorStrategy(data, new Map(), .02, 25, EQUAL_SECTOR_STRATEGY_CONTRACT), /no monetary input\/weight relabelling/);
  }
  const rejected = markMonthlyMoneyUnavailable(new Map([["2020-02", rows()]]), "no source denomination");
  assert.throws(() => walkForwardEqualSectorStrategy(rejected, new Map(), .02, 25, EQUAL_SECTOR_STRATEGY_CONTRACT), MonetaryUnavailableError);
  const rawMoney = new Map([["2020-02", rows().map(r => ({ ...r, marketCap: 100 }))]]);
  assert.throws(() => walkForward(rawMoney, new Map(), .02), MonetaryUnavailableError, "Source cap entry point remains guarded");
});
test("Independent monetary and equal-sector strategy entry points share unchanged forward/risk/cost arithmetic", () => {
  const strategy = new Map<string, ReturnType<typeof rows>>(), money = new Map<string, any[]>(), scores = new Map<string, Map<number, number>>();
  for (let i = 0; i < 24; i++) {
    const month = new Date(Date.UTC(2020, i, 1)).toISOString().slice(0, 7);
    const returns = rows().map((r, j) => ({ ...r, monthlyReturn: (i % 2 ? 1 : -1) * .01 * (j + 1) }));
    strategy.set(month, returns);
    // Explicit synthetic trusted USD-million receipts; ratio 1:1:2 equals the
    // separate strategy constructor's .25/.25/.5 fractions.
    money.set(month, returns.map(r => ({ companyId: r.companyId, marketCap: r.sector === "a" ? 100 : 200, monthlyReturn: r.monthlyReturn })));
    scores.set(month, new Map([[1, -1], [2, 0], [3, 1]]));
  }
  assert.deepEqual(walkForwardEqualSectorStrategy(strategy, scores, .02, 25, EQUAL_SECTOR_STRATEGY_CONTRACT),
    verifiedSyntheticWalkForward(money, scores, .02, 25));
});
