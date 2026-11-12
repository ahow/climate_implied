import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as XLSX from "xlsx";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { candidateInventory, constantScenario, illustrativeScenario, projectNativeEmissions } from "../server/calculation/emissionsCandidate";
import { projectRegionalMember, REGIONS } from "../server/calculation/regionalEngine";
import { nativeCandidateResidualDiagnostics, regionalNativeResidualDiagnostics } from "../server/calculation/nativeThresholdDiagnostics";
import { nativeResidualDiagnosticsSchema, regionalNativeResidualRequestSchema } from "../shared/nativeThresholdSchema";
import { bindNestedOutput, bindExportColumns } from "../shared/outputFieldSemantics";
import { resolveEmissionsInputs } from "../server/calculation/emissionsInputs";
import { nativeThresholdExportRows, nativeThresholdExportBindings } from "../client/src/lib/native-threshold-export";
import { nativeExportColumns, nativeExportRow } from "../shared/nativeExport";
import { EmissionsCandidateReview } from "../client/src/components/emissions-candidate-review";
import { releaseSafety } from "../server/releaseSafety";
import { nativeCandidateHandler } from "../server/nativeCandidateApi";

function regionalFixture() {
  // Engineering capture fixture, NOT an observational regional allocation.
  return { inventoryId: "engineering-captured-regional-initial-condition-not-observations", memberId: "fixture-member",
    cells: REGIONS.flatMap(region => candidateInventory().cells.map(c => ({
      region, gas: c.gas, sector: c.sector, nativeMt: c.nativeMt / 6,
    }))), scenarios: REGIONS.map(region => ({ region, scenario: { ...constantScenario } })) };
}
function handler(method: "get" | "post", path: string) {
  const source = ts.createSourceFile("server/routes.ts", readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let registration = "", fn: (req: unknown, res: unknown) => void;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === `app.${method}` &&
      ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path) registration = node.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(registration);
  const sandbox = { resolveEmissionsInputs, projectNativeEmissions, constantScenario, illustrativeScenario,
    candidateInventory, nativeCandidateResidualDiagnostics, regionalNativeResidualDiagnostics,
    projectRegionalMember, nativeResidualDiagnosticsSchema, regionalNativeResidualRequestSchema, bindNestedOutput,
    nativeCandidateHandler: () => nativeCandidateHandler({
      captureSource: async () => { throw new Error("Isolated test archive unavailable; no producer attestation"); },
      saveArchive: async () => { throw new Error("Must not reach archive save after capture failure"); },
      saveResult: async () => { throw new Error("Must not reach result save after capture failure"); },
      loadResult: async () => { throw new Error("Must not reach result read after capture failure"); },
    }),
    app: { [method]: (_: string, value: typeof fn) => { fn = value; } } };
  vm.runInNewContext(ts.transpile(registration, { target: ts.ScriptTarget.ES2022 }), sandbox);
  return async (req: unknown) => {
    let body: any, status = 200;
    const headers: Record<string, string> = {};
    const res = { set: (k: string, v: string) => { headers[k] = v; return res; },
      status: (n: number) => { status = n; return res; }, json: (v: unknown) => { body = v; return res; } };
    await fn(req, res);
    return { body, status, headers };
  };
}

