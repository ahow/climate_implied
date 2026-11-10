import type { OutputFieldSemantic } from "./outputFieldSemantics";

/** Opt-in extension only: legacy replay worksheets/semantics remain unchanged. */
export const companyAbatementColumns = [
  "member", "year", "scope", "baseEmissionsTonnes", "activityRatio", "intensityMultiplier",
  "beforeSeparateAbatementTonnes", "remainingEmissionsMultiplier", "emissionsTonnes", "noDoubleCountingCheck",
] as const;
export const companyAbatementInputColumns = ["member", "year", "chunk", "canonicalDeclaredAccountingJson"] as const;
const context = {
  source: "Exact content-hashed company input/material evidence and resolved source archives; declaration references are source assertions, not authenticated physical proof",
  period: "The stated member-year; factors are relative to that year's supplied intensity, not compounded annual improvements",
  geography: "Explicit company operating-geography mapping; scope denotes physical emissions boundary, not security domicile",
  status: "Conditional engineering accounting; scientificAcceptance=false and productionEligible=false",
  missingness: "Entire optional block absent means the unchanged no-extra-abatement contract. Present blocks require all scopes and all treatment-specific inputs; no evidence/factor defaults",
  uncertainty: "Explicit conditional residual fractions; no inferred delivery probability, calibrated confidence or verified physical additionality",
  scope: "Disjoint declared measure identities across all three scopes within one member-year; reuse in different years or members is allowed",
  asOfRule: "Every new scalar material leaf and evidence reference is hash-pinned and matched to a resolved source claim available by the explicit cutoff",
};
function semantic(id: string, meaning: string, role: OutputFieldSemantic["role"],
  unit: string, formula: string, dependencies: string[]): OutputFieldSemantic {
  return { id, meaning, role, unit, formula, dependencies, ...context };
}
export const companyAbatementSemantics: OutputFieldSemantic[] = [
  semantic("companyProjection.abatementAccounting", "Optional complete all-scope declarations per member-year",
    "Input", "object", "members[].years[].abatementAccounting = {scope1,scope2,scope3}; absence does not add a factor",
    ["members[].years[].abatementAccounting"]),
  ...(["scope1", "scope2", "scope3"] as const).flatMap(scope => {
    const input = `members[].years[].abatementAccounting.${scope}`;
    const output = `members[].years[].abatementReconciliation.${scope}`;
    return [
      semantic(`companyProjection.abatement.${scope}.intensityEvidence`, "Evidence references for the supplied intensity trajectory",
        "Input", "nonempty string array", `${input}.intensityEvidence`, [input]),
      semantic(`companyProjection.abatement.${scope}.measureId`, "Globally disjoint physical measure identity, not an implicitly scoped project label",
        "Input", "identifier", "trim(measureId); duplicates rejected across all scopes in this member-year",
        [`${input}.measures[].measureId`, "all scopes' embedded and separate measure IDs"]),
      semantic(`companyProjection.abatement.${scope}.treatment`, "Disjoint embedded versus separate treatment",
        "Input", "enum", "embedded-in-intensity => no extra multiplier; separate-abatement => explicit residual factor applied once",
        [`${input}.measures[].treatment`]),
      semantic(`companyProjection.abatement.${scope}.evidence`, "Source references for each physical measure",
        "Input", "nonempty string array", `${input}.measures[].evidence`, [`${input}.measures[]`]),
      semantic(`companyProjection.abatement.${scope}.remainingEmissionsMultiplierInput`, "Explicit separate delivered residual fraction; forbidden on embedded measures",
        "Input", "fraction [0,1]", `${input}.measures[separate-abatement].remainingEmissionsMultiplier; not an inferred target reduction`,
        [`${input}.measures[].treatment`, `${input}.measures[].remainingEmissionsMultiplier`]),
      semantic(`companyProjection.abatement.${scope}.deliveryEvidence`, "References supporting delivered residual factors and delivery credibility",
        "Input", "nonempty string array", "Required for separate-abatement; forbidden on embedded treatment",
        [`${input}.measures[].deliveryEvidence`]),
      semantic(`companyProjection.abatement.${scope}.disjointnessEvidence`, "References asserting physical additionality to intensity and other measures",
        "Input", "nonempty string array", "Required for separate-abatement; names/references alone cannot prove physical disjointness",
        [`${input}.measures[].disjointnessEvidence`]),
      ...([
        ["baseEmissionsTonnes", "Reported base-year scope emissions", "tonnes", `baseEmissionsTonnes.${scope}`],
        ["activityRatio", "Cumulative weighted operating activity including explicit market share", "ratio", "sum(weight * cumulative exposure activity) * marketShareMultiplier"],
        ["intensityMultiplier", "Supplied scope trajectory including already embedded improvements", "ratio", `${scope}IntensityMultiplier`],
        ["beforeSeparateAbatementTonnes", "Physical emissions before any separate measure", "tonnes/year", "baseEmissionsTonnes * activityRatio * intensityMultiplier"],
        ["remainingEmissionsMultiplier", "Combined explicit separate residual factors", "fraction [0,1]", "product(separate-abatement.remainingEmissionsMultiplier); explicit empty separate list has neutral product 1"],
        ["emissionsTonnes", "Final physical scope emissions after separate abatement", "tonnes/year", "beforeSeparateAbatementTonnes * remainingEmissionsMultiplier"],
      ] as const).map(([field, meaning, unit, formula]) => semantic(
        `companyProjection.abatement.${scope}.${field}`, meaning, "Calculated", unit, formula,
        [input, output, `baseEmissionsTonnes.${scope}`, "activityRatio", `${scope}IntensityMultiplier`])),
    ];
  }),
  semantic("companyProjection.abatement.noDoubleCountingCheck", "Declared-identity consistency only, not proof of physical disjointness",
    "Output", "enum", "passed-declared-disjoint-measure-ids iff all-scope identities are unique and embedded/separate sets do not overlap",
    ["members[].years[].abatementAccounting.*.measures[].measureId", "members[].years[].abatementAccounting.*.measures[].treatment"]),
  semantic("companyProjection.abatement.declaredAccounting", "Exact validated declarations retained in opt-in result and bounded XLSX JSON chunks",
    "Output", "JSON object", "abatementReconciliation.declaredAccounting = canonicalized input abatementAccounting; concatenate AbatementInputs chunks per member/year to recover",
    ["members[].years[].abatementAccounting", "inputHash", "material evidenceHash"]),
  semantic("companyProjection.abatement.carbonDrag", "Only liable post-abatement Scope 1 and explicit Scope 2 electricity-price channel; Scope 3 never directly charged",
    "Calculated", "nominal major currency/year", "(finalScope1 * scope1LiableFraction + finalScope2 * scope2LiableFraction) * effectiveCarbonPrice * (1-passThrough)",
    ["emissionsTonnes.scope1", "emissionsTonnes.scope2", "scope1LiableFraction", "scope2LiableFraction", "effectiveCarbonPrice", "passThrough"]),
];

/** These replace only the three legacy scope formulas in opt-in workbooks. */
export const companyAbatementLedgerSemantics = Object.fromEntries(
  (["scope1", "scope2", "scope3"] as const).map(scope => [`companyReplay.ledger.${scope}Tonnes`, {
    formula: `base.${scope} * activityRatio * ${scope}IntensityMultiplier * product(explicit separate residual factors for ${scope}); absent block => no extra abatement`,
    dependencies: [`baseEmissionsTonnes.${scope}`, "activityRatio", `${scope}IntensityMultiplier`,
      `members[].years[].abatementAccounting.${scope}.measures`],
  }]),
);
