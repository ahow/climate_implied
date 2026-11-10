import type { OutputFieldSemantic } from "./outputFieldSemantics";

export const originalNominalAssessmentInputKeys = [
  "baseEarnings", "discountRate", "returnOnEquity", "stageOneGrowth", "sharesBasis",
  "rateBasis", "returnOnEquityEvidence", "discountRateEvidence", "acknowledgeConditionalModel",
] as const;

type Spec = [field: string, meaning: string, formula: string, unit: string];
const prefix = "originalNominalAssessment";
const context = {
  source: "Explicit caller query and server/calculation/originalNominalAssessmentHandler.ts; reverseValuation.ts pure earnings/ROE calculation. Evidence-reference text is caller-supplied, not independently authenticated.",
  period: "Year0 base; years1–5 constant stage growth; years6–15 linear fade; year16 first terminal distribution; terminal perpetuity discounted from year15 to year0",
  geography: "No geography is inferred; no dataset or issuer lookup",
  status: "Supplemental conditional earnings/reinvestment diagnostic only; no original-gap closure, issuer approval, forecast validation or investment evidence",
  missingness: "Required scalar inputs are never defaulted. Invalid requests/economic domains refuse explicitly; infeasible terminal points omit projection and include reason. Missing fields are not zero.",
  uncertainty: "Four fixed terminal points, not probability intervals, calibrated uncertainty or a continuous-range extremum proof",
  scope: "Total-equity claim in caller's nominal units of baseEarnings. Currency and scale are unspecified by this API: never assume USD, USD million or implicit FX. No dataset, source collection, external funding or capital-release assumption.",
  asOfRule: "Caller-supplied conditional assumptions; no source observation date, historical publication-vintage or evidence approval is established",
};
const inputs: Spec[] = [
  ["baseEarnings", "Positive annual base earnings at year0", "Required finite positive scalar; same nominal currency/scale throughout projection and PV", "nominal units of baseEarnings per annual period"],
  ["discountRate", "Explicit nominal annual cost of equity", "Required finite rate in (0,1]; each terminal point requires terminalGrowth < discountRate", "fraction/year"],
  ["returnOnEquity", "Explicit supported sustainable nominal ROE assumption", "Required finite ROE in (0,2]; max(stageOneGrowth,terminalGrowth) <= ROE; source reference required but not authenticated", "fraction/year"],
  ["stageOneGrowth", "Constant nominal earnings growth for years1–5", "Required finite g > -1; growth above ROE refuses; years6–15 g + (gT-g)*(year-5)/10", "fraction/year"],
  ["sharesBasis", "Claim boundary, not shares outstanding", "Required literal total-equity; no per-share or enterprise-value conversion", "claim basis label"],
  ["rateBasis", "Nominal-rate basis, not a real-rate conversion", "Required literal nominal; no inflation adjustment or real-to-nominal conversion", "rate basis label"],
  ["returnOnEquityEvidence", "Caller-supplied ROE evidence locator/assertion", "Required nonblank text, maximum1200 characters at HTTP boundary; not independent verification", "unverified evidence-reference text"],
  ["discountRateEvidence", "Caller-supplied nominal discount-rate evidence locator/assertion", "Required nonblank text, maximum1200 characters at HTTP boundary; not independent verification", "unverified evidence-reference text"],
  ["acknowledgeConditionalModel", "Explicit caller acknowledgement, not scientific approval", "Required scalar literal true; no default acknowledgement", "literal text"],
];
const outputs: Spec[] = [
  ["http.status", "HTTP transport outcome, distinct from body/per-point status", "200 parsed conditional assessment, including mixed/all per-point refusals; 400 malformed/missing/unknown request fields; 422 invalid economic/nonfinite inputs; direct handler non-GET405", "HTTP status code"],
  ["http.cacheControl", "No cached conditional assumptions/results", "Cache-Control: no-store on every handler response", "HTTP header text"],
  ["http.allow", "Supported method on direct non-GET refusal", "Allow: GET when handler returns405; central GET-only routing may reject other methods before handler", "HTTP method label"],
  ["status", "Top-level conditional assessment or explicit request/economic refusal", "conditional-assessment does not mean every terminal point is feasible; refused does not imply zero valuation", "status label"],
  ["reason", "Top-level explicit refusal explanation", "Request/method/economic-domain message; absent on conditional-assessment", "text"],
  ["issues[].path", "Invalid input path or empty path for object-level validation", "Zod issue path joined with '.'; identifies an invalid expected field, not approval of its supplied value", "field path text"],
  ["issues[].message", "Explicit input-validation issue", "Zod validation message; no missing input is replaced by a default", "text"],
  ["rateBasis", "Validated nominal model basis", "Literal nominal; no inferred inflation series", "rate basis label"],
  ["terminalRange.minimum", "Original-specification minimum nominal terminal growth", "0.025, not the separate1–3% diagnostic minimum", "fraction/year"],
  ["terminalRange.maximum", "Original-specification maximum nominal terminal growth", "0.04, not a calibrated upper probability bound", "fraction/year"],
  ["terminalRange.grid[]", "Four fixed terminal-growth assessment points", "[0.025,0.03,0.035,0.04]; not a continuous optimization or probability distribution", "fraction/year"],
  ["fade", "Explicit fifteen-year earnings-growth schedule", "Years1–5 constant g; years6–15 g+(gT-g)*(year-5)/10; gT reached in year15", "schedule definition text"],
  ["rows[].terminalGrowth", "Nominal terminal-growth assumption for this independent point", "One of 0.025,0.03,0.035,0.04; must be strictly below discount and no greater than ROE", "fraction/year"],
  ["rows[].status", "Per-point valuation eligibility, not model acceptance", "conditional-value if fundable and gT<r; otherwise refused with reason and no projection", "status label"],
  ["rows[].reason", "Explicit terminal-point refusal", "gT>=r or max(g,gT)>ROE; no forced value or assumed external funding", "text"],
  ["rows[].projection.equityValue", "Year0 total-equity PV of distributed earnings", "sum(year1..15 distributed/(1+r)^year) + terminalCashFlow/(r-gT)/(1+r)^15", "nominal units of baseEarnings"],
  ["rows[].projection.years[].year", "Annual model index, not a calendar or publication year", "Exactly integers1..15 for each feasible terminal point", "model year index"],
  ["rows[].projection.years[].growth", "Nominal earnings growth applied in this year", "g for year<=5; g+(gT-g)*(year-5)/10 for years6..15", "fraction/year"],
  ["rows[].projection.years[].earnings", "End-of-year earnings after annual growth", "previous earnings*(1+growth), starting with supplied year0 baseEarnings", "nominal units of baseEarnings per annual period"],
  ["rows[].projection.years[].reinvestmentRate", "Fraction of this year's earnings retained to fund growth", "max(0,growth)/ROE; bounded[0,1] for feasible points; negative growth does not create capital release", "fraction of annual earnings"],
  ["rows[].projection.years[].reinvestment", "Internally funded retained earnings", "earnings*reinvestmentRate; not an independently sourced capex or working-capital forecast", "nominal units of baseEarnings per annual period"],
  ["rows[].projection.years[].distributed", "Annual earnings available for distribution after reinvestment", "earnings-reinvestment; no debt issuance, dilution, acquisition or working-capital double deduction", "nominal units of baseEarnings per annual period"],
  ["rows[].projection.years[].presentValue", "Year0 PV of this year's distribution", "distributed/(1+r)^year", "nominal units of baseEarnings"],
  ["rows[].projection.terminalCashFlow", "First terminal distribution in year16", "earnings_year15*(1+gT)*(1-gT/ROE); terminal value at year15=terminalCashFlow/(r-gT)", "nominal units of baseEarnings per annual period"],
  ["rows[].projection.terminalReinvestmentRate", "Sustainable terminal earnings-retention fraction", "gT/ROE; may equal1 and then terminal distribution is zero, not missing", "fraction of terminal earnings"],
  ["returnOnEquityEvidence", "Unverified caller evidence reference retained with conditional result", "Echo of required ROE evidence text; no collection/authentication/approval callback", "unverified evidence-reference text"],
  ["discountRateEvidence", "Unverified caller evidence reference retained with conditional result", "Echo of required nominal discount evidence text; no collection/authentication/approval callback", "unverified evidence-reference text"],
  ["limitations[]", "Conditional model and source restrictions", "Four-point grid; source references unverified; earnings/ROE distinct from FCFE-growth diagnostic; no negative-growth capital release/debt/acquisitions/dilution", "limitation text"],
  ["investmentEvidence", "No investment-evidence promotion", "Literal false when emitted", "boolean"],
  ["identityApproved", "No identity approval", "Literal false when emitted; the endpoint does not identify or approve issuers", "boolean"],
  ["productionEligible", "No production valuation promotion", "Literal false when emitted", "boolean"],
];

export const originalNominalAssessmentSemantics: OutputFieldSemantic[] = [
  ...inputs.map(([field, meaning, formula, unit]) => ({
    ...context, id: `${prefix}.input.${field}`, role: "Input" as const,
    meaning, formula, unit, dependencies: ["explicit HTTP query"],
  })),
  ...outputs.map(([field, meaning, formula, unit]) => ({
    ...context, id: `${prefix}.${field}`, role: "Output" as const,
    meaning, formula, unit,
    dependencies: field.startsWith("http.") ? ["HTTP method and validation outcome"]
      : originalNominalAssessmentInputKeys.map(key => `${prefix}.input.${key}`),
  })),
];
