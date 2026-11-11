import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync, mkdtempSync, writeFileSync, rmSync, unlinkSync, symlinkSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import * as XLSX from "xlsx";
import { contentHash } from "../server/calculation/analysisManifest";
import { assessTrackBAdmission } from "../server/calculation/trackBAdmission";
import { runPairedResearchPipeline } from "../server/calculation/pairedResearchPipeline";
import { bindTrackBAdmission, trackBAdmissionSchema, trackBAdmissionSemantics,
  trackBAdmissionExportDocument, trackBAdmissionHttpSemantics,
  trackBAdmissionExportLeafBindings } from "../shared/trackBAdmissionContract";
import { buildTrackBAdmissionWorkbook, trackBAdmissionWorkbookTables,
  trackBWorkbookReasonBindings, trackBWorkbookIdentityFields } from "../server/calculation/trackBAdmissionWorkbook";
import { outputFieldSemantics } from "../shared/outputFieldSemantics";
import { registerTrackBAdmissionRoutes } from "../server/trackBAdmissionApi";
import { trackBPeriodDomainHash, createTrackBPublicationReader, validateTrackBPublication } from "../server/trackBDisclosureStore";
import { trackBPublicCatalog } from "../server/trackBPublicCatalog";
import { TRACK_B_PUBLIC_PREREQUISITE, trackBPublicCatalogSchema, trackBPublicCatalogSemantics } from "../shared/trackBDisclosureContract";
import { fetchTrackBCatalog, fetchTrackBReport, trackBReportUrl } from "../client/src/lib/trackBPublicReports";
import { TrackBResearch, type TrackBResearchReadState } from "../client/src/components/track-b-research";
import { publishPinnedTrackBReport } from "../server/trackBDisclosurePublisher";
import { releaseSafety } from "../server/releaseSafety";

/** Explicit synthetic negative engineering corpus. Claimed original metadata is
 * deliberately NOT authenticated historical evidence and cannot earn Track B. */
