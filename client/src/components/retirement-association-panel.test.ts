import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { economicBridgeCells, economicBridgeContracts } from "../../../shared/economicBridgeSchema";
import { buildRetirementAssociationPublic } from "../../../shared/retirementAssociationPublic";
import { fetchRetirementAssociationDocument, parseRetirementAssociationDocument, readBoundRetirementAssociationExport, type RetirementAssociationDocument } from "../lib/retirement-association-reader";
import { RETIREMENT_ASSOCIATION_QUERY_KEY } from "../hooks/use-retirement-association";
import { RetirementAssociationPanel, RetirementAssociationPanelContent, type RetirementAssociationReadState } from "./retirement-association-panel";
import { assertNoLiteralBlockInPhrasingContainer } from "./reserve-literal-dom-test-helpers";

Object.assign(globalThis, { React });

function fixture(): RetirementAssociationDocument {
  const hash = "a".repeat(64);
  const artifact = { id: hash, value: { engineeringFixture: true } };
  return {
    version: "supplemental-economic-calculation-1", key: "retirementAssociation",
    report: buildRetirementAssociationPublic(),
    identity: {
      version: "prospective-economic-identity-1", key: "retirementAssociation",
      claim: economicBridgeContracts.retirementAssociation.claim,
      codeArtifact: { id: hash, contract: "calculation-source-1", files: [{ path: "engineering-fixture", sha256: hash }] },
      sourceArtifact: artifact, materialInputs: artifact, assumptions: artifact, model: artifact,
      parent: { kind: "public-prospective-inputs", id: hash, retainedResultId: null },
      derivation: artifact, resultHash: hash, retainedExecution: false, originalHistoricalExport: false,
      sourceApproval: false, scientificAcceptance: false, id: hash,
    },
  };
}
function render(overrides: Partial<RetirementAssociationReadState> = {}) {
  return renderToStaticMarkup(React.createElement(RetirementAssociationPanelContent, {
    state: { isLoading: false, isFetching: false, isError: false, refetch: () => undefined, ...overrides },
  }));
}
test("retirement hook wrapper mounts pending and current cached states", () => {
  for (const ready of [false, true]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    if (ready) client.setQueryData(RETIREMENT_ASSOCIATION_QUERY_KEY, fixture());
    try {
      const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(RetirementAssociationPanel)));
      assert.match(html, ready ? /retirement-association-ready/ : /aria-busy="true"/);
      assertNoLiteralBlockInPhrasingContainer(html);
    } finally { client.clear(); }
  }
});
test("loading, fetching, error and empty withhold stale values and exports", () => {
  for (const overrides of [{ isLoading: true }, { isFetching: true }, { isError: true, error: new Error("Source refused") }]) {
    const html = render({ data: fixture(), ...overrides });
    assert.doesNotMatch(html, /retirement-association-ready|Public JSON|Public XLSX|>206</);
    assert.match(html, overrides.isError ? /Source refused.*Retry retirement report/ : /aria-busy="true"/);
  }
  for (const data of [null, undefined]) {
    const html = render({ data });
    assert.match(html, /retirement-association-empty/);
    assert.match(html, /Exports are withheld/);
    assert.doesNotMatch(html, /Public JSON|Public XLSX/);
  }
});
test("partial report distinguishes source arithmetic from null actual economics and offline methods", () => {
  const html = render({ data: fixture() });
  assertNoLiteralBlockInPhrasingContainer(html);
  for (const pattern of [/retirement-association-partial/, />206</, />0\.4</, /491/, /285/, /332/, /266/, /80/,
    /not a correction/, /already issuer share/, /Retirement valuation/, /Market-implied retirement/,
    /Association estimate/, /null/, /false/, /Offline conditional engine/, /not executed issuer results/,
    /Missing retirement inputs/, /Missing association evidence/, /Scope3 excluded/, /HC3/,
    /publication instant/i, /SHA|c63273a2d6f8e2da0e4b294c77e8cd5eee50086d8e02e290bee29082da19ea2e/,
    /Public JSON/, /Public XLSX/]) assert.match(html, pattern);
  assert.doesNotMatch(html, /<input|<select/);
});
test("reader admits only exact public source report, literal nulls and prospective envelope", () => {
  const document = fixture();
  assert.equal(parseRetirementAssociationDocument(document), document);
  assert.equal(parseRetirementAssociationDocument(null), null);
  const mutate = (change: (value: any) => void) => {
    const value = structuredClone(document);
    change(value);
    assert.throws(() => parseRetirementAssociationDocument(value), /invalid|nonfinite/);
  };
  for (const change of [
    (v: any) => { v.key = "producerReserve"; },
    (v: any) => { v.identity.key = "producerReserve"; },
    (v: any) => { v.identity.id = "bad"; },
    (v: any) => { v.identity.scientificAcceptance = true; },
    (v: any) => { delete v.identity.materialInputs.value; },
    (v: any) => { v.report.source.facilityNetMW = 0; },
    (v: any) => { v.report.source.sha256 = "b".repeat(64); },
    (v: any) => { v.report.calculated.ownedBookValueUsdMillion = 164.8; },
    (v: any) => { v.report.calculated.capacityRoundingResidualMW = 0; },
    (v: any) => { v.report.retirementResult = 206; },
    (v: any) => { v.report.marketImpliedRetirement = 2040; },
    (v: any) => { v.report.association.actualEstimate = 0; },
    (v: any) => { v.report.association.actualStudyExecuted = true; },
    (v: any) => { v.report.missingRetirementInputs = []; },
    (v: any) => { v.report.extraIssuerCalculation = 12; },
  ]) mutate(change);
});
test("GET and exact JSON exports use only contract routes, reject changed body and service failures", async () => {
  const original = globalThis.fetch;
  const document = fixture();
  let body: unknown = document;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(url);
    assert.equal(init?.method, "GET");
    assert.equal(init?.credentials, "include");
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.deepEqual(await fetchRetirementAssociationDocument(), document);
    assert.deepEqual(JSON.parse(await (await readBoundRetirementAssociationExport(document, "json")).text()), document);
    body = { ...document, identity: { ...document.identity, id: "b".repeat(64) } };
    await assert.rejects(readBoundRetirementAssociationExport(document, "json"), /identity or result changed/);
    body = null;
    assert.equal(await fetchRetirementAssociationDocument(), null);
    await assert.rejects(readBoundRetirementAssociationExport(document, "json"), /identity or result changed/);
    assert.ok(calls.every(url => ["/api/cv/retirement-association", "/api/cv/retirement-association/export.json"].includes(url)));
    globalThis.fetch = async () => new Response("not JSON");
    await assert.rejects(fetchRetirementAssociationDocument(), /did not return JSON/);
    globalThis.fetch = async () => new Response("refused", { status: 503 });
    await assert.rejects(fetchRetirementAssociationDocument(), /503/);
  } finally { globalThis.fetch = original; }
});
test("literal XLSX requires complete exact source, null, container and identity readback", async () => {
  const original = globalThis.fetch;
  const document = fixture();
  let corrupt: "none" | "value" | "formula" | "sheet" = "none";
  globalThis.fetch = async input => {
    assert.equal(String(input), "/api/cv/retirement-association/export.xlsx");
    const rows = [["JSON pointer", "Literal JSON value"], ...economicBridgeCells(document).map(row => [row.pointer, row.jsonValue])];
    if (corrupt === "value") rows.find(row => row[0] === "/report/retirementResult")![1] = "0";
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    if (corrupt === "formula") sheet.B2.f = "1+1";
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, corrupt === "sheet" ? "Other" : "Public calculation");
    return new Response(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  };
  try {
    assert.ok((await readBoundRetirementAssociationExport(document, "xlsx")).size > 0);
    for (const kind of ["value", "formula", "sheet"] as const) {
      corrupt = kind;
      await assert.rejects(readBoundRetirementAssociationExport(document, "xlsx"), /differs|nonliteral|Unexpected/);
    }
  } finally { globalThis.fetch = original; }
});
