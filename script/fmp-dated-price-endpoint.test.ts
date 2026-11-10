import assert from "node:assert/strict";
import test from "node:test";
import { fmpRequest } from "../server/financialData/provider";
import { inspectFmpDatedUnadjustedRows } from "./company-dated-market-source-contract";

const endpoint = "historical-price-eod/non-split-adjusted";
const params = { symbol: "TEST", from: "2025-01-31", to: "2025-01-31" };
test("Only fixed non-split historical endpoint is added; arbitrary URLs and sibling historical paths refuse", async () => {
  for (const path of ["https://example.invalid", "historical-price-eod/full",
    "historical-price-eod/light", "../quote", `${endpoint}?symbol=TEST`])
    await assert.rejects(fmpRequest(path, params), /Unsupported/);
});
test("Historical endpoint permits one exact date only; no range, extra params, malformed dates or URL symbols", async () => {
  for (const p of [{ ...params, to: "2025-02-01" }, { ...params, limit: "1" },
    { ...params, from: "2025-02-30", to: "2025-02-30" },
    { ...params, symbol: "https://example.invalid" }, { symbol: "TEST" }])
    await assert.rejects(fmpRequest(endpoint, p), /one exact symbol\/date/);
});
test("Existing provider helper uses fixed host, exact dates, no redirects and private raw capture", async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.FMP_API_KEY;
  process.env.FMP_API_KEY = "engineering-fixture-key";
  let captured = "", calls = 0;
  globalThis.fetch = async (input, init) => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.origin, "https://financialmodelingprep.com");
    assert.equal(url.pathname, `/stable/${endpoint}`);
    assert.equal(url.searchParams.get("from"), params.from);
    assert.equal(url.searchParams.get("to"), params.to);
    assert.equal(init?.redirect, "error");
    return new Response(JSON.stringify([{ symbol: "TEST", date: params.from, adjClose: 12.5 }]), { status: 200 });
  };
  try {
    const rows = await fmpRequest(endpoint, params, raw => { captured = raw; });
    assert.equal(calls, 1);
    assert.equal(rows[0].adjClose, 12.5);
    assert.deepEqual(JSON.parse(captured), rows);
    await assert.rejects(fmpRequest("quote", { symbol: "TEST" }, () => {}), /restricted/);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.FMP_API_KEY; else process.env.FMP_API_KEY = oldKey;
  }
});
test("403 is surfaced without body/key leakage or internal retries", async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.FMP_API_KEY;
  process.env.FMP_API_KEY = "engineering-fixture-key";
  let calls = 0, captured = false;
  globalThis.fetch = async () => { calls++; return new Response("private denied body", { status: 403 }); };
  try {
    await assert.rejects(fmpRequest(endpoint, params, () => { captured = true; }), /^Error: FMP HTTP 403$/);
    assert.equal(calls, 1);
    assert.equal(captured, false);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.FMP_API_KEY; else process.env.FMP_API_KEY = oldKey;
  }
});
test("adjClose is preserved by name; currency/units and CIK/class are not invented from response magnitude/ticker", () => {
  const target = { symbol: "TEST", cik: "0000000001", security: "Engineering common",
    quoteDateRequired: params.from, primaryShares: 90, sharePublishedDate: "2025-02-14",
    shareSourceHash: "a".repeat(64), shareSourceUrl: "https://example.invalid/fixture",
    shareCapturedAt: "2026-11-10T00:00:00.000Z", informationTreatment: "Engineering only",
    identityApproved: false, automaticTickerJoin: false };
  const result = inspectFmpDatedUnadjustedRows([{ symbol: "TEST", date: params.from, adjClose: 12.5 }], target);
  assert.equal(result.status, "same-date-price-primary-shares-candidate");
  assert.equal(result.rawPriceField, "adjClose");
  assert.equal(result.currency, null);
  assert.equal(result.quoteResponseDoesNotAuthenticateCikOrClass, true);
  assert.equal(result.identityApproved, false);
  assert.equal(inspectFmpDatedUnadjustedRows([{ symbol: "TEST", date: "2025-02-01", adjClose: 12.5 }], target).status,
    "blocked-response-fields");
  assert.equal(inspectFmpDatedUnadjustedRows([{ symbol: "TEST", date: params.from, close: 12.5 }], target).status,
    "blocked-response-fields", "No silent close/adjClose substitution");
});
