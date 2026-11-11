import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { CompanyConditionalSummary, ConditionalFactRow, DisclosureList, publicCompanyIssues } from "../client/src/components/company-conditional-summary";
import { COMPANY_CONDITIONAL_QUERY_KEY } from "../client/src/hooks/use-company-conditional-summaries";
import { getConditionalCompanySummary } from "../shared/companyConditionalData";
import ClimateValuation, { AnalysisSection, SummaryCard, roundedPE, ValuationPETooltip, assertValuationGroupRows } from "../client/src/pages/climate-valuation";
import { IndicatorDetailDialog, IndicatorDetailReadState, IndicatorSeriesTooltip, indicatorDetailAvailability } from "../client/src/pages/data-management";
import { IndicatorCards } from "../client/src/components/indicator-cards";
import postcss from "postcss";
import tailwindcss from "tailwindcss";

(globalThis as any).React = React;
const html = (component: React.ReactElement) => renderToStaticMarkup(component);
function conditional(value: unknown) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(COMPANY_CONDITIONAL_QUERY_KEY, value);
  try { return html(React.createElement(QueryClientProvider, { client }, React.createElement(CompanyConditionalSummary))); }
  finally { client.clear(); }
}
test("conditional envelope absent, malformed and unknown/duplicate issuer each fail closed without private-key rendering", () => {
  assert.ok(conditional({ schemaVersion: "company-conditional-public-1", companies: [] }).includes("No public aggregate summaries published"));
  for (const value of [{}, { schemaVersion: "company-conditional-public-1", companies: [null] }, { schemaVersion: "company-conditional-public-1", companies: [{ issuer: "PRIVATE_ENGINEERING_SENTINEL" }] }, { schemaVersion: "company-conditional-public-1", companies: [{ issuer: "NEE" }, { issuer: "NEE" }] }]) {
    const result = conditional(value);
    assert.ok(result.includes("Public conditional summaries unavailable"));
    assert.ok(!result.includes("PRIVATE_ENGINEERING_SENTINEL"));
    assert.ok(!result.includes('href="/api/cv/company-conditional-summaries/export'));
  }
});
test("conditional selected company partial metadata/collections have named reasons and no substituted exports", () => {
  const result = conditional({ schemaVersion: "company-conditional-public-1", companies: [{ issuer: "NEE", privateArtifactBytes: "PRIVATE_ENGINEERING_SENTINEL" }] });
  for (const reason of ["name not returned", "experimentVersion not returned", "evidenceDocument not returned", "informationContext not returned", "Facts array not returned", "Disclosure array not returned", "Public exports unavailable"]) assert.ok(result.includes(reason), reason);
  assert.ok(!result.includes("PRIVATE_ENGINEERING_SENTINEL"));
  assert.ok(!result.includes('href="/api/cv/company-conditional-summaries/export'));
});
test("conditional canonical public snapshot retains null/zero, qualifies facts and exports only complete selected company", () => {
  const payload = structuredClone(getConditionalCompanySummary("NEE"));
  (payload.companies[0].facts[0] as any).value = 0;
  assert.deepEqual(publicCompanyIssues(payload.companies[0]), []);
  const result = conditional(payload);
  for (const text of ["Unknown (null)", ">0<", "Conditional, not qualified", "0/3 qualified", "no Tier 2 or efficacy promotion", "Public JSON", "Public XLSX"]) assert.ok(result.includes(text), text);
  assert.ok(result.includes('href="/api/cv/company-conditional-summaries/export.json?issuer=NEE"'));
});
test("conditional reconciliation mobile containment wraps the actual NEE dividend row without changing facts or exports", async () => {
  const payload = getConditionalCompanySummary("NEE");
  const before = JSON.stringify(payload);
  const result = conditional(payload);
  const table = result.match(/<table class="([^"]+)">([\s\S]*?)<\/table>/);
  assert.ok(table, "Actual reconciliation table is rendered");
  assert.ok(table[2].includes('data-testid="conditional-fact-NEE-fplDividend"'));
  assert.match(table[1], /\btable-fixed\b/);
  assert.ok(table[1].includes("sm:table-auto"));
  assert.ok(table[1].includes("[overflow-wrap:anywhere]"), "Unbroken formula/unit tokens can wrap without being elided");
  assert.match(result, /class="[^"]*min-w-0[^"]*max-w-full[^"]*" data-testid="company-conditional-summary"/);
  assert.match(result, /<div class="min-w-0 w-full max-w-full overflow-x-auto rounded-md border"><table/);
  const cellClasses = [...table[2].matchAll(/<(?:th|td)\b[^>]*class="([^"]+)"/g)].map(match => match[1].split(/\s+/));
  assert.ok(cellClasses.every(classes => !classes.some(token => /^min-w-/.test(token))), "Desktop cell minimum widths cannot force the mobile table wider than its container");
  for (const minimum of ["sm:min-w-40", "sm:min-w-32", "sm:min-w-64"])
    assert.ok(cellClasses.some(classes => classes.includes(minimum)), `Existing desktop layout retained: ${minimum}`);
  const css = (await postcss([tailwindcss({
    content: [{ raw: result, extension: "html" }],
    corePlugins: { preflight: false },
  })]).process("@tailwind utilities;", { from: undefined })).root;
  const declaration = (selector: string, property: string) => {
    let found: { value: string; media?: string } | undefined;
    css.walkRules(rule => {
      if (rule.selector === selector) rule.walkDecls(property, decl => {
        found = { value: decl.value, media: rule.parent?.type === "atrule" ? (rule.parent as postcss.AtRule).params : undefined };
      });
    });
    return found;
  };
  assert.equal(declaration(".table-fixed", "table-layout")?.value, "fixed");
  assert.equal(declaration(".min-w-0", "min-width")?.value, "0px");
  assert.equal(declaration(".max-w-full", "max-width")?.value, "100%");
  assert.equal(declaration(".overflow-x-auto", "overflow-x")?.value, "auto");
  assert.equal(declaration(".\\[overflow-wrap\\:anywhere\\]", "overflow-wrap")?.value, "anywhere");
  assert.deepEqual(declaration(".sm\\:table-auto", "table-layout"), { value: "auto", media: "(min-width: 640px)" });
  for (const [size, value] of [["40", "10rem"], ["32", "8rem"], ["64", "16rem"]])
    assert.deepEqual(declaration(`.sm\\:min-w-${size}`, "min-width"), { value, media: "(min-width: 640px)" });
  assert.ok(result.includes("Unknown (null)"));
  assert.ok(result.includes('href="/api/cv/company-conditional-summaries/export.xlsx?issuer=NEE"'));
  assert.equal(JSON.stringify(payload), before, "Rendering changes containment only, never public source facts");
});
test("missing selected issuer never links to another issuer's complete exports", () => {
  const result = conditional(getConditionalCompanySummary("FSLR"));
  assert.ok(result.includes("No allowlisted summary is available for this issuer."));
  assert.ok(result.includes("Public exports unavailable"));
  assert.ok(!result.includes('href="/api/cv/company-conditional-summaries/export'));
});
test("conditional partial fact rows distinguish absent, null and zero; never infer sourced classification", () => {
  for (const [fact, expected] of [[null, "Conditional fact row unavailable"], [{}, "finite value not returned"], [{ value: null }, "Unknown (null)"], [{ value: 0 }, ">0<"]] as const) {
    const result = html(React.createElement("table", null, React.createElement("tbody", null, React.createElement(ConditionalFactRow, { issuer: "NEE", fact: fact as any }))));
    assert.ok(result.includes(expected), expected);
    if (fact) {
      for (const reason of ["Classification unavailable", "Unit not returned", "Formula not returned", "Boundary not returned", "Source locator not returned"]) assert.ok(result.includes(reason), reason);
      assert.ok(!result.includes("Sourced / derived"));
    }
  }
});
test("conditional disclosure missing, empty and partial items each explain absence without no-refusal claim", () => {
  for (const items of [undefined, null, [], [null]] as const) {
    const result = html(React.createElement(DisclosureList, { title: "Refusals", items: items as any }));
    assert.ok(result.includes(items == null ? "Disclosure array not returned" : !items.length ? "No disclosure items returned" : "Disclosure text unavailable"));
  }
  assert.ok(html(React.createElement(DisclosureList, { title: "Refusals", items: ["engineering-causal-identification-refused"] })).includes("engineering-causal-identification-refused"));
});
for (const state of ["loading", "error"] as const) test(`conditional ${state} read suppresses previously complete facts and export links`, async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(COMPANY_CONDITIONAL_QUERY_KEY, getConditionalCompanySummary("NEE"));
  let release: (() => void) | undefined;
  let pending: Promise<unknown> | undefined;
  if (state === "loading") {
    const gate = new Promise<null>(resolve => { release = () => resolve(null); });
    pending = client.fetchQuery({ queryKey: COMPANY_CONDITIONAL_QUERY_KEY, staleTime: 0, queryFn: () => gate });
  } else await assert.rejects(client.fetchQuery({ queryKey: COMPANY_CONDITIONAL_QUERY_KEY, staleTime: 0, queryFn: async () => { throw new Error("PRIVATE_ENGINEERING_SENTINEL"); } }));
  try {
    const result = html(React.createElement(QueryClientProvider, { client }, React.createElement(CompanyConditionalSummary)));
    assert.ok(result.includes(state === "loading" ? "Loading public conditional summaries" : "Public conditional summaries unavailable"));
    assert.ok(!result.includes('data-testid="conditional-company-NEE"'));
    assert.ok(!result.includes('href="/api/cv/company-conditional-summaries/export'));
    assert.ok(!result.includes("PRIVATE_ENGINEERING_SENTINEL"));
  } finally { release?.(); await pending; client.clear(); }
});

