import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { contentHash } from "../../../server/calculation/analysisManifest";
import {
  fetchRetainedPairedCatalog, fetchRetainedPairedReport, retainedPairedContentHash,
  retainedPairedReportUrl, verifyRetainedPairedReport,
} from "./retained-paired-research-reader";
import {
  retainedPairedPinKey, retainedPairedReportSchema,
  type RetainedPairedCatalog, type RetainedPairedPin, type RetainedPairedReport,
} from "./retained-paired-research-contract";
import { RetainedPairedResearch, type RetainedPairedResearchReadState } from "./retained-paired-research";

// Isolated public-projection ENGINEERING fixture. No real corpus, science,
// publication authorization, reviewed source pin or source rights are implied.
function fixture() {
  const stamp = "2020-01-01T00:00:00.000Z";
  const gap = (reason: string) => ({ status: "unavailable" as const, reason });
  const report: RetainedPairedReport = {
    contract: "retained-paired-research-report-1", producer: "paired-research-pipeline",
    classification: "engineering-fixture",
    protocolHash: contentHash({ syntheticProtocol: true }),
    pipelineResultHash: contentHash({ syntheticPipeline: true }),
    corpusHash: contentHash({ syntheticCorpus: true }),
    disclosure: "locked retrospective evaluation (prior exposure: 2020 onward)",
    protocol: {
      evidenceMode: "revised-history", frozenAt: "2019-01-01T00:00:00.000Z",
      evaluationStart: stamp, evaluationEnd: "2021-01-01T00:00:00.000Z",
      expectedOrigins: [stamp], primaryEndpoints: ["evaluation-r2", "signal-ic", "after-cost-long-short"],
      embargoDays: 2, blockLength: 1, repetitions: 200, seed: 123, currency: "USD",
      geography: "synthetic-region", weighting: "equal-within-sector", costBps: 25,
    },
    originDomain: [{
      specification: "engineering-only:sector:next-month", origin: stamp,
      informationCutoff: null, executionAt: null, endAt: null,
      missingReasons: ["2020-01-01T00:00:00.000Z: missing frozen origin"],
    }],
    sourceContext: { qualification: "Synthetic reader fixture; no actual sources",
      sources: [], missingReasons: ["No original-filing archive retained"] },
    codeContext: { qualification: "Synthetic code context, not a review",
      entries: [], missingReasons: ["No independently retained code receipt"] },
    tracks: { A: gap("No authentic revised-history corpus"),
      B: gap("No authenticated Stage9 plus original-filing review"),
      prospective: gap("Requires independently retained live signal archive") },
    specifications: [{
      model: "engineering-only", peer: "sector", target: "next-month",
      originCount: 0, trainingDates: 0, evaluationDates: 0, missing: ["No retained origin periods"],
      endpoints: {
        "evaluation-r2": gap("Insufficient regression observations"),
        "signal-ic": gap("Incomplete declared corpus"),
        "after-cost-long-short": gap("Borrow history absent: hypothetical only"),
      },
      longOnly: gap("Requires complete next-month rows"),
      longShort: gap("Execution mark discontinuity: supply intervening FX/price/action reconciliation"),
      factorAdjusted: gap("Factor geography/currency mismatch"),
      robustness: gap("No retained sensitivity trajectories"),
    }],
    limitations: ["Engineering fixtures never adjudicate positively."],
    efficacy: "WITHHELD", scientificAcceptance: false, investmentEvidence: false, authenticityVerified: false,
  };
  const pin: RetainedPairedPin = {
    protocolHash: report.protocolHash, reportHash: contentHash(report),
    disclosureHash: contentHash({ syntheticDisclosure: "not a real authorization" }),
    pipelineResultHash: report.pipelineResultHash, corpusHash: report.corpusHash,
    originDomainHash: contentHash(report.originDomain), sourceContextHash: contentHash(report.sourceContext),
    codeContextHash: contentHash(report.codeContext),
  };
  const catalog: RetainedPairedCatalog = {
    contract: "retained-paired-research-catalog-1", reports: [pin],
    operatorPrerequisite: "Actual operator review of exact public projection and redistribution rights is required.",
    scientificAcceptance: false, investmentEvidence: false,
  };
  const headers = new Headers();
  for (const [key, value] of Object.entries(pin)) headers.set(
    `X-Paired-Research-${key.replace(/Hash$/, "").replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}-SHA256`, value);
  return { report, pin, catalog, headers };
}

