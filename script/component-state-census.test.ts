import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { componentStateCensus } from "./component-state-census";
import { contractFor, economicBridgeComponentPolicies, filePolicies, focusedRenderComponents } from "./component-state-contracts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WarmingValidationReference } from "../client/src/components/warming-validation-reference";
import { warmingReferenceExportDocument } from "../shared/warmingValidationReferenceSemantics";

const economicConsumers = [
  "producer-reserve-panel.tsx#ProducerReservePanel",
  "producer-reserve-panel.tsx#ProducerReservePanelContent",
  "producer-reserve-panel.tsx#ProducerReserveReportView",
  "producer-reserve-panel.tsx#ReserveLiteral",
  "producer-reserve-panel.tsx#Disclosure",
  "producer-reserve-panel.tsx#Result",
  "location-electricity-panel.tsx#LocationElectricityPanel",
  "location-electricity-panel.tsx#LocationElectricityPanelContent",
  "location-electricity-panel.tsx#LocationElectricityReportView",
  "location-electricity-panel.tsx#Source",
].map(id => `client/src/components/${id}`);

test("actual domain consumers have source-located expressions and explicit state policies, not placeholder slots", () => {
  const report = componentStateCensus();
  assert.equal(report.componentCount, 87, "Prior77 plus exact6 producer and4 location-electricity consumers; no old acceptance permutations expanded");
  assert.equal(report.focusedRenderedComponentCount, 87);
  assert.deepEqual(report.individuallyUnrenderedComponentIds, []);
  assert.equal(new Set(report.components.map(component => component.id)).size, report.componentCount);
  assert.equal(report.dynamicExpressionCount, report.components.reduce((sum, component) => sum + component.expressions.length, 0));
  for (const component of report.components) {
    assert.ok(component.routes.length > 0, component.id);
    assert.ok(component.dynamicExpressionCount > 0, component.id);
    const source = readFileSync(component.file, "utf8");
    for (const expression of component.expressions) {
      assert.ok(expression.span[0] >= 0 && expression.span[1] <= source.length, component.id);
      assert.ok(expression.span[1] > expression.span[0], component.id);
      assert.ok(expression.line > 0, component.id);
    }
    for (const state of ["missing", "null", "refusal", "loading", "error", "selection", "zero", "scope"]) {
      assert.ok(component.contract[state]?.length > 20, `${component.id}:${state}`);
    }
  }
  assert.equal(report.focusedRenderedComponentCount, report.components.filter(component => focusedRenderComponents.has(component.component)).length);
  assert.equal(report.individuallyUnrenderedComponentIds.length + report.focusedRenderedComponentCount, report.componentCount);
  assert.match(report.fieldBranchCoverage, /Not claimed/);
  const economic = report.components.filter(component => economicConsumers.includes(component.id));
  assert.deepEqual(economic.map(component => component.id).sort(), [...economicConsumers].sort());
  assert.deepEqual(Object.keys(economicBridgeComponentPolicies).map(id => `client/src/components/${id}`).sort(), [...economicConsumers].sort());
  for (const component of economic) {
    assert.deepEqual(component.routes, ["/climate-valuation"]);
    assert.match(component.contract.focusedEvidence, /economic-bridge-ui\.test\.ts/);
    assert.equal(component.contract.inputKind,
      ["ProducerReservePanel", "LocationElectricityPanel"].includes(component.component) ? "queried-evidence" :
        component.component === "Disclosure" ? "presentation-control" : "supplied-result");
  }
  assert.throws(() => contractFor("client/src/components/producer-reserve-panel.tsx", "UnreviewedSibling"), /No reviewed state policy/);
  assert.throws(() => contractFor("client/src/components/location-electricity-panel.tsx", "UnreviewedSibling"), /No reviewed state policy/);
});
test("state policy denominator exactly matches reachable source files, without unused registry entries", () => {
  const report = componentStateCensus();
  const actual = [...new Set(report.components.map(component => component.file.split("/").at(-1)))].sort();
  assert.deepEqual(Object.keys(filePolicies).sort(), actual);
});
test("nested local tooltip JSX is not double-counted in page component denominator", () => {
  const report = componentStateCensus();
  for (const name of ["DecarbSignal", "DecarbGapSignal"]) {
    const parent = report.components.find(component => component.component === name)!;
    const locals = report.components.filter(component => component.file === parent.file && component.id !== parent.id);
    for (const local of locals) for (const child of local.expressions) {
      assert.ok(!parent.expressions.some(expression => expression.span[0] === child.span[0]), `${parent.id} double-counts ${local.id}`);
    }
  }
});
test("imported sibling exports are reachable only through actual component tags", () => {
  const report = componentStateCensus();
  assert.deepEqual(report.components.find(component => component.component === "DownloadJsonButton")?.routes, ["/data-management"]);
  assert.ok(report.components.find(component => component.component === "DownloadDataButton")?.routes.includes("/"));
  const reference = report.components.find(component => component.component === "WarmingValidationReference")!;
  assert.equal(reference.id, "client/src/components/warming-validation-reference.tsx#WarmingValidationReference");
  assert.deepEqual(reference.routes, ["/methodology"]);
  assert.equal(reference.contract.inputKind, "pinned-reference");
  assert.match(reference.contract.focusedEvidence, /warming-validation-reference\.test\.ts/);
  const trackB = report.components.find(component => component.component === "TrackBResearch")!;
  assert.deepEqual(trackB.routes, ["/methodology"]);
  assert.equal(trackB.contract.inputKind, "queried-evidence");
  assert.match(trackB.contract.focusedEvidence, /track-b-admission\.test\.ts/);
  const stage10 = report.components.find(component => component.component === "Stage10FinancialCoverage")!;
  assert.deepEqual(stage10.routes, ["/methodology"]);
  assert.equal(stage10.contract.inputKind, "queried-evidence");
  assert.match(stage10.contract.focusedEvidence, /stage10-retained-coverage\.test\.ts/);
  const money = report.components.find(component => component.component === "WorkbookMoneyAudit")!;
  assert.deepEqual(money.routes, ["/climate-valuation", "/methodology"]);
  assert.equal(money.contract.inputKind, "queried-evidence");
  assert.match(money.contract.focusedEvidence, /workbook-money-integration\.test\.ts/);
  const additions = ["CarbonPassThroughReview", "QualifiedMissingnessReview", "ReadonlyVersionDiff", "VersionDiffResult"]
    .map(name => {
      const component = report.components.find(component => component.component === name)!;
      assert.ok(component, name);
      assert.deepEqual(component.routes, [name === "CarbonPassThroughReview" ? "/climate-valuation" : "/data-management"]);
      assert.match(component.contract.focusedEvidence, /readonly-new-card-states\.test\.ts/);
      assert.equal(component.contract.inputKind, name === "CarbonPassThroughReview" ? "pinned-reference" :
        name === "VersionDiffResult" ? "supplied-result" : "queried-evidence");
      return component.id;
    });
  const registry = report.components.find(component => component.component === "RegistryMethodology")!;
  assert.deepEqual(registry.routes, ["/methodology"]);
  assert.match(registry.contract.focusedEvidence, /methodology-download\.test\.ts/);
  const strands = report.components.find(component => component.component === "ScientificEvidenceStrands")!;
  assert.match(strands.contract.focusedEvidence, /scientific-strands-warning\.test\.ts/);
  const producer = report.components.find(component => component.component === "ProducerDownloadLink")!;
  assert.deepEqual(producer.routes, ["/climate-valuation", "/data-management"]);
  assert.match(producer.contract.focusedEvidence, /producer-download\.test\.ts/);
  const integrated = ["HeadlineDrilldownReview", "RetainedHeadlineDrilldown", "RetainedPairedResearch",
    "RetainedPairedResearchReport", "EvidenceSection", "ReportSkeleton"].map(name => {
      const component = report.components.find(component => component.component === name)!;
      assert.ok(component, name);
      assert.deepEqual(component.routes, [name.includes("Headline") ? "/" : "/decarb-gap"]);
      assert.match(component.contract.focusedEvidence, /(?:headline-drilldown-ui|retained-paired-research-ui)\.test\.ts/);
      assert.equal(component.contract.inputKind, name === "ReportSkeleton" ? "presentation-control" :
        ["HeadlineDrilldownReview", "RetainedPairedResearchReport", "EvidenceSection"].includes(name)
          ? "supplied-result" : "queried-evidence");
      return component.id;
    });
  assert.equal(report.components.filter(component => ![reference.id, trackB.id, stage10.id, money.id, registry.id, strands.id, producer.id, ...additions, ...integrated, ...economicConsumers].includes(component.id)).length, 60);
  assert.equal(reference.fieldBindings.length, 5);
  const html = renderToStaticMarkup(React.createElement(WarmingValidationReference));
  const text = html.replace(/<[^>]*>/g, "");
  assert.match(text, /2025 SR1.5 headline: 1.37 °C/);
  assert.match(text, /2016–2025 mean: 1.24 \[1.0–1.5\] °C/);
  assert.match(text, /Separate inventory year: 2024/);
  assert.match(text, /not the ordinary 2025 annual mean/);
  assert.match(text, /ordinary Annual row is 1.38 C, not a replacement/);
  assert.match(text, /publication day unknown, not inferred/);
  assert.match(text, /Reference, not offset\/calculation\/acceptance/);
  for (const id of ["headline2025.valueC", "decade.meanC", "decade.p05C", "decade.p95C", "inventory.year"])
    assert.ok(html.includes(`data-field-id="warmingReference.${id}"`));
  assert.match(html, /href="\/api\/reference\/warming-validation\/export\.json\?downloadMetadata=manifest-v1"/);
});
