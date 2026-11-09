/**
 * Development only. Capture read-only; restore from files to pg_temp only.
 * No public source rows, schema, sequences or archives are modified.
 */
import { Pool, type PoolClient } from "pg";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { recoveryTables, safeRecoveryPath, assertRecoveryManifest } from "../server/snapshots/recoveryContract";

const [mode, argument] = process.argv.slice(2);
if (process.env.NODE_ENV !== "development") throw new Error("Requires explicit NODE_ENV=development");
if (!["capture", "restore"].includes(mode)) throw new Error("Choose capture or restore");
const directory = safeRecoveryPath(argument || "");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

async function scan(client: PoolClient, table: string, schema: "public" | "pg_temp", consume?: (line: string) => Promise<void>) {
  if (!recoveryTables.includes(table as any)) throw new Error("Table not allowed");
  const hash = createHash("sha256");
  let count = 0;
  await client.query(`DECLARE recovery_rows NO SCROLL CURSOR FOR SELECT row_to_json(t)::text AS row FROM ${schema}.${table} t ORDER BY id`);
  try {
    for (;;) {
      const batch = await client.query("FETCH FORWARD 2000 FROM recovery_rows");
      if (!batch.rowCount) break;
      for (const row of batch.rows) {
        const line = row.row + "\n";
        hash.update(line);
        count++;
        if (consume) await consume(line);
      }
    }
  } finally { await client.query("CLOSE recovery_rows"); }
  return { rows: count, hash: hash.digest("hex") };
}

try {
  if (mode === "capture") {
    await mkdir("generated-artifacts/recovery", { recursive: true });
    await mkdir(directory, { recursive: false });
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const tables = [];
    for (const table of recoveryTables) {
      const file = `${table}.jsonl`;
      const output = createWriteStream(`${directory}/${file}`, { flags: "wx", mode: 0o600 });
      const result = await scan(client, table, "public", async line => {
        if (!output.write(line)) await once(output, "drain");
      });
      output.end();
      await once(output, "finish");
      tables.push({ table, file, ...result });
    }
    await client.query("COMMIT");
    const manifest = { version: 1, tables, capturedAt: new Date().toISOString(),
      scope: "Development analytical rows; schema supplied separately; not production recovery" };
    await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(manifest));
  } else {
    const manifest = assertRecoveryManifest(JSON.parse(await readFile(`${directory}/manifest.json`, "utf8")));
    // Validate every file before any import.
    for (const entry of manifest.tables) {
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(`${directory}/${entry.file}`)) hash.update(chunk);
      if (hash.digest("hex") !== entry.hash) throw new Error(`Recovery content mismatch: ${entry.table}`);
    }
    await client.query("BEGIN");
    const results = [];
    for (const entry of manifest.tables) {
      const table = entry.table;
      await client.query(`CREATE TEMP TABLE ${table} (LIKE public.${table}) ON COMMIT DROP`);
      const rows = createInterface({ input: createReadStream(`${directory}/${entry.file}`), crlfDelay: Infinity });
      let batch: string[] = [];
      async function flush() {
        if (!batch.length) return;
        await client.query(`INSERT INTO pg_temp.${table} SELECT * FROM json_populate_recordset(NULL::pg_temp.${table}, $1::json)`,
          ["[" + batch.join(",") + "]"]);
        batch = [];
      }
      for await (const line of rows) {
        batch.push(line);
        if (batch.length === 1000) await flush();
      }
      await flush();
      const actual = await scan(client, table, "pg_temp");
      if (actual.rows !== entry.rows || actual.hash !== entry.hash)
        throw new Error(`Restored rows differ: ${table}`);
      results.push({ table, ...actual, exact: true });
    }
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ status: "passed", results, publicWrites: 0,
      scope: "Actual development analytical-data restoration; not production backup/recovery" }));
  }
} finally {
  await client.query("ROLLBACK");
  client.release();
  await pool.end();
}
