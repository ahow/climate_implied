import { test } from "node:test";
import assert from "node:assert/strict";
test("duplicate holdings cannot silently corrupt portfolio drift", () => {
  assert.throws(() => walkForward(new Map([["2020-01", [
    { companyId: 1, marketCap: 100, monthlyReturn: 0 },
    { companyId: 1, marketCap: 100, monthlyReturn: 0 },
  ]]]), new Map(), .02), /Duplicate/);
});
test("higher costs reduce wealth and complete loss terminates the series", () => {
  const input = new Map([["2020-01", [{ companyId: 1, marketCap: 100, monthlyReturn: .1 }]],
    ["2020-02", [{ companyId: 2, marketCap: 100, monthlyReturn: .1 }]]]);
  const values = [0, 10, 25, 50].map(cost => walkForward(input, new Map(), .02, cost).accounting.netCumulative);
  assert.ok(values.every((v, i) => i === 0 || v < values[i - 1]));
  input.get("2020-01")![0].monthlyReturn = -1;
  const failed = walkForward(input, new Map(), .02, 10);
  assert.equal(failed.series.length, 1); assert.equal(failed.accounting.netCumulative, 0);
});
import { verifiedSyntheticWalkForward as walkForward } from "./fixtures/verifiedSyntheticMoney";
import { validateCvQuery } from "../server/climateValuation/queryValidation";
test("zero-cost API requests are valid; negative costs are rejected", () => {
  assert.doesNotThrow(() => validateCvQuery("/backtest", { costBps: "0" }));
  assert.throws(() => validateCvQuery("/backtest", { costBps: "-1" }));
});
test("zero costs recover gross wealth exactly and flat costs reconcile to trades", () => {
  const monthly = new Map([["2020-01", [{ companyId: 1, marketCap: 100, monthlyReturn: .1 }]],
    ["2020-02", [{ companyId: 2, marketCap: 100, monthlyReturn: 0 }]]]);
  const zero = walkForward(monthly, new Map(), .02, 0);
  assert.equal(zero.accounting.netCumulative, zero.accounting.grossCumulative);
  const paid = walkForward(monthly, new Map(), .02, 10);
  assert.equal(paid.series[0].tradedNotional, 1);
  assert.equal(paid.series[1].tradedNotional, 2);
  assert.equal(paid.series[0].turnover, 1);
  assert.ok(Math.abs(paid.accounting.netCumulative - .999 * 1.1 * .998) < 1e-12);
});
test("buy-and-hold drift does not generate fictional rebalancing trades", () => {
  const r = walkForward(new Map([
    ["2020-01", [{ companyId: 1, marketCap: 100, monthlyReturn: .1 }, { companyId: 2, marketCap: 100, monthlyReturn: 0 }]],
    ["2020-02", [{ companyId: 1, marketCap: 110, monthlyReturn: 0 }, { companyId: 2, marketCap: 100, monthlyReturn: 0 }]],
  ]), new Map(), .02, 10);
  assert.ok(r.series[1].tradedNotional! < 1e-12);
});
