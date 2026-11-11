import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer } from "node:http";
import express from "express";
import ts from "typescript";
import { PgDialect } from "drizzle-orm/pg-core";
import { getTableName } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import { MemStorage } from "../server/storage";
import { expectedSnapshotGuards } from "../server/snapshots/guards";
import { packDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext } from "../server/snapshots/store";
import { overlayContext } from "../server/snapshots/overlays";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { snapshotSelection, overlaySelection, historicalRequestPolicy } from "../server/snapshots/requestContract";
import { applyOverlays } from "../server/snapshots/overlayContract";
import { createManifest, contentHash } from "../server/calculation/analysisManifest";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { calculateTotalBasedCarbonPrice } from "../server/climateValuation/carbonPriceCalculator";
import { runWithIsolatedCompanyCarbonCache, type CompanyCarbonCacheWitness } from "../server/climateValuation/companyCarbonCache";
import { requestOverrides } from "../server/dataIngestion/requestOverrides";
import { CALCULATION_VERSION } from "../shared/calculationContract";
import * as companyUtils from "../server/climateValuation/sharedUtils";
import { bindNestedOutput } from "../shared/outputFieldSemantics";

const require = createRequire(import.meta.url);
type ArchiveOperation = { operation: string; table?: string; existing?: boolean; id?: string; kind?: string };
function fixture(multiplier: number, noProfit = false) {
  const companies = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1, isin: `engineering-http-${i}`, name: `ENGINEERING ONLY ${i}`, sector: "fixture",
    subSector: null, industry: null, geography: "US", sdgAlignmentScore: null, emissionTarget2050: null,
  }));
  const rows = companies.flatMap(company => Array.from({ length: 36 }, (_, month) => ({
    id: company.id * 1000 + month, companyId: company.id, date: new Date(Date.UTC(2019, month, 1)),
    marketCap: multiplier * (100 + company.id * 10), netProfit: noProfit ? 0 : 10 + company.id, priceEarnings: 10,
    scope1Emissions: company.id * 25, scope2Emissions: company.id * 2, scope3Emissions: null,
    totalReturnIndex: 100 * Math.pow(1 + 0.001 * (company.id - 3), month) })));
  return { companies, rows, packed: packDataset(companies as any, rows as any) };
}

/** Explicit in-memory transport for the ACTUAL archive modules. SQL/ORM calls
 * are recorded, not represented as PostgreSQL execution or trigger authority.
 * Only the database I/O dependency is replaced; hashes/manifests/load validation
 * are the actual production functions. No DDL or real database access. */
