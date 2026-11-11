import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FinancialProviderStatus } from "../client/src/components/financial-provider-status";
import { FinancialReview, ScientificValidation } from "../client/src/components/financial-review";
import { CompanyOperatingReview } from "../client/src/components/company-operating-review";
import { ReadResultReason } from "../client/src/components/read-result-reason";
import { TemperatureGauge } from "../client/src/components/temperature-gauge";
import { BacktestSummary } from "../client/src/components/backtest-summary";
import { CategoryComparison } from "../client/src/components/category-comparison";
import { RegionalComparison } from "../client/src/components/regional-comparison";
import { SensitivityChart } from "../client/src/components/sensitivity-chart";
import { ThresholdDiagnosticDetails } from "../client/src/components/threshold-diagnostic-details";
import { CategoryTrendChart } from "../client/src/components/category-trend-chart";

(globalThis as any).React = React;
function render(component: React.ComponentType, path: string, value: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData([path], value);
  try {
    const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(component)));
    assert.doesNotMatch(html, /\b(?:NaN|Infinity|undefined)\b/);
    return html;
  } finally { client.clear(); }
}
test("provider partial booleans/state/quote are unavailable, not false, verified, zero or epoch", () => {
  const html = render(FinancialProviderStatus, "/api/financial-data/status", { quote: { price: null, timestamp: null } });
  for (const reason of ["Configuration unavailable", "Verification state unavailable", "Quote price unavailable", "Quote observation time unavailable"]) assert.ok(html.includes(reason), reason);
  assert.doesNotMatch(html, />Not configured<|startup diagnostic verified|1\/1\/1970/);
});
test("provider valid false and zero remain explicit without approval promotion", () => {
  const html = render(FinancialProviderStatus, "/api/financial-data/status", { configured: false, state: "not-configured", quote: { price: 0, timestamp: 0 }, limitations: [] });
  assert.match(html, />Not configured</);
  assert.match(html, /data-field-id="financialProvider.quote.price">0</);
  assert.match(html, /No successful verification is reported/);
});
test("readiness missing collections and booleans do not fabricate disabled/failed checks", () => {
  const html = render(ScientificValidation, "/api/calculation/readiness", {});
  assert.match(html, /candidate enablement not returned/);
  assert.match(html, /no checks array was returned/);
  assert.doesNotMatch(html, />Disabled<|>Not passed</);
});
test("readiness partial check preserves false, qualifies absent outcome and does not certify", () => {
  const html = render(ScientificValidation, "/api/calculation/readiness", { candidateEnabled: false, checks: [{ id: "false", passed: false }, { id: "missing" }], limitations: [] });
  assert.match(html, />Disabled</);
  assert.match(html, />Not passed</);
  assert.match(html, /check outcome not returned/);
  assert.match(html, /No explanation supplied/);
  assert.match(html, /does not establish scientific validity/);
});
test("financial missing inventory is not a successful empty queue", () => {
  const html = render(FinancialReview, "/api/financial-data/reviews", {});
  assert.match(html, /no items array was returned/);
  assert.doesNotMatch(html, /No pending or approved financial snapshots/);
});
test("financial missing nested record safely refuses ratio and approval interpretation", () => {
  const html = render(FinancialReview, "/api/financial-data/reviews", { items: [{ id: "engineering-partial", status: "pending", payload: null }] });
  assert.match(html, /identity, quote, statement, calculation not returned/);
  assert.match(html, /No ratio or approval conclusion is substituted/);
});
test("financial complete partial values retain zero and endpoint refusal reason", () => {
  const html = render(FinancialReview, "/api/financial-data/reviews", {
    items: [{ id: "engineering-zero", status: "pending", payload: { identity: {}, quote: { price: 0, marketCap: 0 }, statement: { netIncome: 0 } }, calculation: { priceToLastAnnualEarnings: null, reason: "engineering-denominator-nonpositive", quoteAgeHours: 0 } }],
  });
  assert.match(html, /engineering-denominator-nonpositive/);
  assert.match(html, /not an approved financial snapshot/);
  assert.match(html, /font-mono">0 /);
});
test("operating partial eligibility and evidence never imply false execution or complete gaps", () => {
  const html = render(CompanyOperatingReview, "/api/calculation/company-operating/reviews", [{ proposalId: "engineering-partial" }]);
  assert.match(html, /Execution eligibility unavailable/);
  assert.match(html, /No source archive IDs returned/);
  assert.match(html, /No gap details returned/);
  assert.doesNotMatch(html, />Not executable<|>Conditional execution eligible</);
});
test("operating explicit false and supplied gap/refusal are preserved", () => {
  const html = render(CompanyOperatingReview, "/api/calculation/company-operating/reviews", [{ proposalId: "engineering-false", executable: false, remainingGaps: ["engineering-missing-operating-evidence"], sourceArchiveIds: [] }]);
  assert.match(html, />Not executable</);
  assert.match(html, /engineering-missing-operating-evidence/);
  assert.match(html, /Not established/);
});
test("reason component separately renders loading, error, absent, and real available zero", () => {
  for (const [props, state, text] of [
    [{ loading: true, available: false }, "loading", "previous results are withheld"],
    [{ error: new Error("engineering"), available: false }, "error", "No previous result is shown"],
    [{ available: false }, "absent", "engineering-denominator-missing"],
  ] as const) {
    const html = renderToStaticMarkup(React.createElement(ReadResultReason, { label: "Engineering value", emptyReason: "engineering-denominator-missing", ...props }));
    assert.ok(html.includes(`data-read-state="${state}"`)); assert.ok(html.includes(text));
  }
  assert.equal(renderToStaticMarkup(React.createElement(ReadResultReason, { label: "Zero", emptyReason: "missing", available: 0 != null })), "");
});
test("legacy comparator missing differs from explicit right-censoring; reduction zero remains real", () => {
  const base = { temperature: 2, p10: 1, p90: 3, reductionRate: 0, metricView: "netZero" as const };
  const missing = renderToStaticMarkup(React.createElement(TemperatureGauge, base));
  const censored = renderToStaticMarkup(React.createElement(TemperatureGauge, { ...base, netZeroYear: null }));
  assert.match(missing, /Unavailable — not returned/);
  assert.match(censored, /Not reached within trajectory horizon/);
  assert.match(missing, /0.00% \/ yr/);
  assert.match(missing, /not 5% of 2024 and is not net zero/);
});
const querySurfaces = [
  { component: FinancialProviderStatus, path: "/api/financial-data/status", absent: "No diagnostic status is available", loading: "Loading provider status", error: "Unable to load provider status" },
  { component: FinancialReview, path: "/api/financial-data/reviews", absent: "No review response is available", loading: "Loading financial reviews", error: "Unable to load financial reviews" },
  { component: ScientificValidation, path: "/api/calculation/readiness", absent: "No readiness response is available", loading: "Loading scientific validation", error: "Unable to load calculation readiness" },
  { component: CompanyOperatingReview, path: "/api/calculation/company-operating/reviews", absent: "No operating review packets available", loading: "Loading review packets", error: "Review records unavailable" },
];
for (const surface of querySurfaces) for (const state of ["absent", "loading", "error"] as const) {
  test(`${surface.component.name}: actual ${state} read has a specific reason and hides retained data`, async () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    const key = [surface.path];
    let release: (() => void) | undefined;
    let pending: Promise<unknown> | undefined;
    if (state === "absent") client.setQueryData(key, null);
    else {
      // The sentinel would cause invalid source-shaped data to leak if the hook
      // ever stops suppressing retained records while pending/failed.
      client.setQueryData(key, { symbol: "ENGINEERING_STALE_SENTINEL", defaultEngine: "ENGINEERING_STALE_SENTINEL" });
      if (state === "loading") {
        const gate = new Promise<null>(resolve => { release = () => resolve(null); });
        pending = client.fetchQuery({ queryKey: key, staleTime: 0, queryFn: () => gate });
      } else {
        await assert.rejects(client.fetchQuery({ queryKey: key, staleTime: 0, queryFn: async () => { throw new Error("engineering-read-failure"); } }));
      }
    }
    try {
      const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(surface.component)));
      assert.ok(html.includes(surface[state]), html);
      assert.doesNotMatch(html, /ENGINEERING_STALE_SENTINEL/);
    } finally { release?.(); await pending; client.clear(); }
  });
}
test("backtest partial accounting withholds missing fields and retains real zero cost", () => {
  const html = renderToStaticMarkup(React.createElement(BacktestSummary, { data: {
    summary: { targetTrackingErrorPct: 0, method: "absolute", calibrationStatus: "unavailable", warnings: ["engineering-refusal"], accounting: { costBps: 0, grossCumulative: null } },
  } as any }));
  assert.match(html, /Target TE 0.00%/);
  assert.match(html, /Cost assumption: 0.00 bps/);
  assert.match(html, /Gross cumulative return: Unavailable/);
  assert.match(html, /Cost accounting is incomplete/);
  assert.match(html, /engineering-refusal/);
  assert.doesNotMatch(html, /NaN|Infinity|-100.00/);
});
test("backtest null, error and incomplete summary cannot imply calibrated results", () => {
  assert.match(renderToStaticMarkup(React.createElement(BacktestSummary, {})), /No backtest result/);
  assert.match(renderToStaticMarkup(React.createElement(BacktestSummary, { error: new Error("engineering-refusal") })), /engineering-refusal/);
  assert.match(renderToStaticMarkup(React.createElement(BacktestSummary, { data: { summary: null } as any })), /summary is incomplete/);
});
test("partial regional/category inputs render field-specific unavailability, retaining reduction zero", () => {
  for (const html of [
    renderToStaticMarkup(React.createElement(CategoryComparison, { categories: [{ category: "technology", reductionRate: 0 }] as any })),
    renderToStaticMarkup(React.createElement(RegionalComparison, { regions: [{ region: "eu", reductionRate: 0 }] as any })),
  ]) {
    assert.match(html, /Unavailable/); assert.match(html, /0.00%\/yr/);
    assert.match(html, /missing or invalid diagnostic inputs/); assert.doesNotMatch(html, /NaN|Infinity/);
  }
});
test("sensitivity incomplete baseline is refused, not replaced by the old 2.7 default", () => {
  const html = renderToStaticMarkup(React.createElement(SensitivityChart, { data: [{ p10Temperature: 1, p90Temperature: 2, temperatureRange: 1 }] as any }));
  assert.match(html, /Baseline and sensitivity ranges are withheld rather than defaulted/);
  assert.doesNotMatch(html, /2.7/);
});
test("threshold null diagnostic stays withheld without a borrowed legacy comparator or download", () => {
  const html = renderToStaticMarkup(React.createElement(ThresholdDiagnosticDetails, { diagnostic: null }));
  assert.match(html, /Withheld — 2024 baseline unavailable/);
  assert.match(html, /not net zero/);
  assert.doesNotMatch(html, /Download threshold diagnostic|fixed-5gt/);
});
test("category threshold view tolerates omitted/null category cells and explains the exact missing-cell reason", () => {
  const html = renderToStaticMarkup(React.createElement(CategoryTrendChart, { metricView: "netZero", data: [{ year: 2024, technology: {}, policy: null }] as any }));
  assert.match(html, /Some category cells are missing/);
  assert.match(html, /other categories are not substituted/);
  assert.match(html, /Withheld — 2024 baseline unavailable/);
  const statuses = html.match(/data-testid="category-threshold-statuses"[\s\S]*?<\/details>/)?.[0];
  assert.ok(statuses);
  assert.doesNotMatch(statuses, /NaN|Infinity|undefined/);
});
