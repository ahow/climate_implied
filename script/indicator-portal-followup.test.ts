import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { IndicatorSeriesTooltip } from "../client/src/pages/data-management";
import { displayDiagnostic } from "../client/src/lib/valuation-claims";

(globalThis as any).React = React;
const sourcePath = "client/src/pages/data-management.tsx";
function source(path = sourcePath) {
  return ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function walk(node: ts.Node, callback: (node: ts.Node) => void) { callback(node); ts.forEachChild(node, child => walk(child, callback)); }
function jsxTag(node: ts.Node) {
  return ts.isJsxElement(node) ? node.openingElement.tagName.getText() : ts.isJsxSelfClosingElement(node) ? node.tagName.getText() : "";
}
function evaluate(expression: string, dependencies: Record<string, unknown>) {
  const js = ts.transpileModule(`const value=(${expression});`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const context = { React, ...dependencies };
  return new Function(...Object.keys(context), `${js}; return value;`)(...Object.values(context));
}
function actualAttribute(tag: string, attribute: string, dependencies: Record<string, unknown>) {
  let expression = "";
  walk(source(), node => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText() === tag) {
      const attr = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText() === attribute);
      if (attr && ts.isJsxAttribute(attr) && attr.initializer && ts.isJsxExpression(attr.initializer)) expression = attr.initializer.expression!.getText();
    }
  });
  assert.ok(expression, `Actual ${tag}.${attribute} expression exists`);
  return evaluate(expression, dependencies);
}
test("actual detail portal always has title and description outside the conditional evidence gate", () => {
  let content: ts.JsxElement | undefined;
  walk(source(), node => { if (ts.isJsxElement(node) && jsxTag(node) === "DialogContent") content = node; });
  assert.ok(content);
  const directChildren = content.children.filter(ts.isJsxElement);
  const header = directChildren.find(child => jsxTag(child) === "DialogHeader");
  const gate = directChildren.find(child => jsxTag(child) === "IndicatorDetailReadState");
  assert.ok(header && gate, "Accessible header and evidence gate are separate unconditional siblings");
  assert.ok(header.children.some(child => jsxTag(child) === "DialogTitle"));
  assert.ok(header.children.some(child => jsxTag(child) === "DialogDescription"));
  assert.ok(header.getText().includes('"Indicator details"'), "Absent definition has a real title");
  assert.ok(header.getText().includes("Read-only details for the current indicator selection"), "Absent definition has a real description");
  assert.ok(!gate.getText().includes("<DialogTitle"), "Refusal/loading gate cannot remove portal title");
});
test("actual portal close-autofocus handler restores the connected trigger and does not target BODY", () => {
  let prevented = 0, focused = 0;
  const handler = actualAttribute("DialogContent", "onCloseAutoFocus", { returnFocusTo: { current: { isConnected: true, focus: () => focused++ } } });
  handler({ preventDefault: () => prevented++ });
  assert.equal(prevented, 1); assert.equal(focused, 1);
  for (const current of [null, { isConnected: false, focus() { throw Error("Disconnected trigger must not be focused"); } }]) {
    const callback = actualAttribute("DialogContent", "onCloseAutoFocus", { returnFocusTo: { current } });
    callback({ preventDefault() { throw Error("Unavailable trigger must leave default focus restoration intact"); } });
  }
});
test("actual indicator card captures a keyboard-focusable trigger for click, Enter and Space", () => {
  const trigger = {};
  const captured: { current: unknown } = { current: null };
  const selections: string[] = [];
  const dependencies = { detailTrigger: captured, ind: { key: "renewableCapacityGW" }, setSelectedKey: (key: string) => selections.push(key) };
  const click = actualAttribute("Card", "onClick", dependencies);
  click({ currentTarget: trigger }); assert.equal(captured.current, trigger);
  const keydown = actualAttribute("Card", "onKeyDown", dependencies);
  let prevented = 0;
  for (const key of ["Enter", " "]) keydown({ key, currentTarget: trigger, preventDefault: () => prevented++ });
  keydown({ key: "ArrowDown", preventDefault() { throw Error("Unrelated keyboard navigation must not be captured"); } });
  assert.deepEqual(selections, ["renewableCapacityGW", "renewableCapacityGW", "renewableCapacityGW"]);
  assert.equal(prevented, 2);
  const text = readFileSync(sourcePath, "utf8");
  assert.match(text, /role="button"\s+tabIndex=\{0\}\s+aria-haspopup="dialog"/);
  assert.match(text, /returnFocusTo=\{detailTrigger\}/);
});
test("actual refresh-detail button invokes the current read query refetch only and is disabled while fetching", () => {
  let refetches = 0;
  // Locate the actual refresh button specifically: other read-only buttons may also have onClick.
  let refresh: ts.JsxElement | undefined;
  walk(source(), node => {
    if (ts.isJsxElement(node) && jsxTag(node) === "Button" && node.openingElement.attributes.properties.some(prop =>
      ts.isJsxAttribute(prop) && prop.name.getText() === "data-testid" && prop.initializer?.getText() === '"button-refresh-indicator-detail"')) refresh = node;
  });
  assert.ok(refresh);
  const attrs = refresh.openingElement.attributes.properties.filter(ts.isJsxAttribute);
  const onClick = attrs.find(attr => attr.name.getText() === "onClick")!;
  const disabled = attrs.find(attr => attr.name.getText() === "disabled")!;
  const run = evaluate((onClick.initializer as ts.JsxExpression).expression!.getText(), { refetch: () => { refetches++; } });
  run(); assert.equal(refetches, 1);
  assert.equal(evaluate((disabled.initializer as ts.JsxExpression).expression!.getText(), { isFetching: true }), true);
  assert.equal(evaluate((disabled.initializer as ts.JsxExpression).expression!.getText(), { isFetching: false }), false);
  const calls: string[] = [];
  walk(onClick, node => { if (ts.isCallExpression(node)) calls.push(node.expression.getText()); });
  assert.deepEqual(calls, ["refetch"], "Only the existing query refetch is invoked; no direct fetch, operator action or fake timer");
  assert.ok(refresh.getText().includes("Refresh detail"));
});
test("indicator zero tooltip empty/whitespace/missing source explicitly says Source not returned without fabricating observation status", () => {
  for (const source of ["", "   ", undefined]) {
    const html = renderToStaticMarkup(React.createElement(IndicatorSeriesTooltip, { active: true, label: 2024, decimals: 2, unit: "GW", payload: [{ value: 0, payload: { actual: 0, source } }] }));
    for (const value of ["0.00 GW", "2024", "Source not returned", "Observation/estimate status unavailable"]) assert.ok(html.includes(value), value);
  }
});
for (const path of ["client/src/pages/decarb-signal.tsx", "client/src/pages/decarb-gap-signal.tsx"]) test(`${path} actual backtest tooltip missing TE/active return with a VALID date and a separate genuine zero`, () => {
  let expression = "";
  walk(source(path), node => {
    if (ts.isVariableDeclaration(node) && node.name.getText() === "BacktestTooltip") expression = node.initializer!.getText();
  });
  assert.ok(expression);
  const Tooltip = evaluate(expression, { displayDiagnostic });
  for (const missing of ["trackingError", "activeReturn"]) {
    const html = renderToStaticMarkup(React.createElement(Tooltip, { active: true, label: "2024-01", payload: [
      { dataKey: "trackingError", name: "Tracking Error", value: missing === "trackingError" ? null : 0 },
      { dataKey: "activeReturn", name: "Active Return", value: missing === "activeReturn" ? undefined : 0 },
    ] }));
    assert.ok(html.includes("2024-01"));
    assert.ok(html.includes("Tracking Error")); assert.ok(html.includes("Active Return"));
    assert.equal((html.match(/Unavailable/g) ?? []).length, 1);
    assert.equal((html.match(/0\.00%/g) ?? []).length, 1);
    assert.ok(!html.includes("NaN")); assert.ok(!html.includes("-100%"));
  }
});
