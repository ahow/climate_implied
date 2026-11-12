import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeadlineDrilldownReview } from "../client/src/components/headline-drilldown";
import { retainProducerDownload, captureExactProducerIdentity } from "../client/src/lib/producer-download";
import { contentHash } from "../server/calculation/analysisManifest";
import { headlineDrilldownLabels, headlineDrilldownUrl, type HeadlineDrilldown } from "../shared/headlineDrilldown";

(globalThis as any).React = React;
// Synthetic response-bound UI fixture only. Retained archive/replay/hash
// authenticity is independently exercised by headline-drilldown.test.ts.
async function fixture() {
  const payload = { engineeringOnly: true };
  const hash = (name: string) => contentHash({ engineeringIdentity: name });
  const proof = {
    version: "retained-producer-binding-v1" as const,
    resultId: hash("result"), resultHash: contentHash(payload), manifestId: hash("manifest"),
    materialInputsId: hash("material"), codeArchiveId: hash("code"), orderedSnapshotHashes: [hash("source")],
    modelVersion: "engineering-ui-only", scenario: "source-backed:native-candidate-1", scientificAcceptance: false as const,
  };
  const response = retainProducerDownload(new Response(JSON.stringify(payload), {
    headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") },
  }));
  const headline = await response.json();
  const parent = captureExactProducerIdentity(headline)!;
  const selection = { parent: parent.resultId, year: 2050 };
  const data: HeadlineDrilldown = {
    version: "headline-drilldown-1", mode: "contributions", label: headlineDrilldownLabels.contributions,
    parent, memberId: "engineering-member", seed: null, selection,
    derivation: { id: hash("derivation"), codeHash: hash("drilldown-code"), method: "exact Shapley",
      baseline: "constant activity", groups: { land: ["engineering-driver"] },
      reconciliationNativeMt: 0, parentReportingGtCO2e: 0, targetReportingGtCO2e: 0, filters: "global only" },
    rows: [0, -1].map(value => ({ region: "global", sector: "land", sectorCode: "engineering-land",
      gas: "CO2", driver: "engineering-driver", year: 2050, memberId: "engineering-member",
      baselineNativeMt: 0, targetNativeMt: value, revertedDriverNativeMt: null,
      valueNativeMt: value, gwp100: 1, valueGtCO2e: value / 1000 })),
    limitations: ["Engineering only; no regional allocation"], scientificAcceptance: false,
  };
  return { headline, data, selection };
}
function render(headline: unknown, data?: unknown, state?: Record<string, unknown>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const parent = captureExactProducerIdentity(headline);
  if (parent) {
    const key = [headlineDrilldownUrl("contributions", { parent: parent.resultId, year: 2050 })];
    if (data !== undefined) client.setQueryData(key, data);
    if (state) {
      const query = client.getQueryCache().find({ queryKey: key }) ?? client.getQueryCache().build(client, { queryKey: key });
      query.setState(state);
    }
  }
  try {
    return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(HeadlineDrilldownReview, { headline })));
  } finally { client.clear(); }
}
test("headline review refuses absent, cloned or changed consumed parent without an unrelated read", async () => {
  const { headline } = await fixture();
  for (const value of [null, {}, structuredClone(headline), { ...headline, changed: true }]) {
    assert.match(render(value), /no unchanged retained producer identity/);
    assert.doesNotMatch(render(value), /<select|Download selected/);
  }
  headline.changed = true;
  const client = new QueryClient();
  try {
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(HeadlineDrilldownReview, { headline })));
    assert.match(html, /no unchanged retained producer identity/);
  } finally { client.clear(); }
});
test("actual headline component pending/error/absent states withhold retained rows and both downloads", async () => {
  const { headline, data } = await fixture();
  assert.match(render(headline), /Loading exact retained-headline drilldown/);
  for (const state of [{ fetchStatus: "fetching" }, { status: "error", error: new Error("Exact read refused"), fetchStatus: "idle" }]) {
    const html = render(headline, data, state);
    assert.doesNotMatch(html, /engineering-driver|Download selected|<tbody>/);
    assert.match(html, /Loading exact retained-headline|Exact read refused/);
  }
  assert.match(render(headline, null), /Selected drilldown unavailable or invalid/);
  assert.doesNotMatch(render(headline, null), /Download selected|<tbody>/);
});
test("actual headline component exact parent/mode/filter mismatches refuse all result and export content", async () => {
  const { headline, data } = await fixture();
  for (const changed of [{ ...data, mode: "sensitivities" }, { ...data, parent: { ...data.parent, manifestId: "f".repeat(64) } },
    { ...data, selection: { ...data.selection, gas: "CH4" } }, { ...data, scientificAcceptance: true }]) {
    const html = render(headline, changed);
    assert.match(html, /Selected drilldown unavailable or invalid/);
    assert.doesNotMatch(html, /Download selected|<tbody>/);
  }
});
test("actual headline ready render preserves signed land and zero and pins both manifest-qualified downloads", async () => {
  const { headline, data, selection } = await fixture();
  const html = render(headline, data);
  assert.match(html, /0\.0000000/);
  assert.match(html, /-1\.0000000/);
  assert.match(html, /Signed land is retained/);
  assert.match(html, /Six-region and international-transport allocations are unavailable/);
  assert.match(html, /One-at-a-time sensitivities \(nonadditive\)/);
  for (const format of ["json", "xlsx"] as const) {
    const href = `${headlineDrilldownUrl("contributions", selection, format)}&downloadMetadata=manifest-v1`;
    assert.ok(html.includes(href.replaceAll("&", "&amp;")), href);
  }
});
