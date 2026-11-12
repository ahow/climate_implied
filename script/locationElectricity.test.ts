import test from "node:test";
import assert from "node:assert/strict";
import { calculateLocationElectricityCashBridge, type LocationElectricityCashBridgeInput }
  from "../server/calculation/locationElectricityCashBridge";
import { buildPublicLocationElectricityReport } from "../server/calculation/locationElectricityPublicReport";

// Explicit engineering fixtures, never retained/advertised as issuer facts.
const source = { id: "synthetic-control-only", url: "https://example.invalid/test-control",
  sha256: "a".repeat(64), locator: "synthetic-test-not-issuer-evidence",
  availableAt: "2025-01-01T00:00:00Z", observedAt: "2025-01-02T00:00:00Z" };
const measure = (value: number) => ({ value, basis: "conditional-assumption" as const,
  source, rationale: "Synthetic accounting control, not issuer calibration",
  bounds: { minimum: value, maximum: value } });
function fixture(): LocationElectricityCashBridgeInput {
  const price = (value: number) => ({ ...measure(value), unit: "major-currency/MWh" as const,
    currency: "USD", year: 2025, kind: "conditional-price" as const, supplier: "TEST-UTILITY", tariff: "TEST-TARIFF" });
  return {
    companyId: "TEST-NOT-ISSUER", year: 2025, currency: "USD", cutoff: "2025-02-01T00:00:00Z",
    expenseBasis: "incremental-above-electricity-expense-in-baseline",
    workingCapitalBasis: "electricity-increment-excluded-from-baseline-working-capital",
    scope2DirectTax: false,
    locations: [{
      id: "TEST-SITE", companyId: "TEST-NOT-ISSUER", jurisdiction: "TEST-REGION",
      operatingStatus: "operating", locationSource: source, applicabilitySource: source,
      supplier: "TEST-UTILITY", tariff: "TEST-TARIFF",
      purchasedElectricity: { ...measure(100), unit: "MWh", year: 2025 },
      baselinePrice: price(50), scenarioPrice: price(70),
      customerRecoveryFraction: measure(0.4),
      supplierPaymentFraction: measure(0.75), customerCollectionFraction: measure(0.25),
    }],
  };
}
const rejects = (change: (x: LocationElectricityCashBridgeInput) => void, match?: RegExp) => {
  const x = fixture(); change(x);
  if (match) assert.throws(() => calculateLocationElectricityCashBridge(x), match);
  else assert.throws(() => calculateLocationElectricityCashBridge(x));
};

test("electricity synthetic accrual/receivable/payable cash bridge reconciles without a Scope2 tax", () => {
  const r = calculateLocationElectricityCashBridge(fixture());
  assert.equal(r.status, "conditional-electricity-price-bridge");
  assert.deepEqual(r.totals, { incrementalSupplierExpense: 2000,
    incrementalCustomerRevenue: 800, netAccrualExpense: 1200, increaseWorkingCapital: 100, preTaxCashImpact: -1300 });
  assert.equal(r.locations[0].incrementalPayable, 500);
  assert.equal(r.locations[0].incrementalReceivable, 600);
  assert.equal(r.locations[0].reconciliationResidual, 0);
  assert.equal(r.integration.directScope2Tax, 0);
  assert.equal(r.locations[0].conditionalInputs.length, 6);
  assert.equal(r.productionEligible, false);
});

test("electricity component can enter the income and FCFE identities with loss-year tax discipline", () => {
  const r = calculateLocationElectricityCashBridge(fixture());
  for (const baselinePreTax of [10000, 500, -500]) {
    const taxRate = 0.25, baseWc = 300;
    const beforeTax = Math.max(0, baselinePreTax) * taxRate;
    const afterIncome = baselinePreTax - r.integration.subtractFromPreTaxIncome;
    const afterTax = Math.max(0, afterIncome) * taxRate;
    const beforeFcfe = baselinePreTax - beforeTax + 100 - 200 - baseWc;
    const afterFcfe = afterIncome - afterTax + 100 - 200 -
      (baseWc + r.integration.addToIncreaseWorkingCapital);
    assert.equal(afterFcfe - beforeFcfe, r.totals.preTaxCashImpact + beforeTax - afterTax);
    if (afterIncome < 0) assert.equal(afterTax, 0);
  }
});

