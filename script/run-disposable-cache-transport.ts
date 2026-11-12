import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { contentHash } from "../server/calculation/analysisManifest";

// Local-only engineering setup; never provisions a managed/remote resource.
// Must be explicitly selected; neither ambient DATABASE_URL nor PG* is read.
const args = process.argv.slice(2).join(" ");
if (!["--local-s02-009", "--local-s02-009 --full-checks"].includes(args))
  throw new Error("Explicit isolated setup required: --local-s02-009 [--full-checks]");
const fullChecks = args.endsWith("--full-checks");
const startedAt = new Date().toISOString();
const previousEvidencePath = "docs/disposable-cache-transport-evidence.json";
const previousEvidence = existsSync(previousEvidencePath) ?
  JSON.parse(readFileSync(previousEvidencePath, "utf8")) : null;
const name = "s02_009_disposable_cache";
const root = mkdtempSync(join(tmpdir(), "s02-cache-"));
const data = join(root, "data"), socket = join(root, "socket");
mkdirSync(socket, { mode: 0o700 });
const output = mkdtempSync(resolve("generated-artifacts/disposable-cache-"));
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  key !== "DATABASE_URL" && !key.startsWith("PG") && !key.startsWith("COMPANY_CACHE_DISPOSABLE_")));
env.NODE_ENV = "test";
const commands: any[] = [], blockers: string[] = [];
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function run(command: string, args: string[], timeout = 120_000, childEnv = env) {
  const start = new Date().toISOString(), began = performance.now();
  const result = spawnSync(command, args, { env: childEnv, encoding: "utf8", timeout, maxBuffer: 20 * 1024 * 1024 });
  const log = join(output, `${commands.length}-${command.split("/").pop()}.log`);
  const text = `${result.stdout ?? ""}${result.stderr ?? ""}${result.error ? `\n${result.error.message}` : ""}`;
  writeFileSync(log, text, { mode: 0o600 });
  commands.push({ command: [command, ...args], startedAt: start, durationMs: performance.now() - began,
    status: result.status, signal: result.signal, log, logSha256: sha(text) });
  if (result.status !== 0) throw new Error(`${command} failed: ${result.error?.message ?? result.status}; see ${log}`);
  return text;
}
let running = false, pool: Pool | undefined, setupStatements = 0;
let counts: unknown = null, failure: string | null = null;
const witnesses: any[] = [];
function captureWitnesses(log: string) {
  for (const match of log.matchAll(/(?:HTTP\/MATERIAL CACHE EVIDENCE|PROJECTION CACHE EVIDENCE) (.+\/evidence\.json)/g)) {
    const path = match[1].trim(), text = readFileSync(path, "utf8"), evidence = JSON.parse(text);
    witnesses.push({ path, sha256: sha(text), passed: evidence.passed ?? evidence.probes?.every((p: any) => p.safe && p.warmMutationSafe),
      postgresqlTransportExecuted: evidence.postgresqlTransportExecuted ?? evidence.transport === "Actual isolated PostgreSQL JSONB",
      analyticalReceipts: evidence.results?.length ?? evidence.records?.length ?? evidence.receipts?.length ?? evidence.probes?.length,
      actualPostgresQueries: evidence.realDatabaseQueries ?? evidence.databaseOperations?.length ?? 0,
      companyPhases: evidence.witnesses ? Object.fromEntries(["lookup-miss", "compute", "write", "lookup-hit"].map(phase =>
        [phase, evidence.witnesses.filter((row: any) => row.event.phase === phase).length])) : undefined,
      ttl: evidence.ttl, namespaceKeys: evidence.writes?.map((row: any) => row.name) });
  }
}
try {
  // Resolve only installed binaries, with no package installation or network.
  const binaries = ["initdb", "pg_ctl", "postgres", "psql"].map(binary => {
    const found = run("bash", ["-c", 'command -v "$1"', "_", binary]).trim();
    return { name: binary, path: realpathSync(found), version: run(found, ["--version"]).trim() };
  });
  writeFileSync(join(output, "binaries.json"), JSON.stringify(binaries, null, 2), { mode: 0o600 });
  run("initdb", ["-D", data, "-U", "s02_cache_owner", "--auth-local=trust", "--auth-host=reject", "--no-locale", "--encoding=UTF8"]);
  // Unix socket only in a new private directory. No existing service/port.
  run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o",
    `-c listen_addresses='' -c unix_socket_directories='${socket}' -c unix_socket_permissions=0700`, "-w", "start"]);
  running = true;
  pool = new Pool({ host: socket, database: "postgres", user: "s02_cache_owner", max: 1,
    connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000 });
  await pool.query(`CREATE DATABASE ${name}`); setupStatements++;
  await pool.end();
  pool = new Pool({ host: socket, database: name, user: "s02_cache_owner", max: 1,
    connectionTimeoutMillis: 10_000, query_timeout: 10_000, statement_timeout: 10_000 });
  const identity = await pool.query("SELECT current_database() AS database, current_user AS role, inet_server_addr() AS address");
  if (identity.rows[0].database !== name || identity.rows[0].address !== null)
    throw new Error("Refusing setup: local socket/named database identity mismatch");
  // Exact small schema subset from shared/schema.ts, not an application migration.
  const setup = [
    `CREATE TABLE projection_cache (id varchar PRIMARY KEY DEFAULT gen_random_uuid(), cache_key text NOT NULL UNIQUE,
      projection_year integer NOT NULL, category text, region text, result_data jsonb NOT NULL,
      created_at timestamp NOT NULL DEFAULT now())`,
    `CREATE TABLE cv_analysis_snapshots (id varchar(64) PRIMARY KEY, kind text NOT NULL, source_upload_id integer,
      parent_id varchar(64), company_count integer NOT NULL, observation_count integer NOT NULL, chunk_count integer NOT NULL,
      source_note text NOT NULL, inserted_tx text NOT NULL DEFAULT txid_current()::text,
      created_at timestamptz NOT NULL DEFAULT now())`,
    `CREATE TABLE cv_analysis_chunks (snapshot_id varchar(64) NOT NULL REFERENCES cv_analysis_snapshots(id),
      ordinal integer NOT NULL, payload jsonb NOT NULL)`,
    `CREATE UNIQUE INDEX cv_analysis_chunk_identity ON cv_analysis_chunks(snapshot_id,ordinal)`,
  ];
  const guards = readFileSync("docs/Snapshot_Database_Guards.md", "utf8").match(/```sql\n([\s\S]*?)\n```/)?.[1];
  if (!guards) throw new Error("Supported development guard specification unavailable");
  writeFileSync(join(output, "local-only-setup.sql"), [...setup, guards].join(";\n"), { mode: 0o600 });
  for (const statement of setup) { await pool.query(statement); setupStatements++; }
  await pool.query(guards); setupStatements += 7;
  const url = `postgresql://s02_cache_owner@localhost/${name}?host=${encodeURIComponent(socket)}`;
  const childEnv = { ...env, COMPANY_CACHE_DISPOSABLE_DATABASE_URL: url,
    COMPANY_CACHE_DISPOSABLE_AUTHORIZATION: "preprovisioned-disposable-no-ddl",
    COMPANY_CACHE_DISPOSABLE_DATABASE_HASH: contentHash({ database: name }) };
  // Focused mode executes the two transport files directly. Coherent mode
  // executes BOTH via the complete script/*.test.ts command below,
  // rather than repeating their expensive real-calculator matrices twice.
  if (!fullChecks) {
    for (const testFile of ["script/company-cache-transport.test.ts", "script/projection-route-cache.test.ts"]) {
      const log = run(resolve("node_modules/.bin/tsx"), ["--test", testFile], 300_000, childEnv);
      captureWitnesses(log);
    }
  }
  if (fullChecks) {
    const finalReceipt = "generated-artifacts/cache-drilldown-report-full-final.json";
    // Run the coherent runner INSIDE the already-provisioned,
    // Unix-socket-only isolated test database lifetime. No ambient DATABASE_URL
    // or production connection is consulted; the guarded test cannot skip.
    run("uv", ["run", "python", "script/workplan-evidence-run.py", "--receipt-only",
      "--full-checks", "--receipt", finalReceipt], 1_200_000, childEnv);
    const receipt = JSON.parse(readFileSync(finalReceipt, "utf8"));
    if (receipt.exit_code !== 0 || receipt.suite_counts?.typescript?.skipped !== 0 ||
      receipt.suite_counts?.python?.skipped !== 0)
      throw new Error("Full coherent receipt did not pass with zero skipped tests");
    captureWitnesses(readFileSync(receipt.log, "utf8"));
  }
  counts = (await pool.query(`SELECT
    (SELECT count(*)::int FROM projection_cache) AS cache_rows,
    (SELECT count(*)::int FROM cv_analysis_snapshots) AS archive_headers,
    (SELECT count(*)::int FROM cv_analysis_chunks) AS archive_chunks,
    (SELECT count(*)::int FROM pg_trigger WHERE NOT tgisinternal AND tgenabled IN ('O','A') AND tgrelid IN
      ('cv_analysis_snapshots'::regclass,'cv_analysis_chunks'::regclass)) AS enabled_guard_count`)).rows[0];
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  blockers.push(failure);
} finally {
  if (pool) await pool.end();
  if (running) {
    try { run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]); }
    catch (error) { blockers.push(`Local cluster stop failed: ${String(error)}`); failure ??= String(error); }
  }
  const sourceFiles = ["script/run-disposable-cache-transport.ts", "script/disposable-cache-postgres.ts",
    "script/company-cache-transport.test.ts", "script/projection-route-cache.test.ts", "server/routes.ts",
    "server/storage.ts", "server/operatorContract.ts", "shared/schema.ts", "docs/Snapshot_Database_Guards.md"];
  writeFileSync("docs/disposable-cache-transport-evidence.json", JSON.stringify({
    criterion: "S02-009", startedAt, finishedAt: new Date().toISOString(),
    priorAttempts: previousEvidence ? [...(previousEvidence.priorAttempts ?? []), {
      startedAt: previousEvidence.startedAt, finishedAt: previousEvidence.finishedAt,
      passed: previousEvidence.passed, commands: previousEvidence.commands, blockers: previousEvidence.blockers,
       isolation: previousEvidence.isolation, witnesses: previousEvidence.witnesses,
    }] : [],
    command: `env -u DATABASE_URL NODE_ENV=test node_modules/.bin/tsx script/run-disposable-cache-transport.ts --local-s02-009${fullChecks ? " --full-checks" : ""}`,
    passed: failure === null, commands, counts, setupStatements, blockers, witnesses,
    isolation: { database: name, localClusterDirectory: root, privateUnixSocket: socket, tcpListening: false,
      ambientDatabaseUrlUsed: false, ambientPgVariablesUsed: false, productionAccess: false,
      paidResources: 0, productionDDL: 0, productionDeletes: 0, cacheClears: 0,
      clusterStopped: running && !blockers.some(value => value.includes("stop failed")),
      cleanup: "Only newly initialized local PostgreSQL stopped. Data retained in private temporary directory; no DELETE, DROP, TRUNCATE or existing database touched." },
    scope: [
      "Existing actual company HTTP/calculator/material/result archive suite on real PostgreSQL, not memory ORM.",
      "Six completed route-local matrices preserved, plus actual full/reduced helper namespace and persistent JSONB round-trip with fresh route state.",
      "TTL remains actual regional route cache clock-boundary test, not an invented PostgreSQL row TTL.",
      "Synthetic declared engineering money/indicator datasets; real calculator values, not real issuer evidence.",
      "Application default storage is MemStorage. Projection PostgreSQL test substitutes only the storage I/O dependency; this is not deployed PostgreSQL application acceptance."
    ],
    refusals: [{
      capability: "Authorized refresh/DELETE invalidation HTTP lifecycle", executed: false,
      reason: "server/operatorContract.ts explicitly declares no existing HTTP authentication, principal or role; no supported disposable mutable HTTP loader. DEV/loopback/database ownership is not operator authority.",
      action: "Owner/authentication maintainer must provide the genuine supported disposable DEV principal and importer. No invented token/role or bypass added; no clear/DELETE endpoint invoked."
    }],
    sourceSha256: Object.fromEntries(sourceFiles.map(path => [path, sha(readFileSync(path))])),
    ledgerEdited: false, release: false, commit: false, callback: false,
  }, null, 2) + "\n", { mode: 0o600 });
}
if (failure) { console.error(failure); process.exitCode = 1; }
