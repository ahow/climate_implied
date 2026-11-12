import test from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import express from "express";
import ts from "typescript";
import * as forward from "../server/calculation/forwardProjection";
import * as history from "../server/calculation/historicalIndicators";
import * as categories from "../server/calculation/categoryProjections";
import { getRecalculatedHistoricalTrend } from "../server/calculation/historicalRecalculation";
import { getCategoryHistoricalTrend } from "../server/calculation/categoryHistoricalTrend";
import { selectedTrajectoryThresholdContext } from "../server/calculation/thresholdDiagnostic";
import { historicalTrajectoryMetrics } from "../server/calculation/historicalMetrics";
import { calculationKey } from "../server/calculation/identity";
import { contentHash } from "../server/calculation/analysisManifest";
import { currentSourceArchiveId } from "../server/snapshots/materialInputs";
import { detachProjectionCacheResponse } from "../server/calculation/projectionCacheResponse";
import { CALCULATION_VERSION, RNG_VERSION, legacyContext } from "../shared/calculationContract";
import { projectionResponseSchema, PROJECTION_RESPONSE_VERSION } from "../shared/projectionResponse";
import { bindNestedOutput, bindOutputFields } from "../shared/outputFieldSemantics";
import { historicalRequestPolicy, snapshotSelection, storedReplayRequest } from "../server/snapshots/requestContract";
import { packIndicators, unpackIndicators } from "../server/snapshots/indicatorContract";
import { packRegional, unpackRegional } from "../server/snapshots/regionalContract";
import { requestOverrides, runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { MemStorage } from "../server/storage";
import { openDisposableCachePostgres } from "./disposable-cache-postgres";
import { eq } from "drizzle-orm";
import { projectionCache } from "../shared/schema";

const require = createRequire(import.meta.url);
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const routeSource = readFileSync("server/routes.ts", "utf8");
const sourceTree = ts.createSourceFile("server/routes.ts", routeSource, ts.ScriptTarget.Latest, true);
const calculationSources = ["server/routes.ts", "server/calculation/projectionCacheResponse.ts",
  "server/calculation/forwardProjection.ts", "server/calculation/random.ts", "server/calculation/categoryProjections.ts",
  "server/calculation/historicalIndicators.ts", "server/calculation/historicalRecalculation.ts",
  "server/calculation/categoryHistoricalTrend.ts", "server/calculation/regionalProjections.ts",
  "server/calculation/historicalMetrics.ts", "server/calculation/thresholdDiagnostic.ts", "server/calculation/identity.ts",
  "server/snapshots/requestContract.ts", "server/snapshots/indicatorContract.ts", "server/snapshots/regionalContract.ts",
  "server/dataIngestion/requestOverrides.ts", "server/dataIngestion/overrideStore.ts", "server/storage.ts",
  "shared/calculationContract.ts", "shared/projectionResponse.ts", "shared/outputFieldSemantics.ts"];
const sourcePins = () => Object.fromEntries(calculationSources.map(path => [path, sha(readFileSync(path, "utf8"))]));
const initialSourcePins = sourcePins();
const initialSourceArchiveId = currentSourceArchiveId();
const families = [
  ["/api/projection", "projectionResultCache", "calculateEmissionsTrajectory"],
  ["/api/projection/categories", "categoryCacheResult", "calculateAllCategoryProjections"],
  ["/api/projection/regions", "regionalCacheResult", "calculateRegionalProjections"],
  ["/api/projection/sensitivity", "sensitivityCacheResult", "calculateSensitivityAnalysis"],
  ["/api/projection/historical-trend", "historicalTrendCacheResult", "getRecalculatedHistoricalTrend"],
  ["/api/projection/categories/historical-trend", "categoryHistoricalTrendCache", "getCategoryHistoricalTrend"],
] as const;
const A = packIndicators([{ indicatorKey: "renewableCapacityGW", year: 2024, value: 4500,
  source: "ENGINEERING retained A", method: "isolated cache transport fixture" }]);
const B = packIndicators([{ indicatorKey: "renewableCapacityGW", year: 2024, value: 6500,
  source: "ENGINEERING retained B", method: "isolated cache transport fixture" }]);
const C = packIndicators([{ indicatorKey: "renewableCapacityGW", year: 2024, value: 6501,
  source: "ENGINEERING fault-only C", method: "isolated cache transport fixture" }]);
const regionalA = packRegional(Object.fromEntries(["eu", "us", "china", "india"].map((region, i) =>
  [region, { value: 0.2 + i * 0.1, source: "static" }])));
const regionalB = packRegional(Object.fromEntries(["eu", "us", "china", "india"].map((region, i) =>
  [region, { value: 0.3 + i * 0.1, source: "static" }])));
const emptyRegionalPayload = { ...regionalA.payload, intensities: {} };
const emptyRegionalId = contentHash(emptyRegionalPayload);
type Scope = { id: string; revision?: string; material?: string; dataset?: string; fault?: string; currentFixture?: string };
type Event = { request: string; phase: string; name: string; hit?: boolean };

function productionPieces() {
  const names = new Set(["projectionResultCache", "categoryCacheResult", "regionalCacheResult", "regionalCacheFetchedAt",
    "REGIONAL_CACHE_TTL_MS", "historicalTrendCacheResult", "sensitivityCacheResult", "categoryHistoricalTrendCache",
    "routeCacheRevisions", "validRouteCache", "tagRouteCache"]);
  const statements: string[] = [], registrations = new Map<string, string>();
  let revision = "", indicators = "", projectedRate = "";
  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.has(d.name.getText(sourceTree))))
      statements.push(node.getText(sourceTree));
    if (ts.isFunctionDeclaration(node) && node.name?.text === "currentProjectionRevision") revision = node.getText(sourceTree);
    if (ts.isFunctionDeclaration(node) && node.name?.text === "getProjectedRate") projectedRate = node.getText(sourceTree);
    if (ts.isCallExpression(node) && ["app.get", "app.use"].includes(node.expression.getText(sourceTree)) &&
      ts.isStringLiteral(node.arguments[0])) {
      const path = node.arguments[0].text, text = node.getText(sourceTree);
      if (families.some(([route]) => route === path)) registrations.set(path, text);
      if (path === "/api" && text.includes("Approved indicator inputs unavailable or inconsistent")) indicators = text;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceTree);
  assert.equal(registrations.size, 6); assert.equal(statements.length, 11); assert.ok(revision && indicators);
  assert.ok(projectedRate);
  return { statements, registrations, revision, indicators, projectedRate };
}

