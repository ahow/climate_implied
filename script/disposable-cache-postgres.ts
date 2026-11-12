import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import { contentHash } from "../server/calculation/analysisManifest";

/** Dedicated preprovisioned test transport. Never reads DATABASE_URL or PG*. */
export async function openDisposableCachePostgres() {
  const url = process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_URL;
  if (!url || !["test", "development"].includes(process.env.NODE_ENV ?? "") ||
    process.env.COMPANY_CACHE_DISPOSABLE_AUTHORIZATION !== "preprovisioned-disposable-no-ddl" ||
    !/^[a-f0-9]{64}$/.test(process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_HASH ?? ""))
    throw new Error("Disposable transport needs explicit authorization and exact database identity hash");
  const operations: { operation: string }[] = [];
  const pool = new Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 10_000,
    query_timeout: 10_000, statement_timeout: 10_000 });
  const connect: any = pool.connect.bind(pool);
  const ready = (client: any) => {
    if (!client.__cacheWitnessInstrumented) {
      const query = client.query.bind(client);
      client.query = (...args: any[]) => {
        const text = typeof args[0] === "string" ? args[0] : args[0]?.text;
        // No SQL batching: an allowed leading SELECT must not hide a mutation.
        if (typeof text !== "string" || text.replace(/'(?:''|[^'])*'/g, "''").includes(";") ||
          !/^\s*(SELECT|INSERT|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(text))
          throw new Error("Disposable cache witness refuses DDL, destructive writes and unsupported SQL");
        operations.push({ operation: text.trim().split(/\s/)[0].toUpperCase() });
        return query(...args);
      };
      client.__cacheWitnessInstrumented = true;
    }
    return client;
  };
  pool.connect = ((callback?: any) => callback ? connect((error: any, client: any, release: any) =>
    callback(error, client ? ready(client) : client, release)) : connect().then(ready)) as any;
  try {
    const identity = await pool.query("SELECT current_database() AS name");
    if (contentHash({ database: identity.rows[0].name }) !== process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_HASH)
      throw new Error("Disposable database identity mismatch; no writes authorized");
    return { db: drizzle(pool, { schema }), operations, kind: "postgres" as const,
      access: "Explicit independently authorized already-provisioned disposable PostgreSQL",
      close: () => pool.end() };
  } catch (error) { await pool.end(); throw error; }
}
