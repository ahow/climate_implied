/**
 * Development-only transactional rehearsal. Creates an isolated schema,
 * inserts synthetic records, tests database immutability, then rolls back all
 * DDL and rows. Does NOT migrate production or copy licensed workbook rows.
 */
import { Pool } from "pg";
import assert from "node:assert/strict";
import { contentHash } from "../server/calculation/analysisManifest";
if (process.env.NODE_ENV === "production") throw new Error("Development rehearsal only");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("CREATE SCHEMA snapshot_rehearsal");
  await client.query(`CREATE TABLE snapshot_rehearsal.snapshots (
    id text PRIMARY KEY, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query(`CREATE FUNCTION snapshot_rehearsal.reject_mutation() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Immutable snapshot'; END $$`);
  await client.query(`CREATE TRIGGER immutable_rows BEFORE UPDATE OR DELETE
    ON snapshot_rehearsal.snapshots FOR EACH ROW EXECUTE FUNCTION snapshot_rehearsal.reject_mutation()`);
  await client.query(`CREATE TRIGGER immutable_truncate BEFORE TRUNCATE
    ON snapshot_rehearsal.snapshots FOR EACH STATEMENT EXECUTE FUNCTION snapshot_rehearsal.reject_mutation()`);
  const oldInput = { company: "synthetic", earnings: "100.00", currency: "USD", carbon: null };
  const oldId = contentHash(oldInput);
  await client.query("INSERT INTO snapshot_rehearsal.snapshots(id,payload) VALUES($1,$2)", [oldId, oldInput]);
  const newInput = { ...oldInput, earnings: "200.00" };
  await client.query("INSERT INTO snapshot_rehearsal.snapshots(id,payload) VALUES($1,$2)", [contentHash(newInput), newInput]);
  assert.deepEqual((await client.query("SELECT payload FROM snapshot_rehearsal.snapshots WHERE id=$1", [oldId])).rows[0].payload, oldInput);
  for (const command of [
    "UPDATE snapshot_rehearsal.snapshots SET payload='{}'",
    "DELETE FROM snapshot_rehearsal.snapshots",
    "TRUNCATE snapshot_rehearsal.snapshots",
  ]) {
    await client.query("SAVEPOINT negative_case");
    let blocked = false;
    try { await client.query(command); }
    catch (e) { blocked = e instanceof Error && e.message === "Immutable snapshot"; }
    await client.query("ROLLBACK TO SAVEPOINT negative_case");
    assert.equal(blocked, true, command);
  }
  console.log("PASS: old synthetic snapshot retained; UPDATE, DELETE and TRUNCATE rejected");
} finally {
  await client.query("ROLLBACK");
  const after = await client.query("SELECT to_regnamespace('snapshot_rehearsal') AS schema");
  assert.equal(after.rows[0].schema, null);
  client.release();
  await pool.end();
}
console.log("PASS: rehearsal schema and all fixture rows rolled back");