function render(state: RetainedPairedResearchReadState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(RetainedPairedResearch, { readState: state })));
  } finally { client.clear(); }
}

test("browser canonical public report hash agrees with actual analysisManifest hash", async () => {
  const { report } = fixture();
  assert.equal(await retainedPairedContentHash(report), contentHash(report));
  await assert.rejects(() => retainedPairedContentHash({ estimate: NaN }), /noncanonical/);
});

test("exact reader accepts all eight selection identities and verifies public context bytes", async () => {
  const { report, pin, headers } = fixture();
  assert.deepEqual(await verifyRetainedPairedReport(report, pin, headers), report);
});

test("reader refuses every wrong selection header, including disclosure and code context", async () => {
  const { report, pin, headers } = fixture();
  for (const key of headers.keys()) {
    const wrong = new Headers(headers);
    wrong.set(key, "f".repeat(64));
    await assert.rejects(() => verifyRetainedPairedReport(report, pin, wrong), /does not match/);
  }
});

test("reader rejects changed origin/source/code content even when claimed identity headers match", async () => {
  const { report, pin, headers } = fixture();
  for (const key of ["originDomain", "sourceContext", "codeContext"] as const) {
    const changed = structuredClone(report);
    if (key === "originDomain") changed.originDomain[0].origin = "2020-02-01T00:00:00.000Z";
    else changed[key].qualification = "Tampered context";
    await assert.rejects(() => verifyRetainedPairedReport(changed, pin, headers), /hash mismatch/);
  }
});

test("reader refuses another producer, missing sections, fabricated acceptance and nonfinite metrics", () => {
  const { report } = fixture();
  assert.equal(retainedPairedReportSchema.safeParse({ ...report, producer: "legacy-intensity-proxy" }).success, false);
  assert.equal(retainedPairedReportSchema.safeParse({ ...report, scientificAcceptance: true }).success, false);
  const missing = structuredClone(report) as unknown as Record<string, unknown>;
  delete missing.tracks;
  assert.equal(retainedPairedReportSchema.safeParse(missing).success, false);
  const invalid = structuredClone(report);
  invalid.specifications[0].longOnly = {
    status: "available", label: "Not actual evidence",
    metrics: [{ label: "Return", value: Infinity, unit: "decimal", qualification: "Engineering only" }],
    notes: ["Not scientific evidence"],
  };
  assert.equal(retainedPairedReportSchema.safeParse(invalid).success, false);
});

test("reader URL is a fixed route with only exact hash selections, never an arbitrary file path", () => {
  const { pin } = fixture();
  const url = new URL(retainedPairedReportUrl(pin), "https://reader.invalid");
  assert.equal(url.pathname, "/api/research/paired-research");
  assert.equal(url.searchParams.size, 8);
  assert.throws(() => retainedPairedReportUrl({ ...pin, reportHash: "../../private/report.json" }));
});

test("real fetch convention includes credentials, signal and no-store; public response is verified", async () => {
  const { report, pin, headers, catalog } = fixture();
  const controller = new AbortController();
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(init?.credentials, "include");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.signal, controller.signal);
    calls++;
    return new Response(JSON.stringify(String(input).endsWith("/catalog") ? catalog : report), { headers });
  };
  assert.deepEqual(await fetchRetainedPairedCatalog(fetcher, controller.signal), catalog);
  assert.deepEqual(await fetchRetainedPairedReport(pin, fetcher, controller.signal), report);
  assert.equal(calls, 2);
});

