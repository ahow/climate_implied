import test from "node:test";
import assert from "node:assert/strict";
import { snapshotSelection, snapshotInventoryQuery, storedReplayRequest } from "../server/snapshots/requestContract";
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