const sectionProps = {
  costOfEquityPct: 8, icon: Building2, title: "Engineering selected groups", description: "Engineering diagnostic only",
  chartData: [] as any[], isLoading: false, formatChartDate: String, formatTooltipDate: String,
  testIdPrefix: "carbon", peChart: { highKey: "high", lowKey: "low", highLabel: "Low Carbon (Clean)", lowLabel: "High Carbon (Dirty)", tooltip: () => null },
};
test("valuation section empty, invalid-date and missing-P/E contracts remain distinct", () => {
  assert.ok(html(React.createElement(AnalysisSection, sectionProps)).includes("No P/E observations returned for Engineering selected groups."));
  assert.ok(html(React.createElement(AnalysisSection, { ...sectionProps, chartData: [{ date: NaN, high: 0, low: 1 }] })).includes("No P/E observations have a valid observation date"));
  const result = html(React.createElement(AnalysisSection, { ...sectionProps, chartData: [{ date: 0, high: null, low: 0 }] }));
  assert.ok(result.includes("Some selected P/E observations are missing or invalid."));
  assert.ok(result.includes("Their chart and export cells remain unavailable, not zero."));
  assert.ok(result.includes("No defensible valuation-to-activity mapping"));
});
test("valuation pending/error sections withhold stale rows and disable stale exports", () => {
  for (const props of [{ isLoading: true }, { error: new Error("engineering") }]) {
    const result = html(React.createElement(AnalysisSection, { ...sectionProps, chartData: [{ date: 777, high: 12, low: 13 }], ...props }));
    const download = result.match(/<button[^>]*data-testid="button-download-carbon-pe"[^>]*>/)?.[0];
    assert.ok(download && /\sdisabled=""/.test(download), "Current P/E export is actually disabled, not merely styled with disabled classes.");
    if ("error" in props) assert.ok(result.includes("No prior selection values or downloads are shown"));
    assert.ok(!result.includes('data-testid="text-carbon-pe-chart-heading">777'));
  }
});
test("valuation summary/tooltip preserve zero and name missing counts and P/E rather than blank x", () => {
  const zero = html(React.createElement(SummaryCard, { icon: Building2, label: "Companies", value: 0 }));
  assert.ok(zero.includes(">0<"));
  for (const value of [undefined, null, NaN]) assert.ok(html(React.createElement(SummaryCard, { icon: Building2, label: "Companies", value })).includes("Companies: count not returned for the current selection."));
  const result = html(React.createElement(ValuationPETooltip, { highLabel: "High", lowLabel: "Low", highValue: null, lowValue: 0, lowCount: 0 }));
  for (const text of ["Observation date unavailable", "Unavailable — P/E not returned", "Company count not returned", "0.0x", "0 co."]) assert.ok(result.includes(text), text);
  assert.equal(roundedPE(null), undefined); assert.equal(roundedPE(undefined), undefined); assert.equal(roundedPE(0), 0);
});
test("valuation root partial imputation metadata cannot crash or invent a denominator", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["/api/cv/uploads"], []);
  client.setQueryData(["/api/cv/summary"], { companiesCount: 0, imputation: { imputedRecords: 1 } });
  client.setQueryData(COMPANY_CONDITIONAL_QUERY_KEY, { schemaVersion: "company-conditional-public-1", companies: [] });
  try {
    const result = html(React.createElement(QueryClientProvider, { client }, React.createElement(ClimateValuation)));
    assert.ok(result.includes("Total record count unavailable — not returned"));
    assert.ok(result.includes("Unavailable"));
    assert.ok(!result.includes("NaN%"));
  } finally { client.clear(); }
});
test("valuation summary held request has explicit current-query loading status which clears for settled zero or error", async () => {
  for (const outcome of ["zero", "error"] as const) {
    // Each SSR render creates an observer: do not turn the settled error check
    // into a fresh automatic retry-on-remount (the browser observer stays mounted).
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false, retryOnMount: false } } });
    client.setQueryData(["/api/cv/uploads"], []);
    client.setQueryData(COMPANY_CONDITIONAL_QUERY_KEY, { schemaVersion: "company-conditional-public-1", companies: [] });
    let resolve!: (value: unknown) => void;
    let reject!: (reason: Error) => void;
    const held = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
    const pending = client.fetchQuery({ queryKey: ["/api/cv/summary"], queryFn: () => held });
    const render = () => html(React.createElement(QueryClientProvider, { client }, React.createElement(ClimateValuation)));
    try {
      const waiting = render();
      assert.match(waiting, /<p role="status" aria-live="polite"[^>]*data-testid="status-company-summary-loading">Loading company summary for the current selection\.<\/p>/);
      assert.ok(waiting.indexOf('data-testid="status-company-summary-loading"') < waiting.indexOf("Monetary-input-dependent totals"), "Summary feedback precedes long monetary disclosures on mobile");
      for (const label of ["companies", "records", "sectors", "geographies"])
        assert.ok(!waiting.includes(`data-testid="card-summary-${label}"`), "A held source does not fabricate settled zero/count cards");
      if (outcome === "zero") {
        resolve({ companiesCount: 0, sectors: 0, geographies: 0, dateRange: { recordCount: 0 } });
        await pending;
        const ready = render();
        assert.ok(!ready.includes('data-testid="status-company-summary-loading"'));
        for (const label of ["companies", "records", "sectors", "geographies"])
          assert.match(ready, new RegExp(`data-testid="card-summary-${label}"[\\s\\S]*?<p class="text-xl font-semibold">0<\\/p>`));
      } else {
        reject(new Error("ENGINEERING_HELD_SUMMARY_FAILURE"));
        await assert.rejects(pending, /ENGINEERING_HELD_SUMMARY_FAILURE/);
        const failed = render();
        assert.ok(!failed.includes('data-testid="status-company-summary-loading"'));
        assert.ok(failed.includes("Company summary read failed for the current selection."));
        assert.ok(!failed.includes("ENGINEERING_HELD_SUMMARY_FAILURE"));
      }
    } finally { resolve(null); await pending.catch(() => {}); client.clear(); }
  }
});
test("valuation record collection guard refuses null/nonobject rows, while partial fields remain independently unavailable", () => {
  for (const rows of [null, {}, [null], [0], [[]]]) assert.throws(() => assertValuationGroupRows(rows), /expected an array of observation records/);
  assert.doesNotThrow(() => assertValuationGroupRows([]));
  assert.doesNotThrow(() => assertValuationGroupRows([{ cleanPE: null }]));
});
test("valuation missing history/imputation counts do not infer data availability or zero imputation", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["/api/cv/uploads"], []);
  client.setQueryData(["/api/cv/summary"], { dateRange: {}, imputation: {} });
  client.setQueryData(COMPANY_CONDITIONAL_QUERY_KEY, { schemaVersion: "company-conditional-public-1", companies: [] });
  try {
    const result = html(React.createElement(QueryClientProvider, { client }, React.createElement(ClimateValuation)));
    assert.ok(result.includes("Group-series availability is not inferred"));
    assert.ok(result.includes("No zero-imputation inference is made"));
  } finally { client.clear(); }
});
test("valuation root malformed cached group rows render section-specific failed-read reasons instead of map crashes", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(["/api/cv/uploads"], [{ id: 1, status: "completed" }]);
  client.setQueryData(["/api/cv/summary"], { dateRange: { recordCount: 1 } });
  client.setQueryData(["/api/cv/carbon-price?uploadId=1&method=sector_relative&includeScope3=false&winsorize=true&inferenceMethod=carbon_intensity"], [null]);
  client.setQueryData(["/api/cv/sdg-growth", 0.08, 1], [null]);
  client.setQueryData(["/api/cv/decarb-terciles", "sector_relative", 0.08, 1], [null]);
  client.setQueryData(COMPANY_CONDITIONAL_QUERY_KEY, { schemaVersion: "company-conditional-public-1", companies: [] });
  try {
    const result = html(React.createElement(QueryClientProvider, { client }, React.createElement(ClimateValuation)));
    for (const group of ["High vs Low Carbon Companies", "High vs Low SDG-Aligned Companies", "High vs Low Ambition Companies"]) assert.ok(result.includes(`P/E comparison read failed for ${group}`), group);
  } finally { client.clear(); }
});
test("indicator dialog read-state renderer differentiates pending/error/null and never renders stale child content", () => {
  for (const props of [{ loading: true, available: true }, { error: true, available: true }, { available: false }]) {
    const result = html(React.createElement(IndicatorDetailReadState, props, "ENGINEERING_PRIOR_INDICATOR"));
    assert.ok(!result.includes("ENGINEERING_PRIOR_INDICATOR"));
    assert.ok(result.includes("Loading selected indicator details") || result.includes("No prior indicator details are shown") || result.includes("No indicator detail response was returned"));
  }
  assert.ok(html(React.createElement(IndicatorDetailReadState, { available: true }, "CURRENT_INDICATOR")).includes("CURRENT_INDICATOR"));
});
test("indicator modal partial definition/series refuses unlabeled values and missing proposal history is not a complete queue", () => {
  for (const [props, reason] of [
    [{ definitionAvailable: false }, "Labels and units cannot be verified"],
    [{ seriesAvailable: false }, "Missing or invalid observation rows are not substituted"],
  ] as const) {
    const result = html(React.createElement(IndicatorDetailReadState, { available: true, ...props }, "UNVERIFIED_SERIES"));
    assert.ok(result.includes(reason)); assert.ok(!result.includes("UNVERIFIED_SERIES"));
  }
  const result = html(React.createElement(IndicatorDetailReadState, { available: true, definitionAvailable: true, seriesAvailable: true, seriesEmpty: true, proposalHistoryAvailable: false }, "VERIFIED_CURRENT_DETAIL"));
  assert.ok(result.includes("No indicator series observations were returned"));
  assert.ok(result.includes("Review completeness is not inferred"));
  assert.ok(result.includes("VERIFIED_CURRENT_DETAIL"));
});
test("indicator modal availability uses actual definition, series and proposal fields; zero observations stay usable", () => {
  const def = { key: "renewableCapacityGW", label: "Renewable Capacity", unit: "GW", decimals: 0 };
  const point = { year: 2024, value: 0, source: "engineering-provenance", method: "engineering" };
  const ready = indicatorDetailAvailability({ def, series: [point], proposals: [] } as any);
  assert.equal(ready.hasDefinition, true); assert.equal(ready.usableSeries?.[0].value, 0);
  for (const partialDef of [null, {}, { ...def, unit: null }, { ...def, decimals: 999 }]) {
    assert.equal(indicatorDetailAvailability({ def: partialDef } as any).hasDefinition, false);
  }
  for (const series of [null, {}, [null], [{ ...point, year: undefined }], [{ ...point, value: null }], [{ ...point, source: undefined }], [{ ...point, method: null }], [{ ...point, asOfDate: {} }]]) {
    assert.equal(indicatorDetailAvailability({ def, series } as any).usableSeries, undefined);
  }
  assert.equal(indicatorDetailAvailability({ def, proposals: [null] } as any).proposals, undefined);
  assert.equal(indicatorDetailAvailability({ def: { ...def, key: "unregistered-engineering-key" } } as any).hasDefinition, false);
  assert.equal(indicatorDetailAvailability({ def } as any, "evSalesSharePct").hasDefinition, false);
});
test("actual closed modal never evaluates an undefined indicator export binding", () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  try {
    assert.equal(html(React.createElement(QueryClientProvider, { client }, React.createElement(IndicatorDetailDialog, { indicatorKey: null, onClose() {} }))), "");
  } finally { client.clear(); }
});
test("actual selected modal with absent, partial or unregistered definition refuses binding evaluation", () => {
  for (const detail of [{}, { def: null, series: [] }, { def: { key: "renewableCapacityGW" }, series: [] }, { def: { key: "unregistered-engineering-key", label: "Engineering", unit: "GW", decimals: 0 }, series: [] }]) {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(["/api/data/indicator", "renewableCapacityGW"], detail);
    try {
      const result = html(React.createElement(QueryClientProvider, { client }, React.createElement(IndicatorDetailDialog, { indicatorKey: "renewableCapacityGW", onClose() {} })));
      assert.ok(!result.includes('data-testid="button-download-timeseries"'));
    } finally { client.clear(); }
  }
});
test("indicator tooltip inactive, absent row and missing value/source/status have distinct reasons", () => {
  assert.equal(html(React.createElement(IndicatorSeriesTooltip, { active: false })), "");
  assert.ok(html(React.createElement(IndicatorSeriesTooltip, { active: true, payload: [] })).includes("No indicator observation was returned"));
  const result = html(React.createElement(IndicatorSeriesTooltip, { active: true, payload: [{ payload: {} }] }));
  for (const text of ["Year unavailable", "Unavailable — not returned", "Unit unavailable", "Observation/estimate status unavailable", "Source not returned"]) assert.ok(result.includes(text), text);
});
test("indicator tooltip exact zero and estimated zero retain observation/source qualifiers", () => {
  for (const [payload, label] of [[{ actual: 0, isNowcast: false }, "Sourced"], [{ actual: null, estimated: 0, isNowcast: true }, "Estimated"]] as const) {
    const result = html(React.createElement(IndicatorSeriesTooltip, { active: true, label: 2024, unit: "units", payload: [{ value: 0, payload: { ...payload, source: "engineering-provenance" } }] }));
    assert.ok(result.includes("0.00 units")); assert.ok(result.includes(label)); assert.ok(result.includes("engineering-provenance"));
  }
});
test("indicator cards empty history never invents a 2010–2024 range and latest missing field is not backfilled", () => {
  assert.ok(html(React.createElement(IndicatorCards, { historicalData: [] })).includes("No values or historical date range are substituted"));
  const result = html(React.createElement(IndicatorCards, { historicalData: [{ year: 2023, renewableCapacityGW: 9 }, { year: 2024, renewableCapacityGW: null, evSalesSharePct: 0 }] as any }));
  const card = result.match(/data-testid="text-indicator-value-renewableCapacityGW">([\s\S]*?)<\/span>/)?.[1];
  assert.equal(card, "Unavailable");
  assert.ok(result.includes('data-testid="text-indicator-value-evSalesSharePct">0'));
});
