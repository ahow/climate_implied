import { z } from "zod";
import type { OutputFieldSemantic } from "./outputFieldSemantics";
export const stage10IdentityStates = ["not-queried", "provider-error", "candidate-awaiting-review", "accepted", "ambiguous", "unmatched", "out-of-scope"] as const;
export const stage10Fields = ["revenue", "ebitda", "operatingCashFlow", "capitalExpenditure", "fcfe",
  "workingCapital", "netIncome", "netDebt", "shares", "segments"] as const;
export type Stage10IdentityState = typeof stage10IdentityStates[number];
export type Stage10Field = typeof stage10Fields[number];
export const stage10PrivacyMinimumCompanies = 5;
export const stage10RowSchema = z.object({
  population: z.enum(["full-workbook", "verified-eligible"]), sector: z.string(), region: z.string(),
  dimension: z.enum(["identity", "financial-field"]), key: z.enum([...stage10IdentityStates, ...stage10Fields]),
  companies: z.number().int().nonnegative(), expectedSlots: z.number().int().nonnegative(),
  suppressed: z.boolean(), present: z.number().int().nonnegative().nullable(),
  missing: z.number().int().nonnegative().nullable(), explicitNull: z.number().int().nonnegative().nullable(),
  invalid: z.number().int().nonnegative().nullable(), conflicted: z.number().int().nonnegative().nullable(),
  original: z.number().int().nonnegative().nullable(), restated: z.number().int().nonnegative().nullable(),
  restatementUnknown: z.number().int().nonnegative().nullable(),
  originalFilingDateVerified: z.number().int().nonnegative().nullable(),
  providerFilingDateUnverified: z.number().int().nonnegative().nullable(),
  filingDateMissing: z.number().int().nonnegative().nullable(),
  availableShare: z.number().min(0).max(1).nullable(), restatementKnownDenominator: z.number().int().nonnegative().nullable(),
  restatedShareOfKnownProvenance: z.number().min(0).max(1).nullable(), restatementUnknownShareOfPresent: z.number().min(0).max(1).nullable(),
  explicitRestatedFlagShareOfPresent: z.number().min(0).max(1).nullable(),
}).strict();
export const stage10CoverageSchema = z.object({
  contract: z.literal("stage10-retained-coverage-1"),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/), workbookHash: z.string().regex(/^[a-f0-9]{64}$/),
  informationCutoff: z.string().datetime(), fiscalYears: z.array(z.number().int()).min(1),
  fullWorkbookCompanies: z.number().int().nonnegative(), verifiedEligibleCompanies: z.number().int().nonnegative(),
  admittedStage11To15Records: z.number().int().nonnegative(),
  retainedSourceVersions: z.number().int().nonnegative(), selectedSourceVersions: z.number().int().nonnegative(),
  sourceGaps: z.array(z.string()), rows: z.array(stage10RowSchema),
  scientificAcceptance: z.literal(false), investmentEvidence: z.literal(false),
  limitation: z.string().min(1),
}).strict().superRefine((report, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (report.fiscalYears.length > 51 || report.fiscalYears.some((y, i) => y < 1900 || y > 2100 ||
    (i > 0 && y !== report.fiscalYears[i - 1] + 1))) issue("Fiscal domain must be complete,consecutive and bounded before availability");
  if (report.verifiedEligibleCompanies > report.fullWorkbookCompanies) issue("Eligible population outside full workbook");
  const identities = new Set<string>(), groupCounts = new Map<string, number>();
  for (const row of report.rows) {
    const identity = JSON.stringify([row.population, row.sector, row.region, row.dimension, row.key]);
    if (identities.has(identity)) issue("Duplicate aggregate cell"); identities.add(identity);
    const group = JSON.stringify([row.population, row.sector, row.region]);
    if (groupCounts.has(group) && groupCounts.get(group) !== row.companies) issue("Availability-dependent population denominator");
    groupCounts.set(group, row.companies);
    if (row.expectedSlots !== row.companies * (row.dimension === "identity" ? 1 : report.fiscalYears.length)) issue("Incorrect fixed slot denominator");
    if (!(row.dimension === "identity" ? stage10IdentityStates : stage10Fields).includes(row.key as never)) issue("Quantity outside exact dimension domain");
    if (row.suppressed !== (row.companies > 0 && row.companies < stage10PrivacyMinimumCompanies)) issue("Privacy suppression disagreement");
    const counts = ["present", "missing", "explicitNull", "invalid", "conflicted", "original", "restated", "restatementUnknown",
      "originalFilingDateVerified", "providerFilingDateUnverified", "filingDateMissing", "availableShare", "restatementKnownDenominator",
      "restatedShareOfKnownProvenance", "restatementUnknownShareOfPresent", "explicitRestatedFlagShareOfPresent"] as const;
    if (row.suppressed) { if (counts.some(k => row[k] !== null)) issue("Small-population count disclosure"); continue; }
    if (row.present === null || row.availableShare !== (row.expectedSlots ? row.present / row.expectedSlots : null)) issue("Presence fraction disagreement");
    if (row.dimension === "identity") {
      if (row.present! > row.companies || counts.filter(k => k !== "present" && k !== "availableShare").some(k => row[k] !== null)) issue("Invalid identity-state cell");
      continue;
    }
    if (counts.filter(k => !["availableShare", "restatedShareOfKnownProvenance", "restatementUnknownShareOfPresent", "explicitRestatedFlagShareOfPresent"].includes(k)).some(k => row[k] === null) ||
      row.present! + row.missing! + row.explicitNull! + row.invalid! + row.conflicted! !== row.expectedSlots) issue("Field state partition disagreement");
    if (row.original! + row.restated! + row.restatementUnknown! !== row.present ||
      row.originalFilingDateVerified! + row.providerFilingDateUnverified! + row.filingDateMissing! !== row.present) issue("Provenance partition disagreement");
    if (row.restatementKnownDenominator !== row.original! + row.restated! ||
      row.restatedShareOfKnownProvenance !== (row.restatementKnownDenominator ? row.restated! / row.restatementKnownDenominator : null) ||
      row.explicitRestatedFlagShareOfPresent !== (row.present ? row.restated! / row.present : null) ||
      row.restatementUnknownShareOfPresent !== (row.present ? row.restatementUnknown! / row.present : null)) issue("Unknown provenance cannot become known/restated0%");
  }
  for (const [group, companies] of Array.from(groupCounts)) {
    const [population, sector, region] = JSON.parse(group);
    for (const key of [...stage10IdentityStates, ...stage10Fields]) {
      const dimension = (stage10IdentityStates as readonly string[]).includes(key) ? "identity" : "financial-field";
      if (!identities.has(JSON.stringify([population, sector, region, dimension, key]))) issue("Incomplete seven-state/ten-field group domain");
    }
    const identityRows = report.rows.filter(r => r.population === population && r.sector === sector && r.region === region && r.dimension === "identity");
    if (identityRows.length === 7 && !identityRows[0].suppressed && identityRows.reduce((sum, r) => sum + r.present!, 0) !== companies)
      issue("Seven identity states must reconcile to fixed population");
    if (sector === "All sectors" && region === "All regions" &&
      companies !== (population === "full-workbook" ? report.fullWorkbookCompanies : report.verifiedEligibleCompanies)) issue("Global denominator disagreement");
  }
  for (const population of ["full-workbook", "verified-eligible"]) {
    const global = JSON.stringify([population, "All sectors", "All regions"]);
    if (!groupCounts.has(global)) issue("Missing global population");
    const total = Array.from(groupCounts).filter(([k]) => JSON.parse(k)[0] === population && k !== global).reduce((sum, [, n]) => sum + n, 0);
    if (total !== groupCounts.get(global)) issue("Sector×region population dropped");
  }
});
export type Stage10CoverageReport = z.infer<typeof stage10CoverageSchema>;
const rowSpecs: [string, string, string][] = [
  ["population", "Frozen full workbook or independently verified immutable financial identity subset", "Selection before field availability; never survivor-only"],
  ["sector", "Workbook sector,Unknown retained", "Exact category or Unknown; All sectors denotes full-domain aggregate"],
  ["region", "Workbook geography label,not inferred operating region", "Exact geography or Unknown; no ticker/headquarters remapping"],
  ["dimension", "Identity-state or financial-field coverage row", "One exact seven-state or ten-field domain member"],
  ["key", "Exact identity state or field name", "All seven states/ten fields retained,including zero counts"],
  ["companies", "Population company denominator", "Frozen before inspection of values"],
  ["expectedSlots", "Company or company×fiscal-year denominator", "identity:N;financial-field:N×number of declared fiscal years"],
  ["suppressed", "Small-population privacy suppression", "True for1–4companies; category and denominator retained,counts/shares null,including eligible totals"],
  ["present", "Present valid field slots or exact identity-state count", "Observed zero is present; no missing/null coercion"],
  ["missing", "Absent selected-version field slots", "Expected slots without that source field; no cross-version coalescing"],
  ["explicitNull", "Explicit source null slots", "Null is not zero or absent"],
  ["invalid", "Invalid/nonfinite/sign/classification/date slots", "Retained source error is not valid numerical data"],
  ["conflicted", "Ambiguous same-version/company/period field slots", "No arbitrary duplicate survivor"],
  ["original", "Present values with explicit verified original lineage", "Never inferred from restated=false or lack of a flag"],
  ["restated", "Present values explicitly source-flagged restated", "No error/unknown→not-restated assumption"],
  ["restatementUnknown", "Present values without explicit original/restated evidence", "original+restated+unknown=present"],
  ["originalFilingDateVerified", "Present values with verified original filing dates", "Retained exact source provenance required"],
  ["providerFilingDateUnverified", "Present values with plausible provider filing-date metadata", "Provider proxy is not independent original-publication proof"],
  ["filingDateMissing", "Present values without a usable filing date", "Missing publication date never replaced by fiscal end or capture date"],
  ["availableShare", "Presence share of declared fixed denominator", "present/expectedSlots; zero denominator or suppression→null"],
  ["restatementKnownDenominator", "Present values with explicit original/restated evidence", "original+restated; unknown excluded but separately counted,not silently declared original"],
  ["restatedShareOfKnownProvenance", "Restated share of KNOWN provenance only", "restated/(original+restated); no known provenance→null,never a false0%restatement result"],
  ["restatementUnknownShareOfPresent", "Unknown provenance share among present values", "restatementUnknown/present; no present→null"],
  ["explicitRestatedFlagShareOfPresent", "Share of present values explicitly source-flagged restated,NOT total restatement prevalence", "restated/present; no present→null. Zero means no recorded true flags,NOT no restatements; unknown share and known-provenance denominator remain separate"],
];
const context = {
  role: "Output" as const, dependencies: ["immutable workbook", "retained source/version/identity evidence", "explicit cutoff/fiscal-year domain"],
  source: "server/financialData/stage10Source.ts; stage10Coverage.ts: SELECT/read-only retained inputs,aggregate-only output",
  period: "Declared fiscal years and exact information cutoff; each internal value retains actual source filing date",
  geography: "Workbook sector×geography with Unknown retained; not operating geography or inferred ticker mapping",
  status: "Descriptive retained coverage only; no source approval,publication-vintage verification or model promotion",
  missingness: "Storage/source corruption refuses; absence,null,error,conflict,unknown provenance and privacy suppression are distinct; no zero substitution",
  uncertainty: "Coverage proportions,not statistical confidence or historical efficacy",
  scope: "Counts only; no private company/security identifiers,provider values,filings,raw payloads or provider refresh",
  asOfRule: "Actual retained capture/review/filing dates at cutoff; no future input substitution or current review reconstructed as historical approval",
};
const headerSpecs: [string, string, string][] = [
  ["contract", "Stage10 aggregate report contract", "literal stage10-retained-coverage-1"],
  ["inputHash", "Exact selected input identity", "Canonical SHA256 of complete frozen workbook/identity audit/reviews/immutable sources/settings"],
  ["workbookHash", "Actual selected immutable full workbook", "Verified workbook-snapshot-1 content hash; no current database fallback"],
  ["informationCutoff", "Actual explicit source availability cutoff", "Request value,or exact latest retained capture/review timestamp; not a fabricated filing date"],
  ["fiscalYears[]", "Predeclared complete fiscal-year domain", "2015–2025 inclusive default,or explicit bounded requested range; frozen before field availability"],
  ["fullWorkbookCompanies", "Full immutable workbook denominator", "All workbook companies,including unknown categories/unresolved identities"],
  ["verifiedEligibleCompanies", "Verified immutable approved financial identity denominator", "Unique exact companyId/ISIN/issuer approved-current-financial archive; current review alone insufficient"],
  ["admittedStage11To15Records", "Actually admissible original-dated records", "Verified eligible identity AND original-date proof AND source capture/filing available by origin; never candidate/provider-proxy promotion"],
  ["retainedSourceVersions", "Hash-verified retained candidate source versions", "Immutable source files authenticated before filtering; not approved identities"],
  ["selectedSourceVersions", "Selected actual as-of source versions", "Latest retained capture<=cutoff per exact companyId/ISIN; tied versions conflict,no field-level newest-nonnull merge"],
  ["sourceGaps[]", "Explicit retained source/authority limitations", "No unprovisioned source represented as complete ingestion"],
  ["scientificAcceptance", "No scientific approval", "literal false"],
  ["investmentEvidence", "No investment efficacy", "literal false"],
  ["limitation", "Identity/denominator/privacy/eligibility boundary", "Publication is safe aggregate only; no current or historical numeric model promotion"],
];
export const stage10CoverageSemantics: OutputFieldSemantic[] = [...headerSpecs, ...rowSpecs.map(([p, m, f]) => [`rows[].${p}`, m, f] as [string, string, string]),
  ["error", "Explicit aggregate reader refusal", "400invalid selection;409changed exact input;503source/storage unavailable/corrupt; no fallback aggregate"] as [string, string, string]]
  .map(([path, meaning, formula]) => ({ id: `stage10Coverage.${path}`, meaning, formula, unit:
    path.includes("Hash") ? "SHA256 hex" : path.includes("Share") ? "fraction0–1 or null" :
    path === "informationCutoff" ? "UTC timestamp" : path === "fiscalYears[]" ? "Gregorian fiscal-end year" :
    ["fullWorkbookCompanies", "verifiedEligibleCompanies", "rows[].companies"].includes(path) ? "companies" :
    path.endsWith("SourceVersions") ? "retained source versions" : path === "admittedStage11To15Records" ? "original-dated field records" :
    ["scientificAcceptance", "investmentEvidence", "rows[].suppressed"].includes(path) ? "boolean" :
    path === "rows[].present" || path === "rows[].expectedSlots" ? "companies(identity) or company-year-field slots(financial-field)" :
    path.startsWith("rows[].") && ["missing", "explicitNull", "invalid", "conflicted", "original", "restated", "restatementUnknown",
      "originalFilingDateVerified", "providerFilingDateUnverified", "filingDateMissing", "restatementKnownDenominator"].includes(path.slice(7)) ?
      "company-year-field slots" : "declared identifier/category/qualification text", ...context }));
