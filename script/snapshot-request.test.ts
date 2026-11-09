import test from "node:test";
import assert from "node:assert/strict";
import { snapshotSelection, snapshotInventoryQuery, storedReplayRequest, historicalRequestPolicy } from "../server/snapshots/requestContract";
test("explicit malformed historical IDs never select current inputs", () => {
  assert.equal(snapshotSelection(undefined), undefined);
  assert.equal(snapshotSelection("a".repeat(64)), "a".repeat(64));
  for (const bad of ["", " ", [], ["a".repeat(64)], null, {}, "A".repeat(64)])
    assert.throws(() => snapshotSelection(bad));
});
test("inventory kind and keyset cursor are validated", () => {
  assert.deepEqual(snapshotInventoryQuery({ kind: "workbook-baseline", after: "b".repeat(64) }),
    { kind: "workbook-baseline", after: "b".repeat(64) });
  assert.throws(() => snapshotInventoryQuery({ kind: ["workbook-baseline"] }));
  assert.throws(() => snapshotInventoryQuery({ kind: "other" }));
  assert.throws(() => snapshotInventoryQuery({ after: "" }));
});
test("only exact stored-result routes skip current input resolution", () => {
  assert.equal(storedReplayRequest("/analysis/results/abc"), true);
  for (const path of ["/analysis/results", "/analysis/results/abc/more", "/cv/summary", "/projection"])
    assert.equal(storedReplayRequest(path), false);
});
test("unsupported selectors fail closed instead of advertising ignored historical inputs", () => {
  const id = "a".repeat(64);
  for (const path of ["/health", "/reference-scenarios", "/news/climate", "/cv/uploads",
    "/cv/upload/1/status", "/analysis/snapshot-status", "/analysis/results/" + id, "/unknown"]) {
    assert.throws(() => historicalRequestPolicy(path, { snapshotId: id }));
    assert.throws(() => historicalRequestPolicy(path, { indicatorSnapshotId: id }));
    assert.equal(historicalRequestPolicy(path, {}).readsIndicators, false);
  }
  assert.throws(() => historicalRequestPolicy("/projection/regions", { indicatorSnapshotId: id }));
  assert.equal(historicalRequestPolicy("/projection/regions", {}).readsIndicators, true);
  assert.equal(historicalRequestPolicy("/cv/summary/", { snapshotId: id }).readsWorkbook, true);
  assert.equal(historicalRequestPolicy("/projection", { indicatorSnapshotId: id }).indicators, id);
  assert.throws(() => historicalRequestPolicy("/projection", { snapshotId: id }));
});
