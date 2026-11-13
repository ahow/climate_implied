import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { economicBridgeCells } from "../../../shared/economicBridgeSchema";
import {
  canonicalFiniteJson, createPrivateFiniteLoadGuard, readPrivateFiniteDocument,
} from "../lib/private-finite-reader";
import PrivateFiniteViewer, { PrivateFiniteEvidence } from "./private-finite-viewer";

Object.assign(globalThis, { React });

// Synthetic contract fixture only; contains no source or owner input.
function fixture(mode: "stored" | "recalculate" = "stored") {
  const body = {
    version: "private-finite-company-document-1",
    decisionId: "synthetic-decision", financialReviewId: "synthetic-review",
    cutoff: "2025-02-03T04:05:06Z",
    retrievalMode: mode, executionVerifiedNow: mode === "recalculate",
    producer: { sourceIds: ["synthetic"], finiteExecution: { resultHash: "synthetic" } },
    sourceIds: ["synthetic"],
    variables: {
      Input: { value: { "a/b~c": "<img src=x onerror=alert(1)>", assumption: 0.173 }, editable: "Read-only; new review required" },
      Calculated: {
        value: [{ periodic: null, terminal: { balances: { payable: 3.27, receivable: 0 } } }],
        editable: false, units: "USD; UTC dates", equations: ["closing = opening + accrual - settlement"],
      },
      Output: { value: { covered: { wholeEquity: null }, modelVersions: ["synthetic"] }, editable: false, claim: "Conditional only" },
    },
    scientificAcceptance: false, publicDisclosureAuthorized: false,
  };
  return { ...body, id: createHash("sha256").update(canonicalFiniteJson(body)).digest("hex") };
}

test("canonical rules match SHA256 sorted object keys while retaining array order and literal null", async () => {
  assert.equal(canonicalFiniteJson({ z: [null, -0, true], a: "é" }), '{"a":"é","z":[null,0,true]}');
  assert.equal(canonicalFiniteJson({ b: 2, a: 1 }), canonicalFiniteJson({ a: 1, b: 2 }));
  assert.notEqual(canonicalFiniteJson([1, 2]), canonicalFiniteJson([2, 1]));
  for (const value of [undefined, NaN, Infinity, new Date(), Object.create(null)]) {
    assert.throws(() => canonicalFiniteJson(value));
  }
  for (const mode of ["stored", "recalculate"] as const) {
    const document = fixture(mode);
    const result = await readPrivateFiniteDocument(JSON.stringify(document));
    assert.deepEqual(result.document, document);
    assert.equal(result.recalculatedId, document.id);
    assert.deepEqual(result.cells, economicBridgeCells(document));
  }
});

test("reject malformed, wrong-version, altered and inconsistent exports with no substitute", async () => {
  await assert.rejects(readPrivateFiniteDocument("{"));
  await assert.rejects(readPrivateFiniteDocument("null"));
  for (const document of [
    { ...fixture(), version: "other" },
    { ...fixture(), id: "0".repeat(64) },
    { ...fixture(), executionVerifiedNow: true },
    { ...fixture(), scientificAcceptance: true },
    { ...fixture(), publicDisclosureAuthorized: true },
    { ...fixture(), cutoff: "altered" },
    { ...fixture(), producer: undefined },
  ]) await assert.rejects(readPrivateFiniteDocument(JSON.stringify(document)));
});

test("additive fields are bound by ID, not silently stripped by validation", async () => {
  const original = fixture();
  await assert.rejects(readPrivateFiniteDocument(JSON.stringify({ ...original, extra: null })));
  const { id: _id, ...body } = { ...original, extra: { emptyArray: [], emptyObject: {} } };
  const document = { ...body, id: createHash("sha256").update(canonicalFiniteJson(body)).digest("hex") };
  assert.deepEqual((await readPrivateFiniteDocument(JSON.stringify(document))).cells, economicBridgeCells(document));
});

test("actual rendered cells have exact order, identity selectors, escaped text and explicit nulls", async () => {
  const evidence = await readPrivateFiniteDocument(JSON.stringify(fixture()));
  const html = renderToStaticMarkup(React.createElement(PrivateFiniteEvidence, { evidence }));
  assert.equal((html.match(/data-testid="private-finite-cell-row"/g) ?? []).length, evidence.cells.length);
  assert.match(html, /data-testid="private-finite-id"/);
  assert.match(html, /data-testid="private-finite-calculated-id"/);
  assert.match(html, new RegExp(evidence.document.id));
  assert.match(html, /a~1b~0c/);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img|<a |dangerouslySetInnerHTML/);
  assert.match(html, />null<\/code>/);
  let cursor = 0;
  for (let index = 0; index < evidence.cells.length; index++) {
    const next = html.indexOf(`data-row-index="${index}"`, cursor);
    assert.ok(next >= cursor);
    cursor = next + 1;
  }
});

test("initial viewer is empty and exposes local input, reset and authentication boundary", () => {
  const html = renderToStaticMarkup(React.createElement(PrivateFiniteViewer));
  assert.match(html, /private-finite-empty/);
  assert.match(html, /private-finite-file/);
  assert.match(html, /private-finite-reset/);
  assert.match(html, /HTTP-operator authentication is unsupported/);
  assert.match(html, /403/);
  assert.doesNotMatch(html, /private-finite-ready|private-finite-cell-row/);
});

test("monotonic load tickets reject stale A/B/A work and invalidate work on reset", () => {
  const guard = createPrivateFiniteLoadGuard();
  const firstA = guard.next();
  const b = guard.next();
  const secondA = guard.next();
  assert.equal(guard.isCurrent(firstA), false);
  assert.equal(guard.isCurrent(b), false);
  assert.equal(guard.isCurrent(secondA), true);
  guard.next(); // reset / unmount
  assert.equal(guard.isCurrent(secondA), false);
});
