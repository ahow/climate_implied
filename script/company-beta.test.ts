import test from "node:test";
import assert from "node:assert/strict";
import { historicalBeta } from "../server/financialData/historicalBeta";
const rows = (multiple: number) => {
  let v = 100;
  return Array.from({ length: 70 }, (_, i) => {
    if (i) v *= 1 + multiple * (.01 + .02 * Math.sin(i));
    const date = new Date(Date.UTC(2011, i, 20)).toISOString();
    return { date, totalReturnIndex: v };
  });
};
test("past-only beta recovers known slope and ignores future observations", () => {
  const own = rows(2), peers = Array.from({ length: 10 }, () => rows(1));
  const result = historicalBeta(own, peers, "2016-07-31");
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.ok(Math.abs(result.beta - 2) < 1e-10);
  assert.ok(Math.abs(result.costOfEquity - .105) < 1e-10);
  assert.deepEqual(result, historicalBeta(own.map(r => r.date >= "2016-07" ?
    { ...r, totalReturnIndex: 1e9 } : r), peers, "2016-07-31"));
});
test("insufficient history and benchmark are unavailable", () => {
  assert.equal(historicalBeta(rows(1).slice(20), [rows(1)], "2016-07-31").status, "unavailable");
  assert.equal(historicalBeta(rows(1), [], "2016-07-31").status, "unavailable");
});
