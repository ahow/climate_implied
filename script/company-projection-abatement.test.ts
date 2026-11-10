import test from "node:test";
import assert from "node:assert/strict";
import { contentHash } from "../server/calculation/analysisManifest";
import { projectCompanyMembers } from "../server/calculation/companyProjection";

const scopes = ["scope1", "scope2", "scope3"] as const;
type Scope = typeof scopes[number];

// Synthetic engineering controls, not issuer evidence or actual delivery assumptions.
function accounting(member: number, year: number) {
  return Object.fromEntries(scopes.map((scope, s) => [scope, {
    intensityEvidence: [`synthetic-pathway-${scope}`],
    measures: [
      { measureId: `embedded-${scope}`, treatment: "embedded-in-intensity",
        evidence: ["synthetic-embedded-measure"] },
      { measureId: `separate-${scope}`, treatment: "separate-abatement",
        remainingEmissionsMultiplier: 1 - .05 * (s + 1) - .01 * member - .01 * year,
        evidence: ["synthetic-measure"], deliveryEvidence: ["synthetic-delivery-not-issuer-qualification"],
        disjointnessEvidence: ["synthetic-disjoint-from-pathway-and-other-measures"] },
    ],
  }])) as Record<Scope, {
    intensityEvidence: string[];
    measures: Array<{ measureId: string; treatment: string; evidence: string[];
      remainingEmissionsMultiplier?: number; deliveryEvidence?: string[]; disjointnessEvidence?: string[] }>;
  }>;
}

function fixture(withAccounting = true) {
  return {
    companyId: "synthetic-S12-014", manifestId: "synthetic-engineering-only", currency: "GBP",
    businessType: "non-financial", baseYear: 2024, baseRevenue: 1000, baseFcfe: 80,
    baseEmissionsTonnes: { scope1: 100, scope2: 50, scope3: 1000 },
    marginBounds: { minimum: 0, maximum: .3, evidence: ["synthetic-margin"] },
    mapping: { basis: "operating-geography", evidence: ["synthetic-geography"],
      shares: [{ region: "EU27", sector: "power", weight: .6 }, { region: "US", sector: "power", weight: .4 }] },
    members: Array.from({ length: 3 }, (_, m) => ({
      id: `member-${m}`,
      years: Array.from({ length: 5 }, (_, y) => ({
        year: 2025 + y, exposures: [
          { region: "EU27", sector: "power", activityGrowth: .02 + .01 * m },
          { region: "US", sector: "power", activityGrowth: .01 },
        ],
        marketShareMultiplier: 1 + .01 * y, operatingMargin: .2, taxRate: .2,
        interest: 1, depreciation: 10, capex: 8, increaseWorkingCapital: 2, netBorrowing: 0,
        nonOperatingIncome: 0, incomeAttributionAdjustment: 0, otherCashAdjustments: 0,
        scope1IntensityMultiplier: .9 - .01 * y, scope2IntensityMultiplier: .8 - .01 * y,
        scope3IntensityMultiplier: .7 - .01 * y,
        scope1LiableFraction: .8, scope2LiableFraction: .3, effectiveCarbonPrice: 2, passThrough: .25,
        ...(withAccounting ? { abatementAccounting: accounting(m, y) } : {}),
      })),
    })),
  };
}

