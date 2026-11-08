import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { earningsYieldGapPp, gordonBaselinePct, displayDiagnostic } from "../client/src/lib/valuation-claims";
import { uiClaimRegister } from "../client/src/lib/ui-claim-register";

const read = (path: string) => readFileSync(path, "utf8");
const dashboard = read("client/src/pages/dashboard.tsx");
const companies = ["climate-valuation", "decarb-signal", "decarb-gap-signal"];
function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  node.forEachChild(child => walk(child, visit));
}
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [join(dir, entry.name)] : []);
}

test("default dashboard mounts no legacy model consumers; diagnostics require explicit opt-in", () => {
  const normal = dashboard.slice(0, dashboard.indexOf("function LegacyDashboard"));
  for (const tag of ["TemperatureGauge", "TemperatureHistogram", "RegionalComparison", "SensitivityChart", "CategoryComparison", "HistoricalTrendChart", "CategoryTrendChart", "EmissionsChart"]) {
    assert.ok(!normal.includes(`<${tag}`), `${tag} must stay out of normal view`);
  }
  assert.match(normal, /useState\(false\)/);
  assert.match(normal, /showLegacy && <LegacyDashboard/);
  assert.match(normal, /CO2-only response to aggregate GHG/);
  assert.match(normal, /fixed 1\.1°C offset/);
  assert.match(normal, /fixed 5 Gt threshold/);
  assert.match(normal, /beyond 2100/);
  assert.doesNotMatch(dashboard, /\?\? (2\.7|2\.1|3\.3)/);
  assert.match(normal, /<PublishedScenarioReferences/);
  assert.match(normal, /invalidateQueries/);
  assert.doesNotMatch(normal, /apiRequest|\/api\/refresh|recalculat(?:ed|ing) with/);
});

test("no client HTTP mutation call sites remain", () => {
  for (const path of files("client/src")) {
    const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    walk(source, node => {
      if (!ts.isCallExpression(node)) return;
      if (node.expression.getText(source) === "apiRequest") {
        assert.ok(!node.arguments[0] || !/^["'](?:POST|PUT|PATCH|DELETE)["']$/.test(node.arguments[0].getText(source)), path);
      }
      if (node.expression.getText(source) === "fetch") {
        assert.doesNotMatch(node.arguments[1]?.getText(source) ?? "", /method\s*:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i, path);
      }
    });
  }
});

test("operator controls are explicitly disabled, not merely guarded by a server error", () => {
  const data = read("client/src/pages/data-management.tsx");
  const valuation = read("client/src/pages/climate-valuation.tsx");
  for (const source of [data, valuation]) assert.match(source, /<OperatorOnlyNotice/);
  for (const source of [data, valuation]) {
    const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    walk(ast, node => {
      if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
      const attrs = node.attributes.properties;
      const id = attrs.find(a => ts.isJsxAttribute(a) && a.name.getText(ast) === "data-testid");
      if (!id || !/button-(refresh-now|approve-|reject-|save-manual|upload|reset-upload)/.test(id.getText(ast))) return;
      assert.ok(attrs.some(a => ts.isJsxAttribute(a) && a.name.getText(ast) === "disabled" && !a.initializer), id.getText(ast));
    });
  }
  assert.match(data, /<fieldset disabled/);
  assert.match(read("client/src/components/operator-only-notice.tsx"), /403 operator-cli-required/);
});

test("company views and exports do not consume unsupported climate outputs or physical gap", () => {
  for (const page of companies) {
    const path = `client/src/pages/${page}.tsx`;
    const source = read(path);
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    walk(ast, node => {
      if (ts.isPropertyAccessExpression(node)) {
        assert.ok(!["impliedTemperature", "impliedCarbonPrice", "impliedDecarbRate", "netZeroYear", "projectedRate", "gap", "distribution"].includes(node.name.text),
          `${path} consumes unsupported ${node.name.text}`);
      }
    });
    assert.doesNotMatch(source, /dataKey="(?:impliedTemperature|impliedCarbonPrice|impliedDecarbRate|projectedRate)"/);
    assert.match(source, /Gordon/);
    assert.match(source, /market cap, not revenue|per market cap, not revenue/);
  }
  const gap = read("client/src/pages/decarb-gap-signal.tsx");
  assert.match(gap, /Peer earnings-yield gap/);
  assert.match(gap, /c\.impliedGrowth - c\.peerMedianGrowth/);
  assert.doesNotMatch(gap, /Underpriced Transition|Overpriced Transition|positive = underpriced/);
});

test("published references come from the real endpoint and retain validation and missing states", () => {
  const source = read("client/src/components/published-scenario-references.tsx");
  assert.match(source, /queryKey: \["\/api\/reference-scenarios"\]/);
  assert.match(source, /isPublishedReferences\(data\)/);
  assert.match(source, /isError \|\| !reference/);
  assert.match(source, /No reference values are shown/);
  assert.doesNotMatch(source, /temperatureMedianC\s*\?\?/);
  assert.match(source, /source\.licence/);
  assert.match(source, /comparisonCaveat/);
});

test("actual routes and archived methodology remain contained", () => {
  const routes = read("client/src/App.tsx");
  for (const route of ["/", "/data-management", "/climate-valuation", "/decarb-signal", "/decarb-gap"]) {
    assert.ok(routes.includes(`path="${route}"`));
    assert.ok(uiClaimRegister.some(entry => entry.route === route), `output register missing ${route}`);
  }
  const method = read("client/src/pages/methodology.tsx");
  assert.match(method, /<details/);
  assert.doesNotMatch(method, /<details[^>]*\bopen\b/);
  assert.match(method, /superseded claims/);
});

test("valuation diagnostics have honest units and no missing-value substitution", () => {
  assert.equal(gordonBaselinePct(20, 8), 3);
  assert.equal(earningsYieldGapPp(20, 10), 5);
  assert.equal(earningsYieldGapPp(10, 20), -5);
  for (const value of [undefined, null, 0, -2, NaN, Infinity]) {
    assert.equal(gordonBaselinePct(value), null);
    assert.equal(earningsYieldGapPp(value, 20), null);
  }
  assert.equal(displayDiagnostic(null), "Unavailable");
  assert.equal(displayDiagnostic(0, " pp"), "0.00 pp");
});
