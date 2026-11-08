import test from "node:test";
import assert from "node:assert/strict";
import { packIndicators, unpackIndicators } from "../server/snapshots/indicatorContract";
import { validateCvQuery } from "../server/climateValuation/queryValidation";

const row = { indicatorKey: "renewableCapacity", year: 2024, value: 0, source: "fixture", method: "manual" };
test("indicator archive round trip preserves zero and canonical identity", () => {
  const a = packIndicators([row, { ...row, year: 2025, value: 2 }]);
  const b = packIndicators([{ ...row, year: 2025, value: 2 }, row]);
  assert.equal(a.id, b.id);
  assert.equal(unpackIndicators(a.id, a.payload)[0].value, 0);
  assert.notEqual(a.id, packIndicators([{ ...row, value: 1 }]).id);
});
test("indicator archive rejects tampering, duplicate cells and nonfinite values", () => {
  const a = packIndicators([row]);
  assert.throws(() => unpackIndicators(a.id, { ...a.payload, rows: [{ ...row, value: 9 }] }));
  assert.throws(() => packIndicators([row, row]));
  assert.throws(() => packIndicators([{ ...row, value: NaN }]));
});
test("historical backtests accept snapshot selectors without relaxing unknown parameters", () => {
  assert.doesNotThrow(() => validateCvQuery("/backtest", {
    snapshotId: "a".repeat(64), indicatorSnapshotId: "b".repeat(64),
  }));
  assert.throws(() => validateCvQuery("/backtest", { unrecognised: "value" }));
});
