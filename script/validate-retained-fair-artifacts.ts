import assert from "node:assert/strict";
import { fairArtifactCatalog, fairArtifactSelection, fairSha256 } from "../server/calculation/fairArtifactCatalog";
import { loadFairArtifact, fairMember } from "../server/calculation/fairArtifacts";
import { summarizeEnsemble } from "../server/calculation/ensemble";
import { registerFairArtifactRoutes } from "../server/calculation/fairArtifactRoutes";
import type { Express } from "express";

/** Read-only validation of ACTUAL retained bytes. No Python, model execution,
 * downloading, fixture fallback, old study rerun, output rewriting or promotion.
 * Run separately from engineering route tests:
 * npx tsx script/validate-retained-fair-artifacts.ts
 * Missing private files must FAIL, not skip or substitute synthetic fixtures. */
const evidence = [];
const handlers = new Map<string, (...args: any[]) => any>();
registerFairArtifactRoutes({
  get: (path: string, handler: (...args: any[]) => any) => handlers.set(`GET ${path}`, handler),
  post: (path: string, handler: (...args: any[]) => any) => handlers.set(`POST ${path}`, handler),
  use: () => undefined,
} as unknown as Express);
async function invoke(route: string, request: unknown) {
  let body: any, status = 200;
  const response = {
    set: () => response, status: (value: number) => { status = value; return response; },
    json: (value: unknown) => { body = value; return response; },
  };
  await handlers.get(route)!({ query: {}, params: {}, ...request as object }, response,
    () => { throw new Error("Selected retained artifact unexpectedly fell through"); });
  assert.equal(status, 200, JSON.stringify(body));
  assert.equal(body.modelPromoted, false);
  assert.equal(body.scientificAcceptance, "not-accepted");
  return body;
}
for (const entry of fairArtifactCatalog) {
  const loaded = await loadFairArtifact(fairArtifactSelection(entry));
  const summary = summarizeEnsemble(loaded.ensemble);
  const endpoint = loaded.provenance.annual2100P10P50P90C as number[];
  for (const [i, actual] of [summary.headline.p10, summary.headline.median, summary.headline.p90].entries())
    assert.ok(Math.abs(actual - endpoint[i]) < 1e-12, "Retained endpoint summary mismatch");
  const members = loaded.ensemble.memberIds.map(memberId => {
    const member = fairMember(loaded, memberId);
    const baseline = member.years.flatMap((year, i) => year >= 1850 && year <= 1900 ? [member.temperature[i]] : []);
    assert.equal(baseline.length, 51);
    assert.ok(Math.abs(baseline.reduce((a, b) => a + b, 0) / 51) < 1e-12, "Member baseline mismatch");
    return { memberId, memberSha256: member.memberSha256 };
  });
  const { artifactId, ...query } = loaded.identity;
  // resultSha256 is returned provenance, not a selection parameter.
  const { resultSha256: _result, ...selectionQuery } = query;
  const request = { params: { artifactId }, query: selectionQuery };
  const base = "GET /api/calculation/fair-artifacts/:artifactId/";
  const manifest = await invoke(`${base}manifest`, request);
  assert.deepEqual(manifest.members, members);
  const served = await invoke(`${base}ensemble`, request);
  assert.equal(fairSha256(JSON.stringify(served.ensemble)), fairSha256(JSON.stringify(loaded.ensemble)));
  const summarized = await invoke(`${base}summary`, request);
  assert.deepEqual(summarized.summary, summary);
  const member = await invoke(`${base}members/:memberId`, {
    params: { artifactId, memberId: members[0].memberId },
    query: { ...selectionQuery, memberSha256: members[0].memberSha256 },
  });
  assert.deepEqual(member.member, fairMember(loaded, members[0].memberId));
  const posted = await invoke("POST /api/calculation/ensemble-summary", {
    body: { artifactSelection: fairArtifactSelection(entry) },
  });
  assert.deepEqual(posted.headline, summary.headline);
  // Compatibility test against the retained run's own window, explicitly NOT
  // an independent reference or scientific acceptance test.
  const historical = await invoke("POST /api/calculation/validate-history", {
    body: { artifactSelection: fairArtifactSelection(entry), simulationKind: "total", reference: {
      source: "https://github.com/OMS-NetZero/FAIR", kind: "total", baseline: "1850-1900",
      startYear: 2003, endYear: 2022, lower: -100, upper: 100,
    } },
  });
  assert.equal(historical.status, "range-diagnostic-not-independent-validation");
  assert.deepEqual(historical.artifact, loaded.identity);
  evidence.push({ ...loaded.identity, fairVersion: loaded.manifest.fairVersion,
    upstreamRevision: loaded.manifest.upstreamRevision, members: members.length,
    orderedMemberHashesSha256: fairSha256(JSON.stringify(members)), firstMember: members[0],
    lastMember: members.at(-1), years: [1750, 2100], baseline: "1850-1900",
    endpointP10P50P90C: endpoint, scientificAcceptance: "not-accepted",
    checks: ["pinned-result-and-ensemble-bytes", "four-pinned-upstream-input-files",
      "exact-calibration-member-order", "finite-rectangular-351-by-841", "per-member-baseline",
      "retained-endpoint-summary-consistency", "all-member-series-hashes",
      "six-actual-registered-artifact-consumer-handlers-with-real-loader-no-app-launch"] });
}
console.log(JSON.stringify({ check: "actual-retained-artifact-validator-not-source-only-test",
  artifacts: evidence, passed: true, modelExecution: false, scientificPromotion: false,
  limitations: ["Hashes bind retained content, not publication vintage or independent annual reference accuracy.",
    "Conditional controls and minor-gas histories remain unapproved.",
    "No current-policy/all-commitments production ensemble or coherent emissions/valuation migration is certified.",
    "No physical NetCDF, anthropogenic attribution, 10k convergence or point-in-time holdout acceptance is supplied."] }, null, 2));