test("full accrual recovery is not same-year cash neutrality when collections lag", () => {
  const x = fixture(), l = x.locations[0];
  l.customerRecoveryFraction = measure(1);
  l.supplierPaymentFraction = measure(1);
  l.customerCollectionFraction = measure(0);
  const r = calculateLocationElectricityCashBridge(x);
  assert.equal(r.totals.netAccrualExpense, 0);
  assert.equal(r.totals.increaseWorkingCapital, 2000);
  assert.equal(r.totals.preTaxCashImpact, -2000);
});

test("electricity price decreases propagate signed expense and recovery without clipping", () => {
  const x = fixture();
  x.locations[0].scenarioPrice = { ...x.locations[0].scenarioPrice, ...measure(30) };
  const r = calculateLocationElectricityCashBridge(x);
  assert.equal(r.totals.netAccrualExpense, -1200);
  assert.equal(r.totals.increaseWorkingCapital, -100);
  assert.equal(r.totals.preTaxCashImpact, 1300);
});

test("no source default is assigned to zero purchased MWh", () => {
  const x = fixture(); x.locations[0].purchasedElectricity.value = 0;
  x.locations[0].purchasedElectricity.bounds = { minimum: 0, maximum: 0 };
  assert.equal(calculateLocationElectricityCashBridge(x).totals.preTaxCashImpact, 0);
});

test("multiple operating locations sum without rebalancing and hash canonically", () => {
  const x = fixture();
  x.locations.push({ ...structuredClone(x.locations[0]), id: "AAA-SECOND-SITE" });
  const a = calculateLocationElectricityCashBridge(x);
  x.locations.reverse();
  const b = calculateLocationElectricityCashBridge(x);
  assert.equal(a.totals.preTaxCashImpact, -2600);
  assert.equal(a.inputHash, b.inputHash);
  assert.deepEqual(a, b);
});

test("source-fact label cannot hide conditional ranges or prices", () => {
  rejects(x => { x.locations[0].scenarioPrice.basis = "source-fact"; }, /relabelled/);
  rejects(x => { x.locations[0].purchasedElectricity.basis = "source-fact";
    x.locations[0].purchasedElectricity.bounds.minimum = 1; }, /Source facts/);
});

test("regional industrial price context cannot become a site tariff", () => {
  rejects(x => { x.locations[0].scenarioPrice.kind = "regional-context-only"; }, /Regional/);
});

test("supplier/tariff and issuer mismatches fail closed", () => {
  rejects(x => { x.locations[0].scenarioPrice.supplier = "OTHER"; }, /applicability/);
  rejects(x => { x.locations[0].baselinePrice.tariff = "OTHER"; }, /applicability/);
  rejects(x => { x.locations[0].companyId = "OTHER"; }, /issuer/);
});

test("electricity prices/quantities cannot be forward filled or implicitly FX converted", () => {
  rejects(x => { x.locations[0].scenarioPrice.year = 2024; }, /period\/currency/);
  rejects(x => { x.locations[0].scenarioPrice.currency = "MYR"; }, /period\/currency/);
  rejects(x => { x.locations[0].purchasedElectricity.year = 2024; }, /period/);
});

test("source cutoff applies to location, tariff, quantity and recovery/payment/collection evidence", () => {
  for (const field of ["locationSource", "applicabilitySource"] as const)
    rejects(x => { x.locations[0][field] = { ...source, observedAt: "2026-01-01T00:00:00Z" }; }, /cutoff/);
  for (const field of ["purchasedElectricity", "baselinePrice", "scenarioPrice",
    "customerRecoveryFraction", "supplierPaymentFraction", "customerCollectionFraction"] as const)
    rejects(x => { x.locations[0][field].source = { ...source, observedAt: "2026-01-01T00:00:00Z" }; }, /cutoff/);
  rejects(x => { x.locations[0].locationSource = { ...source, availableAt: "2026-01-01T00:00:00Z" }; }, /cutoff/);
  rejects(x => { x.locations[0].locationSource = { ...source, availableAt: "2025-01-03T00:00:00Z" }; }, /availability/);
});