function archiveTransport() {
  const headers = new Map<string, any>(), chunks = new Map<string, any[]>();
  const operations: ArchiveOperation[] = [];
  const dialect = new PgDialect();
  let clock = 0;
  function insert(table: string, value: any) {
    operations.push({ operation: "insert-if-absent", table, id: value.id ?? value.snapshotId, kind: value.kind,
      existing: table === "cv_analysis_snapshots" ? headers.has(value.id) :
        (chunks.get(value.snapshotId) ?? []).some(row => row.ordinal === value.ordinal) });
    if (table === "cv_analysis_snapshots") {
      if (headers.has(value.id)) return [];
      const row = { ...value, createdAt: new Date(1_600_000_000_000 + clock++), parentId: value.parentId ?? null };
      headers.set(row.id, row); return [row];
    }
    assert.equal(table, "cv_analysis_chunks");
    const rows = chunks.get(value.snapshotId) ?? [];
    if (rows.some(row => row.ordinal === value.ordinal)) return [];
    rows.push(structuredClone(value)); chunks.set(value.snapshotId, rows); return [value];
  }
  const db: any = {
    transaction: async (work: any) => work(db),
    execute: async (query: any) => {
      const q = dialect.sqlToQuery(query);
      operations.push({ operation: q.sql.includes("pg_trigger") ? "guard-metadata-read-fixture" : q.sql.trim().split(/\s/)[0] });
      if (q.sql.includes("pg_trigger")) return { rows: expectedSnapshotGuards.map(guard => ({
        ...guard, schema: "public", functionSchema: "public", enabled: "O", internal: false,
      })) };
      if (/INSERT INTO cv_analysis_snapshots/.test(q.sql)) {
        return { rows: insert("cv_analysis_snapshots", { id: q.params[0], kind: q.params[1],
          companyCount: 0, observationCount: 1, chunkCount: 1 }) };
      }
      if (/INSERT INTO cv_analysis_chunks/.test(q.sql)) {
        insert("cv_analysis_chunks", { snapshotId: q.params[0], ordinal: 0, payload: JSON.parse(String(q.params[1])) });
        return { rows: [] };
      }
      if (/SELECT s.chunk_count,c.ordinal,c.payload/.test(q.sql)) {
        const header = headers.get(String(q.params[0])), rows = chunks.get(String(q.params[0])) ?? [];
        return { rows: header?.kind === q.params[1] ?
          rows.map(row => ({ chunk_count: header.chunkCount, ordinal: row.ordinal, payload: row.payload })) : [] };
      }
      throw new Error("Unsupported isolated transport SQL; never query a fallback DB");
    },
    insert: (table: any) => {
      let values: any, result: any[] | undefined;
      const commit = () => result ??= insert(getTableName(table), values);
      const builder: any = {
        values: (value: any) => { values = value; return builder; },
        onConflictDoNothing: () => builder, returning: async () => commit(),
        then: (yes: any, no: any) => Promise.resolve(commit()).then(yes, no),
      };
      return builder;
    },
    select: () => {
      let table: string, params: unknown[] = [], limit: number | undefined;
      const rows = () => {
        operations.push({ operation: "select", table });
        let result: any[] = table === "cv_analysis_snapshots" ? Array.from(headers.values()) : Array.from(chunks.values()).flat();
        for (const value of params) {
          if (typeof value !== "string") throw new Error("Unexpected isolated selector");
          if (/^[a-f0-9]{64}$/.test(value)) result = result.filter(row => (row.id ?? row.snapshotId) === value);
          else result = result.filter(row => row.kind === value);
        }
        result = [...result].sort((a, b) => table === "cv_analysis_chunks" ? a.ordinal - b.ordinal :
          b.createdAt.getTime() - a.createdAt.getTime());
        return limit === undefined ? result : result.slice(0, limit);
      };
      const builder: any = {
        from: (value: any) => { table = getTableName(value); return builder; },
        where: (query: any) => { params = dialect.sqlToQuery(query).params; return builder; },
        orderBy: () => builder, limit: (value: number) => { limit = value; return builder; },
        then: (yes: any, no: any) => Promise.resolve(rows()).then(yes, no),
      };
      return builder;
    },
  };
  return { db, operations, kind: "memory" as "memory" | "postgres",
    access: "Missing explicitly authorized disposable URL; default DATABASE_URL/PG* are not assumed disposable",
    close: async () => undefined };
}

/** Optional already-provisioned disposable PostgreSQL transport. No default DB
 * connection, no DDL, no deletes/updates/truncates and no fallback if configured
 * authorization or immutable archive guards are wrong. */
