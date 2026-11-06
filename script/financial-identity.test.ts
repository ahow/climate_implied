import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptIdentity, reconcileIdentities } from "../server/financialData/identity";
import { assessMapping } from "../server/financialData/provider";
const review = { companyId: 1, isin: "US0378331005", symbol: "AAPL", currency: "USD", exchange: "NASDAQ",
  shareClassFIGI: "CLASS1", issuerId: "CIK:320193", marketCapScope: "issuer" as const,
  primaryListingEvidence: "https://example.org/listing", issuerEvidence: "https://example.org/issuer",
  reviewedAt: "2026-11-06T00:00:00Z" };
test("explicit review must agree with the checked security and currency", () => {
  const assessment = assessMapping(review.isin, [{ ...review }], [
    { figi: "LISTING", ticker: "AAPL", exchCode: "US", marketSector: "Equity", shareClassFIGI: "CLASS1" },
  ]);
  assert.deepEqual(acceptIdentity(review, assessment), review);
  assert.throws(() => acceptIdentity({ ...review, currency: "GBP" }, assessment));
  assert.throws(() => acceptIdentity({ ...review, issuerEvidence: "" }, assessment));
});
test("whole universe reconciles without dropping difficult identities or duplicating issuers", () => {
  const inputs = [{ id: 1, isin: review.isin }, { id: 2, isin: "US17275R1023" }, { id: 3, isin: "" }];
  const counts = reconcileIdentities(inputs, [review]);
  assert.equal(counts.universe, counts.accepted + counts.unresolved + counts.outOfScope);
  assert.equal(counts.coverage, .5);
  assert.equal(counts.passed, false);
  assert.throws(() => reconcileIdentities(inputs, [review, { ...review, companyId: 2, isin: inputs[1].isin }]));
});
