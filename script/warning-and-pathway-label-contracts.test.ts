import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import ts from "typescript";
import { PublishedScenarioReferences } from "../client/src/components/published-scenario-references";
import { ValuationNotice } from "../client/src/components/valuation-notice";
import { ALL_COMMITMENTS_LABEL, hasReviewedAllCommitmentsLabel } from "../shared/referenceScenarioLabels";
import { bindNestedOutput } from "../shared/outputFieldSemantics";
import { validateNativePair } from "../server/calculation/nativePathwayContract";
import { historicalTrajectoryMetrics } from "../server/calculation/historicalMetrics";
import references from "../server/calculation/data/catReferences.json";
import warnings from "../docs/S16-013-warning-resolution-register.json";

(globalThis as any).React = React;
const read = (path: string) => readFileSync(path, "utf8");
const normalize = (text: string) => text.replace(/\s+/g, " ");
function renderReferences(data: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity } } });
  client.setQueryData(["/api/reference-scenarios"], data);
  try {
    return renderToStaticMarkup(React.createElement(QueryClientProvider, { client },
      React.createElement(PublishedScenarioReferences)));
  } finally { client.clear(); }
}
test("actual published UI and API/JSON-export binding share the reviewed full-commitments label", () => {
  const body = JSON.parse(JSON.stringify(references));
  assert.equal(body.scenarios[1].label, ALL_COMMITMENTS_LABEL);
  assert.ok(hasReviewedAllCommitmentsLabel(body.scenarios[1]));
  const html = renderReferences(body);
  assert.equal(html.split(ALL_COMMITMENTS_LABEL).length - 1, 2, "card and milestone table agree");
  assert.match(html, /Optimistic scenario \(net-zero pledges\)/);
  assert.match(html, /including long-term net-zero announcements/);
  assert.match(html, /NDCs excludes long-term net-zero pledges/);
  assert.match(html, /not.*dashboard-generated projections/);
  const zero = structuredClone(body);
  zero.scenarios[1].temperatureMedianC = 0;
  zero.scenarios[1].emissions.forEach((point: { value: number }) => { point.value = 0; });
  assert.match(renderReferences(zero), /0\.0°C/, "valid zero is not an unavailable label/scope");
  assert.match(read("server/routes.ts"), /res\.json\(catReferences\)/);
  const fields = bindNestedOutput("publishedReference", body);
  for (const id of ["publishedReference.scenarios[].label", "publishedReference.scenarios[].publishedName",
    "publishedReference.scenarios[].definition", "publishedReference.scenarios[].emissions[].value"])
    assert.ok(fields.some(field => field.id === id), id);
  assert.doesNotMatch(read("client/src/components/published-scenario-references.tsx"), /DownloadDataButton|DownloadJsonButton/);
});
test("actual UI withholds NDC-only, contradictory or missing commitment identities rather than relabelling them", () => {
  for (const patch of [
    { publishedName: "NDCs" },
    { publishedName: "Nationally Determined Contributions (NDCs)" },
    { publishedName: "Net Zero 2050" },
    { definition: "NDC-only targets; long-term net-zero pledges excluded." },
    { definition: undefined },
    { publishedName: undefined },
    { label: "NDC targets" },
    { id: "ndc-only" },
  ]) {
    const body = structuredClone(references);
    Object.assign(body.scenarios[1], patch);
    const html = renderReferences(body);
    assert.match(html, /No complete, valid published reference is available/);
    assert.doesNotMatch(html, /1\.9°C|All announced commitments delivered<\/h3>/);
  }
});
test("retained pre-fix UI validator really admitted an NDC-only definition under the commitments ID", () => {
  const source = execFileSync("git", ["show", "40c524b29bec455f51e0bb9ac7d3efabe0218e3e:client/src/components/published-scenario-references.tsx"], { encoding: "utf8" });
  const ast = ts.createSourceFile("original.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(["milestoneYears", "isRecord", "isText", "isFiniteNumber", "isHttpsUrl"]);
  const declarations = ast.statements.filter(node =>
    ts.isFunctionDeclaration(node) && node.name?.text === "isPublishedReferences" ||
    ts.isVariableStatement(node) && node.declarationList.declarations.some(d => names.has(d.name.getText(ast))));
  const js = ts.transpileModule(declarations.map(node => node.getText(ast)).join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const originalValidator = new Function(`${js};return isPublishedReferences;`)();
  const poison = structuredClone(references);
  poison.scenarios[1].definition = "NDC-only targets; long-term net-zero pledges excluded.";
  assert.equal(originalValidator(poison), true, "retained failure reproduced, not a hypothetical helper-only claim");
  assert.match(renderReferences(poison), /No complete, valid published reference/);
});
test("actual native calculation/export refuses NDC-only commitments and preserves unpromoted accounting status", () => {
  const input = ["implemented-policies", "announced-commitments"].map(scenario => ({
    scenario, source: { url: "https://example.org/engineering-only", revision: "isolated",
      policyCutoff: "2026-01", includesLongTermPledges: true, processingStage: "raw" },
    unit: "Mt gas/year", years: Array.from({ length: 77 }, (_, i) => 2024 + i),
    gases: { CH4: Array(77).fill(2) },
  }));
  input[1].source.includesLongTermPledges = false;
  assert.throws(() => validateNativePair(input, { CH4: 2 }), /NDC-only pathways cannot be relabelled/);
  input[1].source.includesLongTermPledges = true;
  const exported = JSON.parse(JSON.stringify(validateNativePair(input, { CH4: 2 })));
  assert.equal(exported.status, "accounting-valid-not-scientifically-promoted");
  assert.equal(exported.scenarios[1].source.includesLongTermPledges, true);
  assert.equal(exported.scenarios[1].scenario, "announced-commitments");
});
test("every recorded removed warning has its actual original text, current replacement and linked resolution", () => {
  assert.equal(warnings.originalHosts.length, 12);
  assert.equal(warnings.removedWarnings.length, 3);
  const actualOriginalHosts = execFileSync("git", ["grep", "-l", "-i", "-E", warnings.scanPattern,
    warnings.originalSourceRevision, "--", "client/src"], { encoding: "utf8" })
    .trim().split("\n").map(line => line.slice(line.indexOf(":") + 1)).sort();
  assert.deepEqual(warnings.originalHosts.map(host => host.path).sort(), actualOriginalHosts,
    "inventory denominator is the actual retained source scan, not placeholder entries");
  for (const host of warnings.originalHosts) {
    const original = normalize(execFileSync("git", ["show", `${warnings.originalSourceRevision}:${host.path}`], { encoding: "utf8" }));
    assert.ok(original.includes(normalize(host.originalExcerpt)), `original ${host.path}`);
    for (const fragment of host.currentRequired)
      assert.ok(normalize(read(host.path)).includes(fragment), `${host.path}: ${fragment}`);
  }
  for (const removed of warnings.removedWarnings) {
    assert.ok(warnings.resolutions.some(record => record.id === removed.resolution));
    assert.ok(execFileSync("git", ["show", `${warnings.originalSourceRevision}:${removed.path}`], { encoding: "utf8" }).includes(removed.originalText));
    assert.ok(!read(removed.path).includes(removed.originalText));
  }
  const preview = warnings.additionalHistoricalSelectionWarning;
  assert.ok(normalize(read(preview.path)).includes(preview.originalText));
});
test("actual fixed5Gt calculator resolves extrapolation only, not physical/net-zero/scientific limitations", () => {
  const rows = Array.from({ length: 77 }, (_, i) => ({ year: 2024 + i, p50: 60 - i / 2 }));
  assert.equal(historicalTrajectoryMetrics(rows).netZeroYear, null);
  rows[76].p50 = 5;
  const result = historicalTrajectoryMetrics(rows);
  assert.equal(result.netZeroYear, 2100);
  assert.equal(result.legacyFixed5Gt.notNetZero, true);
  assert.equal(result.legacyFixed5Gt.version, "fixed-5gt-v1");
  const html = renderToStaticMarkup(React.createElement(Router, { ssrPath: "/climate-valuation" },
    React.createElement(ValuationNotice)));
  for (const text of ["no defensible valuation-to-activity mapping", "Workbook currency compatibility is unverified",
    "not validated investment evidence", "not decarbonisation rates or market climate expectations"])
    assert.ok(normalize(html).includes(text));
});
