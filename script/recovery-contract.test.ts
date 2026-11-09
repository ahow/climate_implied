import test from "node:test";
import assert from "node:assert/strict";
import { recoveryTables, safeRecoveryPath, assertRecoveryManifest } from "../server/snapshots/recoveryContract";

test("recovery cannot target arbitrary paths, user tables or production", () => {
  assert.deepEqual(recoveryTables, ["cv_companies", "cv_time_series", "indicator_values"]);
  assert.throws(() => safeRecoveryPath("../prod"));
  assert.throws(() => safeRecoveryPath("generated-artifacts/../secrets"));
  assert.equal(safeRecoveryPath("generated-artifacts/recovery/run"), "generated-artifacts/recovery/run");
  assert.throws(() => assertRecoveryManifest({ tables: [] }));
});

test("recovery requires all exact tables, content identities and finite row counts", () => {
  const m = { version: 1, tables: recoveryTables.map(table => ({
    table, file: `${table}.jsonl`, hash: "a".repeat(64), rows: 0,
  })) };
  assert.doesNotThrow(() => assertRecoveryManifest(m));
  assert.throws(() => assertRecoveryManifest({ ...m, tables: [...m.tables, m.tables[0]] }));
  assert.throws(() => assertRecoveryManifest({ ...m, tables: m.tables.map(t => ({ ...t, rows: -1 })) }));
  assert.throws(() => assertRecoveryManifest({ ...m, tables: m.tables.map(t => ({ ...t, file: "../bad" })) }));
});
