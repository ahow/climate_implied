import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildCompanyFilingPair } from "../server/calculation/companyFilingPair";

// Entirely synthetic source-only CI fixtures; no issuer facts or private files.
const source = "SYNTHETIC TEST DOCUMENT: not a filing or observed market data";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const facts = {
  symbol: "SYNTH", issuer: "Synthetic test issuer", security: "Synthetic common",
  cik: "0000000001", currency: "USD", fiscalEnd: "2024-12-31",
  documentDate: "2025-02-01", observedAt: "2025-03-02T00:00:00.000Z",
  sourceUrl: "https://example.invalid/synthetic-filing", sourceHash: digest(source),
  textHash: digest(source), operatingCashFlow: 60e9, capitalSpend: 25e9,
  debtProceeds: 2e9, debtRepayments: 5e9, accountingCaveats: [] as string[],
};
assert.equal(facts.sourceHash, digest(source));
assert.notEqual(facts.sourceHash, digest(source + "tampered"));
for (const [operatingCashFlow, expected] of [[60e9, 32e9], [20e9, -8e9], [28e9, 0]]) {
  const result = buildCompanyFilingPair({ ...facts, operatingCashFlow });
  assert.equal(result.baseFcfe, expected);
  assert.equal(result.status, "blocked");
  assert.equal(result.pairs.length, 0);
  assert.equal(result.bridge.workingCapitalDeductedAgain, false);
  assert.equal(result.bridge.manufacturingCreditsAddedAgain, false);
  assert.equal(result.bridge.debtSubtractedFromEquityAgain, false);
  assert.equal(result.bridge.cashAddedToEquity, 0);
}
const market = {
  symbol: facts.symbol, cik: facts.cik, security: facts.security, currency: "USD",
  referenceDate: "2025-03-01", priceDate: "2025-03-01", sharesDate: "2025-03-01",
  price: 100, shares: 4e9, sourceUrl: "https://example.invalid/test-only",
  sourceHash: "a".repeat(64), observedAt: "2025-03-02T00:00:00.000Z",
  usageAuthorization: "Synthetic algebra unit test only",
  sharesBasis: "total-common-outstanding-not-diluted-or-float",
};
const pair = buildCompanyFilingPair(facts, market);
assert.equal(pair.status, "executed-diagnostic-only");
assert.equal(pair.pairs.length, 9);
for (const p of pair.pairs) {
  assert.equal(p.implied.status, "conditional-solution");
  assert.ok(p.repricingError !== null && p.repricingError < 1e-8);
}
assert.throws(() => buildCompanyFilingPair(facts, { ...market, sharesDate: "2025-02-28" }), /reference date/);
assert.throws(() => buildCompanyFilingPair(facts, { ...market, cik: "0000000000" }), /identity/);
assert.equal(buildCompanyFilingPair({ ...facts, accountingCaveats: ["Synthetic unresolved NCI claim"] }, market).status, "blocked");
assert.equal(buildCompanyFilingPair({ ...facts, operatingCashFlow: 1 }, market).status, "blocked");
assert.equal(buildCompanyFilingPair({ ...facts, operatingCashFlow: 28e9 }, market).status, "blocked");
assert.throws(() => buildCompanyFilingPair({ ...facts, sourceHash: "invalid" }, market));
assert.throws(() => buildCompanyFilingPair(facts, { ...market, sourceHash: "invalid" }));
assert.throws(() => buildCompanyFilingPair({ ...facts, textHash: "invalid" }, market));
assert.throws(() => buildCompanyFilingPair({ ...facts, currency: "EUR" }, market));
assert.throws(() => buildCompanyFilingPair(facts, { ...market, currency: "EUR" }));
assert.throws(() => buildCompanyFilingPair(facts, { ...market, referenceDate: "2025-01-01",
  priceDate: "2025-01-01", sharesDate: "2025-01-01" }), /predates filing/);
assert.throws(() => buildCompanyFilingPair(facts, { ...market, sharesBasis: "float" }));
assert.throws(() => buildCompanyFilingPair(facts, { ...market, usageAuthorization: "" }));
console.log("Self-contained synthetic CI: accounting, source/date/currency/identity/refusal gates and nine paired repricings passed.");
