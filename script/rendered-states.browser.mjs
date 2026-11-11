/**
 * ENGINEERING ONLY. Synthetic responses exist solely in the browser interception
 * layer. No database writes, auth bypass, production fixtures, provider calls,
 * server startup, promotion, or ledger updates.
 *
 * Run against an ALREADY RUNNING app:
 *   node script/rendered-states.browser.mjs
 * Optional: BASE_URL, PLAYWRIGHT_MODULE (absolute package entry), BROWSER_EXECUTABLE,
 *           RENDERED_STATE_REPORT (JSON output path),
 *           RENDERED_STATE_CASE (exact route:mode, e.g. /decarb-signal:partial).
 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { marketMeasures, routeInventory } from "./rendered-state-inventory.mjs";

if (process.argv.includes("--list")) {
  console.log(JSON.stringify({ boundary: "Engineering inventory only; not browser evidence", marketMeasures, routes: routeInventory }, null, 2));
  process.exit(0);
}
const baseURL = process.env.BASE_URL || "http://127.0.0.1:5000";
const caseFilter = process.env.RENDERED_STATE_CASE || null;
let playwright;
try {
  const modulePath = process.env.PLAYWRIGHT_MODULE;
  playwright = await import(modulePath ? pathToFileURL(modulePath).href : "playwright");
} catch (error) {
  const external = "/mnt/pid2/node_modules/playwright/index.mjs";
  if (!process.env.PLAYWRIGHT_MODULE && existsSync(external)) playwright = await import(pathToFileURL(external).href);
  else throw new Error("Playwright is unavailable. Set PLAYWRIGHT_MODULE to an existing Playwright entry; no dependency is installed by this harness.", { cause: error });
}
const appSource = await readFile(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const actualRoutes = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1]).sort();
assert.deepEqual(actualRoutes, routeInventory.filter(route => !route.path.includes("__engineering")).map(route => route.path).sort(), "Update inventory when actual routes change");

const browser = await playwright.chromium.launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const report = { boundary: "Synthetic intercepted browser engineering checks, not scientific/owner acceptance", baseURL, caseFilter, startedAt: new Date().toISOString(), routeInventory, marketMeasures, plannedCases: [], checks: [] };
const partialGroups = {
  date: "2025-01-01", cleanPE: 20, dirtyPE: 20,
  cleanCount: 1, dirtyCount: 1,
};
function fixture(path, mode, url) {
  const hasCompany = ["partial", "zero", "selection"].includes(mode);
  if (path === "/api/analysis/snapshots") return { status: "not-provisioned", items: [], nextCursor: null };
  if (mode === "error") return undefined;
  if (path === "/api/cv/dimensions") return { sectors: [], geographies: ["ENGINEERING EMPTY", "ENGINEERING ERROR"] };
  if (path === "/api/cv/uploads") return hasCompany ? [{ id: 99001, status: "completed" }] : [];
  if (path === "/api/cv/summary") return null;
  if (path === "/api/cv/company-conditional-summaries") return { schemaVersion: "company-conditional-public-1", companies: [] };
  if (path === "/api/reference-scenarios") return null;
  if (path === "/api/emissions/candidate") {
    if (mode === "selection" && url.searchParams.get("scenario") === "constant") return {
      result: { trajectory: [{ year: 2024, reportingGtCO2e: 12.34, nativeMt: {}, sectorsGtCO2e: {} }] },
    };
    return { result: { trajectory: [] } };
  }
  if (path === "/api/indicators/historical") return [];
  if (path === "/api/projection") return hasCompany ? {
    temperatureDistribution: { median: 2, p10: 1.5, p90: 2.5, pdf: [] },
    metrics: mode === "zero" ? { reductionRate: 0 } : {},
    emissionsTrajectory: [],
  } : null;
  if (path.startsWith("/api/projection/")) return [];
  if (path === "/api/cv/carbon-price") return [];
  if (path === "/api/cv/sdg-growth") return hasCompany && !url.searchParams.has("geography") ? [partialGroups] : [];
  if (path === "/api/cv/decarb-terciles") return hasCompany ? [{ date: "2025-01-01", bestTercilePE: null, worstTercilePE: 20 }] : [];
  if (path === "/api/cv/decarb-gap/summary") return { companyCount: 0, topCompanies: [], bottomCompanies: [], distribution: [] };
  if (path === "/api/cv/backtest") return { series: [], summary: null };
  if (path === "/api/data/indicators") return mode === "partial" ? {} : { indicators: [], baselineYear: null };
  if (path === "/api/data/runs") return { runs: [], summaryEvidence: {} };
  if (path === "/api/calculation/field-semantics") return { qualifiedFields: [] };
  if (path === "/api/research/driver-registry") return { status: "engineering-fixture-unavailable", indicators: [] };
  if (path === "/api/calculation/company-operating/reviews") return [];
  if (path === "/api/news/climate") return {
    volume: mode === "zero" ? [{ date: "2025-01-01", count: 0 }] : [],
    sentiment: mode === "zero" ? [{ date: "2025-01", avgSentiment: 0, positive: 0, negative: 0, neutral: 0, total: 0 }]
      : mode === "partial" || mode === "selection" ? [{ date: "2025-01", avgSentiment: 0, positive: 1, negative: 1, neutral: 0, total: 2 }] : [],
    topicBreakdown: [], recentArticles: [], totalArticles: hasCompany ? 0 : null,
    dateRange: { start: "2025-01-01", end: "2025-01-01" },
  };
  // Unspecified services are explicitly unavailable, never read from production.
  return undefined;
}
async function waitText(page, text) {
  await page.locator("main").getByText(text, { exact: false }).first()
    .or(page.getByLabel(text, { exact: false }).first()).first()
    .waitFor({ state: "visible", timeout: 15000 });
}
async function choose(page, trigger, option) {
  await page.getByTestId(trigger).click();
  await page.getByTestId(option).click();
}
async function runCase(route, mode, check) {
  report.plannedCases.push({ route: route.path, mode });
  if (caseFilter && `${route.path}:${mode}` !== caseFilter) return;
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let selectedDelay = false;
  await context.route("**/*", async intercepted => {
    const request = intercepted.request();
    const url = new URL(request.url());
    if (url.origin !== new URL(baseURL).origin) return intercepted.abort();
    if (!url.pathname.startsWith("/api/")) return intercepted.continue();
    requests.push({ path: url.pathname, method: request.method(), query: url.search });
    assert.equal(request.method(), "GET", `No mutation permitted: ${url.pathname}`);
    if (mode === "loading" || selectedDelay && url.pathname.startsWith("/api/cv/") && url.searchParams.has("geography")) await gate;
    if (selectedDelay && url.pathname === "/api/news/climate" && url.searchParams.get("months") === "3") await gate;
    const body = fixture(url.pathname, mode === "loading" ? "absent" : mode, url);
    const selectionError = url.searchParams.get("geography") === "ENGINEERING ERROR";
    await intercepted.fulfill({
      status: body === undefined || selectionError ? 503 : 200,
      contentType: "application/json",
      headers: { "X-Engineering-Fixture": "rendered-states-only" },
      body: JSON.stringify(body === undefined || selectionError ? { error: "engineering-fixture-read-unavailable" } : body),
    });
  });
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.goto(new URL(route.path, baseURL).href, { waitUntil: "domcontentloaded" });
    await check(page, () => { selectedDelay = true; }, release);
    release();
    await page.waitForTimeout(100);
    assert.deepEqual(errors, [], "No browser runtime errors");
    const mainText = await page.locator("main").innerText();
    assert.ok(!/\b(?:NaN|Infinity|undefined)\b/.test(mainText), "No non-finite or undefined display values");
    assert.ok(requests.length > 0, "Interception was exercised");
    report.checks.push({ route: route.path, mode, pass: true, assertions: "Specific reason/visible state, no runtime errors/non-finite display, GET-only API interception", interceptedPaths: [...new Set(requests.map(request => request.path))] });
    console.log(`PASS ${route.path} ${mode}`);
  } catch (error) {
    report.checks.push({ route: route.path, mode, pass: false, error: String(error), runtimeErrors: errors });
    throw error;
  } finally {
    release();
    await context.close();
  }
}
try {
  for (const route of routeInventory) {
    for (const mode of ["absent", "partial", "error", "loading"]) {
      await runCase(route, mode, async page => {
        // Climate research has a separate worker/contract. This loop proves only
        // its route shell/runtime; not unimplemented Tier2/TrackB branch coverage.
        if (mode === "error" && route.path === "/news-sentiment") await waitText(page, route.error);
        else await waitText(page, route.title);
        const reason = mode === "loading" ? route.loading : mode === "error" ? route.error
          : mode === "partial" && ["/decarb-signal", "/decarb-gap", "/news-sentiment"].includes(route.path) ? null : route.absent;
        if (reason) await waitText(page, reason);
        if (["absent", "partial"].includes(mode) && route.path === "/") await waitText(page, "No candidate trajectory is available for this scenario.");
        if (mode === "partial" && route.path === "/decarb-signal") {
          await page.getByTestId("text-sdg-rate").filter({ hasText: /^0\.00 pp$/ }).waitFor({ state: "visible", timeout: 15000 });
          assert.equal(await page.getByTestId("text-sdg-rate").innerText(), "0.00 pp", "Legitimate zero gap is preserved");
          await waitText(page, "Selected groups have missing or invalid P/E denominators.");
        }
        if (mode === "partial" && route.path === "/decarb-gap") {
          await choose(page, "select-measure", "option-measure-decarb_ambition");
          await waitText(page, "Selected group gap: Selected groups have missing or invalid P/E denominators.");
          assert.equal(await page.getByTestId("text-implied-rate").innerText(), "Unavailable", "A null P/E denominator is unavailable, not zero");
          assert.equal(await page.getByTestId("text-company-count").innerText(), "0");
        }
      });
    }
  }
  await runCase(routeInventory.find(route => route.path === "/decarb-gap"), "zero", async page => {
    await choose(page, "select-measure", "option-measure-sdg_alignment");
    await waitText(page, "0.00 pp");
    assert.equal(await page.getByTestId("text-implied-rate").innerText(), "0.00 pp", "Equal valid SDG P/E denominators retain a legitimate zero gap");
  });
  for (const mode of ["partial", "zero"]) {
    await runCase(routeInventory[0], mode, async page => {
      await page.getByTestId("button-toggle-legacy").click();
      await page.getByTestId("card-temperature-gauge").waitFor();
      const reduction = page.getByTestId("text-reduction-rate");
      assert.equal(await reduction.innerText(), mode === "zero" ? "0.00% / yr" : "Unavailable — not returned", "Missing reduction is not zero");
    });
    await runCase(routeInventory.find(route => route.path === "/news-sentiment"), mode, async page => {
      await page.getByTestId("card-total-articles").waitFor();
      if (mode === "zero") {
        await waitText(page, "No positive-count sentiment observations");
        assert.match(await page.getByTestId("card-weekly-avg").innerText(), /\b0\b/);
        assert.match(await page.getByTestId("card-overall-sentiment").innerText(), /N\/A/);
      } else {
        assert.match(await page.getByTestId("card-overall-sentiment").innerText(), /0\.00/);
        assert.match(await page.getByTestId("card-weekly-avg").innerText(), /Unavailable/);
      }
    });
  }
  for (const path of ["/decarb-signal", "/decarb-gap"]) {
    await runCase(routeInventory.find(route => route.path === path), "selection", async (page, delay, release) => {
      const metric = page.getByTestId(path === "/decarb-signal" ? "text-sdg-rate" : "text-implied-rate");
      await waitText(page, "0.00 pp");
      assert.equal(await metric.innerText(), "0.00 pp");
      delay();
      await choose(page, "select-geography", "option-geo-engineering-empty");
      await waitText(page, "Loading the current selection");
      assert.equal(await metric.innerText(), "Unavailable", "No stale selected metric while loading");
      release();
      await waitText(page, path === "/decarb-signal" ? "No SDG groups for this selection." : "No valuation groups for this measure and geography.");
      await choose(page, "select-geography", "option-geo-engineering-error");
      await waitText(page, "Read failed for the current selection");
      assert.equal(await metric.innerText(), "Unavailable", "No stale selected metric after failed read");
    });
  }
  await runCase(routeInventory[0], "selection", async page => {
    const candidate = page.getByTestId("emissions-candidate-review");
    await waitText(page, "12.34");
    await page.getByTestId("select-emissions-candidate-scenario").selectOption("transition");
    await waitText(page, "No candidate trajectory is available for this scenario.");
    assert.ok(!(await candidate.innerText()).includes("12.34"), "No stale scenario trajectory");
  });
  await runCase(routeInventory.find(route => route.path === "/news-sentiment"), "selection", async (page, delay, release) => {
    await page.getByTestId("card-total-articles").waitFor();
    delay();
    await choose(page, "select-months-trigger", "select-months-3");
    await waitText(page, "News window: Loading the current selection");
    assert.equal(await page.getByTestId("card-total-articles").count(), 0, "Prior period cards withheld during read");
    release();
    await page.getByTestId("card-total-articles").waitFor();
  });
  assert.ok(report.checks.length > 0, `No engineering cases matched ${caseFilter}`);
  report.finishedAt = new Date().toISOString();
  console.log(`Completed ${report.checks.length} of ${report.plannedCases.length} planned engineering browser checks${caseFilter ? ` (filter: ${caseFilter})` : ""}. Conditional Tier2/TrackB branches require the separate worker's tests.`);
} finally {
  await browser.close();
  if (process.env.RENDERED_STATE_REPORT) await writeFile(process.env.RENDERED_STATE_REPORT, JSON.stringify(report, null, 2));
}
