import test from "node:test";
import assert from "node:assert/strict";
import { normalizeMonetaryValue } from "../server/financialData/currencies";
import { normalizeStatementHistory } from "../server/financialData/statementHistory";
import { financialCalculation, snapshotSchema } from "../server/financialData/review";

test("minor-unit normalization is explicit, case-sensitive and never assumes FX", () => {
  for (const [native, major] of [["GBp", "GBP"], ["ZAc", "ZAR"], ["ILA", "ILS"]]) {
    const v = normalizeMonetaryValue(1234, native);
    assert.equal(v.value, 12.34);
    assert.equal(v.currency, major);
    assert.equal(v.nativeValue, 1234);
    assert.equal(v.factor, .01);
  }
  assert.equal(normalizeMonetaryValue(1234, "GBP").value, 1234);
  assert.throws(() => normalizeMonetaryValue(null, "GBP"));
  assert.throws(() => normalizeMonetaryValue(1, "gbp"));
  assert.throws(() => normalizeMonetaryValue(Infinity, "GBP"));
  const row = { symbol: "X.L", period: "FY", date: "2024-12-31", reportedCurrency: "GBP" };
  const [result] = normalizeStatementHistory(
    [{ ...row, operatingCashFlow: 100, capitalExpenditure: -20, netDebtIssuance: 5 }],
    [{ ...row, netDebt: 10 }], "X.L", "GBp");
  assert.ok(!result.reasons.includes("quote-statement-currency-mismatch-no-fx-assumed"));
  assert.equal(result.fcfe, 85);
  const [foreign] = normalizeStatementHistory([row], [row], "X.L", "USD");
  assert.ok(foreign.reasons.includes("quote-statement-currency-mismatch-no-fx-assumed"));
});

test("minor-unit quote snapshots require an explicit market-cap denomination", () => {
  const input = { identity: { companyId: 1, isin: "GB0002634946", symbol: "BA.L", currency: "GBp",
    exchange: "LSE", shareClassFIGI: "test-share", issuerId: "test-issuer", marketCapScope: "issuer",
    primaryListingEvidence: "https://example.org/listing", issuerEvidence: "https://example.org/issuer",
    reviewedAt: "2026-01-01T00:00:00Z" },
    quote: { price: 1200, marketCap: 1000, observedAt: "2026-01-01T00:00:00Z" },
    statement: { netIncome: 100, currency: "GBP", period: "2024-12-31", filingDate: "2025-03-01" },
    fetchedAt: "2026-01-01T00:00:00Z" };
  assert.equal(snapshotSchema.safeParse(input).success, false);
  const s = snapshotSchema.parse({ ...input, quote: { ...input.quote, marketCapCurrency: "GBP" } });
  const result = financialCalculation(s);
  assert.equal(result.priceToLastAnnualEarnings, 10);
  assert.equal(result.normalizedQuotePrice.value, 12);
  assert.equal(result.normalizedMarketCap.value, 1000);
  assert.equal(snapshotSchema.safeParse({ ...s, quote: { ...s.quote, marketCapCurrency: "USD" } }).success, false);
});
