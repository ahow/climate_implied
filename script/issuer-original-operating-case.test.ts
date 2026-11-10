import test from "node:test";
import assert from "node:assert/strict";
import { buildOriginalIssuerOperatingCase, originalIssuerAssumptions, assessOriginalIssuerOperatingCase,
  type OriginalIssuerInputs } from "../server/calculation/issuerOriginalOperatingCase";

// Code-only engineering fixture; never substitutes for mandatory actual-source
// private validation. No filesystem, network, quotes, issuer source export or CI skip.
function fixture(symbol = "FSLR"): OriginalIssuerInputs {
  const normalized = { revenue: 4e9, operatingProfit: 1e9, depreciation: .4e9, interest: .02e9,
    otherCash: -.01e9, reinvestment: .42e9, claims: 0, receivables: .3e9,
    annualRollover: .1e9, cashAndSecurities: .2e9, debt: .3e9, stubReserve: 0,
    cashTax: .1e9, affiliateCash: .2e9 };
  return {
    reconciliation: { identity: { symbol, cik: "0000000001", security: "Engineering fixture, NOT authentic issuer", fiscalEnd: "2024-12-31" },
      normalized, rows: [], allocation: [], residuals: {}, capitalBudgets: [],
      historical: { cfo: 0, cfi: 0, cff: 0, fx: 0, cashOpen: 0, cashClose: 0, cashChange: 0,
        unrestrictedCash: .2e9, operatingReconciliation: [], investingReconciliation: [], financingReconciliation: [] },
      sourceAuthentication: "Synthetic engineering fixture ONLY",
    },
    netPpe: 3e9, debt: .3e9, inventory: .2e9, otherCurrentAssets: .1e9,
    operatingPayables: .1e9, customerAdvances: .1e9, minimumCash: .2e9,
    maturities2025To2029: [.1e9, .1e9, .1e9, .1e9, .1e9], additionalClaims: [],
    renewableTaxCreditCash: 0,
    primaryHash: "a".repeat(64), supplementHash: "b".repeat(64), publishedAt: "2025-02-25T21:00:00.000Z",
  };
}
const options = { terminalGrowth: .025, variant: "source-conditioned" as const,
  referenceDate: "2025-02-21", frozenAt: "2026-11-10T20:00:00.000Z", historicalBaseFcfe: 1 };

test("Original range runs complete funded five years, ten fade years and terminal, not g=0 maintenance", () => {
  const built = buildOriginalIssuerOperatingCase(fixture(), options);
  assert.equal(built.ledger.years.length, 5);
  assert.equal(built.ledger.continuationYears.length, 10);
  assert.equal(built.ledger.terminalYear?.year, 2041);
  assert.equal(built.engineInput.terminalGrowth, .025);
  assert.equal(built.funding.length, 17);
  assert.ok(built.funding.every((f: any) => Math.abs(f.fixedCapitalResidual) < .001 && Math.abs(f.debtResidual) < .001));
  assert.equal(built.qualifiedOriginalCases, 0);
  assert.throws(() => buildOriginalIssuerOperatingCase(fixture(), { ...options, terminalGrowth: 0 }),
    /original nominal terminal range/);
});

test("Credits follow eligible physical watts/nominal statute, never all revenue or US-customer fraction", () => {
  const built = buildOriginalIssuerOperatingCase(fixture(), options);
  const rows = [...built.ledger.years, ...built.ledger.continuationYears];
  assert.equal(rows.find(y => y.year === 2029)!.recognizedPolicyCredit, originalIssuerAssumptions.fslrForecastCredit2025);
  assert.equal(rows.find(y => y.year === 2030)!.recognizedPolicyCredit, originalIssuerAssumptions.fslrForecastCredit2025 * .75);
  assert.equal(rows.find(y => y.year === 2032)!.recognizedPolicyCredit, originalIssuerAssumptions.fslrForecastCredit2025 * .25);
  assert.equal(rows.find(y => y.year === 2033)!.recognizedPolicyCredit, 0);
  assert.ok(rows.find(y => y.year === 2033)!.cashPolicyCredit > 0, "collect prior scheduled receivable once");
  assert.equal(rows.find(y => y.year === 2034)!.cashPolicyCredit, 0);
  assert.ok(rows.every(y => y.climateRevenue === 0));
  assert.notEqual(built.activity[3].usEligibleCreditEquivalentWattsAssumed,
    built.activity[3].globalSolarWattsAssumed! * originalIssuerAssumptions.fslrUsCustomerShare);
});

test("Startup-only normalization is explicit; all ramp/underutilization is retained and no market fitting", () => {
  const source = buildOriginalIssuerOperatingCase(fixture(), options);
  const stress = buildOriginalIssuerOperatingCase(fixture(), { ...options, variant: "constraint" });
  const sourceProfit = source.ledger.years[0].operatingProfitBeforeClimate;
  const stressProfit = stress.ledger.years[0].operatingProfitBeforeClimate;
  const revenueScale = source.ledger.years[0].revenue / originalIssuerAssumptions.fslrForecastRevenue2025;
  assert.ok(Math.abs(sourceProfit - stressProfit - 65e6 * revenueScale) < .0001);
  assert.ok(source.engineInput.stub.rationale.includes("not observed"));
  assert.ok(originalIssuerAssumptions.rationale.some(r => r.includes("NEVER added back")));
  assert.ok(source.funding.some((f: any) => f.cashReserve !== fixture().minimumCash));
});

test("Actual-date and class mismatch cannot obtain a signed-path comparison", () => {
  const built = buildOriginalIssuerOperatingCase(fixture(), options);
  assert.equal(built.ledger.status, "conditional-full-cashflow-case");
  assert.throws(() => assessOriginalIssuerOperatingCase(built, {
    symbol: "WRONG", cik: "0000000001", security: built.engineInput.security, currency: "USD",
    referenceDate: options.referenceDate, priceDate: options.referenceDate, sharesDate: options.referenceDate,
    price: 10, shares: 100, datedReferenceReviewed: true,
  }), /identity\/currency\/date mismatch/);
});

test("NEE conditional policy cash runs off, is not inflation-indexed or added to historical CFO twice", () => {
  const input = fixture("NEE");
  Object.assign(input.reconciliation.normalized, { fixedAssetDepreciation: .4e9, nuclearAmortization: .01e9,
    nuclearFuel: .02e9, corporateCapex: .01e9, fundNet: .01e9, otherInvesting: .001e9 });
  input.reconciliation.capitalBudgets = [1.2e9, 1.2e9, 1.2e9, 1.2e9, 1.2e9];
  input.renewableTaxCreditCash = .1e9; // synthetic engineering amount, not an issuer observation
  const base = buildOriginalIssuerOperatingCase(input, options);
  const stress = buildOriginalIssuerOperatingCase(input, { ...options, variant: "constraint" });
  const years = [...base.ledger.years, ...base.ledger.continuationYears, base.ledger.terminalYear!];
  assert.equal(years.find(y => y.year === 2026)!.cashPolicyCredit, .1e9);
  assert.equal(years.find(y => y.year === 2030)!.cashPolicyCredit, .09e9);
  assert.equal(years.find(y => y.year === 2039)!.cashPolicyCredit, 0);
  assert.equal(base.ledger.terminalYear!.cashPolicyCredit, 0);
  assert.ok(stress.ledger.years.every(y => y.cashPolicyCredit === 0));
  assert.ok(base.ledger.years.every(y => y.recognizedPolicyCredit === 0 && y.cashTax > 0));
});