function fixture(options: {
  periods?: number; missingRoot?: boolean; missingStage9?: boolean; lag?: number | null;
  stage9Class?: string; fitThrough?: string; restatedCompany?: string; publishedAt?: string;
} = {}) {
  const spec = { model: "engineering-gordon-only", peer: "sector", target: "next-month" };
  const protocol = {
    evidenceMode: "revised-history", primaryEndpoints: ["evaluation-r2", "signal-ic", "after-cost-long-short"],
    specifications: [spec], expectedOrigins: ["2020-02-29T00:00:00Z", "2020-04-30T00:00:00Z"],
    frozenAt: "2019-01-01T00:00:00Z", evaluationStart: "2020-02-29T00:00:00Z", evaluationEnd: "2021-01-01T00:00:00Z",
    embargoDays: 2, blockLength: 1, repetitions: 200, seed: 1, currency: "USD", geography: "engineering-only",
    quantile: .5, weighting: "equal-within-sector", costBps: 25, sensitivityCostBps: [], borrowRateMultipliers: [1],
    terminalStresses: [0, -.3, -1], disclosure: "locked retrospective evaluation (prior exposure: 2020 onward)",
    ...(options.lag === null ? {} : { trackBPolicy: { filingLagDays: options.lag ?? 5 } }),
  };
  const corpus: any = { mode: "point-in-time", dataEnd: "2021-01-01T00:00:00Z", artifacts: [], periods: [] };
  const archive = (payload: unknown, availableAt = "2020-01-01T00:00:00Z") => {
    const hash = contentHash(payload);
    if (!corpus.artifacts.some((a: any) => a.hash === hash)) corpus.artifacts.push({
      hash, payload, originUri: `engineering-fixture://NOT-HISTORICAL/${hash}`, availableAt, capturedAt: availableAt, vintage: "original",
    });
    return hash;
  };
  const ids = ["engineering-alpha", "engineering-beta"];
  const universeHash = archive([...ids].sort());
  const source = archive({ engineeringOnly: true, input: "NO PROVIDER HISTORY" });
  const parametersHash = archive({ engineeringOnly: true, parameters: [1, 2] });
  const fittedThrough = options.fitThrough ?? "2019-12-31T00:00:00Z";
  const parameterFitManifestHash = archive({
    contract: "stage9-parameter-fit-1", model: spec.model, fittedThrough, parametersHash, inputHashes: [source],
  });
  for (let index = 0; index < (options.periods ?? 1); index++) {
    const origin = protocol.expectedOrigins[index];
    const definition = { currency: "USD", basis: "FCFE", horizonYears: 5, growthDefinition: "five-year-CAGR", nominal: true };
    const filings: { companyId: string; artifactHash: string }[] = [];
    const securities = ids.map((companyId, i) => {
      const projectionManifest = archive({ companyId, model: spec.model, origin, definition, members: [{ id: "member", growth: .02 + i * .01 }] });
      const valuationManifest = archive({ companyId, model: spec.model, origin, definition, members: [{ id: "member", growth: 0 }] });
      const publishedAt = options.publishedAt ?? "2019-12-10T00:00:00Z";
      const sourceDocumentHash = archive({ engineeringOnly: true, companyId, originalDocument: "SYNTHETIC NEGATIVE CONTRACT FIXTURE" }, publishedAt);
      const artifactHash = archive({ contract: "original-filing-lineage-1", companyId, original: true,
        restated: companyId === options.restatedCompany, publishedAt, fiscalEnd: "2019-09-30T00:00:00Z",
        valuationManifestHash: valuationManifest, sourceDocumentHash }, publishedAt);
      filings.push({ companyId, artifactHash });
      return {
        companyId, numericId: i + 1, sector: "engineering-sector", marketCap: 1000, informationAvailableAt: origin,
        pair: { origin, companyId, peer: "engineering-sector", projectionManifest, valuationManifest,
          projectionDefinition: definition, valuationDefinition: definition, projectionAvailableAt: origin, valuationAvailableAt: origin,
          members: [{ id: "member", projectedGrowth: .02 + i * .01, impliedGrowth: 0 }] },
        controls: [0, 0, 0, 0, 0, 0, 0], baselineGrowth: .03, transitionDemand: 0, carbonDrag: 0, intensity: .1,
        executionPrice: 100, executionFx: 1, endPrice: 100, endFx: 1, splitRatio: 1, dividends: 0, terminalProceeds: 0,
        lifecycle: "continuing", borrowAvailable: true, borrowAnnualRate: .01, assumedBorrowAnnualRate: .03,
        sourceHashes: [source, artifactHash, sourceDocumentHash],
      };
    });
    const stage9ManifestHash = options.missingStage9 ? "f".repeat(64) : archive({
      contract: "stage9-retrospective-lineage-1", specification: spec, origin, informationCutoff: origin,
      classification: options.stage9Class ?? "retrospective-simulation-on-verified-past-inputs",
      parameterFitThrough: fittedThrough, parameterFitManifestHash, inputHashes: [source],
      projectionManifestHashes: securities.map(s => s.pair.projectionManifest),
    });
    const trackBManifestHash = archive({ contract: "track-b-period-manifest-1", specification: spec,
      origin, informationCutoff: origin, stage9ManifestHash, filings });
    corpus.periods.push({
      specification: spec, origin, executionAt: index ? "2020-05-01T00:00:00Z" : "2020-03-01T00:00:00Z",
      endAt: index ? "2020-06-01T00:00:00Z" : "2020-04-01T00:00:00Z",
      outcomeAvailableAt: index ? "2020-06-01T00:00:00Z" : "2020-04-01T00:00:00Z", universeHash,
      ...(options.missingRoot ? {} : { trackBManifestHash }), expectedCompanyIds: ids, securities,
      cashAnnualRate: 0, financingAnnualRate: .04,
      factors: { currency: "USD", geography: "engineering-only", sourceHashes: [source], regionalDeveloped: [0], workbookUniverse: [0] },
    });
  }
  return { protocol, corpus };
}
const assess = (f: ReturnType<typeof fixture>) => assessTrackBAdmission(f.protocol, contentHash(f.protocol), f.corpus);
const codes = (row: ReturnType<typeof assess>["periods"][number]) => row.reasons.map(r => r.code);
test("exact S15-017 criterion and Stage9 AND original-filing amendment are retained", () => {
  const ledger = readFileSync("docs/WORKPLAN_COMPLETION_LEDGER.md", "utf8");
  assert.match(ledger, /### S15-017[^\n]*\nTrack B shows “unavailable” for every period failing its evidence requirements\./);
  assert.ok(ledger.includes("projections are retrospective simulations on verified past inputs (Stage 9) and fundamentals are original, not restated, filings"));
});
test("every frozen period remains present with exact unavailable reasons; no mode-only or current-data substitution", () => {
  const f = fixture({ missingRoot: true }), before = contentHash(f);
  const report = assess(f);
  assert.equal(report.periods.length, 2);
  const [present, absent] = report.periods;
  assert.ok(codes(present).includes("missing-period-manifest"));
  assert.ok(codes(present).includes("missing-stage9-lineage"));
  for (const id of f.corpus.periods[0].expectedCompanyIds)
    assert.ok(present.reasons.some(r => r.code === "missing-original-filing" && r.companyId === id));
  assert.ok(codes(absent).includes("missing-period"));
  for (const row of report.periods) {
    assert.equal(row.status, "unavailable"); assert.equal(row.result, null);
    assert.equal(row.informationCutoff, row.origin);
    assert.ok(codes(row).includes("stage9-independent-review-unavailable"));
    assert.ok(codes(row).includes("original-filing-independent-review-unavailable"));
  }
  assert.equal(contentHash(f), before);
  f.corpus.periods[0].trackBManifestHash = null;
  assert.ok(codes(assess(f).periods[0]).includes("missing-period-manifest"), "Explicit null is unavailable, not zero or a global survivor filter");
});
test("Stage9 and original filings are separately conjunctive; structural passes never authenticate fixtures", () => {
  const original = fixture({ periods: 2 }), complete = assess(original);
  assert.ok(complete.periods.every(p => p.stage9ContractSatisfied && p.originalFilingsContractSatisfied));
  assert.ok(complete.periods.every(p => p.status === "unavailable" && p.result === null && p.reasons.length === 5));
  assert.ok(complete.periods.every(p => p.reasons.filter(r => r.code === "original-filing-independent-review-unavailable").length === 2));
  assert.ok(complete.periods.every(p => p.reasons.every(r => r.artifactHash !== null)));
  for (const period of complete.periods) for (const id of ["engineering-alpha", "engineering-beta"]) {
    const documentHash = original.corpus.artifacts.find((a: any) =>
      a.payload.contract === "original-filing-lineage-1" && a.payload.companyId === id).payload.sourceDocumentHash;
    assert.ok(period.reasons.some(r => r.code === "original-source-document-independent-review-unavailable" &&
      r.companyId === id && r.artifactHash === documentHash), "Real underlying source document hash retained without its bytes");
  }
  assert.equal(complete.authenticityVerified, false);
  const noStage9 = assess(fixture({ missingStage9: true })).periods[0];
  assert.equal(noStage9.stage9ContractSatisfied, false);
  assert.equal(noStage9.originalFilingsContractSatisfied, true);
  assert.ok(noStage9.reasons.some(r => r.code === "missing-artifact" && r.artifactHash === "f".repeat(64)));
  const restated = assess(fixture({ restatedCompany: "engineering-alpha" })).periods[0];
  assert.equal(restated.stage9ContractSatisfied, true);
  assert.equal(restated.originalFilingsContractSatisfied, false);
  assert.ok(restated.reasons.some(r => r.code === "restated-or-non-original-filing" && r.companyId === "engineering-alpha"));
  assert.ok(!restated.reasons.some(r => r.code === "restated-or-non-original-filing" && r.companyId === "engineering-beta"));
});
test("actual period cutoffs, precommitted filing lag and parameter-fit dates fail the precise affected periods", () => {
  const late = assess(fixture({ periods: 2, publishedAt: "2020-03-20T00:00:00Z" }));
  assert.ok(codes(late.periods[0]).includes("filing-published-after-origin"));
  assert.ok(codes(late.periods[0]).includes("filing-lag-after-origin"));
  assert.equal(late.periods[1].originalFilingsContractSatisfied, true);
  const unfrozen = assess(fixture({ lag: null })).periods[0];
  assert.ok(codes(unfrozen).includes("filing-lag-not-frozen"));
  const futureFit = assess(fixture({ periods: 2, fitThrough: "2020-03-01T00:00:00Z" }));
  assert.ok(codes(futureFit.periods[0]).includes("future-parameter-fit"));
  assert.ok(!codes(futureFit.periods[1]).includes("future-parameter-fit"));
  assert.ok(codes(assess(fixture({ stage9Class: "revised-history" })).periods[0]).includes("stage9-not-retrospective"));
});
test("hash/manifest/identity/capture failures are period failures, not authenticity or global survivor selection", () => {
  let f = fixture({ periods: 2 });
  const rootHash = f.corpus.periods[0].trackBManifestHash;
  f.corpus.artifacts.find((a: any) => a.hash === rootHash).payload.origin = "2025-01-01T00:00:00Z";
  assert.ok(codes(assess(f).periods[0]).includes("payload-hash-mismatch"));
  assert.equal(assess(f).periods[1].stage9ContractSatisfied, true);
  f = fixture();
  f.corpus.artifacts.find((a: any) => a.hash === f.corpus.periods[0].universeHash).capturedAt = "2020-03-01T00:00:00Z";
  assert.ok(codes(assess(f).periods[0]).includes("not-retained-at-origin"));
  f = fixture(); f.corpus.dataEnd = "2020-03-15T00:00:00Z";
  assert.ok(codes(assess(f).periods[0]).includes("incomplete-outcome"));
  f = fixture(); f.corpus.periods[0].securities.pop();
  assert.ok(assess(f).periods[0].reasons.some(r => r.code === "missing-company" && r.companyId === "engineering-beta"));
  assert.throws(() => assessTrackBAdmission(f.protocol, "0".repeat(64), f.corpus), /protocol hash mismatch/);
});
test("actual research pipeline embeds exact period admission JSON and withholds historical efficacy", () => {
  const f = fixture();
  // Reduce this synthetic negative integration to one frozen date; no historical inference.
  f.protocol.expectedOrigins = [f.protocol.expectedOrigins[0]];
  const result = runPairedResearchPipeline(f.protocol, contentHash(f.protocol), f.corpus);
  assert.deepEqual(result.trackBAdmission, assess(f));
  assert.match(result.tracks.B, /^unavailable:.*every frozen period/);
  assert.equal(result.efficacy, "WITHHELD");
  assert.equal(result.investmentEvidence, false);
  assert.equal(result.scientificAcceptance, false);
  assert.equal(result.family.tests.filter(t => t.passed).length, 0);
});
test("exact API/export semantics preserve every failed period/reason, dates, hashes and explicit null result", async () => {
  const report = assess(fixture({ restatedCompany: "engineering-alpha" }));
  const bound = bindTrackBAdmission(report);
  assert.equal(bound.ids.length, 23);
  assert.equal(trackBAdmissionHttpSemantics.length, 1);
  assert.equal(trackBAdmissionHttpSemantics[0].id, "trackBAdmissionHttp.error");
  assert.deepEqual(bound.ids, trackBAdmissionSemantics.map(s => s.id).sort());
  for (const semantic of trackBAdmissionSemantics)
    for (const key of ["meaning", "formula", "unit", "source", "period", "missingness", "uncertainty", "scope", "asOfRule"] as const)
      assert.ok(semantic[key].length > 5);
  const document = trackBAdmissionExportDocument(report);
  assert.equal(document.rows.length, report.periods.reduce((n, p) => n + p.reasons.length, 0));
  assert.ok(document.rows.every(row => row["Track B status"] === "unavailable" && row["Track B result"] === null));
  assert.equal(Object.keys(document.columnBindings).length, 18);
  assert.deepEqual(JSON.parse(JSON.stringify(document)), document);
  const paths = (value: unknown, path = ""): string[] => {
    if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, child]) =>
      paths(child, Array.isArray(value) && (path.startsWith("report.") || path === "rows")
        ? `${path}[]` : path ? `${path}.${key}` : key));
    return [path];
  };
  assert.deepEqual(Array.from(new Set(paths(document))).sort(), Object.keys(trackBAdmissionExportLeafBindings()).sort());
  for (const row of document.rows) assert.deepEqual(Object.keys(row).sort(), Object.keys(document.columnBindings).sort());
  assert.ok(!JSON.stringify(document).includes("engineering-fixture://"));
  assert.ok(!JSON.stringify(document).includes("SYNTHETIC NEGATIVE CONTRACT FIXTURE"));
  assert.throws(() => trackBAdmissionSchema.parse({ ...report, periods: [{ ...report.periods[0], result: 0 }] }));
  const app = express();
  app.use(releaseSafety());
  registerTrackBAdmissionRoutes(app, hash => {
    const identity = { protocolHash: report.protocolHash, reportHash: contentHash(report),
      disclosureHash: contentHash({ syntheticUnitIdentity: true }), pipelineResultHash: contentHash({ syntheticPipelineIdentity: true }),
      periodDomainHash: trackBPeriodDomainHash(report) };
    if (hash === report.protocolHash || hash === "e".repeat(64)) return { report, identity };
    if (hash === "d".repeat(64)) return { identity, report: { ...report, protocolHash: hash,
      periods: [{ ...report.periods[0], result: 0 }] } } as any;
    return undefined;
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/research/track-b-admission`;
  try {
    const query = `?protocolHash=${report.protocolHash}`;
    const response = await fetch(`${base}${query}`);
    assert.deepEqual(await response.json(), report);
    assert.deepEqual(response.headers.get("x-field-semantics")!.split(",").sort(), bound.ids);
    assert.deepEqual(await (await fetch(`${base}/export.json${query}`)).json(), document);
    const refusal = await fetch(base);
    assert.equal(refusal.status, 400);
    assert.equal(refusal.headers.get("x-field-semantics"), "trackBAdmissionHttp.error");
    assert.equal((await fetch(`${base}${query}&origin=2025`)).status, 400);
    assert.equal((await fetch(`${base}?protocolHash=${"0".repeat(64)}`)).status, 404);
    for (const hash of ["e".repeat(64), "d".repeat(64)])
      assert.equal((await fetch(`${base}?protocolHash=${hash}`)).status, 503, "Wrong protocol or invented zero result must refuse");
    assert.equal((await fetch(`${base}${query}`, { method: "POST" })).status, 403);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
test("unconfigured API instance explicitly503; production index installs genuine source-pinned disclosure reader", async () => {
  const index = readFileSync("server/index.ts", "utf8");
  assert.ok(index.indexOf("registerTrackBAdmissionRoutes(app, loadPublishedTrackBAdmission)") > index.indexOf("app.use(releaseSafety())"));
  for (const s of [...trackBAdmissionSemantics, ...trackBAdmissionHttpSemantics])
    assert.deepEqual(outputFieldSemantics.filter(v => v.id === s.id), [s]);
  const app = express(); app.use(releaseSafety()); registerTrackBAdmissionRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try {
    for (const suffix of ["", "/export.json"]) {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/research/track-b-admission${suffix}?protocolHash=${"a".repeat(64)}`);
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("x-field-semantics"), "trackBAdmissionHttp.error");
      assert.deepEqual(await response.json(), { error: "Authorized public retained pipeline report resolver is not provisioned; API report engineering remains incomplete" });
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
test("actual pipeline CLI produces immutable JSON/XLSX and unreviewed disclosure candidate; DEV-only pinned publication roundtrip", async () => {
  const f = fixture({ restatedCompany: "engineering-alpha" });
  const report = assess(f), document = trackBAdmissionExportDocument(report);
  const tables = trackBAdmissionWorkbookTables(report);
  assert.equal(tables.reasons.length, document.rows.length);
  assert.equal(tables.definitions.length, 23);
  assert.equal(tables.bindings.length, 18);
  const buffer = buildTrackBAdmissionWorkbook(report);
  assert.ok(buffer.equals(buildTrackBAdmissionWorkbook(report)), "Deterministic workbook, no live metadata timestamp");
  const book = XLSX.read(buffer, { type: "buffer" });
  assert.deepEqual(book.SheetNames, ["Period reasons", "Assessment identity", "Field semantics", "Column bindings"]);
  const decode = (row: Record<string, unknown>) => Object.fromEntries(Object.entries(row).map(([column, value]) =>
    [column, trackBWorkbookReasonBindings[column].transform.startsWith("JSON.stringify") ? JSON.parse(value as string) : value]));
  assert.deepEqual(XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets["Period reasons"]).map(decode), document.rows);
  const identity = XLSX.utils.sheet_to_json<{ Field: keyof typeof report; "JSON value": string }>(book.Sheets["Assessment identity"]);
  assert.deepEqual(identity.map(row => row.Field), [...trackBWorkbookIdentityFields]);
  for (const row of identity) assert.deepEqual(JSON.parse(row["JSON value"]), report[row.Field]);
  assert.ok(!JSON.stringify(tables).includes("SYNTHETIC NEGATIVE CONTRACT FIXTURE"));
  const directory = mkdtempSync(join(tmpdir(), "track-b-negative-engineering-"));
  try {
    const protocolPath = join(directory, "protocol.json"), corpusPath = join(directory, "corpus.json");
    writeFileSync(protocolPath, JSON.stringify(f.protocol)); writeFileSync(corpusPath, JSON.stringify(f.corpus));
    const run = () => spawnSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"),
      resolve("script/run-paired-research-pipeline.ts"), protocolPath, contentHash(f.protocol), corpusPath],
    { cwd: directory, encoding: "utf8", timeout: 120000 });
    const execution = run(); assert.equal(execution.status, 0, execution.stderr);
    const output = JSON.parse(execution.stdout), retained = JSON.parse(readFileSync(join(directory, output.path), "utf8"));
    assert.deepEqual(retained.trackBAdmission, report);
    assert.ok(output.path.endsWith(`${contentHash(retained)}.json`));
    assert.ok(output.trackBWorkbookPath.endsWith(`${contentHash(retained)}-track-b-admission.xlsx`));
    const actual = XLSX.read(readFileSync(join(directory, output.trackBWorkbookPath)), { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json<Record<string, unknown>>(actual.Sheets["Period reasons"]).map(decode), document.rows);
    assert.equal(output.efficacy, "WITHHELD"); assert.equal(output.scientificAcceptance, false);
    const repeated = run(); assert.equal(repeated.status, 0, repeated.stderr);
    assert.deepEqual(JSON.parse(repeated.stdout), output, "Existing identical artifacts are preserved, not rewritten");
    const draft = JSON.parse(readFileSync(join(directory, output.disclosureDraftPath), "utf8"));
    assert.equal(draft.status, "unpublished"); assert.deepEqual(draft.review, { kind: "not-reviewed" });
    assert.deepEqual(JSON.parse(readFileSync(join(directory, output.reportPath), "utf8")), report);
    assert.equal(draft.pipelineResultHash, contentHash(retained));
    const disclosure = { ...draft, status: "published", classification: "engineering-fixture",
      review: { kind: "synthetic-development-only", qualification: "Synthetic authorization for isolated DEV engineering only; no real approval" } };
    const pin = { protocolHash: report.protocolHash, reportHash: contentHash(report),
      pipelineResultHash: contentHash(retained), disclosureHash: contentHash(disclosure), periodDomainHash: trackBPeriodDomainHash(report) };
    const pipelineRoot = join(directory, "generated-artifacts/paired-research-pipeline"), publicRoot = join(directory, "public-only");
    writeFileSync(join(pipelineRoot, `${pin.disclosureHash}.disclosure.json`), JSON.stringify(disclosure));
    const environment = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "development";
      const options = { catalog: [pin], pipelineRoot, publicRoot, allowEngineeringFixtures: true };
      await publishPinnedTrackBReport(pin.protocolHash, options);
      await publishPinnedTrackBReport(pin.protocolHash, options);
      assert.deepEqual((await createTrackBPublicationReader({ root: publicRoot, catalog: [pin], allowEngineeringFixtures: true })(pin.protocolHash)).report, report);
      await assert.rejects(publishPinnedTrackBReport(pin.protocolHash, { pipelineRoot, publicRoot }), /cannot grant approval/);
      process.env.NODE_ENV = "production";
      await assert.rejects(createTrackBPublicationReader({ root: publicRoot, catalog: [pin], allowEngineeringFixtures: true })(pin.protocolHash), /not authorized/);
    } finally { if (environment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = environment; }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
function disclosureFixture() {
  const protocol = { frozenAt: "2019-01-01T00:00:00Z", trackBPolicy: { filingLagDays: 5 },
    specifications: [{ model: "SYNTHETIC-DEV-ONLY", peer: "sector", target: "next-month" }],
    expectedOrigins: ["2020-02-29T00:00:00Z", "2020-04-30T00:00:00Z"] };
  const corpus = { mode: "engineering-fixture", dataEnd: "2021-01-01T00:00:00Z", artifacts: [], periods: [] };
  const report = assessTrackBAdmission(protocol, contentHash(protocol), corpus);
  const disclosure = { contract: "track-b-public-disclosure-1", status: "published", classification: "engineering-fixture",
    protocolHash: report.protocolHash, reportHash: contentHash(report), pipelineResultHash: contentHash({ engineeringOnly: true, trackBAdmission: report }),
    corpusHash: report.corpusHash, periodDomainHash: trackBPeriodDomainHash(report), providerPayloadIncluded: false,
    review: { kind: "synthetic-development-only", qualification: "Synthetic authorization for isolated DEV engineering only; no real approval" },
    scientificAcceptance: false, investmentEvidence: false };
  const pin = { protocolHash: report.protocolHash, reportHash: contentHash(report), disclosureHash: contentHash(disclosure),
    pipelineResultHash: disclosure.pipelineResultHash, periodDomainHash: disclosure.periodDomainHash };
  return { report, disclosure, pin };
}
const catalogFor = (f: ReturnType<typeof disclosureFixture>) => trackBPublicCatalogSchema.parse({
  contract: "track-b-public-catalog-1", reports: [f.pin], availability: "Pinned publications; retained bytes validated on exact selection",
  operatorPrerequisite: TRACK_B_PUBLIC_PREREQUISITE, scientificAcceptance: false, investmentEvidence: false,
});
test("genuine production catalog has no fabricated real approvals; exact operator publication prerequisite and11 registered metadata definitions", async () => {
  assert.equal(trackBPublicCatalog.length, 0);
  await assert.rejects(createTrackBPublicationReader()("a".repeat(64)), /No source-authorized/);
  assert.match(TRACK_B_PUBLIC_PREREQUISITE, /redistribution rights/);
  assert.match(TRACK_B_PUBLIC_PREREQUISITE, /reviewed source change/);
  assert.equal(trackBPublicCatalogSemantics.length, 11);
  for (const s of trackBPublicCatalogSemantics) assert.deepEqual(outputFieldSemantics.filter(v => v.id === s.id), [s]);
});
test("trusted source pin and retained disclosure refuse unpublished/unreviewed/hash/domain/private keys and production synthetic authorization", () => {
  const f = disclosureFixture(), previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    assert.deepEqual(validateTrackBPublication(f.pin, f.disclosure, f.report, true).report, f.report);
    for (const change of [{ status: "unpublished" }, { review: { kind: "not-reviewed" } }]) {
      const disclosure = { ...f.disclosure, ...change }, pin = { ...f.pin, disclosureHash: contentHash(disclosure) };
      assert.throws(() => validateTrackBPublication(pin, disclosure, f.report, true), /unpublished|authorization/);
    }
    assert.throws(() => validateTrackBPublication({ ...f.pin, reportHash: "0".repeat(64) }, f.disclosure, f.report, true), /hash mismatch/);
    const disclosure = { ...f.disclosure, periodDomainHash: "1".repeat(64) };
    assert.throws(() => validateTrackBPublication({ ...f.pin, periodDomainHash: disclosure.periodDomainHash,
      disclosureHash: contentHash(disclosure) }, disclosure, f.report, true), /identity mismatch/);
    assert.throws(() => validateTrackBPublication(f.pin, f.disclosure, { ...f.report, providerPayload: "DO NOT PUBLISH" }, true));
    process.env.NODE_ENV = "production";
    assert.throws(() => validateTrackBPublication(f.pin, f.disclosure, f.report, true), /not authorized/);
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
test("actual DEV filesystem resolver HTTP JSON/XLSX/client hashes preserve absent periods and refuse missing/corrupt/changed/unauthorized paths", async () => {
  const f = disclosureFixture(), root = mkdtempSync(join(tmpdir(), "track-b-public-DEV-")), previous = process.env.NODE_ENV;
  const reportPath = join(root, `${f.pin.reportHash}.report.json`), disclosurePath = join(root, `${f.pin.disclosureHash}.disclosure.json`);
  const save = () => { writeFileSync(reportPath, JSON.stringify(f.report)); writeFileSync(disclosurePath, JSON.stringify(f.disclosure)); };
  save(); process.env.NODE_ENV = "development";
  const reader = createTrackBPublicationReader({ root, catalog: [f.pin], allowEngineeringFixtures: true });
  let activeReader = reader;
  const app = express(); app.use(releaseSafety()); registerTrackBAdmissionRoutes(app, hash => activeReader(hash), [f.pin]);
  const server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const localFetch = ((input: RequestInfo | URL, init?: RequestInit) => fetch(`${base}${input}`, init)) as typeof fetch;
  try {
    assert.deepEqual(await fetchTrackBCatalog(localFetch), catalogFor(f));
    assert.deepEqual(await fetchTrackBReport(f.pin, localFetch), f.report);
    assert.equal(f.report.periods.length, 2);
    assert.ok(f.report.periods.every(p => p.status === "unavailable" && p.result === null && p.reasons.some(r => r.code === "missing-period")));
    const json = await localFetch(trackBReportUrl(f.pin, "/export.json")), document: any = await json.json();
    assert.deepEqual(document.report, f.report);
    const binary = await localFetch(trackBReportUrl(f.pin, "/export.xlsx"));
    for (const response of [json, binary]) assert.equal(response.headers.get("x-track-b-report-sha256"), f.pin.reportHash);
    const book = XLSX.read(Buffer.from(await binary.arrayBuffer()), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<any>(book.Sheets["Period reasons"]);
    assert.equal(rows.length, document.rows.length);
    assert.ok(rows.every(r => r["Track B result"] === "null" && r["Protocol SHA256"] === f.pin.protocolHash && r["Corpus SHA256"] === f.report.corpusHash));
    assert.equal((await localFetch(trackBReportUrl({ ...f.pin, reportHash: "0".repeat(64) }))).status, 409);
    assert.equal((await localFetch("/api/research/track-b-admission?protocolHash=" + "0".repeat(64))).status, 404);
    assert.equal((await localFetch(trackBReportUrl(f.pin) + "&path=/etc/passwd")).status, 400);
    assert.equal((await localFetch(trackBReportUrl(f.pin), { method: "POST" })).status, 403);
    unlinkSync(reportPath); assert.equal((await localFetch(trackBReportUrl(f.pin))).status, 404);
    writeFileSync(reportPath, "{broken-json"); assert.equal((await localFetch(trackBReportUrl(f.pin))).status, 503);
    save(); unlinkSync(reportPath); symlinkSync(disclosurePath, reportPath);
    assert.equal((await localFetch(trackBReportUrl(f.pin))).status, 503);
    unlinkSync(reportPath); save();
    const unpublished = { ...f.disclosure, status: "unpublished" }, unpublishedPin = { ...f.pin, disclosureHash: contentHash(unpublished) };
    writeFileSync(join(root, `${unpublishedPin.disclosureHash}.disclosure.json`), JSON.stringify(unpublished));
    activeReader = createTrackBPublicationReader({ root, catalog: [unpublishedPin], allowEngineeringFixtures: true });
    assert.equal((await localFetch(trackBReportUrl(f.pin))).status, 403, "Actual retained unpublished disclosure is denied");
    activeReader = reader;
    process.env.NODE_ENV = "production";
    assert.equal((await localFetch(trackBReportUrl(f.pin))).status, 403, "Synthetic authorization cannot escape isolated DEV");
    process.env.NODE_ENV = "development";
    await assert.rejects(createTrackBPublicationReader({ root, catalog: [f.pin, f.pin], allowEngineeringFixtures: true })(f.pin.protocolHash), /Ambiguous/);
    const forgedFetch = (async () => new Response(JSON.stringify({ ...f.report, corpusCutoff: "2022-01-01T00:00:00Z" }),
      { headers: { "X-Track-B-Report-SHA256": f.pin.reportHash, "X-Track-B-Disclosure-SHA256": f.pin.disclosureHash,
        "X-Track-B-Pipeline-SHA256": f.pin.pipelineResultHash, "X-Track-B-Period-Domain-SHA256": f.pin.periodDomainHash } })) as typeof fetch;
    await assert.rejects(fetchTrackBReport(f.pin, forgedFetch), /identity mismatch/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});
test("new actual UI SSR covers loading/error/empty/missing/corrupt/selected absence and exact period reasons/download IDs, no old UI rerun", () => {
  const f = disclosureFixture(), catalog = catalogFor(f);
  const render = (state: TrackBResearchReadState) => renderToStaticMarkup(React.createElement(QueryClientProvider,
    { client: new QueryClient() }, React.createElement(TrackBResearch, { readState: state })));
  for (const state of [
    { catalog: { data: catalog, loading: true } }, { catalog: { data: catalog, error: "catalog unavailable" } },
    { catalog: {} }, { catalog: { data: { ...catalog, reports: [] } } },
    { catalog: { data: catalog } }, { catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash, report: { loading: true, data: f.report } },
    { catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash, report: { error: "corrupt report", data: f.report } },
    { catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash },
    { catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash, report: { data: { ...f.report, periods: [] } } },
    { catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash, selectedReportHash: "0".repeat(64), report: { data: f.report } },
    { catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash, selectedDisclosureHash: "0".repeat(64), report: { data: f.report } },
  ] as TrackBResearchReadState[]) {
    const html = render(state);
    assert.doesNotMatch(html, /Download exact JSON|Download exact XLSX/);
    assert.doesNotMatch(html, /Track B: unavailable/);
  }
  assert.match(render({ catalog: { data: { ...catalog, reports: [] } } }), /No authorized public Track B reports/);
  assert.match(render({ catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash }), /Selected report response absent/);
  const html = render({ catalog: { data: catalog }, selectedProtocol: f.pin.protocolHash, report: { data: f.report } });
  for (const period of f.report.periods) {
    assert.ok(html.includes(period.origin)); assert.ok(html.includes(period.specification.replaceAll('"', "&quot;")));
    for (const reason of period.reasons) assert.ok(html.includes(reason.code));
  }
  assert.match(html, /Result unavailable \(null\)/);
  assert.ok(html.includes(trackBReportUrl(f.pin, "/export.xlsx").replaceAll("&", "&amp;")));
  assert.match(html, /not Stage9 authentication/);
});
