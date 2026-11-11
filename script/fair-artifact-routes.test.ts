import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Express } from "express";
import { fairArtifactCatalog, fairArtifactSelection, fairSha256 } from "../server/calculation/fairArtifactCatalog";
import { createFairArtifactLoader, FairArtifactError, fairArtifactSelectionSchema, fairMember,
  type LoadedFairArtifact } from "../server/calculation/fairArtifacts";
import { registerFairArtifactRoutes, fairRouteInventory } from "../server/calculation/fairArtifactRoutes";
import { calculationReadiness } from "../server/calculation/readiness";

// Explicit synthetic engineering fixture ONLY; never written to a production
// artifact directory, never offered as scientific evidence.
const fixture = {
  identity: { ...fairArtifactSelection(fairArtifactCatalog[0]), resultSha256: "a".repeat(64) },
  manifest: fairArtifactCatalog[0].manifest,
  ensemble: { baseline: "1850-1900", memberIds: ["engineering-a", "engineering-b"],
    years: [2003, 2004, 2100], temperature: [[0.5, 0.7], [0.6, 0.8], [2, 3]] },
  provenance: {},
} as unknown as LoadedFairArtifact;
type Handler = (req: any, res: any, next: () => void) => any;
export function captureFairHandlers(loader = async (input: unknown) => {
  fairArtifactSelectionSchema.parse(input);
  return fixture;
}) {
  const handlers = new Map<string, Handler>();
  let middleware: Handler;
  const app = {
    get: (path: string, handler: Handler) => handlers.set(`GET ${path}`, handler),
    post: (path: string, handler: Handler) => handlers.set(`POST ${path}`, handler),
    use: (handler: Handler) => { middleware = handler; },
  } as unknown as Express;
  registerFairArtifactRoutes(app, loader);
  return async (route: string, req: any = {}) => {
    let body: any, status = 200, nextCalled = false;
    const headers: Record<string, string> = {};
    const res = {
      set: (key: string, value: string) => { headers[key] = value; return res; },
      status: (value: number) => { status = value; return res; },
      json: (value: unknown) => { body = value; return res; },
    };
    const handler = route === "middleware" ? middleware! : handlers.get(route)!;
    assert.ok(handler, route);
    await handler({ query: {}, params: {}, ...req }, res, () => { nextCalled = true; });
    return { status, body, headers, nextCalled };
  };
}
const selection = fairArtifactSelection(fairArtifactCatalog[0]);
const { artifactId, ...query } = selection;
const request = { params: { artifactId }, query };
const get = (operation: string) => `GET /api/calculation/fair-artifacts/:artifactId/${operation}`;

test("all registered artifact routes carry exact identity and unaccepted scientific state", async () => {
  const call = captureFairHandlers();
  const catalog = await call("GET /api/calculation/fair-artifacts");
  assert.equal(catalog.body.artifacts.length, 16);
  assert.ok(catalog.body.artifacts.every((entry: any) => entry.manifest.productionEligible === false));
  for (const operation of ["manifest", "ensemble", "summary"]) {
    const response = await call(get(operation), request);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.artifact, fixture.identity);
    assert.equal(response.body.modelPromoted, false);
    assert.equal(response.body.scientificAcceptance, "not-accepted");
    assert.equal(response.headers["X-FaIR-Ensemble-SHA256"], selection.ensembleSha256);
  }
  const manifest = await call(get("manifest"), request);
  const member = manifest.body.members[1];
  const response = await call(get("members/:memberId"), {
    params: { artifactId, memberId: member.memberId },
    query: { ...query, memberSha256: member.memberSha256 },
  });
  assert.deepEqual(response.body.member.temperature, [0.7, 0.8, 3]);
  assert.equal(response.body.member.memberSha256, fairMember(fixture, member.memberId).memberSha256);
});

test("all artifact-backed POST consumers use loaded bytes, refuse mixed data and anthropogenic relabeling", async () => {
  const call = captureFairHandlers();
  const summary = await call("POST /api/calculation/ensemble-summary", { body: { artifactSelection: selection } });
  assert.equal(summary.body.headline.median, 2.5);
  assert.equal(summary.body.artifact.ensembleSha256, selection.ensembleSha256);
  assert.equal((await call("POST /api/calculation/ensemble-summary", {
    body: { artifactSelection: selection, temperature: [[999]] },
  })).status, 422);
  const reference = { source: "https://example.org/engineering-only", kind: "total",
    baseline: "1850-1900", startYear: 2003, endYear: 2004, lower: 0, upper: 1 };
  const history = await call("POST /api/calculation/validate-history", {
    body: { artifactSelection: selection, simulationKind: "total", reference },
  });
  assert.equal(history.body.status, "range-diagnostic-not-independent-validation");
  assert.equal(history.body.median, 0.65);
  for (const body of [
    { artifactSelection: selection, simulationKind: "anthropogenic", reference },
    { artifactSelection: selection, simulationKind: "total", reference: { ...reference, kind: "anthropogenic" } },
    { artifactSelection: selection, simulationKind: "total", reference, ensemble: fixture.ensemble },
  ]) assert.equal((await call("POST /api/calculation/validate-history", { body })).status, 422);
  for (const route of ["ensemble-summary", "validate-history"])
    assert.equal((await call(`POST /api/calculation/${route}`, { body: fixture.ensemble })).nextCalled, true);
});

