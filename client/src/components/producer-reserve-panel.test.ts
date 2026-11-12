import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { buildPublicProducerReserveReport } from "../../../server/calculation/producerReserveModel";
import { producerPrimaryAuthentication } from "../../../server/calculation/producerPrimaryAuthentication";
import { economicBridgeCells, economicBridgeContracts } from "../../../shared/economicBridgeSchema";
import {
  exactEconomicJson, fetchProducerReserveDocument, parseProducerReserveDocument,
  readBoundProducerReserveExport, type ProducerReserveDocument,
} from "../lib/producer-reserve-reader";
import { ProducerReservePanel, ProducerReservePanelContent, ReserveLiteral, type ProducerReserveReadState } from "./producer-reserve-panel";
import { PRODUCER_RESERVE_QUERY_KEY } from "../hooks/use-producer-reserve";
import { assertNoLiteralBlockInPhrasingContainer } from "./reserve-literal-dom-test-helpers";

// The repository's tsconfig preserves JSX; standalone tsx uses the classic
// transform for shared UI modules. Vite supplies the automatic runtime in-app.
Object.assign(globalThis, { React });

// Engineering identity fixture ONLY. Values are the actual pure worker output;
// the fixture identity does not confer source approval or retained execution.
function documentFixture(): ProducerReserveDocument {
  const hash = "a".repeat(64);
  const artifact = { id: hash, value: { fixture: "engineering identity, not a receipt" } };
  return {
    version: "supplemental-economic-calculation-1", key: "producerReserve",
    report: buildPublicProducerReserveReport(),
    identity: {
      version: "prospective-economic-identity-1", key: "producerReserve",
      claim: economicBridgeContracts.producerReserve.claim,
      codeArtifact: { id: hash, contract: "calculation-source-1", files: [{ path: "engineering-fixture", sha256: hash }] },
      sourceArtifact: { ...artifact, value: { primaryAuthentication: producerPrimaryAuthentication } },
      materialInputs: artifact, assumptions: artifact, model: artifact,
      parent: { kind: "public-prospective-inputs", id: hash, retainedResultId: null },
      derivation: artifact, resultHash: hash, retainedExecution: false, originalHistoricalExport: false,
      sourceApproval: false, scientificAcceptance: false, id: hash,
    },
  };
}
function render(overrides: Partial<ProducerReserveReadState> = {}) {
  return renderToStaticMarkup(React.createElement(ProducerReservePanelContent, {
    state: { isLoading: false, isError: false, isFetching: false, refetch: () => undefined, ...overrides },
  }));
}
test("actual producer hook wrapper mounts pending and current idle cached report states", () => {
  for (const ready of [false, true]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    if (ready) client.setQueryData(PRODUCER_RESERVE_QUERY_KEY, documentFixture());
    try {
      const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(ProducerReservePanel)));
      assert.match(html, ready ? /producer-reserve-ready/ : /aria-busy="true"/);
      assertNoLiteralBlockInPhrasingContainer(html);
    } finally { client.clear(); }
  }
});
test("loading and refreshing suppress cached results and all exports", () => {
  for (const state of [{ isLoading: true }, { isFetching: true }]) {
    const html = render({ data: documentFixture(), ...state });
    assert.match(html, /aria-busy="true"/);
    assert.doesNotMatch(html, /producer-reserve-ready|Public JSON|Public XLSX/);
  }
});
test("error takes precedence over stale data; retry is offered without substitution", () => {
  const html = render({ data: documentFixture(), isError: true, error: new Error("Source identity refused") });
  assert.match(html, /Source identity refused/);
  assert.match(html, /Retry producer result/);
  assert.doesNotMatch(html, /producer-reserve-ready|Public JSON|Public XLSX/);
});
test("absent and null documents render empty, not zero or cached results", () => {
  for (const data of [undefined, null]) {
    const html = render({ data });
    assert.match(html, /producer-reserve-empty/);
    assert.match(html, /Exports are withheld/);
    assert.doesNotMatch(html, /producer-reserve-ready|Public JSON|Public XLSX/);
  }
});
test("ready renders actual worker values, registries, all annual years, sensitivities and refusals", () => {
  const document = documentFixture();
  const html = render({ data: document });
  assertNoLiteralBlockInPhrasingContainer(html);
  assert.match(html, /producer-reserve-ready/);
  assert.match(html, /Public JSON/);
  assert.match(html, /Public XLSX/);
  assert.match(html, /Sourced inputs/);
  assert.match(html, /Conditional assumptions/);
  assert.match(html, /marketEquityTarget/);
  assert.match(html, /Unknown \(null\)/);
  assert.match(html, /Independent of the selected historical analysis archive/);
  assert.doesNotMatch(html, /location-electricity-missing|no public location-electricity result adapter/);
  assert.ok(html.includes(String(document.report.baseResult.decline)));
  for (const row of document.report.annualRows) assert.ok(html.includes(String(row.year)));
  for (const row of document.report.sensitivityRows) assert.ok(html.includes(row.id));
  for (const row of document.report.refusalRows) assert.ok(html.includes(row.status));
});
test("complete current primary authentication is explicit and separate from original frozen gaps, not market acceptance", () => {
  const document = documentFixture();
  const html = render({ data: document });
  const current = html.slice(html.indexOf('data-testid="producer-primary-authentication"'), html.indexOf("</section>", html.indexOf('data-testid="producer-primary-authentication"')));
  const exactAssessment = renderToStaticMarkup(React.createElement(ReserveLiteral, { value: producerPrimaryAuthentication }));
  assert.ok(current.includes(exactAssessment), "Every current allowlisted primary-assessment field and remaining limitation must render");
  assert.match(current, /supplementary-primary-table-authentication-resolved/);
  assert.match(current, /2025-02-19T21:39:37Z/);
  assert.match(current, /producerNumericFactsMatched/);
  assert.match(current, />39</);
  assert.match(current, /comparedRows/);
  assert.match(current, />38</);
  assert.match(current, /comparedNumericCells/);
  assert.match(current, />261</);
  assert.match(current, /do not establish market-implied decline, successor-security continuity, owner approval, scientific acceptance/);
  assert.match(html, /Original frozen-report source gaps · declaration-time record, not current primary-authentication status/);
  // The original declaration is still available, not rewritten or deleted.
  assert.ok(html.includes(document.report.sourceGaps[5]));
  assert.deepEqual(document.report, buildPublicProducerReserveReport(), "Supplementary authentication must not alter frozen report, assumptions, inputs or roots");
  assertNoLiteralBlockInPhrasingContainer(html);
});
test("absent supplemental primary authentication is named unavailable, never a completed primary review", () => {
  const document = documentFixture();
  document.identity.sourceArtifact.value = {};
  const html = render({ data: document });
  assert.match(html, /Current primary authentication was not returned/);
  assert.doesNotMatch(html, /supplementary-primary-table-authentication-resolved/);
});
test("ReserveLiteral null, scalar, array and nested object branches emit valid block-capable markup", () => {
  for (const value of [null, undefined, false, 0, "source text", [], [0.017], { roots: [0.017, null], nested: { value: [1, 2] } }]) {
    const html = renderToStaticMarkup(React.createElement("div", null, React.createElement(ReserveLiteral, { value })));
    assertNoLiteralBlockInPhrasingContainer(html);
  }
  // Ensure this regression check actually detects the original screenshot bug.
  assert.throws(() => assertNoLiteralBlockInPhrasingContainer("<p>Roots: <ol><li>0.017</li></ol></p>"), /must not descend/);
});
test("every ReserveLiteral consumer uses a block-capable ancestor, never p, heading or inline wrappers", () => {
  const forbidden = new Set(["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "a", "button", "label", "strong", "em", "code", "pre"]);
  let consumers = 0;
  function inspectDirectory(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { inspectDirectory(path); continue; }
      if (!entry.name.endsWith(".tsx")) continue;
      const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      function visit(node: ts.Node) {
        if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === "ReserveLiteral") {
          consumers++;
          for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
            if (ts.isJsxElement(ancestor)) {
              const tag = ancestor.openingElement.tagName.getText(source);
              assert.ok(!forbidden.has(tag), `${path}: ReserveLiteral can emit ol/dl; <${tag}> cannot contain it`);
            }
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  inspectDirectory("client/src");
  assert.ok(consumers > 0, "Must inspect actual ReserveLiteral consumers");
});
test("refused base, empty annual path and empty sensitivities never fabricate calculations", () => {
  const document = documentFixture();
  document.report.baseResult = document.report.refusalRows[0];
  document.report.annualRows = [];
  document.report.sensitivityRows = [];
  const html = render({ data: document });
  assert.match(html, /Annual path unavailable/);
  assert.match(html, /No sensitivity cases returned/);
  assert.match(html, /nonidentified/);
  assert.match(html, /Unknown \(null\)/);
});
test("literal renderer distinguishes null, missing, false, zero and nonfinite", () => {
  const literal = (value: unknown) => renderToStaticMarkup(React.createElement(ReserveLiteral, { value }));
  assert.match(literal(null), /Unknown \(null\)/);
  assert.match(literal(undefined), /not returned/);
  assert.match(literal(false), />false</);
  assert.match(literal(0), />0</);
  assert.match(literal(NaN), /nonfinite/);
});
test("contract validation is fail closed and preserves additive response fields", () => {
  const document = documentFixture();
  assert.equal(parseProducerReserveDocument(document), document);
  assert.equal(parseProducerReserveDocument(null), null);
  const extra = { ...document, additiveField: { note: "preserved for exact export binding" } };
  assert.equal(parseProducerReserveDocument(extra), extra);
  for (const mutate of [
    (value: any) => { value.key = "locationElectricity"; },
    (value: any) => { value.identity.sourceApproval = true; },
    (value: any) => { value.report.marketImpliedDecline = 0; },
    (value: any) => { delete value.report.sourceRegister[0].scope; },
    (value: any) => { value.report.annualRows[0].revenue = NaN; },
    (value: any) => { value.report.baseResult.decline = null; },
    (value: any) => { value.identity.id = "unknown"; },
  ]) {
    const value = structuredClone(document);
    mutate(value);
    assert.throws(() => parseProducerReserveDocument(value), /contract is invalid/);
  }
  assert.throws(() => exactEconomicJson({ missing: undefined }), /non-JSON/);
});
test("same-origin read and JSON export use zero query pins, reject changed identities", async () => {
  const document = documentFixture();
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  let body: unknown = document;
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    assert.equal(init?.credentials, "include");
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  try {
    assert.deepEqual(await fetchProducerReserveDocument(), document);
    const blob = await readBoundProducerReserveExport(document, "json");
    assert.deepEqual(JSON.parse(await blob.text()), document);
    body = { ...document, identity: { ...document.identity, id: "b".repeat(64) } };
    await assert.rejects(readBoundProducerReserveExport(document, "json"), /identity or result changed/);
    const changedPrimary = structuredClone(document);
    changedPrimary.identity.sourceArtifact.value = { primaryAuthentication: { ...producerPrimaryAuthentication, producerNumericFactsMatched: 0 } };
    body = changedPrimary;
    await assert.rejects(readBoundProducerReserveExport(document, "json"), /identity or result changed/);
    assert.deepEqual(calls, ["/api/cv/producer-reserve", "/api/cv/producer-reserve/export.json", "/api/cv/producer-reserve/export.json", "/api/cv/producer-reserve/export.json"]);
  } finally { globalThis.fetch = originalFetch; }
});
test("XLSX exports require literal full-body readback, including identity, units and nulls", async () => {
  const document = documentFixture();
  const originalFetch = globalThis.fetch;
  let changed = false;
  let formula = false;
  let primaryChanged = false;
  globalThis.fetch = async () => {
    const value = structuredClone(document);
    if (changed) value.report.moneyUnit = "changed" as "USD million";
    if (primaryChanged) value.identity.sourceArtifact.value = { primaryAuthentication: { ...producerPrimaryAuthentication, publishedAt: null } };
    const sheet = XLSX.utils.aoa_to_sheet([
      ["JSON pointer", "Literal JSON value"], ...economicBridgeCells(value).map(row => [row.pointer, row.jsonValue]),
    ]);
    if (formula) sheet.B2.f = "1+1";
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Public calculation");
    return new Response(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  };
  try {
    assert.ok((await readBoundProducerReserveExport(document, "xlsx")).size > 0);
    changed = true;
    await assert.rejects(readBoundProducerReserveExport(document, "xlsx"), /differs from this panel/);
    changed = false;
    primaryChanged = true;
    await assert.rejects(readBoundProducerReserveExport(document, "xlsx"), /differs from this panel/);
    primaryChanged = false;
    formula = true;
    await assert.rejects(readBoundProducerReserveExport(document, "xlsx"), /nonliteral content/);
  } finally { globalThis.fetch = originalFetch; }
});
