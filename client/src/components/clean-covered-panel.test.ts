import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { economicBridgeCells, economicBridgeContracts } from "../../../shared/economicBridgeSchema";
import { buildCleanCoveredReport } from "../../../server/calculation/cleanCoveredReport";
import { fetchCleanCoveredDocument, parseCleanCoveredDocument, readBoundCleanCoveredExport, type CleanCoveredDocument } from "../lib/clean-covered-reader";
import { CLEAN_COVERED_QUERY_KEY } from "../hooks/use-clean-covered";
import { CleanCoveredPanel, CleanCoveredPanelContent, type CleanCoveredReadState } from "./clean-covered-panel";
import { assertNoLiteralBlockInPhrasingContainer } from "./reserve-literal-dom-test-helpers";

Object.assign(globalThis, { React });

function fixture(): CleanCoveredDocument {
  const hash = "a".repeat(64);
  const artifact = { id: hash, value: { engineeringFixture: true } };
  return {
    version: "supplemental-economic-calculation-1", key: "cleanCovered",
    report: buildCleanCoveredReport() as CleanCoveredDocument["report"],
    identity: {
      version: "prospective-economic-identity-1", key: "cleanCovered",
      claim: economicBridgeContracts.cleanCovered.claim,
      codeArtifact: { id: hash, contract: "calculation-source-1", files: [{ path: "engineering-fixture", sha256: hash }] },
      sourceArtifact: artifact, materialInputs: artifact, assumptions: artifact, model: artifact,
      parent: { kind: "public-prospective-inputs", id: hash, retainedResultId: null },
      derivation: artifact, resultHash: hash, retainedExecution: false, originalHistoricalExport: false,
      sourceApproval: false, scientificAcceptance: false, id: hash,
    },
  };
}
function render(overrides: Partial<CleanCoveredReadState> = {}) {
  return renderToStaticMarkup(React.createElement(CleanCoveredPanelContent, {
    state: { isLoading: false, isFetching: false, isError: false, refetch: () => undefined, ...overrides },
  }));
}
test("clean/covered wrapper mounts pending and cached current reports", () => {
  for (const ready of [false, true]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    if (ready) client.setQueryData(CLEAN_COVERED_QUERY_KEY, fixture());
    try {
      const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(CleanCoveredPanel)));
      assert.match(html, ready ? /clean-covered-ready/ : /aria-busy="true"/);
      assertNoLiteralBlockInPhrasingContainer(html);
    } finally { client.clear(); }
  }
});
test("pending, refetch, error and absent data suppress stale report and exports", () => {
  for (const state of [{ isLoading: true }, { isFetching: true }, { isError: true, error: new Error("Source refused") }]) {
    const html = render({ data: fixture(), ...state });
    assert.doesNotMatch(html, /clean-covered-ready|Public JSON|Public XLSX|1776490/);
    assert.match(html, state.isError ? /Source refused.*Retry clean\/covered report/ : /aria-busy="true"/);
  }
  for (const data of [undefined, null]) {
    const html = render({ data });
    assert.match(html, /clean-covered-empty/);
    assert.match(html, /Exports are withheld/);
    assert.doesNotMatch(html, /Public JSON|Public XLSX/);
  }
});
test("ready report separates physical facts, equations and unavailable economics without inputs", () => {
  const html = render({ data: fixture() });
  assertNoLiteralBlockInPhrasingContainer(html);
  for (const pattern of [
    /EPA eGRID2023/, /BW91/, /ORIS 6101/, /1776490/, /2215360\.4693472/,
    /1\.2470435912091822/, /1772288\.37547776/, /1421192/, /× 0\.8/,
    /not an independently observed intensity/, /independent validation/, /not an operational-control inventory/,
    /One provisional source case, not the accepted full-workbook covered universe/,
    /not a statistical uncertainty interval/, /Source comparisons/,
    /Warming in 2100 · unavailable/, /Net-zero years · unavailable/,
    /Probability of net zero by 2050 · unavailable/, /Reduction rates · unavailable/,
    /actual economics unavailable/, /null/, /false/, /not zero economics/,
    /not the original publication timestamp/, /never UI state/,
    /Public JSON/, /Public XLSX/,
  ]) assert.match(html, pattern);
  assert.doesNotMatch(html, /<input|<select|<textarea/);
});
test("reader validates bounded facts, known shapes, versions, identity and unavailable flags", () => {
  const document = fixture();
  assert.equal(parseCleanCoveredDocument(document), document);
  assert.equal(parseCleanCoveredDocument(null), null);
  for (const change of [
    (v: any) => { v.key = "retirementAssociation"; },
    (v: any) => { v.report.version = "other"; },
    (v: any) => { v.report.source.year = 2024; },
    (v: any) => { v.report.source.sha256 = "bad"; },
    (v: any) => { v.report.source.locators.unitCO2 = "other"; },
    (v: any) => { v.report.source.ownership.fraction = 1; },
    (v: any) => { v.report.source.comparison.facilityCo2eAR4Tonnes = 0; },
    (v: any) => { v.report.source.extra = 42; },
    (v: any) => { v.report.observed.generationMWh = 0; },
    (v: any) => { v.report.calculated.conditionalEquityShareMWh = 0; },
    (v: any) => { v.report.calculated.reportedRateDifferenceKgPerMWh = 0; },
    (v: any) => { v.report.calculated.facilityMinusElectricityUnitCO2Tonnes = 0; },
    (v: any) => { v.report.calculated.unitPlantCO2Difference = 1; },
    (v: any) => { v.report.calculated.generatorPlantMWhDifference = 1; },
    (v: any) => { v.report.covered.scenarios = {}; },
    (v: any) => { v.report.covered.ranges = [42]; },
    (v: any) => { v.report.covered.population.push("Accepted issuer"); },
    (v: any) => { v.report.covered.years = [2024]; },
    (v: any) => { v.report.covered.inputHash = "bad"; },
    (v: any) => { v.report.covered.expanded = {}; },
    (v: any) => { v.report.covered.extra = 42; },
    (v: any) => { v.report.covered.ranges[0].max = 0; },
    (v: any) => { v.report.covered.ranges[0].extra = 42; },
    (v: any) => { v.report.covered.scenarios[0].status = "accepted"; },
    (v: any) => { v.report.covered.scenarios[0].assumptions.extra = 42; },
    (v: any) => { v.report.covered.scenarios[0].assumptions.ownershipSource.fraction = 1; },
    (v: any) => { v.report.covered.scenarios[0].assumptionHash = "bad"; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].extra = 42; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].activity = 0; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].ownership = 1; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].emissionsTonnes = 0; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].activitySource.extra = 42; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].intensitySource.locator = "independent validation"; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].lineage.activity.availableBy = "2023-01-01T00:00:00Z"; },
    (v: any) => { v.report.covered.scenarios[0].rows[0].lineage.parentResultHash = "b".repeat(64); },
    (v: any) => { v.report.covered.scenarios[0].totals.extra = 0; },
    (v: any) => { delete v.report.covered.stage7.netZeroYears; },
    (v: any) => { v.report.covered.stage7.warming2100.median = 1.8; },
    (v: any) => { v.report.covered.stage7.warming2100.extra = null; },
    (v: any) => { v.report.covered.stage7.netZeroYears.co2 = 2050; },
    (v: any) => { v.report.covered.stage7.probabilityNetZero2050.ghg = 0; },
    (v: any) => { v.report.covered.stage7.reductionRates.period2024_2030 = 0; },
    (v: any) => { v.report.covered.scientificAcceptance = true; },
    (v: any) => { v.report.manufacturing.actualResult = 0; },
    (v: any) => { v.report.extraResult = 42; },
    (v: any) => { v.identity.key = "producerReserve"; },
    (v: any) => { v.identity.id = "bad"; },
    (v: any) => { v.identity.sourceApproval = true; },
    (v: any) => { v.identity.retainedExecution = true; },
    (v: any) => { v.identity.originalHistoricalExport = true; },
    (v: any) => { v.identity.scientificAcceptance = true; },
    (v: any) => { v.identity.parent.retainedResultId = "a".repeat(64); },
    (v: any) => { delete v.identity.materialInputs.value; },
  ]) {
    const value = structuredClone(document);
    change(value);
    assert.throws(() => parseCleanCoveredDocument(value), /invalid|nonfinite/);
  }
});
test("clean/covered GET and JSON exports require exact current server body with no pins", async () => {
  const original = globalThis.fetch;
  const document = fixture();
  let body: unknown = document;
  const calls: string[] = [];
  globalThis.fetch = async input => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.deepEqual(await fetchCleanCoveredDocument(), document);
    assert.deepEqual(JSON.parse(await (await readBoundCleanCoveredExport(document, "json")).text()), document);
    for (const changed of [
      { ...document, identity: { ...document.identity, id: "b".repeat(64) } },
      { ...document, report: { ...document.report, limitations: ["Changed current report"] } },
      null,
    ]) {
      body = changed;
      await assert.rejects(readBoundCleanCoveredExport(document, "json"), /identity or result changed/);
    }
    assert.equal(await fetchCleanCoveredDocument(), null);
    assert.ok(calls.every(url => ["/api/cv/clean-covered", "/api/cv/clean-covered/export.json"].includes(url)));
    globalThis.fetch = async () => new Response("not JSON");
    await assert.rejects(fetchCleanCoveredDocument(), /did not return JSON/);
    globalThis.fetch = async () => new Response("refused", { status: 503 });
    await assert.rejects(fetchCleanCoveredDocument(), /503/);
  } finally { globalThis.fetch = original; }
});
test("literal XLSX rejects changed nulls, formulas, links, extra sheets and identity", async () => {
  const original = globalThis.fetch;
  const document = fixture();
  let corrupt = "none";
  globalThis.fetch = async input => {
    assert.equal(String(input), "/api/cv/clean-covered/export.xlsx");
    const rows = [["JSON pointer", "Literal JSON value"], ...economicBridgeCells(document).map(row => [row.pointer, row.jsonValue])];
    if (corrupt === "null") rows.find(row => row[0] === "/report/manufacturing/actualResult")![1] = "0";
    if (corrupt === "identity") rows.find(row => row[0] === "/identity/id")![1] = JSON.stringify("b".repeat(64));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    if (corrupt === "formula") sheet.B2.f = "1+1";
    if (corrupt === "link") sheet.B2.l = { Target: "https://example.org" };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Public calculation");
    if (corrupt === "sheet") XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["extra"]]), "Other");
    return new Response(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  };
  try {
    assert.ok((await readBoundCleanCoveredExport(document, "xlsx")).size > 0);
    for (const kind of ["null", "identity", "formula", "link", "sheet"]) {
      corrupt = kind;
      await assert.rejects(readBoundCleanCoveredExport(document, "xlsx"), /differs|nonliteral|Unexpected/);
    }
  } finally { globalThis.fetch = original; }
});
