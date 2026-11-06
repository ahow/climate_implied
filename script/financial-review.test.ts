import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotSchema, snapshotId, financialCalculation, transition } from "../server/financialData/review";
export const fixture = {
  identity: { companyId: 1, isin: "US0378331005", symbol: "AAPL", currency: "USD", exchange: "NASDAQ",
    shareClassFIGI: "FIXTURE", issuerId: "FIXTURE-ISSUER", marketCapScope: "issuer",
    primaryListingEvidence: "https://example.org/listing", issuerEvidence: "https://example.org/issuer", reviewedAt: "2026-11-06T00:00:00Z" },
  quote: { price: 10, marketCap: 1000, observedAt: "2026-11-05T21:00:00Z" },
  statement: { netIncome: 100, currency: "USD", period: "2025-12-31", filingDate: "2026-02-15" },
  fetchedAt: "2026-11-06T00:00:00Z",
};
test("approval and rejection are idempotent terminal decisions", () => {
  assert.equal(transition("pending", "approved"), "approved");
  assert.equal(transition("approved", "approved"), "approved");
  assert.equal(transition("pending", "rejected"), "rejected");
  assert.throws(() => transition("rejected", "approved"));
});
test("new economics change calculation identity; repeating fetch does not", () => {
  const parsed = snapshotSchema.parse(fixture);
  assert.equal(financialCalculation(parsed).priceToLastAnnualEarnings, 10);
  assert.equal(snapshotId(parsed), snapshotId({ ...parsed, fetchedAt: "2026-11-07T00:00:00Z" }));
  assert.notEqual(snapshotId(parsed), snapshotId({ ...parsed, quote: { ...parsed.quote, price: 11 } }));
});
test("currency mismatch, future quotes, injected carbon fields and invalid inputs fail explicitly", () => {
  assert.throws(() => snapshotSchema.parse({ ...fixture, statement: { ...fixture.statement, currency: "GBP" } }));
  assert.throws(() => snapshotSchema.parse({ ...fixture, scope1Emissions: 0 }));
  assert.throws(() => snapshotSchema.parse({ ...fixture, quote: { ...fixture.quote, price: NaN } }));
  assert.throws(() => snapshotSchema.parse({ ...fixture, quote: { ...fixture.quote, observedAt: "2027-01-01T00:00:00Z" } }));
  assert.equal(financialCalculation(snapshotSchema.parse({ ...fixture, statement: { ...fixture.statement, netIncome: -1 } })).priceToLastAnnualEarnings, null);
});
