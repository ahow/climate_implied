import test from "node:test";
import assert from "node:assert/strict";
import { projectCompanyMembers } from "../server/calculation/companyProjection";

function fixture() {
  return { companyId: "fixture-utility", manifestId: "fixture-manifest", currency: "GBP",
    businessType: "non-financial", baseYear: 2024, baseRevenue: 1000, baseFcfe: 80,
    marginBounds: { minimum: 0, maximum: .2, evidence: ["fixture-not-empirical-margin"] },
    baseEmissionsTonnes: { scope1: 100, scope2: 50, scope3: 1000 },
    mapping: { basis: "operating-geography", evidence: ["fixture"], shares: [
      { region: "EU27", sector: "power", weight: .6 }, { region: "US", sector: "power", weight: .4 },
    ] },
    members: Array.from({ length: 1000 }, (_, i) => ({
      id: `m${i.toString().padStart(4, "0")}`,
      years: Array.from({ length: 5 }, (_, y) => ({
        year: 2025 + y, exposures: [
          { region: "EU27", sector: "power", activityGrowth: .02 },
          { region: "US", sector: "power", activityGrowth: .02 },
        ],
        marketShareMultiplier: 1, operatingMargin: .1, taxRate: .2, interest: 0,
        depreciation: 10, capex: 10, increaseWorkingCapital: 0, netBorrowing: 0,
        nonOperatingIncome: 0, incomeAttributionAdjustment: 0, otherCashAdjustments: 0,
        scope1IntensityMultiplier: 1, scope2IntensityMultiplier: 1, scope3IntensityMultiplier: 1,
        scope1LiableFraction: 1, scope2LiableFraction: 0, effectiveCarbonPrice: 1, passThrough: .5,
      })),
    })) };
}
test("company member cash flows reconcile and Scope 3 is never a direct liability", () => {
  const x = fixture(), a = projectCompanyMembers(x);
  assert.equal(a.status, "conditional-projection");
  if (a.status !== "conditional-projection") throw new Error("Expected projection");
  const first = a.members[0].years[0];
  assert.ok(Math.abs(first.revenue - 1020) < 1e-9);
  assert.ok(Math.abs(first.emissionsTonnes.scope1 - 102) < 1e-9);
  assert.ok(Math.abs(first.carbonDrag - 51) < 1e-9);
  assert.ok(Math.abs(first.fcfe - 40.8) < 1e-9);
  const b = projectCompanyMembers({ ...x, baseEmissionsTonnes: { ...x.baseEmissionsTonnes, scope3: 999999 } });
  assert.equal(b.status, "conditional-projection");
  if (b.status !== "conditional-projection") throw new Error("Expected projection");
  assert.equal(b.members[0].growth, a.members[0].growth);
  assert.deepEqual(projectCompanyMembers({ ...x, members: [...x.members].reverse() }), a);
  assert.equal(a.definition.basis, "FCFE");
  assert.equal(a.definition.horizonYears, 5);
});
test("company projection refuses missing mappings, invalid fractions and unsupported financials", () => {
  const x = fixture();
  assert.throws(() => projectCompanyMembers({ ...x, mapping: { ...x.mapping, shares: x.mapping.shares.slice(1) } }));
  assert.throws(() => projectCompanyMembers({ ...x, members: [x.members[0], x.members[0]] }));
  const invalid = structuredClone(x);
  invalid.members[0].years[0].passThrough = 1.01;
  assert.throws(() => projectCompanyMembers(invalid));
  assert.equal(projectCompanyMembers({ ...x, businessType: "financial" }).status, "not-modelled");
  const missing = structuredClone(x);
  missing.members[0].years[0].exposures.pop();
  assert.throws(() => projectCompanyMembers(missing));
});

test("company ledgers retain explicit accounting bridge items and refuse omissions", () => {
  const x = fixture();
  x.members = x.members.slice(0, 2);
  for (const m of x.members) for (const y of m.years) {
    y.nonOperatingIncome = 10;
    y.incomeAttributionAdjustment = 2;
    y.otherCashAdjustments = 3;
  }
  const result = projectCompanyMembers(x);
  assert.equal(result.status, "conditional-projection");
  if (result.status !== "conditional-projection") throw new Error("Expected projection");
  assert.ok(Math.abs(result.members[0].years[0].fcfe - 53.8) < 1e-9);
  const missing: any = structuredClone(x);
  delete missing.members[0].years[0].otherCashAdjustments;
  assert.throws(() => projectCompanyMembers(missing));
});