async function supportedTransport() {
  const url = process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_URL;
  if (!url) return archiveTransport();
  if (!["test", "development"].includes(process.env.NODE_ENV ?? "") ||
    process.env.COMPANY_CACHE_DISPOSABLE_AUTHORIZATION !== "preprovisioned-disposable-no-ddl" ||
    !/^[a-f0-9]{64}$/.test(process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_HASH ?? ""))
    throw new Error("Disposable transport needs explicit authorization and exact database identity hash");
  const operations: ArchiveOperation[] = [];
  const pool = new Pool({ connectionString: url, max: 4 });
  function instrument(target: any) {
    const query = target.query.bind(target);
    target.query = (...args: any[]) => {
      const text = typeof args[0] === "string" ? args[0] : args[0]?.text;
      if (typeof text !== "string" || !/^\s*(SELECT|INSERT|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET)\b/i.test(text))
        throw new Error("Disposable cache witness refuses DDL, destructive writes and unsupported SQL");
      operations.push({ operation: text.trim().split(/\s/)[0].toUpperCase() });
      return query(...args);
    };
  }
  const connect: any = pool.connect.bind(pool);
  const ready = (client: any) => {
    if (!(client as any).__cacheWitnessInstrumented) {
      instrument(client); (client as any).__cacheWitnessInstrumented = true;
    }
    return client;
  };
  pool.connect = ((callback?: any) => callback ? connect((error: any, client: any, release: any) =>
    callback(error, client ? ready(client) : client, release)) : connect().then(ready)) as any;
  try {
    const identity = await pool.query("SELECT current_database() AS name");
    if (contentHash({ database: identity.rows[0].name }) !== process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_HASH)
      throw new Error("Disposable database identity mismatch; no writes authorized");
    return { db: drizzle(pool, { schema }), operations, kind: "postgres" as "memory" | "postgres",
      access: "Explicit independently authorized already-provisioned disposable PostgreSQL",
      close: () => pool.end() };
  } catch (error) { await pool.end(); throw error; }
}

function productionArchiveModules(db: any) {
  const cache = new Map<string, any>();
  const virtual = new Set(["server/snapshots/store.ts", "server/snapshots/overlays.ts",
    "server/snapshots/materialInputs.ts", "server/snapshots/results.ts"].map(file => resolve(file)));
  function load(file: string): any {
    if (cache.has(file)) return cache.get(file);
    const module = { exports: {} }; cache.set(file, module.exports);
    let contexts = 0;
    const localRequire = (name: string) => {
      if (name === "../db") return { db };
      if (file.endsWith("/store.ts") && name === "node:async_hooks") return {
        AsyncLocalStorage: class {
          constructor() { return contexts++ === 0 ? snapshotContext : new AsyncLocalStorage(); }
        },
      };
      const dependency = name.startsWith(".") ? resolve(dirname(file), `${name}.ts`) : "";
      if (dependency === resolve("server/dataIngestion/requestOverrides.ts"))
        return { requestOverrides, runWithOverrideRows };
      return virtual.has(dependency) ? load(dependency) :
        name.startsWith(".") ? require(resolve(dirname(file), name)) : require(name);
    };
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    new Function("require", "module", "exports", code)(localRequire, module, module.exports);
    return module.exports;
  }
  return Object.assign({}, ...Array.from(virtual).map(load));
}

test("optional disposable PostgreSQL transport refuses absent authorization before connection", async () => {
  const keys = ["COMPANY_CACHE_DISPOSABLE_DATABASE_URL", "COMPANY_CACHE_DISPOSABLE_AUTHORIZATION",
    "COMPANY_CACHE_DISPOSABLE_DATABASE_HASH"] as const;
  const before = keys.map(key => process.env[key]);
  try {
    process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_URL = "postgresql://unreachable.invalid/engineering-only";
    delete process.env.COMPANY_CACHE_DISPOSABLE_AUTHORIZATION;
    delete process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_HASH;
    await assert.rejects(supportedTransport(), /explicit authorization/);
    process.env.COMPANY_CACHE_DISPOSABLE_AUTHORIZATION = "preprovisioned-disposable-no-ddl";
    process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_HASH = "invalid";
    await assert.rejects(supportedTransport(), /exact database identity hash/);
  } finally {
    keys.forEach((key, i) => {
      if (before[i] === undefined) delete process.env[key]; else process.env[key] = before[i];
    });
  }
});

test("remaining MemStorage cache detaches payloads and updates full cache without evicting an unrelated selection", async () => {
  const store = new MemStorage(), original = { values: [1, 2] };
  const put = await store.setProjectionCache({ cacheKey: "a", projectionYear: 2024, resultData: original });
  original.values[0] = 999; (put.resultData as any).values[0] = 888;
  const read = (await store.getProjectionCache("a"))!;
  assert.deepEqual(read.resultData, { values: [1, 2] });
  (read.resultData as any).values[0] = 777;
  assert.deepEqual((await store.getProjectionCache("a"))!.resultData, { values: [1, 2] });
  for (let i = 1; i < 64; i++) await store.setProjectionCache({ cacheKey: `b${i}`, projectionYear: 2024, resultData: { i } });
  await store.setProjectionCache({ cacheKey: "a", projectionYear: 2024, resultData: { values: [3] } });
  assert.ok(await store.getProjectionCache("b1"), "replacement must not consume extra capacity or evict an unrelated key");
});