test("missing/corrupt/unreadable/version/unknown artifact fail explicitly, without reader fallback", async () => {
  let reads = 0;
  const missing = createFairArtifactLoader(async () => {
    reads++; throw Object.assign(new Error("private filesystem detail"), { code: "ENOENT" });
  });
  for (const [input, code] of [
    [{ ...selection, version: "latest" }, "FAIR_VERSION_MISMATCH"],
    [{ ...selection, manifestSha256: "0".repeat(64) }, "FAIR_VERSION_MISMATCH"],
    [{ ...selection, ensembleSha256: "0".repeat(64) }, "FAIR_VERSION_MISMATCH"],
    [{ ...selection, memberIdsSha256: "0".repeat(64) }, "FAIR_VERSION_MISMATCH"],
    [{ ...selection, artifactId: "../private" }, "FAIR_ARTIFACT_UNKNOWN"],
    [{ artifactId }, "FAIR_SELECTION_INVALID"],
    [{ ...selection, extra: true }, "FAIR_SELECTION_INVALID"],
  ] as const) await assert.rejects(missing(input), (error: any) => error.code === code);
  assert.equal(reads, 0);
  await assert.rejects(missing(selection), (e: any) => e.code === "FAIR_ARTIFACT_MISSING");
  const corrupt = createFairArtifactLoader(async () => Buffer.from('{"scientificallyAccepted":true}'));
  await assert.rejects(corrupt(selection), (e: any) => e.code === "FAIR_ARTIFACT_CORRUPT");
  const unreadable = createFairArtifactLoader(async () => { throw new Error("private detail"); });
  await assert.rejects(unreadable(selection), (e: any) => e.code === "FAIR_ARTIFACT_UNREADABLE");
  for (const loader of [missing, corrupt, unreadable]) {
    for (const route of [get("manifest"), get("ensemble"), get("summary"), get("members/:memberId"),
      "POST /api/calculation/ensemble-summary", "POST /api/calculation/validate-history"]) {
      const call = captureFairHandlers(loader);
      const response = await call(route, { ...request, body: {
        artifactSelection: selection, ...(route.endsWith("validate-history") ? { simulationKind: "total", reference: {} } : {}),
      } });
      assert.equal(response.status, 503, route);
      assert.equal(response.body.fallbackUsed, false);
      assert.equal(JSON.stringify(response.body).includes("private"), false);
    }
  }
});

test("member/hash/path ambiguity refuses; selected data never silently ignored on unsupported surfaces", async () => {
  const call = captureFairHandlers();
  assert.equal((await call(get("manifest"), { ...request, query: { ...query, artifactId: "other" } })).status, 400);
  assert.equal((await call(get("members/:memberId"), {
    ...request, params: { artifactId, memberId: "engineering-a" }, query: { ...query, memberSha256: "0".repeat(64) },
  })).body.code, "FAIR_MEMBER_HASH_MISMATCH");
  assert.equal((await call(get("members/:memberId"), {
    ...request, params: { artifactId, memberId: "missing" },
  })).body.code, "FAIR_MEMBER_MISSING");
  for (const route of fairRouteInventory.filter(r => !r.artifactConsumer && !r.path.includes("fair-artifacts"))) {
    const selected = await call("middleware", { path: route.path, body: { artifactSelection: selection } });
    assert.equal(selected.status, 409, route.path);
    assert.equal((await call("middleware", { path: route.path })).nextCalled, true, route.path);
  }
});

test("inventory covers every projection route and existing default/frozen gates remain unpromoted", () => {
  const routes = readFileSync("server/routes.ts", "utf8");
  const paths = [...routes.matchAll(/app\.get\("(\/api\/projection[^"]*)"/g)].map(match => match[1]).sort();
  assert.deepEqual(fairRouteInventory.filter(r => r.path.startsWith("/api/projection")).map(r => r.path).sort(), paths);
  assert.match(routes, /req\.query\.engine !== undefined && req\.query\.engine !== "legacy"/);
  assert.match(routes, /req\.query\.engine === "fair" \? 409 : 400/);
  const readiness = calculationReadiness();
  assert.equal(readiness.candidateEnabled, false);
  assert.ok(readiness.checks.every(check => check.passed === false));
  for (const file of ["fairArtifacts.ts", "fairArtifactCatalog.ts", "fairArtifactRoutes.ts"]) {
    const source = readFileSync(`server/calculation/${file}`, "utf8");
    assert.doesNotMatch(source, /from ["'](?:node:)?child_process|spawn\s*\(|exec(?:File|Sync)?\s*\(|fetch\s*\(|writeFile\s*\(/);
  }
  assert.equal(new Set(fairArtifactCatalog.map(e => e.manifest.artifactId)).size, 16);
  assert.ok(fairArtifactCatalog.every(e => fairSha256(JSON.stringify(e.manifest)) === e.manifestSha256));
  assert.ok(new FairArtifactError("X", 409, "test") instanceof Error);
});