export const stage10ExportBindings = Object.fromEntries(rowSpecs.map(([field]) => [
  field, { id: `stage10Coverage.rows[].${field}`, transform: "Identity of aggregate row; null remains explicit unavailable/suppressed,never zero" },
]));
export const stage10ReportFieldPaths = stage10CoverageSemantics.filter(s => !s.id.endsWith(".error")).map(s => s.id.slice("stage10Coverage.".length));
/** Every concrete dictionary/binding cell has its own finite structural path.
 * Metadata is not reclassified as an observed financial value. */
export function stage10JsonExportLeafBindings() {
  const out: Record<string, { id: string; transform: string }> = {};
  for (const path of stage10ReportFieldPaths) out[`report.${path}`] = { id: `stage10Coverage.${path}`, transform: "Identity of strict aggregate report; no private rows" };
  for (const [column, binding] of Object.entries(stage10ExportBindings)) out[`rows[].${column}`] = binding;
  stage10CoverageSemantics.forEach((semantic, i) => {
    for (const [property, value] of Object.entries(semantic)) {
      const paths = Array.isArray(value) ? value.map((_, n) => `${property}[${n}]`) : [property];
      for (const path of paths) out[`fieldSemantics[${i}].${path}`] = { id: semantic.id,
        transform: `Literal dictionary metadata ${path},not the measured value or independent source approval` };
    }
  });
  for (const [column, binding] of Object.entries(stage10ExportBindings))
    for (const property of ["id", "transform"]) out[`columnBindings.${column}.${property}`] = { id: binding.id,
      transform: `Literal binding ${property} metadata,not a second measured value` };
  out.qualification = { id: "stage10Coverage.limitation", transform: "Aggregate-only privacy/interpretation disclosure" };
  return out;
}
