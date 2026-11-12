import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { PairedResearchProtocol } from "../server/calculation/pairedResearchPipeline";
import type { ResearchCorpus } from "../server/calculation/pairedResearchCorpus";
import { contentHash } from "../server/calculation/analysisManifest";
import { buildRetainedPairedResearch } from "../server/retainedPairedResearchProjection";
import {
  createRetainedPairedResearchReader, retainedPairedIdentity, writeRetainedPairedArtifact,
  retainedPairedDisclosureSchema, validateRetainedPairedPublication, publishPinnedRetainedPairedResearch,
} from "../server/retainedPairedResearchStore";
import { registerRetainedPairedResearchRoutes } from "../server/retainedPairedResearchApi";
import { retainedPairedResearchCatalog } from "../server/retainedPairedResearchCatalog";
import {
  retainedPairedPinSchema, retainedPairedReportSchema,
} from "../client/src/components/retained-paired-research-contract";
import {
  fetchRetainedPairedCatalog, fetchRetainedPairedReport, retainedPairedReportUrl,
} from "../client/src/components/retained-paired-research-reader";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { RetainedPairedResearchReport } from "../client/src/components/retained-paired-research";

// Every artifact in this suite is explicitly synthetic isolated DEV engineering.
// No approved source pin is added to the production catalog.
function fixture() {
  const specification = { model: "engineering-retained-gordon", peer: "sector", target: "next-month" as const };
  const p: PairedResearchProtocol = {
    evidenceMode: "revised-history", primaryEndpoints: ["evaluation-r2", "signal-ic", "after-cost-long-short"],
    specifications: [specification, { ...specification, model: "engineering-retained-absent" }],
    expectedOrigins: [], frozenAt: "2019-01-01T00:00:00Z", evaluationStart: "2020-12-31T00:00:00Z",
    evaluationEnd: "2023-02-01T00:00:00Z", embargoDays: 2, blockLength: 1, repetitions: 200, seed: 123,
    currency: "USD", geography: "engineering-only", quantile: .25, weighting: "equal-within-sector",
    longOnlyKernelWeighting: "equal-within-sector", costBps: 25, sensitivityCostBps: [0, 50],
    borrowRateMultipliers: [0, 2], terminalStresses: [0, -.3, -1],
    disclosure: "locked retrospective evaluation (prior exposure: 2020 onward)",
  };
  const c: ResearchCorpus = { mode: "engineering-fixture", dataEnd: "2024-01-01T00:00:00Z", artifacts: [], periods: [] };
  let seed = 971;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 - .5; };
  const ids = Array.from({ length: 16 }, (_, i) => `engineering-${i}`);
  const stamp = (month: number, day = 1) => new Date(Date.UTC(2020, month, day)).toISOString();
  const archive = (payload: unknown, at: string) => {
    const hash = contentHash(payload);
    if (!c.artifacts.some(a => a.hash === hash)) c.artifacts.push({
      hash, payload, originUri: `engineering-fixture://${hash}`, capturedAt: at, availableAt: at, vintage: "engineering-fixture",
    });
    return hash;
  };
  const universeHash = archive([...ids].sort(), p.frozenAt);
  for (let m = 0; m < 36; m++) {
    const origin = stamp(m, 0), executionAt = stamp(m), endAt = stamp(m + 1);
    p.expectedOrigins.push(origin);
    const source = archive({ engineeringOnly: true, m, factor: rnd() }, origin);
    const definition = { currency: "USD", basis: "FCFE", horizonYears: 5, growthDefinition: "five-year-CAGR", nominal: true };
    const securities = ids.map((companyId, i) => {
      const growth = rnd(), executionPrice = m ? c.periods[m - 1].securities[i].endPrice : 100;
      const projectionManifest = archive({ companyId, model: specification.model, origin, definition, members: [{ id: "member", growth }] }, origin);
      const valuationManifest = archive({ companyId, model: specification.model, origin, definition, members: [{ id: "member", growth: 0 }] }, origin);
      return { companyId, numericId: i + 1, sector: i < 8 ? "sector-a" : "sector-b", marketCap: 100 + i,
        informationAvailableAt: origin,
        pair: { origin, companyId, peer: i < 8 ? "sector-a" : "sector-b", projectionManifest, valuationManifest,
          projectionDefinition: definition, valuationDefinition: definition, projectionAvailableAt: origin, valuationAvailableAt: origin,
          members: [{ id: "member", projectedGrowth: growth, impliedGrowth: 0 }] },
        controls: Array.from({ length: 7 }, rnd), baselineGrowth: rnd(), transitionDemand: rnd(), carbonDrag: rnd(), intensity: rnd(),
        executionPrice, executionFx: 1, endPrice: executionPrice * (1 + growth * .05 + rnd() * .01), endFx: 1,
        splitRatio: 1, dividends: 0, terminalProceeds: 0, lifecycle: "continuing" as const,
        borrowAvailable: true, borrowAnnualRate: .01, assumedBorrowAnnualRate: .03, sourceHashes: [source] };
    });
    c.periods.push({ specification, origin, executionAt, endAt, outcomeAvailableAt: endAt, universeHash,
      expectedCompanyIds: ids, securities, cashAnnualRate: 0, financingAnnualRate: .04,
      factors: { currency: p.currency, geography: p.geography, sourceHashes: [source],
        regionalDeveloped: [rnd() * .01], workbookUniverse: [rnd() * .01] } });
  }
  return { p, c };
}
async function engineering() {
  const { p, c } = fixture();
  const built = await buildRetainedPairedResearch(p, contentHash(p), c);
  const { disclosureHash: _, ...bindings } = retainedPairedIdentity(built.report, "0".repeat(64));
  const disclosure = retainedPairedDisclosureSchema.parse({
    contract: "retained-paired-research-disclosure-1", status: "published",
    classification: "engineering-fixture", ...bindings, providerPayloadIncluded: false,
    review: { kind: "synthetic-development-only",
      qualification: "Synthetic authorization for isolated DEV engineering only; no real approval" },
    scientificAcceptance: false, investmentEvidence: false,
  });
  return { p, c, ...built, disclosure, pin: retainedPairedIdentity(built.report, contentHash(disclosure)) };
}
async function workspace() {
  const root = await mkdtemp(join(tmpdir(), "paired-public-engineering-"));
  const pipelineRoot = join(root, "private"), publicRoot = join(root, "public");
  await mkdir(pipelineRoot);
  await mkdir(publicRoot);
  const material = await engineering();
  const { pin, pipeline, report, disclosure, p, c } = material;
  await writeRetainedPairedArtifact(pipelineRoot, pin.pipelineResultHash, "pipeline", pipeline);
  await writeRetainedPairedArtifact(pipelineRoot, pin.pipelineResultHash, "paired-inputs", {
    pipelineResultHash: pin.pipelineResultHash, protocol: p, corpus: c,
  });
  await writeRetainedPairedArtifact(pipelineRoot, pin.reportHash, "paired-report", report);
  await writeRetainedPairedArtifact(pipelineRoot, pin.disclosureHash, "paired-disclosure", disclosure);
  return { ...material, root, pipelineRoot, publicRoot, catalog: [pin], allowEngineeringFixtures: true };
}
async function dev<T>(work: () => Promise<T>) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  try { return await work(); } finally {
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
}
async function http<T>(options: Parameters<typeof registerRetainedPairedResearchRoutes>[1],
  work: (base: string) => Promise<T>) {
  const app = express();
  registerRetainedPairedResearchRoutes(app, options);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  try { return await work(`http://127.0.0.1:${port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}
const localFetch = (base: string): typeof fetch => (input, init) => fetch(`${base}${input}`, init);

test("actual paired pipeline → offline reviewed DEV publisher → public store → HTTP → browser verification → renderer", async () => dev(async () => {
  const w = await workspace();
  try {
    await publishPinnedRetainedPairedResearch(w.pin, {
      pipelineRoot: w.pipelineRoot, publicRoot: w.publicRoot, catalog: w.catalog, allowEngineeringFixtures: true,
    });
    // Public directory contains no protocol, corpus, source payload or pipeline.
    const { readdir } = await import("node:fs/promises");
    assert.deepEqual((await readdir(w.publicRoot)).sort(), [
      `${w.pin.disclosureHash}.paired-disclosure.json`, `${w.pin.reportHash}.paired-report.json`,
    ].sort());
    const reader = createRetainedPairedResearchReader({ root: w.publicRoot, catalog: w.catalog, allowEngineeringFixtures: true });
    await http({ readReport: reader, catalog: w.catalog }, async base => {
      const fetcher = localFetch(base), catalog = await fetchRetainedPairedCatalog(fetcher);
      assert.deepEqual(catalog.reports, [w.pin]);
      const report = await fetchRetainedPairedReport(catalog.reports[0], fetcher);
      assert.deepEqual(report, w.report);
      assert.equal(report.pipelineResultHash, contentHash(w.pipeline));
      for (const endpoint of w.p.primaryEndpoints) {
        const section = report.specifications[0].endpoints[endpoint];
        assert.equal(section.status, "available");
        if (section.status === "available") assert.equal(section.metrics[0].value,
          (w.pipeline.specifications[0].endpoints[endpoint] as { estimate: number }).estimate);
        assert.equal(report.specifications[1].endpoints[endpoint].status, "unavailable");
      }
      for (const key of ["longOnly", "longShort", "factorAdjusted", "robustness"] as const) {
        assert.equal(report.specifications[0][key].status, "available", key);
        assert.equal(report.specifications[1][key].status, "unavailable", key);
      }
      assert.equal(report.originDomain.length, w.p.expectedOrigins.length * w.p.specifications.length);
      assert.ok(report.originDomain.some(origin => origin.executionAt === null && origin.missingReasons.length > 0));
      assert.equal(report.tracks.B.status, "unavailable");
      assert.equal(report.tracks.prospective.status, "unavailable");
      assert.equal(report.efficacy, "WITHHELD");
      const text = JSON.stringify(report);
      for (const forbidden of ["originUri", "payload", "expectedCompanyIds", "holdings", "securities", "engineering-0"])
        assert.ok(!text.includes(`"${forbidden}"`), forbidden);
      const html = renderToStaticMarkup(React.createElement(RetainedPairedResearchReport, { report }));
      assert.match(html, /Engineering fixture/i);
      assert.match(html, /Unavailable/);
      assert.match(html, /estimate/);
      const response = await fetch(base + retainedPairedReportUrl(w.pin));
      assert.equal(response.headers.get("Cache-Control"), "no-store");
      for (const [key, value] of Object.entries(w.pin)) assert.equal(response.headers.get(
        `X-Paired-Research-${key.replace(/Hash$/, "").replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}-SHA256`), value);
    });
  } finally { await rm(w.root, { recursive: true, force: true }); }
}));

test("empty real catalog stays honest; strict eight-pin HTTP rejects omissions, arrays, paths, overrides and changed identities", async () => dev(async () => {
  assert.deepEqual(retainedPairedResearchCatalog, []);
  await http(undefined, async base => {
    const catalog = await fetchRetainedPairedCatalog(localFetch(base));
    assert.deepEqual(catalog.reports, []);
    assert.equal((await fetch(base + "/api/research/paired-research/catalog?root=/private")).status, 400);
    const unlisted = Object.fromEntries(Object.keys(retainedPairedPinSchema.shape).map(key => [key, "f".repeat(64)]));
    assert.equal((await fetch(base + retainedPairedReportUrl(retainedPairedPinSchema.parse(unlisted)))).status, 404);
  });
  const w = await workspace();
  try {
    const reader = createRetainedPairedResearchReader({ root: w.publicRoot, catalog: w.catalog, allowEngineeringFixtures: true });
    await http({ readReport: reader, catalog: w.catalog }, async base => {
      for (const key of Object.keys(w.pin)) {
        const params = new URLSearchParams(w.pin); params.delete(key);
        assert.equal((await fetch(`${base}/api/research/paired-research?${params}`)).status, 400);
        const changed = { ...w.pin, [key]: "f".repeat(64) };
        assert.equal((await fetch(base + retainedPairedReportUrl(changed))).status, key === "protocolHash" ? 404 : 409);
      }
      for (const extra of ["&path=/private", "&approved=true", "&protocolHash=" + w.pin.protocolHash, "&root=/private"]) {
        assert.equal((await fetch(base + retainedPairedReportUrl(w.pin) + extra)).status, 400);
      }
      assert.equal((await fetch(base + retainedPairedReportUrl(w.pin))).status, 404);
      assert.equal((await fetch(base + "/api/research/paired-research", { method: "POST", body: "{}" })).status, 404);
    });
  } finally { await rm(w.root, { recursive: true, force: true }); }
}));

test("public store refuses corrupt bytes, wrong schemas, unsafe symlinks, duplicate pins and absent exact files", async () => dev(async () => {
  const w = await workspace();
  try {
    await publishPinnedRetainedPairedResearch(w.pin, {
      pipelineRoot: w.pipelineRoot, publicRoot: w.publicRoot, catalog: w.catalog, allowEngineeringFixtures: true,
    });
    const reader = createRetainedPairedResearchReader({ root: w.publicRoot, catalog: w.catalog, allowEngineeringFixtures: true });
    const reportPath = join(w.publicRoot, `${w.pin.reportHash}.paired-report.json`);
    const original = await readFile(reportPath, "utf8");
    for (const corrupt of ["{", JSON.stringify({ ...w.report, investmentEvidence: true }),
      JSON.stringify({ ...w.report, codeContext: { ...w.report.codeContext, missingReasons: ["changed"] } })]) {
      await writeFile(reportPath, corrupt);
      await assert.rejects(reader(w.pin), /corrupt|strict public contract|hash mismatch/);
      await http({ readReport: reader, catalog: w.catalog }, async base => {
        const response = await fetch(base + retainedPairedReportUrl(w.pin));
        assert.equal(response.status, 503);
        assert.ok(!response.headers.has("X-Paired-Research-Report-SHA256"));
        assert.deepEqual(Object.keys(await response.json()), ["error"]);
      });
    }
    await writeFile(reportPath, original);
    await assert.rejects(createRetainedPairedResearchReader({
      root: w.publicRoot, catalog: [w.pin, w.pin], allowEngineeringFixtures: true,
    })(w.pin), /Ambiguous/);
    await unlink(reportPath);
    await assert.rejects(reader(w.pin), /missing/);
    const external = join(w.root, "external.json");
    await writeFile(external, original); await symlink(external, reportPath);
    await assert.rejects(reader(w.pin), /unsafe/);
    const linkedRoot = join(w.root, "linked-root"); await symlink(w.publicRoot, linkedRoot);
    await assert.rejects(createRetainedPairedResearchReader({
      root: linkedRoot, catalog: w.catalog, allowEngineeringFixtures: true,
    })(w.pin), /unsafe/);
  } finally { await rm(w.root, { recursive: true, force: true }); }
}));

test("unpublished, unreviewed, classification mismatches and production DEV injection never authorize publication", async () => dev(async () => {
  const e = await engineering();
  for (const disclosure of [
    { ...e.disclosure, status: "unpublished" },
    { ...e.disclosure, review: { kind: "not-reviewed" } },
    { ...e.disclosure, classification: "retained-research" },
  ]) {
    const pin = retainedPairedIdentity(e.report, contentHash(disclosure));
    assert.throws(() => validateRetainedPairedPublication(pin, disclosure, e.report, true), /Unpublished|classification mismatch/);
  }
  assert.throws(() => validateRetainedPairedPublication(e.pin, e.disclosure, e.report), /DEV engineering only/);
  process.env.NODE_ENV = "production";
  assert.throws(() => validateRetainedPairedPublication(e.pin, e.disclosure, e.report, true), /DEV engineering only/);
  await assert.rejects(createRetainedPairedResearchReader({ catalog: [e.pin], allowEngineeringFixtures: true })(e.pin), /synthetic DEV engineering only/);
  await assert.rejects(publishPinnedRetainedPairedResearch(e.pin, { catalog: [e.pin], allowEngineeringFixtures: true }), /synthetic DEV engineering only/);
}));

test("actual HTTP refuses unpublished and unreviewed public files even when bytes and all eight pins match", async () => dev(async () => {
  const w = await workspace();
  try {
    await writeRetainedPairedArtifact(w.publicRoot, w.pin.reportHash, "paired-report", w.report);
    for (const disclosure of [
      { ...w.disclosure, status: "unpublished" },
      { ...w.disclosure, review: { kind: "not-reviewed" } },
    ]) {
      const pin = retainedPairedIdentity(w.report, contentHash(disclosure));
      await writeRetainedPairedArtifact(w.publicRoot, pin.disclosureHash, "paired-disclosure", disclosure);
      const reader = createRetainedPairedResearchReader({ root: w.publicRoot, catalog: [pin], allowEngineeringFixtures: true });
      await http({ readReport: reader, catalog: [pin] }, async base => {
        const response = await fetch(base + retainedPairedReportUrl(pin));
        assert.equal(response.status, 403);
        assert.deepEqual(Object.keys(await response.json()), ["error"]);
        await assert.rejects(fetchRetainedPairedReport(pin, localFetch(base)), /Unpublished report|missing source-authorized/);
      });
    }
  } finally { await rm(w.root, { recursive: true, force: true }); }
}));

test("actual pipeline with no periods or artifacts preserves every frozen cell and explicit absent sections, never zero substitutes", async () => {
  const { p, c } = fixture();
  c.periods = []; c.artifacts = [];
  const { report, pipeline } = await buildRetainedPairedResearch(p, contentHash(p), c);
  assert.equal(report.pipelineResultHash, contentHash(pipeline));
  assert.equal(report.tracks.A.status, "unavailable");
  assert.equal(report.sourceContext.sources.length, 0);
  assert.ok(report.sourceContext.missingReasons.includes("No retained source artifacts"));
  assert.equal(report.originDomain.length, p.expectedOrigins.length * p.specifications.length);
  assert.ok(report.originDomain.every(period => period.executionAt === null && period.endAt === null && period.missingReasons.length));
  for (const spec of report.specifications) {
    for (const endpoint of Object.values(spec.endpoints)) assert.equal(endpoint.status, "unavailable");
    for (const key of ["longOnly", "longShort", "factorAdjusted", "robustness"] as const)
      assert.equal(spec[key].status, "unavailable");
    assert.equal(spec.originCount, 0); // Genuine coverage count, never a substituted result.
  }
});

test("offline publisher refuses unlisted pins, forged pipeline/input/projection and changed code identities", async () => dev(async () => {
  const w = await workspace();
  const options = { pipelineRoot: w.pipelineRoot, publicRoot: w.publicRoot, catalog: w.catalog, allowEngineeringFixtures: true };
  try {
    await assert.rejects(publishPinnedRetainedPairedResearch(w.pin), /source-catalog pin/);
    const pipelinePath = join(w.pipelineRoot, `${w.pin.pipelineResultHash}.json`);
    await writeFile(pipelinePath, JSON.stringify({ ...w.pipeline, efficacy: "fabricated" }));
    await assert.rejects(publishPinnedRetainedPairedResearch(w.pin, options), /pipeline\/projection\/source\/code mismatch/);
    await writeFile(pipelinePath, JSON.stringify(w.pipeline));
    const receiptPath = join(w.pipelineRoot, `${w.pin.pipelineResultHash}.paired-inputs.json`);
    await writeFile(receiptPath, JSON.stringify({ pipelineResultHash: w.pin.pipelineResultHash,
      protocol: { ...w.p, seed: 1 }, corpus: w.c }));
    await assert.rejects(publishPinnedRetainedPairedResearch(w.pin, options), /protocol hash mismatch/);
    await writeFile(receiptPath, JSON.stringify({ pipelineResultHash: w.pin.pipelineResultHash, protocol: w.p, corpus: w.c }));
    const report = retainedPairedReportSchema.parse({ ...w.report,
      codeContext: { ...w.report.codeContext, entries: w.report.codeContext.entries.map(entry => ({ ...entry, hash: "f".repeat(64) })) },
    });
    const { disclosureHash: _, ...bindings } = retainedPairedIdentity(report, "0".repeat(64));
    const disclosure = { ...w.disclosure, ...bindings };
    const pin = retainedPairedIdentity(report, contentHash(disclosure));
    await writeRetainedPairedArtifact(w.pipelineRoot, pin.reportHash, "paired-report", report);
    await writeRetainedPairedArtifact(w.pipelineRoot, pin.disclosureHash, "paired-disclosure", disclosure);
    await assert.rejects(publishPinnedRetainedPairedResearch(pin, { ...options, catalog: [pin] }), /pipeline\/projection\/source\/code mismatch/);
    assert.ok(retainedPairedPinSchema.safeParse(w.pin).success);
  } finally { await rm(w.root, { recursive: true, force: true }); }
}));

test("actual CLI retains pipeline and public projection plus private receipt, only an unpublished not-reviewed draft", async () => {
  const root = await mkdtemp(join(tmpdir(), "paired-cli-engineering-"));
  const { p, c } = fixture();
  p.seed = parseInt(contentHash(root).slice(0, 8), 16); // Unique isolated engineering artifact identities.
  try {
    const protocolPath = join(root, "protocol.json"), corpusPath = join(root, "corpus.json");
    await writeFile(protocolPath, JSON.stringify(p)); await writeFile(corpusPath, JSON.stringify(c));
    // The command intentionally retains into its fixed project root, never accepts a public root.
    const result = spawnSync(process.execPath, ["--import", "tsx", "script/run-paired-research-pipeline.ts",
      protocolPath, contentHash(p), corpusPath], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    const report = retainedPairedReportSchema.parse(JSON.parse(await readFile(output.pairedReportPath, "utf8")));
    const draft = retainedPairedDisclosureSchema.parse(JSON.parse(await readFile(output.pairedDisclosureDraftPath, "utf8")));
    assert.equal(report.classification, "engineering-fixture");
    assert.equal(draft.status, "unpublished");
    assert.equal(draft.review.kind, "not-reviewed");
    assert.equal(report.pipelineResultHash, contentHash(JSON.parse(await readFile(output.path, "utf8"))));
    assert.deepEqual(retainedPairedResearchCatalog, []);
    // Remove only files produced for this isolated unique fixture, not other workers' artifacts.
    for (const path of [output.path, output.trackBWorkbookPath, output.reportPath, output.disclosureDraftPath,
      output.assessmentMaterialPath, output.pairedReportPath, output.pairedDisclosureDraftPath,
      `generated-artifacts/paired-research-pipeline/${report.pipelineResultHash}.paired-inputs.json`]) await rm(path, { force: true });
  } finally { await rm(root, { recursive: true, force: true }); }
});