test("actual regional provider cache cold/warm and failure-cache returns cannot be poisoned by caller mutation", async () => {
  const file = resolve("server/calculation/regionalProjections.ts");
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  for (const fail of [false, true]) {
    const module = { exports: {} as any }, events: string[] = [];
    const localRequire = (name: string) => name.startsWith(".") ? require(resolve(dirname(file), name)) : require(name);
    const provider = async () => {
      events.push("fetch");
      if (fail) throw new Error("isolated engineering provider failure; no real network");
      return { ok: true, json: async () => ({ "United States": { data: [{ year: 2021, co2_per_gdp: 0.25 }] } }) };
    };
    const clone = (input: unknown) => { events.push("return-detached-payload"); return structuredClone(input); };
    new Function("require", "module", "exports", "fetch", "structuredClone", "setTimeout", "clearTimeout", code)(
      localRequire, module, module.exports, provider, clone, () => 0, () => {});
    const cold = await module.exports.getRegionalCarbonIntensities();
    const hash = contentHash(cold);
    cold.us.value = 999;
    const warm = await module.exports.getRegionalCarbonIntensities();
    assert.equal(contentHash(warm), hash);
    warm.us.value = 888;
    assert.equal(contentHash(await module.exports.getRegionalCarbonIntensities()), hash);
    assert.equal(warm.us.source, fail ? "static" : "owid");
    assert.deepEqual(events, ["fetch", "return-detached-payload", "return-detached-payload", "return-detached-payload"]);
    console.log("REGIONAL CACHE EVIDENCE", JSON.stringify({
      engineeringProviderFixture: true, failureBranch: fail, analyticalHash: hash,
      sourceHash: contentHash(readFileSync(file, "utf8")), events, realNetworkRequests: 0,
    }));
  }
});

