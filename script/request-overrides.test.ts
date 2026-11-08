import test from "node:test";
import assert from "node:assert/strict";
import { requestOverrides, runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { getOverride } from "../server/dataIngestion/overrideStore";
test("concurrent requests retain different approved inputs across asynchronous work", async () => {
  const row = { indicatorKey: "evSalesSharePct", year: 2024, value: 10, source: "fixture", method: "manual" };
  const results = await Promise.all([10, 20].map(value => runWithOverrideRows([{ ...row, value }], async () => {
    const hash = requestOverrides.getStore()!.hash;
    await new Promise(resolve => setTimeout(resolve, value === 10 ? 8 : 1));
    return { value: getOverride(row.indicatorKey, row.year), hash };
  })));
  assert.deepEqual(results.map(r => r.value), [10, 20]);
  assert.notEqual(results[0].hash, results[1].hash);
  assert.equal(requestOverrides.getStore(), undefined);
});
test("duplicate approved cells fail instead of selecting an arbitrary winner", () => {
  const row = { indicatorKey: "x", year: 2024, value: 10, source: "fixture", method: "manual" };
  assert.throws(() => runWithOverrideRows([row, row], () => null));
});
