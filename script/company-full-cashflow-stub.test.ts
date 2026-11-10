import assert from "node:assert/strict";
import test from "node:test";
import { calculateCompanyFullCashflowCase, pairCompanyFullCashflowCase } from "../server/calculation/companyFullCashflowCase";

// Engineering-only FCFE fixture; no actual issuer cases or sourced future cash invented.
function fixture() {
  const input = {
    symbol: "TEST", cik: "0000000001", security: "Synthetic common", currency: "USD",
    referenceDate: "2026-11-10", frozenAt: "2026-11-10T12:00:00.000Z", firstYear: 2027,
    informationContext: { mode: "prospective-conditional", modelAsOf: "2026-11-10T13:00:00.000Z",
      informationCutoff: "2026-11-10T12:00:00.000Z" },
    baseFcfe: 40, boundary: "whole-issuer-common-equity", unresolvedAccountingClaims: [],
    evidence: [{ id: "fixture", kind: "frozen-analyst-assumption", rationale: "Synthetic contract algebra only",
      availableAt: "2026-11-10T12:00:00.000Z", sha256: "a".repeat(64) }],
    discountRate: .08, terminalGrowth: .02, continuationGrowthAtYear5: .03,
    terminalEvidenceIds: ["fixture"],
    stub: { cashBasis: "FCFE-whole-issuer-common-equity", currency: "USD",
      throughDate: "2026-12-31", rationale: "Explicit fixture common-equity cash and complete stub coverage",
      completenessEvidenceIds: ["fixture"],
      cashFlows: [{ date: "2026-11-30", fcfe: -15, evidenceIds: ["fixture"] },
        { date: "2026-12-20", fcfe: 25, evidenceIds: ["fixture"] }] },
    years: Array.from({ length: 5 }, (_, i) => ({
      year: 2027 + i, cashFlowDate: `${2027 + i}-12-31`, evidenceIds: ["fixture"],
      nonClimateRevenue: 100, climateRevenue: 0, operatingMarginBeforeClimateCostsAndCredits: .5,
      climateOperatingCost: 0, recognizedPolicyCredit: 0, cashPolicyCredit: 0, depreciation: 10,
      otherNonCash: 0, openingReceivables: 20, closingReceivables: 20,
      increaseOtherOperatingWorkingCapital: 0, interestPaid: 0, cashTax: 10, otherOperatingCash: 0,
      capitalSpend: 10, debtProceeds: 0, debtRepayments: 0, nonCommonCashClaims: 0,
    })),
  };
  const market = { symbol: input.symbol, cik: input.cik, security: input.security, currency: "USD" as const,
    referenceDate: input.referenceDate, priceDate: "2026-11-09", sharesDate: "2026-11-09",
    quoteAt: "2026-11-09T21:00:00.000Z", observedAt: "2026-11-10T10:00:00.000Z",
    price: 600, shares: 1, datedReferenceReviewed: true };
  return { input, market };
}
// Independent timing/continuation arithmetic; fixed stub is not adjustment-scaled.
function independentlyValue(x: ReturnType<typeof fixture>["input"], adjustment: number) {
  const pv = (cash: number, date: string) => cash / (1 + x.discountRate) **
    ((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25));
  let total = x.stub.cashFlows.reduce((s, r) => s + pv(r.fcfe, r.date), 0);
  for (let i = 0; i < 5; i++) total += pv(40 * (1 + adjustment) ** (i + 1), `${2027 + i}-12-31`);
  let cash = 40 * (1 + adjustment) ** 5;
  const initial = (1 + x.continuationGrowthAtYear5) * (1 + adjustment) - 1;
  for (let t = 6; t <= 15; t++) {
    cash *= 1 + initial + (x.terminalGrowth - initial) * (t - 5) / 10;
    total += pv(cash, `${2026 + t}-12-31`);
  }
  return total + pv(cash * (1 + x.terminalGrowth) / (x.discountRate - x.terminalGrowth), "2041-12-31");
}
test("Dated negative/positive stub and all annual/terminal cash use identical ACT/365.25 in both directions", () => {
  const { input, market } = fixture(), chosenAdjustment = .12;
  market.price = independentlyValue(input, chosenAdjustment);
  const pair = pairCompanyFullCashflowCase(input, market);
  assert.equal(pair.pairing, "conditional-same-basis-whole-equity");
  if (!("impliedAnnualFcfeAdjustment" in pair)) throw new Error("Expected conditional pair");
  assert.ok(Math.abs(pair.forwardWholeEquity - independentlyValue(input, 0)) < 1e-9);
  assert.ok(Math.abs(pair.impliedAnnualFcfeAdjustment - chosenAdjustment) < 1e-12);
  assert.ok(pair.relativeRepricingError < 1e-10);
  assert.deepEqual(pair.stubCashFlows.map(r => r.discountYears), [20 / 365.25, 40 / 365.25]);
  assert.ok(pair.stubCashFlows[0].presentValue < 0);
  assert.equal(pair.quoteDate, "2026-11-09");
  assert.equal(pair.comparisonMode, "prospective-conditional");
});
test("Legacy schedules parse unchanged but missing stub explicitly withholds pairing, never assumes zero", () => {
  const { input, market } = fixture();
  const { stub, ...legacy } = input;
  assert.equal(calculateCompanyFullCashflowCase(legacy).stubStatus, "missing-stub-not-assumed-zero-legacy-schedule-only");
  assert.equal(pairCompanyFullCashflowCase(legacy, market).pairing, "blocked");
  const zero = { ...input, stub: { ...stub, cashFlows: [], rationale: "Engineering explicit justified zero" } };
  assert.equal(calculateCompanyFullCashflowCase(zero).stubStatus, "explicit-evidenced-zero-stub");
  assert.equal(pairCompanyFullCashflowCase(zero, market).pairing, "conditional-same-basis-whole-equity");
});
test("Stub requires FCFE basis, currency, evidence and complete ordered dates; no stock or duplicate deductions", () => {
  const { input } = fixture();
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub, cashBasis: "FCFF" } }));
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub, currency: "EUR" } }));
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub, completenessEvidenceIds: [] } }));
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub, rationale: "" } }));
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub, throughDate: "2027-01-01" } }), /cover/);
  for (const date of ["2026-11-10", "2027-01-01"]) assert.throws(() =>
    calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub,
      cashFlows: [{ ...input.stub.cashFlows[0], date }] } }), /dates/);
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub,
    cashFlows: [...input.stub.cashFlows].reverse() } }), /dates/);
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, stub: { ...input.stub,
    cashFlows: [{ ...input.stub.cashFlows[0], evidenceIds: ["missing"] }] } }), /Unknown/);
});
test("Prospective last close available by freeze is valid; historical cutoff and future-quote guards remain strict", () => {
  const { input, market } = fixture();
  assert.equal(pairCompanyFullCashflowCase(input, market).pairing, "conditional-same-basis-whole-equity");
  assert.throws(() => pairCompanyFullCashflowCase({ ...input, informationContext: {
    ...input.informationContext, mode: "historical-point-in-time" } }, market), /Same-date/);
  assert.throws(() => pairCompanyFullCashflowCase(input, { ...market,
    quoteAt: "2026-11-11T00:00:00.000Z", priceDate: "2026-11-11", sharesDate: "2026-11-11" }), /cannot exceed/);
  assert.throws(() => calculateCompanyFullCashflowCase({ ...input, informationContext: {
    ...input.informationContext, informationCutoff: "2026-11-09T21:00:00.000Z" } }), /cutoff/);
  assert.throws(() => pairCompanyFullCashflowCase(input, { ...market, sharesDate: "2026-11-10" }), /Same-date/);
});
test("Negative annual FCFE retains dated stub in forward value and refuses unsupported reverse monotonicity", () => {
  const { input, market } = fixture();
  input.years[0].capitalSpend = 100;
  const pair = pairCompanyFullCashflowCase(input, market);
  assert.equal(pair.pairing, "reverse-unavailable");
  if (!("stubPresentValue" in pair)) throw new Error("Expected forward stub value");
  assert.ok(Number.isFinite(pair.forwardWholeEquity));
  assert.ok(pair.stubPresentValue > 0);
});
