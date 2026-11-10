import assert from "node:assert/strict";
import { calculateCompanyFullCashflowCase, pairCompanyFullCashflowCase } from "../server/calculation/companyFullCashflowCase";

const input = {
  symbol: "TEST", cik: "0000000001", security: "Synthetic common", currency: "USD",
  referenceDate: "2026-11-09", frozenAt: "2026-11-10T09:00:00.000Z", firstYear: 2027,
  baseFcfe: 30, boundary: "whole-issuer-common-equity", unresolvedAccountingClaims: [],
  evidence: [{ id: "synthetic", kind: "frozen-analyst-assumption", rationale: "Synthetic algebra only; not an issuer forecast",
    availableAt: "2026-11-09T00:00:00.000Z", sha256: "a".repeat(64) }],
  discountRate: .08, terminalGrowth: .02, continuationGrowthAtYear5: .02,
  terminalEvidenceIds: ["synthetic"],
  years: Array.from({ length: 5 }, (_, i) => ({
    year: 2027 + i, cashFlowDate: `${2027 + i}-12-31`,
    evidenceIds: ["synthetic"], nonClimateRevenue: 100, climateRevenue: 10,
    operatingMarginBeforeClimateCostsAndCredits: .4, climateOperatingCost: 2,
    recognizedPolicyCredit: 5, cashPolicyCredit: 3, depreciation: 10, otherNonCash: 0,
    openingReceivables: 20 + i, closingReceivables: 21 + i,
    increaseOtherOperatingWorkingCapital: 2, interestPaid: 1, cashTax: 4, otherOperatingCash: 0,
    capitalSpend: 10, debtProceeds: 5, debtRepayments: 3, nonCommonCashClaims: 1,
  })),
};
const ledger = calculateCompanyFullCashflowCase(input);
assert.equal(ledger.status, "conditional-full-cashflow-case");
assert.equal(ledger.years.length, 5);
assert.equal(ledger.years[0].revenue, 110);
assert.equal(ledger.years[0].collections, 109);
assert.equal(ledger.years[0].operatingProfit, 47);
assert.equal(ledger.years[0].operatingCashFlow, 47);
assert.equal(ledger.years[0].fcfe, 38);
const market = { symbol: "TEST", cik: "0000000001", security: "Synthetic common", currency: "USD" as const,
  referenceDate: "2026-11-09", priceDate: "2026-11-09", sharesDate: "2026-11-09",
  price: 600, shares: 1, datedReferenceReviewed: true };
const pair = pairCompanyFullCashflowCase(input, market);
assert.equal(pair.pairing, "conditional-same-basis-whole-equity");
if ("relativeRepricingError" in pair) assert.ok(pair.relativeRepricingError! < 1e-8);
assert.equal(pairCompanyFullCashflowCase(input, { ...market, datedReferenceReviewed: false }).pairing, "blocked");
assert.throws(() => pairCompanyFullCashflowCase(input, { ...market, cik: "0000000002" }), /mismatch/);
assert.throws(() => calculateCompanyFullCashflowCase({ ...input, terminalGrowth: .08 }), /exceed/);
assert.throws(() => calculateCompanyFullCashflowCase({ ...input, years: input.years.slice(1) }));
assert.throws(() => calculateCompanyFullCashflowCase({ ...input,
  evidence: [{ ...input.evidence[0], availableAt: "2026-11-10T00:00:00.000Z" }] }), /unavailable/);
assert.equal(calculateCompanyFullCashflowCase({ ...input, unresolvedAccountingClaims: ["Synthetic unresolved NCI"] }).status, "blocked");
const losses = { ...input, years: input.years.map((y, i) => i === 0 ? { ...y, capitalSpend: 100 } : y) };
assert.equal(pairCompanyFullCashflowCase(losses, market).pairing, "reverse-unavailable");
console.log("Synthetic full five-year cash ledger and whole-equity same-path pair checks passed; no actual issuer completion inferred.");
