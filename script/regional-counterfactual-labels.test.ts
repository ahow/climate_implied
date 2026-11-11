import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { RegionalComparison } from "../client/src/components/regional-comparison";
import { FIXED_5GT_DESCRIPTOR, residualQuantityExportNotes } from "../shared/quantityDescriptors";
import { THRESHOLD_DIAGNOSTIC_LABEL } from "../shared/thresholdDiagnostic";
import { bindExportColumns, requireOutputSemantic } from "../shared/outputFieldSemantics";

(globalThis as any).React = React;

test("regional legacy counterfactual is not exported as a regional forecast or net-zero result", () => {
  const source = readFileSync("client/src/components/regional-comparison.tsx", "utf8");
  assert.doesNotMatch(source, /"Net-Zero Year"|>Net-Zero:|Regional Projections|Temperature Rise/);
  assert.match(source, /Global intensity counterfactual/);
  assert.match(source, /Legacy 5 Gt milestone/);
  assert.match(source, /not a regional temperature forecast/);
  assert.match(source, /Claim: r.claim/);
  assert.match(source, /"Intensity basis": r.carbonIntensityBasis/);
  assert.match(source, /Legacy 5 Gt milestone \(fixed-5gt-v1\)/);
  assert.match(source, /not net zero or the 5%-of-2024 diagnostic/);
  assert.match(source, /not source-evidenced regional inventories/);
  // Execute the actual production row and binding expressions; a shared import
  // must not let a renamed header silently detach from its year or definition.
  const file = ts.createSourceFile("regional-comparison.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let rowExpression = "", bindingExpression = "", noteExpression = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === "downloadRows")
      rowExpression = node.initializer!.getText(file);
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(file) === "DownloadDataButton")
      for (const attr of node.attributes.properties)
        if (ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)) {
          if (attr.name.getText(file) === "fieldBindings") bindingExpression = attr.initializer.expression!.getText(file);
          if (attr.name.getText(file) === "interpretationNotes") noteExpression = attr.initializer.expression!.getText(file);
        }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(rowExpression && bindingExpression && noteExpression, "Real production export must supply rows, bindings and notes");
  const region = {
    region: "EU", regionName: "Europe", temperatureRise: 2, reductionRate: 0,
    carbonIntensity: 0.1, carbonIntensityBasis: "kg CO2 per international dollar GDP (PPP); OWID",
    netZeroYear: 2097, milestoneDefinition: FIXED_5GT_DESCRIPTOR.description,
    claim: "Legacy global intensity counterfactual; not a regional temperature forecast",
  };
  const regions = [region, { ...region, region: "US", regionName: "United States", netZeroYear: null }];
  const evaluate = (expression: string) => {
    const js = ts.transpileModule(`const value=(${expression});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    return new Function("regions", "FIXED_5GT_DESCRIPTOR", "residualQuantityExportNotes", `${js};return value;`)(
      regions, FIXED_5GT_DESCRIPTOR, residualQuantityExportNotes);
  };
  const rows = evaluate(rowExpression), bindings = evaluate(bindingExpression), notes = evaluate(noteExpression);
  const label = "Legacy fixed-5gt-v1 year (5 GtCO2e)";
  assert.equal(FIXED_5GT_DESCRIPTOR.label, label);
  assert.deepEqual(rows.map((row: Record<string, unknown>) => row[label]), [2097, null]);
  assert.equal(rows[0]["Reduction Rate (%/yr)"], 0);
  assert.equal(rows[0]["Intensity basis"], region.carbonIntensityBasis);
  assert.equal(rows[0].Claim, region.claim);
  assert.equal(rows[0]["Milestone definition"], FIXED_5GT_DESCRIPTOR.description);
  assert.equal(bindings[label].id, "regional.netZeroYear");
  assert.equal(requireOutputSemantic(bindings[label].id).meaning, label);
  assert.ok(requireOutputSemantic(bindings[label].id).scope.includes(FIXED_5GT_DESCRIPTOR.description));
  assert.equal(bindExportColumns(rows, bindings).length, Object.keys(rows[0]).length);
  assert.equal(notes.find((note: { Field: string }) => note.Field === label)?.Value, FIXED_5GT_DESCRIPTOR.description);
  assert.ok(!Object.hasOwn(rows[0], THRESHOLD_DIAGNOSTIC_LABEL), "Separate5% diagnostic must not relabel the fixed5Gt column");
  const rendered = renderToStaticMarkup(React.createElement(RegionalComparison, { regions }));
  assert.ok(rendered.includes(label), "Actual UI and production workbook header must be identical");
  assert.ok(rendered.includes("2097"));
  assert.ok(rendered.includes("Not reached by 2100"));
  assert.ok(rendered.includes(FIXED_5GT_DESCRIPTOR.description.replace(/</g, "&lt;")));
});
