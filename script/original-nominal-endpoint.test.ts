import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse } from "node:querystring";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import type { Request, Response, RequestHandler } from "express";
import { originalNominalAssessmentHandler } from "../server/calculation/originalNominalAssessmentHandler";
import { originalNominalEquityAssessment } from "../server/calculation/reverseValuation";
import { originalNominalAssessmentSemantics, originalNominalAssessmentInputKeys } from "../shared/originalNominalAssessmentSemantics";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { semanticRows } from "../shared/fieldSemantics";

const path = "/api/valuation/original-nominal-assessment";
const nominal = {
  baseEarnings: 100, discountRate: .08, returnOnEquity: .2, stageOneGrowth: .06,
  sharesBasis: "total-equity", rateBasis: "nominal",
  returnOnEquityEvidence: "ENGINEERING-ONLY nominal sustainable ROE reference",
  discountRateEvidence: "ENGINEERING-ONLY nominal discount reference",
  acknowledgeConditionalModel: true,
};
const query = Object.fromEntries(Object.entries(nominal).map(([key, value]) => [key, String(value)]));

/** Execute the actual parent-owned route registration without bootstrapping
 * registerRoutes (which initializes providers). No server/network/listener.
 */
function registeredRoute() {
  const source = readFileSync("server/routes.ts", "utf8");
  const ast = ts.createSourceFile("server/routes.ts", source, ts.ScriptTarget.Latest, true);
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(ast) === "app" && node.expression.name.text === "get" &&
      node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === path)
      calls.push(node);
    node.forEachChild(visit);
  }
  visit(ast);
  assert.equal(calls.length, 1, "Exactly one real GET registration, not a test-only route");
  assert.equal(calls[0].arguments[1].getText(ast), "originalNominalAssessmentHandler");
  assert.ok(ast.statements.some(node => ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === "./calculation/originalNominalAssessmentHandler" &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some(element => element.name.text === "originalNominalAssessmentHandler")),
  "Resolve the real handler import without importing provider-bootstrapping central routes");
  const registry = new Map<string, RequestHandler>();
  runInNewContext(calls[0].getText(ast), {
    app: { get(route: string, handler: RequestHandler) { registry.set(route, handler); } },
    originalNominalAssessmentHandler,
  });
  return registry.get(path)!;
}

function requestFixture(fields: Record<string, unknown>) {
  const url = new URL(path, "http://request-fixture.invalid");
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    for (const scalar of Array.isArray(value) ? value : [value]) url.searchParams.append(key, String(scalar));
  }
  const captured: { status: number; body?: any; headers: Record<string, string> } = { status: 200, headers: {} };
  const response = {
    set(key: string, value: string) { captured.headers[key] = value; return this; },
    status(code: number) { captured.status = code; return this; },
    json(body: unknown) { captured.body = JSON.parse(JSON.stringify(body)); return this; },
  };
  registeredRoute()({ method: "GET", path, query: parse(url.search.slice(1)) } as unknown as Request,
    response as unknown as Response, () => assert.fail("Pure route must not delegate to provider/collector middleware"));
  const ids = captured.headers["X-Field-Semantics"]?.split(",") ?? [];
  assert.ok(ids.length > 0);
  for (const id of ids) assert.equal(requireOutputSemantic(id).id, id);
  for (const field of bindNestedOutput("originalNominalAssessment", captured.body))
    assert.ok(ids.includes(field.id), `Missing actual response binding ${field.id}`);
  assert.ok(ids.includes("originalNominalAssessment.http.status"));
  assert.ok(ids.includes("originalNominalAssessment.http.cacheControl"));
  assert.equal(captured.headers["Cache-Control"], "no-store");
  return { ...captured, ids };
}

test("registered original nominal GET preserves pure body and bounded four-by-fifteen schedule with complete bindings", () => {
  const response = requestFixture(query);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, JSON.parse(JSON.stringify(originalNominalEquityAssessment(nominal))),
    "Header registration must not change existing conditional result body");
  assert.equal(response.body.rows.length, 4);
  assert.equal(response.body.rows.reduce((sum: number, row: any) => sum + row.projection.years.length, 0), 60);
  for (const key of originalNominalAssessmentInputKeys)
    assert.ok(response.ids.includes(`originalNominalAssessment.input.${key}`));
  for (const row of response.body.rows) {
    assert.equal(row.projection.years[0].year, 1);
    assert.equal(row.projection.years[14].year, 15);
    assert.ok(Math.abs(row.projection.years[14].growth - row.terminalGrowth) < 1e-14);
  }
  assert.equal(response.body.investmentEvidence, false);
  assert.equal(response.body.identityApproved, false);
  assert.equal(response.body.productionEligible, false);
});

test("registered nominal GET binds malformed/missing/scalar/domain/nonfinite and per-terminal refusals", () => {
  for (const fields of [
    {}, { ...query, acknowledgeConditionalModel: undefined },
    { ...query, discountRate: ["0.08", "0.1"] },
    { ...query, unexpectedCurrency: "USD" },
    { ...query, rateBasis: "real" },
    { ...query, returnOnEquityEvidence: "x".repeat(1201) },
  ]) {
    const response = requestFixture(fields);
    assert.equal(response.status, 400);
    assert.equal(response.body.status, "refused");
    assert.ok(response.body.issues.length > 0);
  }
  const economic = requestFixture({ ...query, baseEarnings: "-1" });
  assert.equal(economic.status, 422);
  assert.equal(economic.body.status, "refused");
  const overflow = requestFixture({ ...query, baseEarnings: "1e308" });
  assert.equal(overflow.status, 422);
  assert.equal(overflow.body.reason, "Nonfinite valuation");
  const mixed = requestFixture({ ...query, discountRate: ".035" });
  assert.equal(mixed.status, 200);
  assert.deepEqual(mixed.body.rows.map((row: any) => row.status),
    ["conditional-value", "conditional-value", "refused", "refused"]);
  const refused = requestFixture({ ...query, discountRate: ".025" });
  assert.equal(refused.status, 200, "Per-point refusal is not malformed request or top-level approval");
  assert.ok(refused.body.rows.every((row: any) => row.status === "refused" && !("projection" in row)));
});

test("supplemental endpoint semantics precisely declare source, units/currency, horizon, HTTP/body statuses and conditionality", () => {
  const ids = originalNominalAssessmentSemantics.map(field => field.id);
  assert.equal(new Set(ids).size, ids.length);
  const exported = semanticRows();
  for (const field of originalNominalAssessmentSemantics) {
    assert.ok(exported.some(row => row.Field === field.id));
    assert.match(field.source, /caller|query/i);
    assert.match(field.source, /not independently authenticated/);
    assert.match(field.scope, /Currency and scale are unspecified/);
    assert.match(field.scope, /never assume USD/);
    assert.match(field.period, /year16|Year0/);
    assert.match(field.status, /Supplemental conditional/);
    assert.match(field.status, /no original-gap closure/);
  }
  const value = requireOutputSemantic("originalNominalAssessment.rows[].projection.equityValue");
  assert.equal(value.unit, "nominal units of baseEarnings");
  assert.match(value.formula, /terminalCashFlow\/\(r-gT\)/);
  const terminal = requireOutputSemantic("originalNominalAssessment.rows[].projection.terminalCashFlow");
  assert.match(terminal.meaning, /year16/);
  assert.match(terminal.formula, /year15/);
  assert.match(requireOutputSemantic("originalNominalAssessment.http.status").formula, /200.*400.*422.*405/);
  assert.match(requireOutputSemantic("originalNominalAssessment.rows[].status").formula, /otherwise refused/);
});
