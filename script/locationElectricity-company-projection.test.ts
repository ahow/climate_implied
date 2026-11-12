import test from "node:test";
import assert from "node:assert/strict";
import { projectCompanyMembers } from "../server/calculation/companyProjection";
import type { LocationElectricityCashBridgeInput } from "../server/calculation/locationElectricityCashBridge";

// All numeric company inputs below are engineering controls, not real issuers.
function electricity(): LocationElectricityCashBridgeInput {
  const source = { id: "synthetic-only", url: "https://example.invalid/engineering-control",
    sha256: "b".repeat(64), locator: "not-empirical", observedAt: "2025-01-02T00:00:00Z",
    availableAt: "2025-01-01T00:00:00Z" };
  const measure = (value: number) => ({ value, basis: "conditional-assumption" as const,
    rationale: "Engineering control, not issuer tariff/recovery evidence", source,
    bounds: { minimum: value, maximum: value } });
  const price = (value: number) => ({ ...measure(value), year: 2025, currency: "USD",
    unit: "major-currency/MWh" as const, supplier: "TEST", tariff: "TEST", kind: "conditional-price" as const });
  return { companyId: "TEST-COMPANY", year: 2025, currency: "USD", cutoff: "2025-02-01T00:00:00Z",
    expenseBasis: "incremental-above-electricity-expense-in-baseline",
    workingCapitalBasis: "electricity-increment-excluded-from-baseline-working-capital",
    scope2DirectTax: false,
    locations: [{ id: "TEST-SITE", companyId: "TEST-COMPANY", jurisdiction: "TEST-REGION",
      operatingStatus: "operating", locationSource: source, applicabilitySource: source,
      supplier: "TEST", tariff: "TEST",
      purchasedElectricity: { ...measure(100), unit: "MWh", year: 2025 },
      baselinePrice: price(50), scenarioPrice: price(70),
      customerRecoveryFraction: measure(0.4), supplierPaymentFraction: measure(0.75),
      customerCollectionFraction: measure(0.25) }] };
}
function fixture() {
  return { companyId: "TEST-COMPANY", manifestId: "TEST-MANIFEST", currency: "USD",
    businessType: "non-financial", baseYear: 2024, baseRevenue: 10000, baseFcfe: 3405,
    baseEmissionsTonnes: { scope1: 100, scope2: 500, scope3: 99999 },
    marginBounds: { minimum: 0, maximum: 0.6, evidence: ["synthetic-only"] },
    mapping: { basis: "operating-geography", evidence: ["synthetic-only"],
      shares: [{ region: "TEST-REGION", sector: "manufacturing", weight: 1 }] },
    members: [0, 1].map(i => ({ id: `TEST-${i}`, years: Array.from({ length: 5 }, (_, t) => ({
      year: 2025 + t, exposures: [{ region: "TEST-REGION", sector: "manufacturing", activityGrowth: 0 }],
      marketShareMultiplier: 1, operatingMargin: 0.5, taxRate: 0.25, interest: 25,
      depreciation: 100, capex: 200, increaseWorkingCapital: 300, netBorrowing: 50,
      nonOperatingIncome: 100, incomeAttributionAdjustment: 2, otherCashAdjustments: 3,
      scope1IntensityMultiplier: 1, scope2IntensityMultiplier: 1, scope3IntensityMultiplier: 1,
      scope1LiableFraction: 0.5, scope2LiableFraction: 0, effectiveCarbonPrice: 2, passThrough: 0.25,
      ...({} as { locationElectricity?: LocationElectricityCashBridgeInput }),
    })) })) };
}
function projected(x: ReturnType<typeof fixture>) {
  const r = projectCompanyMembers(x);
  if (r.status !== "conditional-projection") throw new Error("Expected synthetic conditional company projection");
  return r;
}

test("actual companyProjection consumes electricity accrual, WC and tax exactly once in FCFE", () => {
  const x = fixture(), baseline = projected(x);
  x.members[0].years[0].locationElectricity = electricity();
  const retained = structuredClone(x), r = projected(x);
  const b = baseline.members[0].years[0], y = r.members[0].years[0];
  assert.equal(b.carbonDrag, 75);
  assert.equal(b.cashTax, 1250);
  assert.equal(b.fcfe, 3405);
  assert.equal(y.carbonDrag, b.carbonDrag, "Electricity must not become Scope2 carbon drag");
  assert.equal(y.electricityPriceBridge?.totals.netAccrualExpense, 1200);
  assert.equal(y.electricityPriceBridge?.totals.preTaxCashImpact, -1300);
  assert.equal(y.baselineIncreaseWorkingCapital, 300);
  assert.equal(y.increaseWorkingCapital, 400);
  assert.equal(y.cashTax, 950);
  assert.equal(y.fcfe, 2405);
  assert.equal(y.fcfe - b.fcfe, -1300 + 300);
  assert.equal(y.fcfe, y.netIncome + y.depreciation + y.otherCashAdjustments -
    y.capex - y.increaseWorkingCapital + y.netBorrowing);
  assert.deepEqual(r.members[1], baseline.members[1], "No peer-member mutation");
  assert.deepEqual(r.members[0].years.slice(1), baseline.members[0].years.slice(1));
  assert.notEqual(r.inputHash, baseline.inputHash);
  assert.deepEqual(x, retained);
});

