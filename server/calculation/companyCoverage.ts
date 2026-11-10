/** S12-018: descriptive selected-workbook coverage, never a projected census.
 * Membership is frozen before inspecting values; missing values never become 0.
 */
export type CoverageState = "present" | "null" | "missing" | "conflicted" | "invalid";
export type MappingBasis = "operating-geography" | "headquarters-fallback" | "unknown" | "missing" | "conflicted";
export interface CoverageCompany { id: number; isin: string }
export interface CoverageObservation {
  companyId: number; date: Date | string;
  marketCap?: number | null; scope1Emissions?: number | null;
  scope2Emissions?: number | null; scope3Emissions?: number | null;
  /** Absent uses the declared workbook USD convention; explicit mismatches do not aggregate. */
  marketCapCurrency?: string | null;
}
export interface CoverageReview {
  companyId: number; eligible: boolean; eligibilityConflict?: boolean; mapping: MappingBasis;
}
const fields = ["marketCap", "scope1Emissions", "scope2Emissions", "scope3Emissions"] as const;
export function companyCoverage(input: {
  companies: CoverageCompany[]; observations: CoverageObservation[]; reviews: CoverageReview[];
  observationDate: string; informationCutoff: string; sourceId: string;
}) {
  const day = (value: string | Date) => {
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) throw new Error("Invalid coverage date");
    return d.toISOString().slice(0, 10);
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.observationDate) || day(input.observationDate) !== input.observationDate)
    throw new Error("Exact valid observation calendar date required");
  if (day(input.observationDate) > day(input.informationCutoff)) throw new Error("Observation after information cutoff");
  const ids = new Set(input.companies.map(c => c.id));
  if (ids.size !== input.companies.length || new Set(input.companies.map(c => c.isin)).size !== ids.size)
    throw new Error("Duplicate coverage workbook identity");
  const reviews = new Map<number, CoverageReview>();
  for (const review of input.reviews) {
    if (!ids.has(review.companyId) || reviews.has(review.companyId)) throw new Error("Invalid or duplicate coverage review identity");
    reviews.set(review.companyId, review);
  }
  const observations = new Map<number, CoverageObservation[]>();
  for (const row of input.observations) {
    if (!ids.has(row.companyId)) throw new Error("Observation outside coverage workbook");
    if (day(row.date) !== day(input.observationDate)) continue;
    observations.set(row.companyId, [...(observations.get(row.companyId) ?? []), row]);
  }
  const records = input.companies.map(c => {
    const rows = observations.get(c.id) ?? [];
    const review = reviews.get(c.id);
    const values = Object.fromEntries(fields.map(field => {
      let state: CoverageState = "missing", value: number | null = null;
      // Multiple same-date records are ambiguous even if values happen to match.
      if (rows.length > 1) state = "conflicted";
      else if (rows.length && field === "marketCap" && Object.hasOwn(rows[0], "marketCapCurrency") &&
        rows[0].marketCapCurrency !== "USD") state = "conflicted";
      else if (rows.length && Object.hasOwn(rows[0], field)) {
        const raw = rows[0][field];
        if (raw === null) state = "null";
        else if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || (field === "marketCap" && raw === 0)) state = "invalid";
        else { state = "present"; value = raw; }
      }
      return [field, { state, value }];
    })) as Record<typeof fields[number], { state: CoverageState; value: number | null }>;
    return { eligible: review?.eligible === true && !review.eligibilityConflict,
      eligibilityConflict: review?.eligibilityConflict === true,
      mapping: review?.eligibilityConflict ? "conflicted" as const : review?.mapping ?? "missing" as const, values };
  });
  const fraction = (n: number, d: number) => d > 0 ? n / d : null;
  const summarize = (rows: typeof records) => {
    const denominator = rows.length;
    const mappings = Object.fromEntries((["operating-geography", "headquarters-fallback", "unknown", "missing", "conflicted"] as const)
      .map(basis => {
        const count = rows.filter(r => r.mapping === basis).length;
        return [basis, { count, share: fraction(count, denominator) }];
      }));
    const metrics = Object.fromEntries(fields.map(field => {
      const states = Object.fromEntries((["present", "null", "missing", "conflicted", "invalid"] as const)
        .map(state => [state, rows.filter(r => r.values[field].state === state).length]));
      const known = rows.filter(r => r.values[field].state === "present");
      const knownTotal = known.length ? known.reduce((s, r) => s + r.values[field].value!, 0) : null;
      const mapped = (basis: MappingBasis) => {
        const matching = known.filter(r => r.mapping === basis);
        const value = known.length ? matching.reduce((s, r) => s + r.values[field].value!, 0) : null;
        return { knownValue: value, shareOfKnownValue: value !== null && knownTotal !== null ? fraction(value, knownTotal) : null };
      };
      return [field, { states, availableCount: known.length, availableShare: fraction(known.length, denominator),
        knownTotal, operatingGeography: mapped("operating-geography"), headquartersFallback: mapped("headquarters-fallback") }];
    }));
    return { denominator, mapping: mappings, metrics };
  };
  const fullWorkbook = summarize(records), eligible = summarize(records.filter(r => r.eligible));
  const eligibleKnownValueCoverage = Object.fromEntries(fields.map(field => {
    const numerator = eligible.metrics[field].knownTotal, denominator = fullWorkbook.metrics[field].knownTotal;
    return [field, numerator !== null && denominator !== null ? fraction(numerator, denominator) : null];
  }));
  return { version: "company-coverage-1" as const, sourceId: input.sourceId,
    observationDate: day(input.observationDate), informationCutoff: new Date(input.informationCutoff).toISOString(),
    fullWorkbook, eligible, eligibleCompanyShare: fraction(eligible.denominator, fullWorkbook.denominator),
    eligibleKnownValueCoverage,
    eligibilityConflicts: records.filter(r => r.eligibilityConflict).length,
    eligibilityRule: "Unique currently approved financial review, exact workbook companyId/ISIN, valid snapshot, all review/source/quote/filing timestamps available by cutoff; no issuer double counting.",
    units: { marketCap: "USD million (workbook convention; no FX applied)", emissions: "tonnes CO2e; scopes separate, never summed across issuers/scopes as a global inventory" },
    limitations: [
      "Exact observation date only; no latest-value carry-forward. Full workbook denominator is fixed before data availability checks.",
      "Eligible denominator means reviewed financial identity, not approved operating model or scientific acceptance.",
      "Mapping requires a unique approved complete operating proposal with verified archived identity and source claims; headquarters is never inferred as operating geography.",
      "Known-value weighted shares exclude unknown/conflicted/invalid values; they are NOT shares of unknown total universe value. All-zero emissions denominator yields null weighted shares.",
      "Workbook denomination is a source convention, not independently verified issuer FX; unknown original publication vintages prevent historical point-in-time claims.",
      "Current financial review status is not a reconstructed historical approval journal; superseded reviews are not revived at earlier cutoffs.",
    ], scientificAcceptance: false as const };
}
export type CompanyCoverageReport = ReturnType<typeof companyCoverage>;
