import { sql } from "drizzle-orm";

// PostgreSQL pg_trigger.tgtype bitmask: ROW=1, BEFORE=2, INSERT=4,
// DELETE=8, UPDATE=16, TRUNCATE=32. Names alone do not establish protection.
export const expectedSnapshotGuards = [
  { name: "cv_snapshot_header_immutable", table: "cv_analysis_snapshots", type: 27, functionName: "cv_snapshot_reject_mutation" },
  { name: "cv_snapshot_chunk_immutable", table: "cv_analysis_chunks", type: 27, functionName: "cv_snapshot_reject_mutation" },
  { name: "cv_snapshot_header_truncate", table: "cv_analysis_snapshots", type: 34, functionName: "cv_snapshot_reject_mutation" },
  { name: "cv_snapshot_chunk_truncate", table: "cv_analysis_chunks", type: 34, functionName: "cv_snapshot_reject_mutation" },
  { name: "cv_snapshot_chunk_insert", table: "cv_analysis_chunks", type: 7, functionName: "cv_snapshot_guard_insert" },
] as const;

type Guard = {
  name: string; table: string; schema: string; type: number;
  functionName: string; functionSchema: string; enabled: string; internal: boolean;
};

export function validSnapshotGuards(rows: Guard[]): boolean {
  return rows.length === expectedSnapshotGuards.length && expectedSnapshotGuards.every(expected => {
    const matches = rows.filter(r => r.name === expected.name);
    return matches.length === 1 && matches.every(r =>
      r.schema === "public" && r.table === expected.table && r.type === expected.type
      && r.functionSchema === "public" && r.functionName === expected.functionName
      && ["O", "A"].includes(r.enabled) && !r.internal);
  });
}

export const snapshotGuardQuery = sql`
  SELECT t.tgname AS name, c.relname AS table, n.nspname AS schema,
    t.tgtype::int AS type, p.proname AS "functionName",
    pn.nspname AS "functionSchema", t.tgenabled AS enabled, t.tgisinternal AS internal
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_namespace pn ON pn.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND t.tgname IN ('cv_snapshot_header_immutable', 'cv_snapshot_chunk_immutable',
      'cv_snapshot_header_truncate', 'cv_snapshot_chunk_truncate', 'cv_snapshot_chunk_insert')`;

export function guardRowsValid(rows: Record<string, unknown>[]) {
  return validSnapshotGuards(rows as Guard[]);
}