async function harness(store: Pick<MemStorage, "getProjectionCache" | "setProjectionCache"> = new MemStorage()) {
  const scope = new AsyncLocalStorage<Scope>(), events: Event[] = [], responses = new Map<string, any>();
  const receipts: any[] = [], errors: string[] = [];
  let clock = Date.now(), serial = 0, control: any;
  const gates = new Map<string, { promise: Promise<void>; release: () => void }>();
  const app = express();
  const packed = new Map([[A.id, A.payload], [B.id, B.payload], [C.id, C.payload]]);
  const regional = new Map([[regionalA.id, regionalA.payload], [regionalB.id, regionalB.payload]]);
  regional.set(emptyRegionalId, emptyRegionalPayload as typeof regionalA.payload);
  app.use((req, res, next) => {
    const state: Scope = { id: String(req.headers["x-witness-id"]), fault: String(req.headers["x-fixture-fault"] ?? ""),
      currentFixture: String(req.headers["x-current-fixture"] ?? "") };
    const send = res.json.bind(res);
    res.json = ((body: any) => { responses.set(state.id, body); return send(body); }) as typeof res.json;
    scope.run(state, () => {
      if (req.headers["x-empty-history"]) history.historicalInputContext.run([], next);
      else next();
    });
  });
  const record = (phase: string, name: string, hit?: boolean) =>
    events.push({ request: scope.getStore()!.id, phase, name, ...(hit === undefined ? {} : { hit }) });
  class TagMap<K, V> extends Map<K, V> {
    get(key: K) {
      const result = super.get(key);
      record("route-cache-lookup", String(key), result === scope.getStore()?.revision);
      return result;
    }
    set(key: K, value: V) { record("route-cache-tag", String(key)); return super.set(key, value); }
  }
  class ClockDate extends Date { static now() { return clock; } }
  const instrument = (name: string, calculate: (...args: any[]) => any) => (...args: any[]) => {
    record("compute", name);
    if (scope.getStore()!.fault === name) throw new Error("isolated engineering calculator fault");
    return calculate(...args);
  };
  const regionalFile = resolve("server/calculation/regionalProjections.ts"), regionalModule = { exports: {} as any };
  const providerFixture = {
    "European Union (27)": { data: [{ year: 2024, co2_per_gdp: 0.2 }] },
    "United States": { data: [{ year: 2024, co2_per_gdp: 0.3 }] },
    China: { data: [{ year: 2024, co2_per_gdp: 0.4 }] }, India: { data: [{ year: 2024, co2_per_gdp: 0.5 }] },
  };
  const localRequire = (name: string) => name === "./forwardProjection" ? forward :
    name === "./historicalIndicators" ? history :
      name.startsWith(".") ? require(resolve(dirname(regionalFile), name)) : require(name);
  const regionalCode = ts.transpileModule(readFileSync(regionalFile, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", "fetch", regionalCode)(localRequire, regionalModule, regionalModule.exports,
    async () => ({ ok: true, json: async () => providerFixture }));
  const bindings: Record<string, any> = {
    app, ...forward, ...history, ...categories, historicalTrajectoryMetrics, selectedTrajectoryThresholdContext,
    calculationKey, CALCULATION_VERSION, legacyContext, projectionResponseSchema, PROJECTION_RESPONSE_VERSION,
    bindNestedOutput, bindOutputFields, snapshotSelection, historicalRequestPolicy, storedReplayRequest,
    runWithOverrideRows, requestOverrides, detachProjectionCacheResponse,
    loadIndicatorSnapshot: async (id: string) => unpackIndicators(id, packed.get(id)),
    getApprovedValues: async () => scope.getStore()!.currentFixture === "A" ? A.payload.rows :
      scope.getStore()!.currentFixture === "B" ? B.payload.rows : scope.getStore()!.currentFixture === "C" ? C.payload.rows : [],
    loadRegionalInputs: async (id: string) => unpackRegional(id, regional.get(id)),
    calculateRegionalFromInputs: instrument("calculateRegionalFromInputs", regionalModule.exports.calculateRegionalFromInputs),
    calculateRegionalProjections: instrument("calculateRegionalProjections", async () => {
      const result = await regionalModule.exports.calculateRegionalProjections();
      await gates.get(scope.getStore()!.id)?.promise;
      return result;
    }),
    calculateEmissionsTrajectory: instrument("calculateEmissionsTrajectory", forward.calculateEmissionsTrajectory),
    calculateAllCategoryProjections: instrument("calculateAllCategoryProjections", categories.calculateAllCategoryProjections),
    calculateSensitivityAnalysis: instrument("calculateSensitivityAnalysis", forward.calculateSensitivityAnalysis),
    getRecalculatedHistoricalTrend: instrument("getRecalculatedHistoricalTrend", getRecalculatedHistoricalTrend),
    getCategoryHistoricalTrend: instrument("getCategoryHistoricalTrend", getCategoryHistoricalTrend),
    storage: {
      getProjectionCache: async (key: string) => { const result = await store.getProjectionCache(key); record("persistent-lookup", key, result !== undefined); return result; },
      setProjectionCache: async (value: any) => { record("persistent-write", value.cacheKey); return store.setProjectionCache(value); },
    },
    console: { error: (...args: any[]) => errors.push(args.map(value => value instanceof Error ? value.message : String(value)).join(": ")) },
    Map: TagMap, Date: ClockDate,
  };
  const pieces = productionPieces();
  // Actual indicator-read middleware; only archive/current-read I/O is isolated.
  new Function(...Object.keys(bindings), ts.transpile(pieces.indicators, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(...Object.values(bindings));
  app.use((req, res, next) => {
    try {
      const state = scope.getStore()!;
      state.revision = control.revision();
      res.locals.calculationRevision = state.revision;
      state.dataset = requestOverrides.getStore()!.hash;
      state.material = contentHash({ effectiveHistoricalInputs: history.getAllHistoricalIndicatorsWithNowcast(),
        indicatorSelection: state.dataset, regionalSelection: req.query.regionalSnapshotId ?? null,
        defaultRegionalProviderFixture: req.path.endsWith("/regions") && !req.query.regionalSnapshotId ? providerFixture : null });
      res.set("X-Calculation-Version", CALCULATION_VERSION).set("X-Calculation-Input-Revision", state.revision!);
      res.on("finish", () => receipts.push({ request: state.id, status: res.statusCode, revision: state.revision,
        dataset: state.dataset, materialFingerprint: state.material }));
      next();
    } catch (error) { next(error); }
  });
  const code = [...pieces.statements, pieces.revision, pieces.projectedRate, ...Array.from(pieces.registrations.values()),
    "return { revision: currentProjectionRevision, projectedRate: getProjectedRate };"].join("\n");
  control = new Function(...Object.keys(bindings), ts.transpile(code, {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }))(...Object.values(bindings));
  // Private engineering entry to the actual retained finance helper, not an
  // application endpoint or invented operator identity.
  // Reuse an existing indicator-selection-eligible read path in this private
  // harness; the application's calculation-contract registration is NOT loaded.
  app.get("/api/calculation-contract", async (_req, res, next) => {
    try { res.json({ rate: await control.projectedRate() }); } catch (error) { next(error); }
  });
  app.use((_error: unknown, _req: unknown, res: express.Response, _next: unknown) => res.status(500).json({ error: "Invalid effective inputs refused" }));
  const server = createServer(app);
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  return {
    events, receipts, responses, errors,
    advance: (milliseconds: number) => { clock += milliseconds; },
    gate: (id: string) => {
      let release!: () => void; const promise = new Promise<void>(done => { release = done; });
      gates.set(id, { promise, release }); return release;
    },
    request: async (path: string, selection: "A" | "B" | "C" | "current", options: {
      id?: string; fault?: string; query?: string; empty?: boolean;
    } = {}) => {
      const id = options.id ?? `r${serial++}`;
      // Production policy deliberately forbids retained-indicator/default-region
      // mixtures. Test default cache A/B via isolated CURRENT provider values;
      // paired immutable regional replay is separately exercised as a bypass.
      const currentRegional = path === "/api/projection/regions" && !options.query?.includes("regionalSnapshotId");
      const query = [selection === "current" || currentRegional ? "" : `indicatorSnapshotId=${selection === "A" ? A.id : selection === "B" ? B.id : C.id}`, options.query ?? ""].filter(Boolean).join("&");
      const response = await fetch(`${base}${path}${query ? `?${query}` : ""}`, { headers: {
        "x-witness-id": id, ...(options.fault ? { "x-fixture-fault": options.fault } : {}),
        ...(currentRegional ? { "x-current-fixture": selection } : {}),
        ...(options.empty ? { "x-empty-history": "1" } : {}),
      } });
      const body = await response.json();
      return { id, status: response.status, body, hash: contentHash(body),
        headers: Object.fromEntries(["X-Indicator-Snapshot", "X-Indicator-Data-State", "X-Calculation-Version",
          "X-Calculation-Input-Revision", "X-Regional-Snapshot", "Cache-Control", "X-Field-Semantics"].map(name => [name, response.headers.get(name)])) };
    },
    close: () => { gates.forEach(gate => gate.release()); return new Promise<void>(done => server.close(() => done())); },
  };
}
function mutate(value: any): boolean {
  if (value === null || typeof value !== "object") return false;
  for (const key of Object.keys(value)) {
    if (typeof value[key] === "number" && Number.isFinite(value[key])) { value[key] += 1; return true; }
    if (mutate(value[key])) return true;
  }
  return false;
}
function save(name: string, payload: unknown) {
  mkdirSync("generated-artifacts/projection-route-cache", { recursive: true, mode: 0o700 });
  const folder = mkdtempSync(resolve(`generated-artifacts/projection-route-cache/${name}-`));
  const path = `${folder}/evidence.json`;
  writeFileSync(path, JSON.stringify(payload, null, 2), { mode: 0o600, flag: "wx" });
  console.log("PROJECTION CACHE EVIDENCE", path);
}

test("six actual route-local caches resist server response mutation", async () => {
  const api = await harness(), probes = [];
  try {
    for (const [path] of families) {
      const cold = await api.request(path, "A");
      assert.equal(cold.status, 200, JSON.stringify({ body: cold.body, errors: api.errors }));
      assert.ok(mutate(api.responses.get(cold.id)));
      const warm = await api.request(path, "A");
      assert.ok(mutate(api.responses.get(warm.id)));
      const hot = await api.request(path, "A");
      probes.push({ path, cold: cold.hash, warm: warm.hash, hot: hot.hash,
        safe: cold.hash === warm.hash, warmMutationSafe: cold.hash === hot.hash });
    }
    save("mutation", { routesSourceSha256: sha(routeSource), probes, events: api.events });
    assert.ok(probes.every(probe => probe.safe && probe.warmMutationSafe),
      "Actual cached objects must not be owned by downstream res.json consumers");
  } finally { await api.close(); }
});

test("six actual route-local caches preserve seeded cold/warm retained/current/concurrent identities", async () => {
  const api = await harness(), records: any[] = [], boundaries: any[] = [];
  const references = new Map<string, any>();
  const assertSame = (a: any, b: any) => {
    assert.equal(a.hash, b.hash); assert.deepEqual(a.headers, b.headers);
    const material = (id: string) => {
      const record = api.receipts.find(row => row.request === id);
      assert.ok(record, "Valid request must have a pinned actual effective-input receipt");
      return { revision: record.revision, dataset: record.dataset, material: record.materialFingerprint };
    };
    assert.deepEqual(material(a.id), material(b.id));
    assert.equal(a.headers["X-Calculation-Version"], CALCULATION_VERSION);
  };
  try {
    for (const [path, state, calculator] of families) {
      for (const selection of ["A", "B", "current"] as const) {
        const cold = await api.request(path, selection), warm = await api.request(path, selection);
        assert.equal(cold.status, 200, JSON.stringify(cold.body)); assertSame(cold, warm);
        assert.ok(api.events.some(event => event.request === cold.id && event.phase === "compute" && event.name === calculator));
        assert.ok(api.events.some(event => event.request === warm.id && event.phase === "route-cache-lookup" && event.hit));
        assert.ok(!api.events.some(event => event.request === warm.id && event.phase === "compute"));
        assert.ok(mutate(warm.body)); const afterClientMutation = await api.request(path, selection);
        assertSame(cold, afterClientMutation);
        references.set(`${path}:${selection}`, cold);
        records.push({ path, state, selection, cold: cold.id, warm: warm.id, analyticalHash: cold.hash, headers: cold.headers });
      }
      const concurrent = await Promise.all(["A", "B", "current"].map(selection => api.request(path, selection as "A" | "B" | "current")));
      concurrent.forEach((result, i) => assertSame(references.get(`${path}:${["A", "B", "current"][i]}`), result));
      const failed = await api.request(path, "C", { fault: calculator });
      assert.equal(failed.status, 500);
      const recovered = await api.request(path, "A");
      assertSame(references.get(`${path}:A`), recovered);
      const empty = await api.request(path, "A", { empty: true });
      assert.equal(empty.status, 500, "Captured empty historical inputs are refused, not cached as invented empty results");
      const unavailable = await api.request(path, "current", { query: `indicatorSnapshotId=${"f".repeat(64)}${
        path.endsWith("/regions") ? `&regionalSnapshotId=${regionalA.id}` : ""}` });
      assert.equal(unavailable.status, 422);
      boundaries.push({ path, fault: { id: failed.id, status: failed.status }, recovered: recovered.id,
        emptyCapturedHistory: { id: empty.id, status: empty.status },
        unavailableIndicatorArchive: { id: unavailable.id, status: unavailable.status } });
    }
    const region = "/api/projection/regions";
    const before = await api.request(region, "A");
    api.advance(24 * 60 * 60 * 1000 - 1);
    const fresh = await api.request(region, "A"); assertSame(before, fresh);
    assert.ok(!api.events.some(event => event.request === fresh.id && event.phase === "compute"));
    api.advance(1);
    const expired = await api.request(region, "A"); assertSame(before, expired);
    assert.ok(api.events.some(event => event.request === expired.id && event.phase === "compute"));
    boundaries.push({ regionalTTL: { before: before.id, atTTLMinus1: fresh.id, atTTL: expired.id,
      payloadHash: before.hash, material: api.receipts.find(row => row.request === before.id)!.materialFingerprint } });
    const replayA = await api.request(region, "A", { query: `regionalSnapshotId=${regionalA.id}` });
    const replayB = await api.request(region, "B", { query: `regionalSnapshotId=${regionalB.id}` });
    assert.equal(replayA.status, 200); assert.equal(replayB.status, 200);
    assert.notEqual(replayA.headers["X-Regional-Snapshot"], replayB.headers["X-Regional-Snapshot"]);
    assert.equal(replayA.headers["Cache-Control"], "no-store");
    assert.ok(api.events.some(event => event.request === replayA.id && event.name === "calculateRegionalFromInputs"));
    const replayAgain = await api.request(region, "A", { query: `regionalSnapshotId=${regionalA.id}` });
    assertSame(replayA, replayAgain);
    assert.ok(api.events.some(event => event.request === replayAgain.id && event.name === "calculateRegionalFromInputs"),
      "Retained geography deliberately bypasses the default route-local cache");
    const badRegion = await api.request(region, "A", { query: `regionalSnapshotId=${"f".repeat(64)}` });
    assert.equal(badRegion.status, 422);
    const emptyRegion = await api.request(region, "A", { query: `regionalSnapshotId=${emptyRegionalId}` });
    assert.equal(emptyRegion.status, 422);
    const emptyRegional = (() => { try { packRegional({}); return false; } catch { return true; } })();
    assert.ok(emptyRegional, "Missing geographic material is refused, not static-filled by captured replay");
    const unfiltered = await api.request(region, "A", { query: "geography=ZZ" });
    assertSame(references.get(`${region}:A`), unfiltered);
    assert.deepEqual(unfiltered.body.map((row: any) => row.region), ["eu", "us", "china", "india"]);
    boundaries.push({ regionalReplay: { retainedA: replayA.id, retainedB: replayB.id, repeatA: replayAgain.id,
      missing: { id: badRegion.id, status: badRegion.status }, empty: { id: emptyRegion.id, status: emptyRegion.status },
      unsupportedGeographyQueryIsNotAFilter: unfiltered.id } });
    api.advance(24 * 60 * 60 * 1000);
    const releaseA = api.gate("late-A"), releaseB = api.gate("early-B");
    const lateA = api.request(region, "A", { id: "late-A" });
    const earlyB = api.request(region, "B", { id: "early-B" });
    const wait = async (id: string) => {
      const deadline = Date.now() + 10000;
      while (!api.events.some(event => event.request === id && event.phase === "compute")) {
        if (Date.now() > deadline) throw new Error("Concurrent regional gate not reached");
        await new Promise(done => setTimeout(done, 5));
      }
    };
    await Promise.all([wait("late-A"), wait("early-B")]);
    releaseB(); assertSame(references.get(`${region}:B`), await earlyB);
    releaseA(); assertSame(references.get(`${region}:A`), await lateA);
    assertSame(references.get(`${region}:A`), await api.request(region, "A"));
    assert.deepEqual(sourcePins(), initialSourcePins, "Actual calculator/handler dependencies must not change while the witness runs");
    save("matrix", {
      passed: true, routesSourceSha256: sha(routeSource), sourceArchiveId: initialSourceArchiveId, calculationSourceHashes: initialSourcePins,
      model: CALCULATION_VERSION, rng: RNG_VERSION, seedContract: "Actual existing calculator seeds and original run counts; no Math.random override or reduced runs",
      fixtures: { A: A.id, B: B.id, current: "isolated current-approved provider [] plus actual embedded curated/nowcast history", regionalA: regionalA.id, regionalB: regionalB.id },
      records, boundaries, receipts: api.receipts, events: api.events, errors: api.errors,
      ttl: "Only default regional response has 24h TTL; tested at TTL-1 and exact TTL. Other five route-local caches have no clock TTL.",
      transport: "Actual loopback HTTP; actual six registrations, revision/tag helpers, indicator-selection middleware and production calculators. Only archive/current/provider I/O isolated.",
      identityQualification: "Model/dataset headers are actual HTTP outputs. Source and effective-material fingerprints are witness-level pins; projection routes do not expose CV material/result archive identities. No such HTTP/archive fields are invented.",
      omittedOuterMiddleware: "Startup/override reload/global invalidation DELETE middleware is not executed. No database/cache clear is authorized. Actual pure revision helper and actual route cache helpers execute.",
      regionalSelectionPolicy: "Actual policy requires paired indicator/regional archives, which bypass default region cache. A/B default-region cache witnesses use isolated CURRENT approved-provider fixture values. No impossible retained/default mixture is enabled.",
      realDatabaseQueries: 0, realProviderRequests: 0, ddl: 0, productionCacheClears: 0,
      unchangedCompanyQuarterRegionalWitnessesRerun: false,
    });
  } finally { await api.close(); }
});

test("authorized disposable PostgreSQL preserves actual full/reduced namespaces and revision isolation",
  { skip: !process.env.COMPANY_CACHE_DISPOSABLE_DATABASE_URL, timeout: 120_000 }, async () => {
    const transport = await openDisposableCachePostgres();
    const store = {
      getProjectionCache: async (key: string) =>
        (await transport.db.select().from(projectionCache).where(eq(projectionCache.cacheKey, key)))[0],
      setProjectionCache: async (value: any) =>
        (await transport.db.insert(projectionCache).values(value).onConflictDoNothing().returning())[0],
    };
    const api = await harness(store);
    const receipts: any[] = [];
    try {
      const reduced = await api.request("/api/calculation-contract", "A");
      assert.equal(reduced.status, 200, JSON.stringify({ body: reduced.body, errors: api.errors }));
      const reducedWarm = await api.request("/api/calculation-contract", "A");
      assert.equal(reduced.hash, reducedWarm.hash);
      assert.ok(!api.events.some(event => event.request === reducedWarm.id && event.phase === "compute"));
      const full = await api.request("/api/projection", "A");
      assert.equal(full.status, 200, JSON.stringify({ body: full.body, errors: api.errors }));
      assert.ok(api.events.some(event => event.request === full.id && event.phase === "compute"));
      const warm = await api.request("/api/projection", "A");
      assert.equal(full.hash, warm.hash); assert.deepEqual(full.headers, warm.headers);
      const changed = await api.request("/api/projection", "B");
      assert.equal(changed.status, 200);
      assert.notEqual(full.headers["X-Calculation-Input-Revision"], changed.headers["X-Calculation-Input-Revision"]);
      assert.ok(api.events.some(event => event.request === changed.id && event.phase === "compute"));
      // Recreate route-local state: the next A hit MUST come from real JSONB.
      const fresh = await harness(store);
      try {
        const persistent = await fresh.request("/api/projection", "A");
        assert.equal(persistent.status, 200); assert.equal(full.hash, persistent.hash);
        assert.deepEqual(full.headers, persistent.headers);
        assert.ok(fresh.events.some(event => event.request === persistent.id && event.phase === "persistent-lookup" && event.hit));
        assert.ok(!fresh.events.some(event => event.request === persistent.id && event.phase === "compute"));
        receipts.push({ persistent, events: fresh.events, receipts: fresh.receipts });
      } finally { await fresh.close(); }
      const writes = api.events.filter(event => event.phase === "persistent-write");
      assert.equal(writes.length, 3);
      assert.equal(new Set(writes.map(event => event.name)).size, 3,
        "Reduced A, full A and full B must occupy three distinct production calculation keys");
      const rows = await transport.db.select().from(projectionCache);
      assert.ok(writes.every(event => rows.some(row => row.cacheKey === event.name)));
      save("postgres-namespace", { passed: true, transport: "Actual isolated PostgreSQL JSONB",
        productionStorageQualification: "Actual production handler/helper storage calls with a Drizzle PostgreSQL I/O adapter; default application storage remains MemStorage.",
        fullRunCount: 10000, reducedRunCount: 10000,
        reducedMeans: "Different finance response shape/threshold semantics, not lowered Monte Carlo runs",
        reduced, reducedWarm, full, warm, changed, persistent: receipts,
        writes, events: api.events, receipts: api.receipts, databaseOperations: transport.operations,
        sourceHashes: sourcePins(), ddlDuringTest: 0, deletes: 0, cacheClears: 0 });
    } finally { await api.close(); await transport.close(); }
  });
