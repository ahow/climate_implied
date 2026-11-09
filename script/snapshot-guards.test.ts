import test from "node:test";
import assert from "node:assert/strict";
import { validSnapshotGuards, expectedSnapshotGuards } from "../server/snapshots/guards";

const installed = () => expectedSnapshotGuards.map(g => ({
  ...g, schema: "public", functionSchema: "public", enabled: "O", internal: false,
}));

test("snapshot guards must protect the intended table with the correct events and function", () => {
  assert.equal(validSnapshotGuards(installed()), true);
  for (const field of ["table", "schema", "functionName", "functionSchema", "enabled", "type"] as const) {
    const rows = installed();
    (rows[0] as any)[field] = field === "type" ? 5 : "wrong";
    assert.equal(validSnapshotGuards(rows), false, field);
  }
  const rows = installed(); rows[0].internal = true;
  assert.equal(validSnapshotGuards(rows), false);
});

test("missing and duplicate guards fail closed; unrelated schema names cannot satisfy a guard", () => {
  assert.equal(validSnapshotGuards(installed().slice(1)), false);
  assert.equal(validSnapshotGuards([...installed(), installed()[0]]), false);
  assert.equal(validSnapshotGuards(installed().map(g => ({ ...g, schema: "shadow" }))), false);
  assert.equal(validSnapshotGuards(installed().map(g => ({ ...g, enabled: "A" }))), true);
});