test("duplicate sites, unbounded coefficients, nonfinite and missing values fail closed", () => {
  rejects(x => { x.locations.push(structuredClone(x.locations[0])); }, /Duplicate/);
  rejects(x => { x.locations[0].customerRecoveryFraction = measure(1.1); });
  rejects(x => { x.locations[0].supplierPaymentFraction.bounds.maximum = 2; }, /bounds/);
  rejects(x => { x.locations[0].scenarioPrice.value = Infinity; });
  rejects(x => { x.locations[0].customerCollectionFraction.value = -0.1; });
  const x = fixture() as any;
  delete x.locations[0].customerRecoveryFraction;
  assert.throws(() => calculateLocationElectricityCashBridge(x));
});

test("unexpected direct-tax, wrong units and duplicate-baseline treatments are rejected", () => {
  for (const extra of [{ scope2DirectTax: true }, { scope2Tonnes: 200 }, { effectiveCarbonPrice: 100 },
    { expenseBasis: "total-electricity-expense" }, { workingCapitalBasis: "already-in-baseline" }])
    assert.throws(() => calculateLocationElectricityCashBridge({ ...fixture(), ...extra }));
  const x = fixture() as any; x.locations[0].purchasedElectricity.unit = "kWh";
  assert.throws(() => calculateLocationElectricityCashBridge(x));
});

test("overflow in site calculations and aggregate cash bridges is not silent", () => {
  rejects(x => { x.locations[0].purchasedElectricity = { ...x.locations[0].purchasedElectricity,
    ...measure(1e308) }; }, /Nonfinite/);
});

test("public real-source findings adapter needs no private files and never manufactures an issuer tariff/result", () => {
  const e = buildPublicLocationElectricityReport();
  assert.deepEqual(e.counts, { evidencedPropertyRows: 6, operatingPropertyRows: 5,
    constructionPropertyRows: 1, regionalPriceRecords: 5, applicableIssuerTariffs: 0,
    siteConsumptionRecords: 0, customerRecoveryRecords: 0, sourceQualifiedIssuerCashBridgeExecutions: 0 });
  assert.equal(e.actualIssuerResult, null);
  assert.equal(e.sourceApproval, false);
  assert.equal(e.assumptionValuesAssignedToIssuers, 0);
  assert.equal(e.cutoff, "2026-11-12T14:23:56.564Z");
  for (const row of e.sourceFacts.contextualElectricityPrices) {
    assert.equal(row.nominalMajorCurrencyPerMWh, row.reportedValue * 10);
    assert.equal(row.kind, "regional-context-only");
    assert.equal(row.issuerTariff, false);
    assert.equal(row.applicableToNamedIssuerSite, false);
    assert.equal(row.source.availableAt, null);
  }
  assert.equal(e.sourceFacts.contextualElectricityPrices[0].reportedValue, 7.1);
  assert.equal(e.sourceFacts.contextualElectricityPrices[1].reportedValue, 7.03);
  for (const l of e.sourceFacts.operatingLocations) {
    assert.equal(l.purchasedElectricityMWh, null);
    assert.equal(l.customerRecoveryFraction, null);
    assert.equal(l.issuerCashBridgeExecutable, false);
    assert.ok(Date.parse(l.source.observedAt) <= Date.parse(e.cutoff));
  }
  assert.equal(e.sourceFacts.operatingLocations[5].operatingStatus, "under-construction-not-operating-at-source-date");
  assert.ok(e.missingIssuerInputs.some(s => s.includes("confer no issuer tariff permission")));
  const modified = buildPublicLocationElectricityReport();
  modified.sourceFacts.operatingLocations.pop();
  assert.deepEqual(buildPublicLocationElectricityReport(), e, "Public reports must not share mutable state");
  assert.equal(JSON.stringify(e).includes("generated-artifacts/"), false);
});