test("actual HTTP carbon route + material/result archive functions preserve cold/warm geography and empty identities", async () => {
  const prior = process.env.NODE_ENV; process.env.NODE_ENV = "test";
  const transport = await supportedTransport(), modules = productionArchiveModules(transport.db);
  const fixtures = [fixture(1), fixture(2), fixture(3, true)], datasets = new Map(fixtures.map(value => [value.packed.id, value]));
  const entries = new Map<string, string>(), witnesses: { request: string; event: CompanyCarbonCacheWitness }[] = [];
  const cacheOperations: { request: string; operation: string; key: string; hit?: boolean }[] = [];
  const cacheScope = new AsyncLocalStorage<string>();
  const backend = {
    get: async (key: string) => {
      const stored = transport.kind === "postgres" ?
        (await transport.db.select().from(schema.projectionCache).where(eq(schema.projectionCache.cacheKey, key)))[0]?.resultData :
        entries.has(key) ? JSON.parse(entries.get(key)!) : undefined;
      const hit = stored !== undefined; cacheOperations.push({ request: cacheScope.getStore()!, operation: "get", key, hit });
      return stored;
    },
    putIfAbsent: async (key: string, result: unknown) => {
      cacheOperations.push({ request: cacheScope.getStore()!, operation: "put", key });
      if (transport.kind === "postgres") await transport.db.insert(schema.projectionCache).values({
        cacheKey: key, projectionYear: 2024, category: "finance", resultData: result,
      }).onConflictDoNothing({ target: schema.projectionCache.cacheKey });
      if (!entries.has(key)) entries.set(key, JSON.stringify(result));
    },
  };
  const source = ts.createSourceFile("server/routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const registrations = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ["app.get", "app.use"].includes(node.expression.getText(source))) {
      const text = node.getText(source), path = node.arguments[0];
      if (ts.isStringLiteral(path)) {
        if (path.text === "/api/cv" && text.includes("const material = await captureMaterialInputs")) registrations.set("material", text);
        if (path.text === "/api/cv" && text.includes("X-Analytical-Status")) registrations.set("public", text);
        if (path.text === "/api/cv/carbon-price") registrations.set("carbon", text);
        if (path.text === "/api/cv/backtest") registrations.set("backtest", text);
        if (path.text === "/api/analysis/results/:id") registrations.set("result", text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(registrations.size, 5, "Use actual production registrations, never a handwritten HTTP calculation");
  const memoEvents: { family: string; request: string; key: string; phase: string }[] = [];
  function memoModule(file: string, family: string) {
    class ObservedMap<K, V> extends Map<K, V> {
      tracked(key: K) {
        return typeof key === "number" && key > Date.UTC(2000, 0, 1) ||
          typeof key === "string" && /^\d{4}-Q[1-4]$/.test(key);
      }
      get(key: K) {
        if (this.tracked(key)) memoEvents.push({ family, request: cacheScope.getStore()!, key: String(key),
          phase: super.has(key) ? "hit" : "miss" });
        return super.get(key);
      }
      set(key: K, value: V) {
        if (this.tracked(key)) memoEvents.push({ family, request: cacheScope.getStore()!, key: String(key), phase: "write" });
        return super.set(key, value);
      }
    }
    const module = { exports: {} as any };
    const localRequire = (name: string) => name === "./sharedUtils" ? companyUtils :
      name.startsWith(".") ? require(resolve(dirname(file), name)) : require(name);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    new Function("require", "module", "exports", "Map", code)(localRequire, module, module.exports, ObservedMap);
    return module.exports;
  }
  const walkForward = memoModule(resolve("server/climateValuation/walkForwardBacktest.ts"), "current-walk-forward-quarter");
  const legacy = memoModule(resolve("server/climateValuation/backtestCalculator.ts"), "legacy-prior-quarter");
  const app = express();
  app.use((req, _res, next) => {
    const label = String(req.headers["x-test-witness"] ?? "stored-result");
    const id = req.query.snapshotId as string;
    const work = () => cacheScope.run(label, () => runWithOverrideRows([], () =>
      runWithIsolatedCompanyCarbonCache(backend, event => witnesses.push({ request: label, event }), next)));
    const selected = datasets.get(id);
    if (selected) runWithReplayWorkbook(selected.packed, work); else work();
  });
  const bindings: Record<string, unknown> = { ...modules, app, historicalRequestPolicy, snapshotSelection, overlaySelection,
    applyOverlays, createManifest, CALCULATION_VERSION, requestOverrides, snapshotContext, overlayContext,
    publicValuationResult, calculateTotalBasedCarbonPrice, calculateBacktest: walkForward.calculateBacktest,
    bindNestedOutput, db: transport.db, console };
  const failures: string[] = [];
  for (const name of ["resolveSnapshot", "loadSnapshot", "captureMaterialInputs", "saveAnalysisResult", "loadAnalysisResult"]) {
    bindings[name] = async (...args: unknown[]) => {
      try { return await modules[name](...args); }
      catch (error) { failures.push(`${name}: ${error instanceof Error ? error.message : "unknown failure"}`); throw error; }
    };
  }
  for (const name of ["material", "public", "carbon", "backtest", "result"]) {
    const code = ts.transpileModule(registrations.get(name)!, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  }
  // Explicit private fixture endpoint for the retained legacy comparison only;
  // no such endpoint is added to the application or public route inventory.
  app.get("/__test/legacy-quarter", async (req, res) => {
    const header = await modules.resolveSnapshot(String(req.query.snapshotId));
    const output = await snapshotContext.run(header, () => legacy.calculateLegacyBacktest(
      "decarb_gap", 2, "absolute", "US", 0, new Map([[2018, 0], [2019, 0], [2020, 0], [2021, 0]])));
    res.json(publicValuationResult(output));
  });
  const server = createServer(app);
  const results: any[] = [];
  try {
    for (const value of fixtures) await modules.saveImportedWorkbook(value.companies, value.rows, "SYNTHETIC ENGINEERING HTTP fixture");
    await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
    const base = `http://127.0.0.1:${(server.address() as any).port}`;
    const request = async (index: number, geography: string, label: string) => {
      const response = await fetch(`${base}/api/cv/carbon-price?snapshotId=${fixtures[index].packed.id}&method=absolute&geography=${geography}`,
        { headers: { "x-test-witness": label } });
      const body = await response.json(); assert.equal(response.status, 200, JSON.stringify({ body, failures }));
      const identity = Object.fromEntries(["X-Analysis-Snapshot", "X-Analysis-Manifest", "X-Analysis-Material-Inputs", "X-Analysis-Result"]
        .map(key => [key, response.headers.get(key)]));
      assert.ok(Object.values(identity).every(Boolean));
      const storedResponse = await fetch(`${base}/api/analysis/results/${identity["X-Analysis-Result"]}`);
      const stored = await storedResponse.json(); assert.equal(storedResponse.status, 200, JSON.stringify(stored));
      assert.deepEqual(stored.result, body); assert.equal(stored.manifest.id, identity["X-Analysis-Manifest"]);
      assert.equal(stored.materialReplayState, "referenced-material-archives-verified");
      assert.equal(stored.manifest.settings.materialInputsId, identity["X-Analysis-Material-Inputs"]);
      const calculatorIdentity = witnesses.find(row => row.request === label)!.event.identity;
      assert.equal(calculatorIdentity.sourceVersion, stored.manifest.codeVersion);
      assert.equal(calculatorIdentity.modelVersion, stored.manifest.modelVersion);
      const record = { label, dataset: index, geography, rows: body.length, analyticalHash: contentHash(body), identity,
        calculatorIdentity, archiveSourceVersion: stored.manifest.codeVersion, archiveModelVersion: stored.manifest.modelVersion };
      results.push(record); return record;
    };
    const a = await request(0, "US", "a-cold"), empty = await request(0, "ZZ", "empty-cold");
    const b = await request(1, "US", "b-cold");
    const noEligible = await request(2, "US", "no-eligible-cold");
    const warm = await Promise.all([request(0, "US", "a-warm"), request(0, "ZZ", "empty-warm"),
      request(1, "US", "b-warm"), request(2, "US", "no-eligible-warm")]);
    for (const [i, cold] of Array.from([a, empty, b, noEligible].entries())) {
      assert.equal(cold.analyticalHash, warm[i].analyticalHash);
      assert.deepEqual(cold.identity, warm[i].identity);
      assert.deepEqual(cold.calculatorIdentity, warm[i].calculatorIdentity);
      assert.deepEqual(witnesses.filter(row => row.request === cold.label).map(row => row.event.phase), ["lookup-miss", "compute", "write"]);
      assert.deepEqual(witnesses.filter(row => row.request === warm[i].label).map(row => row.event.phase), ["lookup-hit"]);
    }
    assert.ok(a.rows > 0); assert.equal(empty.rows, 0); assert.equal(noEligible.rows, 0);
    assert.notEqual(a.identity["X-Analysis-Manifest"], b.identity["X-Analysis-Manifest"]);
    assert.notEqual(a.identity["X-Analysis-Material-Inputs"], b.identity["X-Analysis-Material-Inputs"]);
    assert.notEqual(a.calculatorIdentity.cacheKey, empty.calculatorIdentity.cacheKey);
    assert.equal(entries.size, 4);
    const memoResults = [];
    for (const [family, endpoint] of [
      ["current-walk-forward-quarter", "/api/cv/backtest"],
      ["legacy-prior-quarter", "/__test/legacy-quarter"],
    ]) {
      const requestMemo = async (dataset: number, attempt: number) => {
        const label = `${family}-${attempt}`;
        const response = await fetch(`${base}${endpoint}?snapshotId=${fixtures[dataset].packed.id}&signal=carbon_intensity&method=absolute&geography=US`,
          { headers: { "x-test-witness": label } });
        const output = await response.json();
        assert.equal(response.status, 200, JSON.stringify({ output, failures }));
        if (family === "current-walk-forward-quarter") {
          const archive = await fetch(`${base}/api/analysis/results/${response.headers.get("X-Analysis-Result")}`);
          const stored = await archive.json();
          assert.equal(archive.status, 200, JSON.stringify({ stored, failures }));
          assert.deepEqual(stored.result, output);
          assert.equal(stored.manifest.snapshotHashes[0], fixtures[dataset].packed.id);
          assert.equal(stored.manifest.codeVersion, results[0].calculatorIdentity.sourceVersion);
          assert.equal(stored.manifest.modelVersion, CALCULATION_VERSION);
          assert.equal(stored.materialReplayState, "referenced-material-archives-verified");
        }
        const events = memoEvents.filter(event => event.request === label);
        const misses = events.filter(event => event.phase === "miss").length;
        const hits = events.filter(event => event.phase === "hit").length;
        const writes = events.filter(event => event.phase === "write").length;
        assert.ok(misses > 0 && hits > 0); assert.equal(misses, writes);
        return { datasetId: fixtures[dataset].packed.id, hash: contentHash(output), misses, hits, writes,
          manifest: response.headers.get("X-Analysis-Manifest"), material: response.headers.get("X-Analysis-Material-Inputs"),
          result: response.headers.get("X-Analysis-Result") };
      };
      const first = await requestMemo(0, 0);
      const concurrent = await Promise.all([requestMemo(0, 1), requestMemo(1, 2)]);
      const outputs = [first, ...concurrent];
      assert.deepEqual(outputs[0], outputs[1], "Fresh invocation has the same local miss/hit pattern and analytical/archive identities");
      assert.notEqual(outputs[0].datasetId, outputs[2].datasetId);
      if (family === "current-walk-forward-quarter") {
        assert.notEqual(outputs[0].manifest, outputs[2].manifest);
        assert.notEqual(outputs[0].material, outputs[2].material);
      }
      memoResults.push({ family, sourceVersion: results[0].calculatorIdentity.sourceVersion, model: CALCULATION_VERSION, outputs });
    }
    if (transport.kind === "memory") {
      for (const kind of ["calculation-source", "material-inputs", "analysis-result"]) {
        const inserts = transport.operations.filter(operation => operation.kind === kind);
        assert.ok(inserts.some(operation => operation.existing === false), `${kind}: direct first insert`);
        assert.ok(inserts.some(operation => operation.existing === true), `${kind}: direct immutable dedup branch`);
      }
    }
    mkdirSync("generated-artifacts/company-cache-extension", { recursive: true, mode: 0o700 });
    const directory = mkdtempSync(resolve("generated-artifacts/company-cache-extension/http-"));
    writeFileSync(`${directory}/evidence.json`, JSON.stringify({
      passed: true, fixture: "6 companies x 36 dates, three synthetic engineering datasets; not real issuer evidence",
      productionRegistrations: Array.from(registrations.keys()), sourceHash: contentHash(readFileSync("server/routes.ts", "utf8")),
      results, witnesses, cacheOperations, memoResults, memoEvents, archiveTransportOperations: transport.operations,
      transport: transport.kind === "postgres" ? "Actual loopback HTTP and independently authorized disposable PostgreSQL" :
        "Actual loopback HTTP, actual production handlers and material/result hash-validation functions; isolated in-memory SQL/ORM I/O adapter",
      access: transport.access, postgresqlTransportExecuted: transport.kind === "postgres",
      realDatabaseQueries: transport.kind === "postgres" ? transport.operations.length : 0,
      ddl: 0, productionCacheClears: 0,
      prior2442CompanyWitnessRerun: false,
    }, null, 2), { mode: 0o600, flag: "wx" });
    console.log(`HTTP/MATERIAL CACHE EVIDENCE ${directory}/evidence.json`);
  } finally {
    await new Promise<void>(done => server.close(() => done()));
    await transport.close();
    if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior;
  }
});