function projection(input: unknown) {
  const result = projectCompanyMembers(input);
  assert.equal(result.status, "conditional-projection");
  if (result.status !== "conditional-projection") throw new Error("Expected conditional projection");
  return result;
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${actual} != ${expected}`);
}

test("S12-014 legacy output identity receipt", () => {
  const result = projection(fixture(false));
  // Captured from the unmodified engine before implementation; covers full result,
  // original inputHash, limitations and absence of any new output/default fields.
  assert.equal(contentHash(result), "2aa4418de391a94726f7d140c3136cc791bf4ad494c28dc872356210487e6233");
  assert.ok(result.members.every(m => m.years.every(y => !("abatementReconciliation" in y))));
  const unsupported = fixture(false);
  Object.assign(unsupported.members[0].years[0], { additionalTargetAbatement: .2 });
  assert.throws(() => projection(unsupported));
});

test("S12-014 all three scopes reconcile activity × supplied intensity × separate abatement for every member/year", () => {
  const input = fixture(), result = projection(input);
  assert.equal(result.members.length * result.members[0].years.length * scopes.length, 45);
  for (const [m, member] of result.members.entries()) {
    for (const [i, row] of member.years.entries()) {
      const source = input.members[m].years[i];
      const activity = (.6 * Math.pow(1.02 + .01 * m, i + 1) + .4 * Math.pow(1.01, i + 1)) *
        source.marketShareMultiplier;
      close(row.activityRatio, activity);
      const check = row.abatementReconciliation!;
      assert.equal(check.noDoubleCountingCheck, "passed-declared-disjoint-measure-ids");
      for (const scope of scopes) {
        const multiplier = source.abatementAccounting![scope].measures[1].remainingEmissionsMultiplier!;
        const before = input.baseEmissionsTonnes[scope] * activity * source[`${scope}IntensityMultiplier`];
        close(row.emissionsTonnes[scope], before * multiplier);
        close(check[scope].beforeSeparateAbatementTonnes, before);
        close(check[scope].remainingEmissionsMultiplier, multiplier);
        close(check[scope].emissionsTonnes, row.emissionsTonnes[scope]);
        close(check[scope].baseEmissionsTonnes * check[scope].activityRatio *
          check[scope].intensityMultiplier * check[scope].remainingEmissionsMultiplier, row.emissionsTonnes[scope]);
      }
      close(row.carbonDrag, (row.emissionsTonnes.scope1 * source.scope1LiableFraction +
        row.emissionsTonnes.scope2 * source.scope2LiableFraction) * source.effectiveCarbonPrice * (1 - source.passThrough));
      const preTax = row.revenue * source.operatingMargin - row.carbonDrag - source.interest;
      close(row.fcfe, preTax - Math.max(0, preTax) * source.taxRate + source.depreciation -
        source.capex - source.increaseWorkingCapital);
    }
  }
});

test("S12-014 embedded measures are never applied again; explicit separate factors multiply once", () => {
  const input = fixture(), legacy = projection(fixture(false));
  for (const member of input.members) for (const year of member.years) for (const scope of scopes)
    year.abatementAccounting![scope].measures = year.abatementAccounting![scope].measures.slice(0, 1);
  const embeddedOnly = projection(input);
  for (const [m, member] of embeddedOnly.members.entries()) for (const [i, year] of member.years.entries()) {
    assert.deepEqual(year.emissionsTonnes, legacy.members[m].years[i].emissionsTonnes);
    assert.equal(year.carbonDrag, legacy.members[m].years[i].carbonDrag);
    assert.equal(year.fcfe, legacy.members[m].years[i].fcfe);
  }
  for (const member of input.members) for (const year of member.years) for (const scope of scopes) {
    const measures = year.abatementAccounting![scope].measures;
    measures.push({ ...accounting(0, 0)[scope].measures[1], measureId: `incremental-A-${scope}`,
      remainingEmissionsMultiplier: .8 });
    measures.push({ ...accounting(0, 0)[scope].measures[1], measureId: `incremental-B-${scope}`,
      remainingEmissionsMultiplier: .5 });
  }
  const separate = projection(input);
  for (const [m, member] of separate.members.entries()) for (const [i, year] of member.years.entries())
    for (const scope of scopes) close(year.emissionsTonnes[scope], legacy.members[m].years[i].emissionsTonnes[scope] * .4);
});

test("S12-014 rejects embedded/separate overlap within and across every scope, including late member-years", () => {
  for (const embeddedScope of scopes) for (const separateScope of scopes) {
    const input = fixture();
    const late = input.members[2].years[4].abatementAccounting!;
    late[separateScope].measures[1].measureId = late[embeddedScope].measures[0].measureId;
    assert.throws(() => projection(input), /Double-counted abatement already embedded in intensity/);
  }
  for (const scope of scopes) {
    const input = fixture(), measures = input.members[1].years[3].abatementAccounting![scope].measures;
    measures.push(structuredClone(measures[1]));
    assert.throws(() => projection(input), /Duplicate abatement measure across scopes/);
  }
  const input = fixture(), allScopes = input.members[0].years[0].abatementAccounting!;
  allScopes.scope3.measures[1].measureId = allScopes.scope1.measures[1].measureId;
  assert.throws(() => projection(input), /Duplicate abatement measure across scopes/);
});

test("S12-014 rejects incomplete, unevidenced, ambiguous and out-of-range abatement instead of supplying facts", () => {
  const mutations: Array<(year: any) => void> = [
    y => { delete y.abatementAccounting.scope3; },
    y => { y.abatementAccounting.scope2.intensityEvidence = []; },
    y => { y.abatementAccounting.scope1.measures[1].evidence = []; },
    y => { y.abatementAccounting.scope2.measures[1].deliveryEvidence = [" "]; },
    y => { delete y.abatementAccounting.scope3.measures[1].disjointnessEvidence; },
    y => { delete y.abatementAccounting.scope1.measures[1].remainingEmissionsMultiplier; },
    y => { y.abatementAccounting.scope2.measures[1].remainingEmissionsMultiplier = -.1; },
    y => { y.abatementAccounting.scope3.measures[1].remainingEmissionsMultiplier = 1.01; },
    y => { y.abatementAccounting.scope3.measures[1].remainingEmissionsMultiplier = NaN; },
    y => { y.abatementAccounting.scope1.measures[1].remainingEmissionsMultiplier = Infinity; },
    y => { y.abatementAccounting.scope2.measures[0].remainingEmissionsMultiplier = .5; },
    y => { y.abatementAccounting.scope3.measures[1].treatment = "target"; },
    y => { y.abatementAccounting.scope1.measures[1].measureId = " "; },
    y => { y.abatementAccounting.scope1.measures[1].measureId = " embedded-scope1 "; },
    y => { y.scope3LiableFraction = 1; },
    y => { y.additionalTargetAbatement = .5; },
    y => { delete y.scope2LiableFraction; },
    y => { delete y.passThrough; },
  ];
  for (const mutate of mutations) {
    const input = fixture();
    mutate(input.members[2].years[4]);
    assert.throws(() => projection(input));
  }
});

test("S12-014 Scope 3 changes physical emissions but never direct liability, FCFE or growth", () => {
  const input = fixture(), original = projection(input);
  input.baseEmissionsTonnes.scope3 *= 100000;
  for (const member of input.members) for (const year of member.years) {
    year.scope3IntensityMultiplier *= 3;
    year.abatementAccounting!.scope3.measures[1].remainingEmissionsMultiplier = .1;
  }
  const changed = projection(input);
  assert.notEqual(changed.inputHash, original.inputHash);
  for (const [m, member] of changed.members.entries()) {
    assert.equal(member.growth, original.members[m].growth);
    for (const [i, year] of member.years.entries()) {
      const old = original.members[m].years[i];
      assert.notEqual(year.emissionsTonnes.scope3, old.emissionsTonnes.scope3);
      assert.equal(year.carbonDrag, old.carbonDrag);
      assert.equal(year.fcfe, old.fcfe);
    }
  }
});

test("S12-014 Scope 2 electricity-price liability and pass-through remain explicit, with no extra direct charge", () => {
  for (const liableFraction of [0, .3, 1]) for (const passThrough of [0, .25, 1]) {
    const input = fixture();
    for (const member of input.members) for (const year of member.years) {
      year.scope1LiableFraction = 0;
      year.scope2LiableFraction = liableFraction;
      year.passThrough = passThrough;
    }
    const result = projection(input);
    for (const member of result.members) for (const year of member.years)
      close(year.carbonDrag, year.emissionsTonnes.scope2 * liableFraction * 2 * (1 - passThrough));
  }
});

test("S12-014 explicit zero/unit factors and empty separate lists are valid, not invented assumptions", () => {
  const input = fixture();
  for (const member of input.members) for (const year of member.years) {
    year.abatementAccounting!.scope1.measures[1].remainingEmissionsMultiplier = 0;
    year.abatementAccounting!.scope2.measures[1].remainingEmissionsMultiplier = 1;
    year.abatementAccounting!.scope3.measures = [];
  }
  const result = projection(input), legacy = projection(fixture(false));
  for (const [m, member] of result.members.entries()) for (const [i, year] of member.years.entries()) {
    assert.equal(year.emissionsTonnes.scope1, 0);
    assert.equal(year.emissionsTonnes.scope2, legacy.members[m].years[i].emissionsTonnes.scope2);
    assert.equal(year.emissionsTonnes.scope3, legacy.members[m].years[i].emissionsTonnes.scope3);
  }
});

test("S12-014 canonical input identity covers measure declarations/evidence and ignores set order", () => {
  const input = fixture(), original = projection(input);
  input.mapping.shares.reverse();
  input.members.reverse();
  for (const member of input.members) {
    member.years.reverse();
    for (const year of member.years) {
      year.exposures.reverse();
      for (const scope of scopes) year.abatementAccounting![scope].measures.reverse();
    }
  }
  assert.deepEqual(projection(input), original);
  input.members[0].years[0].abatementAccounting!.scope1.intensityEvidence.push("different-source-claim");
  assert.notEqual(projection(input).inputHash, original.inputHash);
});

test("S12-014 shared project ID defaults to rejection; explicit measurement namespaces remain conditional evidence assertions", () => {
  const input = fixture(), accounting = input.members[0].years[0].abatementAccounting!;
  accounting.scope1.measures[1].measureId = "project42";
  accounting.scope2.measures[1].measureId = "project42";
  assert.throws(() => projection(input), /Duplicate abatement measure across scopes/);
  // No automatic scope-prefixing: callers must identify genuinely distinct
  // physical measurements and provide evidence. Strings alone do not prove it.
  accounting.scope1.measures[1].measureId = "fuel-meter-A/project42";
  accounting.scope2.measures[1].measureId = "electricity-meter-B/project42";
  accounting.scope1.measures[1].disjointnessEvidence = ["synthetic-fuel-meter-boundary"];
  accounting.scope2.measures[1].disjointnessEvidence = ["synthetic-electricity-meter-boundary"];
  const result = projection(input);
  assert.equal(result.members[0].years[0].abatementReconciliation!.noDoubleCountingCheck,
    "passed-declared-disjoint-measure-ids");
  assert.equal(result.productionEligible, false);
});
