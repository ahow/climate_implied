import type { OutputFieldSemantic } from "./outputFieldSemantics";
/** New S12-018 fields. Not part of, and do not renumber, the original 1001 cohort. */
export const companyCoverageSemantics: OutputFieldSemantic[] = [
  ["sourceId", "Exact selected immutable workbook hash, or explicit current-workbook-unversioned marker", "identifier", "snapshotContext.id; no anonymous source fallback"],
  ["version", "Separate S12-018 report contract version", "identifier", "company-coverage-1"],
  ["observationDate", "Exact common workbook observation day", "UTC calendar day", "explicit date or latest workbook date <= cutoff; no per-company latest lookup"],
  ["informationCutoff", "Requested information availability boundary", "UTC timestamp", "explicit request cutoff; reviews and sources must be available by this instant"],
  ["eligibilityRule", "Financial review eligibility, not complete operating-case acceptance", "text", "unique approved exact workbook identity; valid snapshot currency/time contract; unique issuer"],
  ["eligibilityConflicts", "Workbook issuers with inconsistent or duplicate financial approval evidence", "issuer count", "count unique workbook companies with eligibilityConflict"],
  ["eligibleCompanyShare", "Eligible reviewed identities as fraction of full workbook company population", "fraction or null", "eligible.denominator / fullWorkbook.denominator; empty full workbook=>null"],
  ...(["marketCap", "scope1Emissions", "scope2Emissions", "scope3Emissions"] as const).map(metric => [
    `eligibleKnownValueCoverage.${metric}`, `${metric}: known observed value represented by eligible financial identities`, "fraction or null",
    "eligible.metrics[metric].knownTotal / fullWorkbook.metrics[metric].knownTotal; either absent or denominator zero=>null; descriptive known-value coverage, never an estimate of missing universe values",
  ]),
  ["units.marketCap", "Workbook denomination convention, not issuer-level FX verification", "text", "USD million; explicit non-USD observation currency conflicts, never aggregate it"],
  ["units.emissions", "Separate company-reported emissions scopes", "text", "tonnes CO2e; scope3 sums are not a global physical emissions inventory"],
  ["limitations[]", "Coverage and historical-vintage limitations", "text", "explicit known-only denominators, current review status and non-scientific acceptance warnings"],
  ["scientificAcceptance", "No predictive or scientific acceptance asserted", "boolean", "false"],
  ...(["fullWorkbook", "eligible"] as const).flatMap(population => [
    [`${population}.denominator`, "Stable issuer-count population denominator", "issuer count", population === "fullWorkbook" ? "all selected workbook companies, before metric/mapping exclusions" : "workbook companies with unique valid approved financial identity at cutoff"],
    ...(["operating-geography", "headquarters-fallback", "unknown", "missing", "conflicted"] as const).flatMap(mapping => [
      [`${population}.mapping.${mapping}.count`, `Issuer count in ${mapping} mapping state`, "issuer count", "one exclusive state per issuer; unknown=dated packet without accepted mapping, missing=no available packet; never infer mapping from cv_companies.geography"],
      [`${population}.mapping.${mapping}.share`, `Issuer-count ${mapping} fraction of declared population`, "fraction or null", "mapping state count / population.denominator; empty denominator => null"],
    ]),
    ...(["marketCap", "scope1Emissions", "scope2Emissions", "scope3Emissions"] as const).flatMap(metric => [
      ...(["present", "null", "missing", "conflicted", "invalid"] as const).map(state => [
        `${population}.metrics.${metric}.states.${state}`, `${metric}: exclusive ${state} observation count`, "issuer count",
        "exact common date; present=finite nonnegative emissions or positive cap, null=explicit null, missing=no row/property, conflicted=duplicate rows or explicit incompatible currency, invalid=invalid numeric value; no carry-forward",
      ]),
      [`${population}.metrics.${metric}.availableCount`, `${metric}: observed valid issuer count`, "issuer count", "count field state=present; no cross-scope imputation"],
      [`${population}.metrics.${metric}.availableShare`, `${metric}: metric availability fraction`, "fraction or null", "availableCount / population.denominator; empty denominator => null"],
      [`${population}.metrics.${metric}.knownTotal`, `${metric}: partial known-value denominator, not a total universe estimate`, metric === "marketCap" ? "USD million" : "tonnes CO2e", "sum only finite valid values; no valid records=>null; observed zero emissions total remains 0; separate company scopes, not global physical inventory"],
      ...(["operatingGeography", "headquartersFallback"] as const).flatMap(basis => [
        [`${population}.metrics.${metric}.${basis}.knownValue`, `${metric}: known value with ${basis} mapping`, metric === "marketCap" ? "USD million" : "tonnes CO2e", "sum present metric values in explicit basis; no known metric records=>null"],
        [`${population}.metrics.${metric}.${basis}.shareOfKnownValue`, `${metric}: ${basis} share of known metric value only`, "fraction or null", "knownValue / knownTotal; absent or zero knownTotal=>null; never total-universe value share"],
      ]),
    ]),
  ]),
].map(([key, meaning, unit, formula]) => ({
  id: `companyCoverage.${key}`, meaning, unit, formula, role: "Output",
  dependencies: ["selected full workbook companies/timeSeries", "complete unpaginated financial_reviews",
    "content-verified operating decision/proposal/identity/source archives"],
  source: "Selected workbook plus read-only complete review journal; no approval or source mutation",
  period: "Exact workbook observation day; independent requested information cutoff",
  geography: "Explicit reviewed operating mapping versus explicit headquarters-fallback, not inferred from headquarters",
  status: "Descriptive revised-workbook coverage, not original-vintage or scientific validation",
  missingness: "Null, missing, conflicted and invalid distinct; no silent zero; empty/zero denominator shares null",
  uncertainty: "No probabilistic interpretation; unknown values are not estimated",
  scope: "New S12-018 contract, separately registered from original1001 cohort; full workbook and eligible denominators",
  asOfRule: "All quote/fetch/identity/review/filing and operating source/approval timestamps <= cutoff; historical superseded status not reconstructed",
}));