test("actual companyProjection loss-year electricity adjustment never invents a tax refund", () => {
  for (const margin of [0.1, 0]) {
    const x = fixture();
    x.members[0].years[0].operatingMargin = margin;
    const before = projected(x).members[0].years[0];
    x.members[0].years[0].locationElectricity = electricity();
    const after = projected(x).members[0].years[0];
    assert.equal(after.cashTax, 0);
    assert.equal(after.fcfe - before.fcfe, -1300 + before.cashTax);
  }
});

test("company Scope2/Scope3 tonnes are not purchased electricity; Scope1 direct drag stays separate", () => {
  const x = fixture(); x.members[0].years[0].locationElectricity = electricity();
  const before = projected(x).members[0].years[0];
  x.baseEmissionsTonnes.scope2 *= 1000; x.baseEmissionsTonnes.scope3 *= 1000;
  const after = projected(x).members[0].years[0];
  assert.equal(after.fcfe, before.fcfe);
  assert.deepEqual(after.electricityPriceBridge, before.electricityPriceBridge);
  x.baseEmissionsTonnes.scope1 *= 2;
  const direct = projected(x).members[0].years[0];
  assert.equal(direct.carbonDrag, before.carbonDrag * 2);
  assert.deepEqual(direct.electricityPriceBridge, before.electricityPriceBridge);
});

test("company full customer recovery with delayed collection still reduces same-year cash, not income", () => {
  const x = fixture(), baseline = projected(x).members[0].years[0];
  const e = electricity(), l = e.locations[0];
  for (const [measure, value] of [[l.customerRecoveryFraction, 1],
    [l.supplierPaymentFraction, 1], [l.customerCollectionFraction, 0]] as const) {
    measure.value = value; measure.bounds = { minimum: value, maximum: value };
  }
  x.members[0].years[0].locationElectricity = e;
  const after = projected(x).members[0].years[0];
  assert.equal(after.netIncome, baseline.netIncome);
  assert.equal(after.cashTax, baseline.cashTax);
  assert.equal(after.increaseWorkingCapital, 2300);
  assert.equal(after.fcfe - baseline.fcfe, -2000);
});

test("company consumer rejects duplicate Scope2 charge, mismatched issuer/year/currency and HQ mapping", () => {
  for (const mutate of [
    (x: ReturnType<typeof fixture>) => { x.members[0].years[0].scope2LiableFraction = 0.1; },
    (x: ReturnType<typeof fixture>) => { x.members[0].years[0].locationElectricity!.companyId = "OTHER"; },
    (x: ReturnType<typeof fixture>) => { x.members[0].years[0].locationElectricity!.year = 2026; },
    (x: ReturnType<typeof fixture>) => { x.members[0].years[0].locationElectricity!.currency = "GBP"; },
    (x: ReturnType<typeof fixture>) => { x.mapping.basis = "headquarters-fallback"; },
    (x: ReturnType<typeof fixture>) => { x.members[0].years[0].locationElectricity!.locations[0].jurisdiction = "OTHER"; },
  ]) {
    const x = fixture(); x.members[0].years[0].locationElectricity = electricity(); mutate(x);
    assert.throws(() => projectCompanyMembers(x));
  }
});

test("company consumer refuses source-context averages and already-in-baseline electricity/WC", () => {
  for (const change of [
    (e: any) => { e.locations[0].scenarioPrice.kind = "regional-context-only"; },
    (e: any) => { e.workingCapitalBasis = "already-in-baseline"; },
    (e: any) => { e.expenseBasis = "total-electricity-expense"; },
  ]) {
    const x = fixture(), e = electricity(); change(e);
    x.members[0].years[0].locationElectricity = e;
    assert.throws(() => projectCompanyMembers(x));
  }
});

test("absent optional electricity preserves legacy output after removing the opt-in", () => {
  const a = fixture(), b: any = structuredClone(a);
  b.members[0].years[0].locationElectricity = electricity();
  for (const m of b.members) for (const y of m.years) delete y.locationElectricity;
  const r = projected(a);
  assert.deepEqual(r, projectCompanyMembers(b));
  assert.equal("electricityPriceBridge" in r.members[0].years[0], false);
  assert.equal("baselineIncreaseWorkingCapital" in r.members[0].years[0], false);
});
