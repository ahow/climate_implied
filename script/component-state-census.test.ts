import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { componentStateCensus } from "./component-state-census";
import { filePolicies, focusedRenderComponents } from "./component-state-contracts";

test("actual domain consumers have source-located expressions and explicit state policies, not placeholder slots", () => {
  const report = componentStateCensus();
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
});
