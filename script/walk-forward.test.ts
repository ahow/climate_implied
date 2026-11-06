import { test } from "node:test";
import assert from "node:assert/strict";
import { walkForward, type ReturnObservation } from "../server/climateValuation/walkForward";
import { computeMonthlyReturns } from "../server/climateValuation/backtestCalculator";
import type { CvTimeSeries } from "../shared/schema";
import { calculateBacktest } from "../server/climateValuation/walkForwardBacktest";

function fixture() {
  const data = new Map<string, ReturnObservation[]>();
  const scores = new Map<string, Map<number, number>>();
  for (let i = 0; i < 30; i++) {
    const month = `${2020 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, "0")}`;
    data.set(month, [{ companyId: 1, marketCap: 100, monthlyReturn: i % 2 ? .05 : -.03 },
      { companyId: 2, marketCap: 100, monthlyReturn: i % 2 ? -.01 : .02 }]);
    scores.set(month, new Map([[1, 1], [2, -1]]));
  }
  return { data, scores };
}
test("warm-up holds benchmark and later observations cannot change earlier trades", () => {
  const { data, scores } = fixture();
  const first = walkForward(data, scores, .02);
  assert.ok(first.series.slice(0, 12).every(x => x.tiltScale === 0 && x.activeReturn === 0));
  assert.ok(first.series[12].tiltScale! > 0);
  data.set("2022-06", [{ companyId: 1, marketCap: 100, monthlyReturn: 2 }]);
  scores.set("2022-06", new Map([[1, -1]]));
  const changed = walkForward(data, scores, .02);
  assert.deepEqual(first.series.slice(0, -1), changed.series.slice(0, -1));
});
test("simple benchmark and wealth accounting reconcile", () => {
  const r = walkForward(new Map([["2020-01", [
    { companyId: 1, marketCap: 100, monthlyReturn: .1 },
    { companyId: 2, marketCap: 300, monthlyReturn: -.1 },
  ]]]), new Map(), .02);
  assert.ok(Math.abs(r.series[0].benchmarkReturn + .05) < 1e-12);
  assert.ok(Math.abs(r.series[0].portfolioCumulative - .95) < 1e-12);
});
test("large-universe warm-up is exactly benchmark, not normalization noise", () => {
  const rows = Array.from({ length: 2345 }, (_, i) => ({
    companyId: i, marketCap: i * 73 + 1, monthlyReturn: i % 2 ? .13 : -.08,
  }));
  const r = walkForward(new Map([["2020-01", rows]]),
    new Map([["2020-01", new Map(rows.map(r => [r.companyId, 1]))]]), .02);
  assert.equal(r.series[0].activeReturn, 0);
  assert.equal(r.series[0].portfolioReturn, r.series[0].benchmarkReturn);
});
test("extreme and total-loss returns survive, missing months are not compressed", () => {
  const rows = [
    ["2020-01-31", 100, 100], ["2020-02-29", 200, 100],
    ["2020-04-30", 300, 100], ["2020-05-31", 0, 0],
  ].map(([date, ri, mv], i) => ({ id: i, companyId: 1, date: new Date(date as string),
    totalReturnIndex: ri, marketCap: mv } as CvTimeSeries));
  const result = computeMonthlyReturns(new Map([[1, rows]]));
  assert.equal(result.get("2020-02")![0].monthlyReturn, 1);
  assert.equal(result.has("2020-04"), false);
  assert.equal(result.get("2020-05")![0].monthlyReturn, -1);
});
test("undated SDG and target scores cannot masquerade as historical signals", async () => {
  for (const signal of ["sdg_exposure", "decarb_ambition"] as const) {
    const result = await calculateBacktest(signal, 2);
    assert.equal(result.series.length, 0);
    assert.match(result.summary.warnings[0], /unavailable/);
  }
});