test("missing/corrupt/wrong-selection HTTP responses preserve exact server refusal reasons", async () => {
  const { pin } = fixture();
  for (const status of [403, 404, 409, 503]) {
    await assert.rejects(() => fetchRetainedPairedReport(pin, async () =>
      new Response(JSON.stringify({ error: `Exact retained refusal ${status}` }), { status })),
    new RegExp(`Exact retained refusal ${status}`));
  }
  await assert.rejects(() => fetchRetainedPairedReport(pin, async () =>
    new Response("corrupt retained bytes", { status: 200 })), /not valid JSON/);
});

test("catalog refuses invalid shape and duplicate exact selections", async () => {
  const { catalog, pin } = fixture();
  await assert.rejects(() => fetchRetainedPairedCatalog(async () =>
    new Response(JSON.stringify({ ...catalog, reports: [pin, pin] }))), /duplicate/);
  await assert.rejects(() => fetchRetainedPairedCatalog(async () =>
    new Response(JSON.stringify({ ...catalog, arbitraryPath: "/private" }))), /public contract/);
});

test("ready report renders actual required sections, prior exposure, exact gaps and no new exports", () => {
  const { report, pin, catalog } = fixture();
  const html = render({ catalog: { data: catalog }, selectedKey: retainedPairedPinKey(pin), report: { data: report } });
  for (const phrase of ["prior exposure: 2020 onward", "Engineering fixture only", "Track A", "Track B",
    "Prospective archive", "Long-only", "Long-short", "Factor-adjusted evidence", "Robustness",
    "Borrow history absent: hypothetical only", "Execution mark discontinuity",
    "No original-filing archive retained", "No independently retained code receipt", "Unavailable (null)"]) {
    assert.ok(html.includes(phrase), phrase);
  }
  assert.ok(!html.includes("/export."));
  assert.ok(!html.includes("<a "));
});

test("empty catalog is a data/publication gap, never scientific completion or automatic fallback", () => {
  const { catalog } = fixture();
  const html = render({ catalog: { data: { ...catalog, reports: [] } } });
  assert.ok(html.includes("No authorized retained paired-research reports"));
  assert.ok(html.includes(catalog.operatorPrerequisite));
  assert.ok(html.includes("not a zero result"));
  assert.ok(!html.includes('data-testid="retained-paired-report"'));
});

test("no default selection, stale pending/error data, invalid reports or mismatched protocol are displayed", () => {
  const { report, pin, catalog } = fixture();
  const selectedKey = retainedPairedPinKey(pin);
  const cases: RetainedPairedResearchReadState[] = [
    { catalog: { data: catalog }, report: { data: report } },
    { catalog: { data: catalog, loading: true }, selectedKey, report: { data: report } },
    { catalog: { data: catalog, error: "Catalog revoked" }, selectedKey, report: { data: report } },
    { catalog: { data: catalog }, selectedKey, report: { data: report, loading: true } },
    { catalog: { data: catalog }, selectedKey, report: { data: report, error: "Disclosure no longer authorized" } },
    { catalog: { data: catalog }, selectedKey, report: { data: { ...report, protocolHash: "f".repeat(64) } } },
    { catalog: { data: catalog }, selectedKey, report: { data: {} as RetainedPairedReport } },
  ];
  for (const state of cases) assert.ok(!render(state).includes('data-testid="retained-paired-report"'));
});

test("finite true zero metrics are rendered as zero, never suppressed as missing or formatted into fake precision", () => {
  const { report, pin, catalog } = fixture();
  report.specifications[0].longOnly = {
    status: "available", label: "Synthetic zero, not efficacy",
    metrics: [{ label: "Engineering check", value: 0, unit: "decimal", qualification: "Engineering only" }],
    notes: ["Separate accounting; not long-short evidence"],
  };
  const html = render({ catalog: { data: catalog }, selectedKey: retainedPairedPinKey(pin), report: { data: report } });
  assert.ok(html.includes("0 decimal"));
  assert.ok(html.includes("Synthetic zero, not efficacy"));
});
