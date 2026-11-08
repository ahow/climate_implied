import test from "node:test";
import assert from "node:assert/strict";
import { longShortResearch } from "../server/climateValuation/longShortResearch";
const rows = [
  { date: "2024-01-01", id: "a", sector: "x", score: 1, nextReturn: .1, borrowAvailable: true },
  { date: "2024-01-01", id: "b", sector: "x", score: -1, nextReturn: -.05, borrowAvailable: true },
  { date: "2024-02-01", id: "a", sector: "x", score: 1, nextReturn: 0, borrowAvailable: true },
  { date: "2024-02-01", id: "b", sector: "x", score: -1, nextReturn: 0, borrowAvailable: true },
];
test("separate long-short accounting charges both traded legs and borrow", () => {
  const result = longShortResearch({ rows, costBps: 25, annualBorrowRate: .12, annualFinancingRate: 0, quantile: .5 });
  assert.equal(result.series[0].grossReturn, .15000000000000002);
  assert.equal(result.series[0].tradedNotional, 2);
  assert.equal(result.series[0].tradingCost, .005);
  assert.equal(result.series[0].borrowCost, .01);
  assert.ok(Math.abs(result.series[0].netReturn - .135) < 1e-12);
  assert.equal(result.investable, false);
});
test("future outcomes do not alter earlier target holdings and unavailable borrow excludes shorts", () => {
  const a = longShortResearch({ rows, costBps: 0, annualBorrowRate: 0, annualFinancingRate: 0, quantile: .5 });
  const b = longShortResearch({ rows: rows.map(r => r.date === "2024-02-01" ? { ...r, nextReturn: .8 } : r),
    costBps: 0, annualBorrowRate: 0, annualFinancingRate: 0, quantile: .5 });
  assert.deepEqual(a.series[0].holdings, b.series[0].holdings);
  assert.throws(() => longShortResearch({ rows: rows.map(r => ({ ...r, borrowAvailable: false })),
    costBps: 0, annualBorrowRate: 0, annualFinancingRate: 0, quantile: .5 }));
});
