import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { buildPublicLocationElectricityReport } from "../../../server/calculation/locationElectricityPublicReport";
import { economicBridgeCells, economicBridgeContracts } from "../../../shared/economicBridgeSchema";
import {
  fetchLocationElectricityDocument, parseLocationElectricityDocument,
  readBoundLocationElectricityExport, type LocationElectricityDocument,
} from "../lib/location-electricity-reader";
import { LocationElectricityPanel, LocationElectricityPanelContent, type LocationElectricityReadState } from "./location-electricity-panel";
import { LOCATION_ELECTRICITY_QUERY_KEY } from "../hooks/use-location-electricity";
import { assertNoLiteralBlockInPhrasingContainer } from "./reserve-literal-dom-test-helpers";

// Standalone tsx uses the classic JSX transform for existing UI modules.
Object.assign(globalThis, { React });

// Public pure source projection, with an explicitly engineering-only identity.
// This never invokes an archive reader, private validator, DB or source fetch.
function fixture(): LocationElectricityDocument {
  const hash = "a".repeat(64);
  const artifact = { id: hash, value: { fixture: "engineering identity, not an execution receipt" } };
  return {
    version: "supplemental-economic-calculation-1", key: "locationElectricity",
    report: buildPublicLocationElectricityReport(),
    identity: {
      version: "prospective-economic-identity-1", key: "locationElectricity",
      claim: economicBridgeContracts.locationElectricity.claim,
      codeArtifact: { id: hash, contract: "calculation-source-1", files: [{ path: "engineering-fixture", sha256: hash }] },
      sourceArtifact: artifact, materialInputs: artifact, assumptions: artifact, model: artifact,
      parent: { kind: "public-prospective-inputs", id: hash, retainedResultId: null },
      derivation: artifact, resultHash: hash, retainedExecution: false, originalHistoricalExport: false,
      sourceApproval: false, scientificAcceptance: false, id: hash,
    },
  };
}
function render(overrides: Partial<LocationElectricityReadState> = {}) {
  return renderToStaticMarkup(React.createElement(LocationElectricityPanelContent, {
    state: { isLoading: false, isFetching: false, isError: false, refetch: () => undefined, ...overrides },
  }));
}
test("actual electricity hook wrapper mounts pending and current idle cached source-report states", () => {
  for (const ready of [false, true]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    if (ready) client.setQueryData(LOCATION_ELECTRICITY_QUERY_KEY, fixture());
    try {
      const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(LocationElectricityPanel)));
      assert.match(html, ready ? /location-electricity-ready/ : /aria-busy="true"/);
      assertNoLiteralBlockInPhrasingContainer(html);
    } finally { client.clear(); }
  }
});
test("electricity loading and refreshing suppress stale source findings and exports", () => {
  for (const state of [{ isLoading: true }, { isFetching: true }]) {
    const html = render({ data: fixture(), ...state });
    assert.match(html, /aria-busy="true"/);
    assert.doesNotMatch(html, /location-electricity-ready|Public JSON|Public XLSX|Perrysburg/);
  }
});
test("electricity error takes precedence over stale data and offers retry", () => {
  const html = render({ data: fixture(), isError: true, error: new Error("Calculation source refused") });
  assert.match(html, /Calculation source refused/);
  assert.match(html, /Retry electricity findings/);
  assert.doesNotMatch(html, /location-electricity-ready|Public JSON|Public XLSX/);
});
test("electricity null and absent envelopes render empty without synthetic issuer results", () => {
  for (const data of [undefined, null]) {
    const html = render({ data });
    assert.match(html, /location-electricity-empty/);
    assert.match(html, /Exports are withheld/);
    assert.doesNotMatch(html, /location-electricity-ready|Public JSON|Public XLSX/);
  }
});
test("electricity partial source report displays real 5 operating, 1 construction and 5 context rows, not issuer execution", () => {
  const document = fixture();
  assert.equal(document.report.counts.operatingPropertyRows, 5);
  assert.equal(document.report.counts.constructionPropertyRows, 1);
  assert.equal(document.report.counts.regionalPriceRecords, 5);
  assert.equal(document.report.actualIssuerResult, null);
  assert.equal(document.report.assumptionValuesAssignedToIssuers, 0);
  const html = render({ data: document });
  assertNoLiteralBlockInPhrasingContainer(html);
  assert.match(html, /location-electricity-ready/);
  assert.match(html, /location-electricity-partial/);
  assert.match(html, /Actual issuer result/);
  assert.match(html, /Unknown \(null\)/);
  assert.match(html, /under-construction-not-operating-at-source-date/);
  assert.match(html, /regional-context-only/);
  assert.match(html, /not execute an issuer cash bridge or companyProjection/);
  assert.match(html, /Independent of the selected historical analysis archive/);
  assert.match(html, /Public JSON/);
  assert.match(html, /Public XLSX/);
  assert.doesNotMatch(html, /no public location-electricity result adapter/);
  for (const row of document.report.sourceFacts.operatingLocations) {
    assert.ok(html.includes(row.location));
    assert.ok(html.includes(row.source.sha256));
    assert.ok(html.includes(row.source.observedAt));
  }
  for (const row of document.report.sourceFacts.contextualElectricityPrices) {
    assert.ok(html.includes(String(row.reportedValue)));
    assert.ok(html.includes(String(row.nominalMajorCurrencyPerMWh)));
    assert.ok(html.includes(String(row.year)));
    assert.ok(html.includes(row.source.locator));
  }
  // Text is HTML-escaped by React; compare against the same text renderer.
  for (const gap of document.report.missingIssuerInputs) {
    const escaped = renderToStaticMarkup(React.createElement(React.Fragment, null, gap));
    assert.ok(html.includes(escaped));
  }
});
test("electricity empty fact arrays are explicit missingness, not interpolated prices or locations", () => {
  const document = fixture();
  document.report.sourceFacts.operatingLocations = [];
  document.report.sourceFacts.contextualElectricityPrices = [];
  Object.assign(document.report.counts, {
    evidencedPropertyRows: 0, operatingPropertyRows: 0, constructionPropertyRows: 0, regionalPriceRecords: 0,
  });
  assert.equal(parseLocationElectricityDocument(document), document);
  const html = render({ data: document });
  assert.match(html, /No property rows returned/);
  assert.match(html, /No regional price observations returned/);
  assert.match(html, /Unknown \(null\)/);
});
test("electricity validation rejects missing source, inconsistent conversion/counts, qualified claims and non-null issuer cash", () => {
  const document = fixture();
  assert.equal(parseLocationElectricityDocument(document), document);
  assert.equal(parseLocationElectricityDocument(null), null);
  const extra = { ...document, additiveField: { mustStayBoundToExport: true } };
  assert.equal(parseLocationElectricityDocument(extra), extra);
  for (const mutate of [
    (value: any) => { delete value.report.sourceFacts.operatingLocations[0].source.locator; },
    (value: any) => { value.report.sourceFacts.operatingLocations[0].purchasedElectricityMWh = 0; },
    (value: any) => { value.report.actualIssuerResult = { preTaxCashImpact: 0 }; },
    (value: any) => { value.report.assumptionValuesAssignedToIssuers = 1; },
    (value: any) => { value.report.sourceQualifiedIssuerExecution = true; },
    (value: any) => { value.report.sourceFacts.contextualElectricityPrices[0].issuerTariff = true; },
    (value: any) => { value.report.sourceFacts.contextualElectricityPrices[0].nominalMajorCurrencyPerMWh += 1; },
    (value: any) => { value.report.counts.operatingPropertyRows += 1; },
    (value: any) => { value.report.missingIssuerInputs = []; },
    (value: any) => { value.identity.key = "producerReserve"; },
    (value: any) => { value.identity.sourceApproval = true; },
  ]) {
    const value = structuredClone(document);
    mutate(value);
    assert.throws(() => parseLocationElectricityDocument(value), /invalid|conflict/);
  }
});
test("electricity read and JSON export use exact no-query same-origin paths; changed identity/null exports refuse", async () => {
  const document = fixture();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  let body: unknown = document;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.credentials, "include");
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.deepEqual(await fetchLocationElectricityDocument(), document);
    const blob = await readBoundLocationElectricityExport(document, "json");
    assert.deepEqual(JSON.parse(await blob.text()), document);
    body = { ...document, identity: { ...document.identity, id: "b".repeat(64) } };
    await assert.rejects(readBoundLocationElectricityExport(document, "json"), /identity or result changed/);
    body = null;
    assert.equal(await fetchLocationElectricityDocument(), null);
    await assert.rejects(readBoundLocationElectricityExport(document, "json"), /identity or result changed/);
    assert.ok(calls.every(url => !url.includes("?") && url.startsWith("/api/cv/location-electricity")));
  } finally { globalThis.fetch = originalFetch; }
});
test("electricity transport rejects non-JSON, HTTP errors and incomplete report payloads", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("<html>unavailable</html>", { headers: { "content-type": "text/html" } });
    await assert.rejects(fetchLocationElectricityDocument(), /did not return JSON/);
    globalThis.fetch = async () => new Response(JSON.stringify({ error: "source refused" }), { status: 503 });
    await assert.rejects(fetchLocationElectricityDocument(), /503/);
    globalThis.fetch = async () => new Response(JSON.stringify({ report: null }), { headers: { "content-type": "application/json" } });
    await assert.rejects(fetchLocationElectricityDocument(), /contract is invalid/);
  } finally { globalThis.fetch = originalFetch; }
});
test("electricity XLSX requires complete literal source/null/identity readback and rejects substituted values", async () => {
  const document = fixture();
  const originalFetch = globalThis.fetch;
  let variant: "exact" | "identity" | "source" | "formula" | "sheet" = "exact";
  globalThis.fetch = async (url) => {
    assert.equal(url, "/api/cv/location-electricity/export.xlsx");
    const value = structuredClone(document);
    if (variant === "identity") value.identity.id = "b".repeat(64);
    if (variant === "source") value.report.sourceFacts.operatingLocations[0].source.locator = "changed locator";
    const sheet = XLSX.utils.aoa_to_sheet([
      ["JSON pointer", "Literal JSON value"], ...economicBridgeCells(value).map(row => [row.pointer, row.jsonValue]),
    ]);
    if (variant === "formula") sheet.B2.f = "1+1";
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, variant === "sheet" ? "Substituted" : "Public calculation");
    return new Response(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  };
  try {
    assert.ok((await readBoundLocationElectricityExport(document, "xlsx")).size > 0);
    for (const changed of ["identity", "source", "formula", "sheet"] as const) {
      variant = changed;
      await assert.rejects(readBoundLocationElectricityExport(document, "xlsx"), /differs|nonliteral|Unexpected/);
    }
  } finally { globalThis.fetch = originalFetch; }
});