test("actual captured source-derived native inventory supports27 conditional same-species baselines, never CO2e", () => {
  const result = projectNativeEmissions(constantScenario, 2030), before = JSON.stringify(result);
  const d = nativeResidualDiagnosticsSchema.parse(nativeCandidateResidualDiagnostics(result));
  assert.equal(d.records.length, 27);
  for (const r of d.records) {
    assert.equal(r.diagnostic.status, "right-censored");
    assert.equal(r.diagnostic.year, null);
    assert.equal(r.diagnostic.horizonYear, 2030);
    assert.equal(r.diagnostic.thresholdValue, 0.05 * r.diagnostic.baselineValue!);
    assert.equal(r.diagnostic.baselineEvidenceId, d.baselineInputId);
  }
  const methane = d.records.find(r => r.gas === "CH4")!.diagnostic;
  assert.equal(methane.baselineValue, candidateInventory().cells.filter(c => c.gas === "CH4").reduce((s, c) => s + c.nativeMt, 0));
  assert.equal(methane.basis!.unit, "Mt CH4/year");
  assert.notEqual(methane.baselineValue, candidateInventory().reporting.components.CH4);
  assert.equal(d.records.find(r => r.gas === "CO2-FFI")!.diagnostic.baselineValue, result.trajectory[0].co2FossilMt);
  assert.equal(d.records.find(r => r.gas === "CO2-LULUCF")!.diagnostic.baselineValue, result.trajectory[0].co2LandUseMt);
  assert.equal(d.records.some(r => r.gas === "CO2"), false);
  assert.equal(JSON.stringify(result), before, "Original native outputs are not rewritten");
  assert.match(d.qualification, /not independently redownloaded/);
});
test("missing/changed candidate provenance or2024 input cannot authenticate itself from modeled output", () => {
  const result = projectNativeEmissions(constantScenario, 2025);
  for (const inventory of [
    { ...candidateInventory(), sourceRevision: "" },
    { ...candidateInventory(), year: 2023 },
    { ...candidateInventory(), cells: candidateInventory().cells.map(c => ({ ...c, nativeMt: c.nativeMt * 2 })) },
  ]) {
    const d = nativeCandidateResidualDiagnostics(result, inventory);
    assert.ok(d.records.every(r => r.diagnostic.status === "withheld"));
    assert.ok(d.records.every(r => r.diagnostic.baselineEvidenceId === null));
  }
});
test("a qualified native gas crossing is conditional on its own selected scenario, not a quantile or net-zero claim", () => {
  const result = projectNativeEmissions({ ...constantScenario, name: "engineering-zero-industry-sensitivity",
    sectorPathways: { industry: { annualActivityGrowth: 0, residualIntensityImprovement: 1, trendEndYear: 2030 } } }, 2025);
  const r = nativeCandidateResidualDiagnostics(result).records.find(r => r.gas === "c-C4F8")!;
  assert.equal(r.diagnostic.status, "reached");
  assert.equal(r.diagnostic.year, 2025, "Equality/zero at actual final year counts; no extrapolation");
  assert.equal(r.diagnostic.notNetZero, true);
  assert.match(r.memberId, /not-an-ensemble/);
});
test("explicit captured regional member cells stay same-region/member/gas; negative land baseline withholds", () => {
  const input = regionalFixture();
  const china = input.cells.find(c => c.region === "China" && c.sector === "LULUCF")!;
  const row = input.cells.find(c => c.region === "Rest of World" && c.sector === "LULUCF")!;
  row.nativeMt += china.nativeMt + 10; china.nativeMt = -10;
  const member = projectRegionalMember(input, 2026), before = JSON.stringify(member);
  const d = nativeResidualDiagnosticsSchema.parse(regionalNativeResidualDiagnostics(member, 2024));
  assert.ok(regionalNativeResidualDiagnostics(member, null).records.every(r => r.diagnostic.status === "withheld"),
    "Generated2024 rows do not replace the required selected2024 regional input declaration");
  assert.equal(d.records.length, 162);
  assert.match(d.qualification, /MODEL baseline/);
  for (const r of d.records) {
    assert.equal(r.memberId, input.memberId);
    assert.equal(r.diagnostic.basis!.gasBasis, `native-mass:${r.gas}:${r.region}`);
    if (r.gas === "CO2-LULUCF" && r.region === "China") assert.equal(r.diagnostic.status, "withheld");
    else assert.equal(r.diagnostic.status, "right-censored");
  }
  assert.equal(JSON.stringify(member), before, "No engine result/archive augmentation");
});
test("actual candidate GET and regional submitted-input POST handlers emit strict mapped supplemental diagnostics", async () => {
  const get = handler("get", "/api/emissions/candidate");
  for (const scenario of ["constant", "transition", "dashboard"]) {
    const { body, status, headers } = await get({ query: { scenario } });
    assert.equal(status, 200);
    const d = nativeResidualDiagnosticsSchema.parse(body.residualDiagnostics);
    assert.equal(d.records.length, 27);
    assert.ok(d.records.every(r => r.diagnostic.status !== "withheld"), "All27 actual source/captured native baselines qualify in each current candidate case");
    assert.equal(headers["X-Field-Semantics-Family"], "native");
    assert.ok(bindNestedOutput("native", body).length > 152);
    const original = projectNativeEmissions(scenario === "dashboard" ? body.inputs.diagnostic :
      scenario === "transition" ? illustrativeScenario : constantScenario);
    assert.equal(JSON.stringify(body.result), JSON.stringify(original));
  }
  assert.equal((await get({ query: { scenario: "unknown" } })).status, 400);
  const post = handler("post", "/api/emissions/regional-residual-diagnostics");
  let allowed = false;
  releaseSafety()({ path: "/api/emissions/regional-residual-diagnostics", method: "POST" } as any,
    {} as any, () => { allowed = true; });
  assert.equal(allowed, true, "Real release-safety boundary admits this bounded pure diagnostic, not an operator write");
  const success = await post({ body: { baselineYear: 2024, input: regionalFixture() } });
  assert.equal(success.status, 200);
  assert.equal(nativeResidualDiagnosticsSchema.parse(success.body.residualDiagnostics).records.length, 162);
  assert.ok(bindNestedOutput("native", success.body).length > 0);
  assert.equal((await post({ body: { inventoryId: "missing-inputs" } })).status, 422);
  assert.equal((await post({ body: { input: regionalFixture() } })).status, 422);
  assert.equal((await post({ body: { baselineYear: 2023, input: regionalFixture() } })).status, 422);
  const d = success.body.residualDiagnostics;
  assert.equal(nativeResidualDiagnosticsSchema.safeParse({ ...d, unknown: true }).success, false);
  const clone = JSON.parse(JSON.stringify(d));
  clone.records[0].diagnostic.basis.unit = "Gt CO2e/year";
  assert.equal(nativeResidualDiagnosticsSchema.safeParse(clone).success, false);
  const unknownGas = JSON.parse(JSON.stringify(d));
  unknownGas.records[0].gas = "invented-gas";
  assert.equal(nativeResidualDiagnosticsSchema.safeParse(unknownGas).success, false);
});
test("new separate21-column native diagnostic export roundtrips; old35 native quantities and UI qualification remain", () => {
  const result = projectNativeEmissions(constantScenario, 2030);
  const d = nativeCandidateResidualDiagnostics(result), rows = nativeThresholdExportRows(d.records);
  assert.equal(Object.keys(rows[0]).length, 21);
  const bindings = bindExportColumns(rows, nativeThresholdExportBindings);
  assert.equal(bindings.length, 21);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Native residual diagnostic");
  const read = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const restored = XLSX.utils.sheet_to_json<any>(read.Sheets["Native residual diagnostic"], { defval: null });
  assert.equal(restored[0]["Threshold value"], rows[0]["Threshold value"]);
  assert.equal(restored[0].Gas, rows[0].Gas);
  assert.equal(restored[0].Region, "Global");
  assert.equal(restored[0]["Year emissions reach 5% of 2024"], null);
  assert.equal(nativeExportColumns.length, 35);
  assert.equal(Object.keys(nativeExportRow(result.trajectory[0])).length, 35);
  (globalThis as any).React = React;
  const client = new QueryClient();
  client.setQueryData(["/api/emissions/candidate?scenario=constant"], { result, residualDiagnostics: d });
  const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(EmissionsCandidateReview)));
  assert.match(html, /native-mass diagnostics/);
  assert.match(html, /Mt CH4\/year/);
  assert.match(html, /not calibrated or scientifically promoted/);
  assert.match(html, /Download separate native threshold diagnostics/);
  assert.doesNotMatch(html, /On Track|Delayed/);
  client.setQueryData(["/api/emissions/candidate?scenario=constant"],
    { result: { ...result, version: "native-emissions-candidate-2" }, residualDiagnostics: d });
  const oldEngine = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(EmissionsCandidateReview)));
  assert.match(oldEngine, /Candidate emissions could not be loaded/);
  assert.match(oldEngine, /Unsupported native engine response native-emissions-candidate-2/);
  assert.doesNotMatch(oldEngine, /data-testid="native-residual-diagnostics"/);
  client.setQueryData(["/api/emissions/candidate?scenario=constant"], { result });
  const missing = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(EmissionsCandidateReview)));
  assert.match(missing, /No default or legacy baseline is substituted/);
  assert.doesNotMatch(missing, /data-testid="native-residual-diagnostics"/);
  client.setQueryData(["/api/emissions/candidate?scenario=constant"], { result, residualDiagnostics: { ...d, unknown: true } });
  const malformed = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(EmissionsCandidateReview)));
  assert.match(malformed, /Candidate emissions could not be loaded/);
  assert.doesNotMatch(malformed, /data-testid="native-residual-diagnostics"/);
  client.clear();
});
