import test from "node:test";
import assert from "node:assert/strict";
import { packRegional, unpackRegional } from "../server/snapshots/regionalContract";
import { historicalRequestPolicy } from "../server/snapshots/requestContract";
import { selectedRequest } from "../client/src/lib/analysis-selection";
test("regional archive rejects tampering and incomplete observed inputs", () => {
  const input = Object.fromEntries(["eu", "us", "china", "india"].map(k => [k, { value: .2, source: "owid" }]));
  const packed = packRegional(input);
  assert.deepEqual(unpackRegional(packed.id, packed.payload), input);
  assert.throws(() => packRegional({}));
  assert.throws(() => unpackRegional("a".repeat(64), packed.payload));
});
test("regional history requires both explicit archives and routes the selected identities", () => {
  const selection = { workbook: "a".repeat(64), indicators: "b".repeat(64), regional: "c".repeat(64) };
  assert.throws(() => historicalRequestPolicy("/projection/regions", { regionalSnapshotId: selection.regional }));
  assert.throws(() => historicalRequestPolicy("/projection", { regionalSnapshotId: selection.regional }));
  assert.equal(historicalRequestPolicy("/projection/regions", {
    regionalSnapshotId: selection.regional, indicatorSnapshotId: selection.indicators }).indicators, selection.indicators);
  assert.match(selectedRequest("/api/projection/regions", selection).url, /regionalSnapshotId=c{64}/);
});
