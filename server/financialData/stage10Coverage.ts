import { contentHash } from "../calculation/analysisManifest";
import { stage10Fields, stage10IdentityStates, stage10CoverageSchema, stage10PrivacyMinimumCompanies, type Stage10Field, type Stage10IdentityState } from "../../shared/stage10Coverage";
import { validIsin } from "./isin";
import { snapshotSchema, snapshotId } from "./review";
export type Stage10Company = { id: number; isin: string; sector?: string | null; geography?: string | null };
export type Stage10Cell = { companyId: number; isin: string; year: number; field: Stage10Field;
  state: "present" | "missing" | "explicitNull" | "invalid" | "conflicted"; value?: unknown;
  currency: string | null;
  sourceFilingDate?: string | null;
  filingDate: string | null; filingEvidence: "verified-original" | "provider-unverified" | "missing";
  restatement: "original" | "restated" | "unknown"; sourceHash: string; capturedAt: string };
export function sevenStateIdentity(company: Stage10Company, attempts: Record<string, any>[], reviews: Record<string, any>[],
  cutoff: string): Stage10IdentityState {
  if (!validIsin(company.isin)) return "out-of-scope";
  const matches = attempts.filter(r => r.companyId === company.id);
  if (matches.some(r => r.isin !== company.isin) || matches.length > 1) return "ambiguous";
  if (matches.some(r => ["error", "provider-error"].includes(r.status))) return "provider-error";
  if (matches.some(r => r.status === "not-queried")) return "not-queried";
  const approvals = reviews.filter(r => r.status === "approved" && r.payload?.identity?.companyId === company.id);
  if (approvals.length > 1) return "ambiguous";
  if (approvals.length) {
    const row = approvals[0], parsed = snapshotSchema.safeParse(row.payload);
    if (!parsed.success || snapshotId(parsed.data) !== row.id || parsed.data.identity.isin !== company.isin) return "ambiguous";
    const times = [row.reviewed_at, parsed.data.identity.reviewedAt, parsed.data.fetchedAt, parsed.data.quote.observedAt,
      `${parsed.data.statement.filingDate}T23:59:59.999Z`];
    if (times.every(t => {
      const time = t instanceof Date ? t.getTime() : Date.parse(String(t));
      return t && Number.isFinite(time) && time <= Date.parse(cutoff);
    })) return "accepted";
  }
  if (!matches.length) return "not-queried";
  switch (matches[0].status) {
    case "error": case "provider-error": return "provider-error";
    case "candidate-needs-issuer-review": case "candidate-awaiting-review": return "candidate-awaiting-review";
    case "ambiguous": return "ambiguous";
    case "unmatched": return "unmatched";
    case "invalid-identifier": case "out-of-scope": return "out-of-scope";
    case "not-queried": return "not-queried";
    default: throw new Error("Unknown retained identity state; cannot collapse to unmatched/not-queried");
  }
}
export function stage10EligibleCorpus(companies: Stage10Company[], eligible: Set<number>, cells: Stage10Cell[], origin: string) {
  const multiplicity = new Map<string, number>();
  for (const c of cells) {
    const key = `${c.companyId}|${c.year}|${c.field}`;
    multiplicity.set(key, (multiplicity.get(key) ?? 0) + 1);
  }
  return cells.filter(c => multiplicity.get(`${c.companyId}|${c.year}|${c.field}`) === 1 &&
    eligible.has(c.companyId) && companies.some(x => x.id === c.companyId && x.isin === c.isin) &&
    c.state === "present" && c.restatement === "original" && c.filingEvidence === "verified-original" && c.filingDate &&
    (["shares", "segments"].includes(c.field) || /^[A-Z]{3}$/.test(c.currency ?? "")) &&
    Date.parse(c.capturedAt) <= Date.parse(origin) && Date.parse(`${c.filingDate}T23:59:59.999Z`) <= Date.parse(origin));
}
export function buildStage10Coverage(input: {
  workbookHash: string; cutoff: string; years: number[]; companies: Stage10Company[]; attempts: Record<string, any>[];
  reviews: Record<string, any>[]; eligibleIds: number[]; cells: Stage10Cell[]; sourceIdentity: unknown;
  retainedVersions: number; selectedVersions: number; sourceGaps: string[];
}) {
  if (new Set(input.companies.map(c => c.id)).size !== input.companies.length ||
    new Set(input.companies.map(c => c.isin)).size !== input.companies.length) throw new Error("Duplicate workbook identity");
  const ids = new Set(input.companies.map(c => c.id)), eligible = new Set(input.eligibleIds);
  if (input.eligibleIds.length !== eligible.size || input.eligibleIds.some(id => !ids.has(id))) throw new Error("Eligible identity outside frozen universe or duplicated");
  if (!input.years.length || new Set(input.years).size !== input.years.length || input.years.some(y => !Number.isInteger(y))) throw new Error("Invalid declared fiscal-year domain");
  const issuerOwners = new Map<string, number[]>();
  for (const r of input.reviews.filter(r => r.status === "approved")) {
    const p = snapshotSchema.safeParse(r.payload);
    if (p.success) issuerOwners.set(p.data.identity.issuerId, [...(issuerOwners.get(p.data.identity.issuerId) ?? []), p.data.identity.companyId]);
  }
  const state = new Map(input.companies.map(c => [c.id, sevenStateIdentity(c, input.attempts, input.reviews, input.cutoff)]));
  for (const owners of Array.from(issuerOwners.values()).filter(x => x.length > 1))
    for (const id of owners) { if (ids.has(id)) state.set(id, "ambiguous"); eligible.delete(id); }
  for (const id of Array.from(eligible)) if (state.get(id) !== "accepted") throw new Error("Verified eligible identity is not accepted");
  const cells = new Map<string, Stage10Cell[]>();
  for (const cell of input.cells) {
    if (!input.companies.some(c => c.id === cell.companyId && c.isin === cell.isin)) throw new Error("Cell identity mismatch; no ticker join");
    if (Date.parse(cell.capturedAt) > Date.parse(input.cutoff)) throw new Error("Future source cell");
    const key = `${cell.companyId}|${cell.year}|${cell.field}`;
    cells.set(key, [...(cells.get(key) ?? []), cell]);
  }
  const cat = (s: string | null | undefined) => s?.trim() || "Unknown";
  const groups = [{ sector: "All sectors", region: "All regions", companies: input.companies }];
  for (const sector of Array.from(new Set(["Unknown", ...input.companies.map(c => cat(c.sector))])).sort())
    for (const region of Array.from(new Set(["Unknown", ...input.companies.map(c => cat(c.geography))])).sort())
      groups.push({ sector, region, companies: input.companies.filter(c => cat(c.sector) === sector && cat(c.geography) === region) });
  const rows = [];
  for (const group of groups) for (const population of ["full-workbook", "verified-eligible"] as const) {
    const companies = group.companies.filter(c => population === "full-workbook" || eligible.has(c.id));
    const suppressed = companies.length > 0 && companies.length < stage10PrivacyMinimumCompanies;
    const base = { population, sector: group.sector, region: group.region, companies: companies.length, suppressed };
    const blank = { missing: null, explicitNull: null, invalid: null, conflicted: null, original: null, restated: null, restatementUnknown: null,
      originalFilingDateVerified: null, providerFilingDateUnverified: null, filingDateMissing: null, restatementKnownDenominator: null,
      restatedShareOfKnownProvenance: null, restatementUnknownShareOfPresent: null, explicitRestatedFlagShareOfPresent: null };
    for (const key of stage10IdentityStates) {
      const present = companies.filter(c => state.get(c.id) === key).length;
      rows.push({ ...base, ...blank, dimension: "identity" as const, key, expectedSlots: companies.length,
        present: suppressed ? null : present, availableShare: suppressed || !companies.length ? null : present / companies.length });
    }
    for (const field of stage10Fields) {
      const counts = { present: 0, missing: 0, explicitNull: 0, invalid: 0, conflicted: 0, original: 0, restated: 0, restatementUnknown: 0,
        originalFilingDateVerified: 0, providerFilingDateUnverified: 0, filingDateMissing: 0 };
      for (const c of companies) for (const year of input.years) {
        const found = cells.get(`${c.id}|${year}|${field}`) ?? [];
        if (found.length > 1) { counts.conflicted++; continue; }
        if (!found.length) { counts.missing++; continue; }
        const cell = found[0];
        counts[cell.state]++;
        if (cell.state !== "present") continue;
        counts[cell.restatement === "unknown" ? "restatementUnknown" : cell.restatement]++;
        counts[cell.filingEvidence === "verified-original" ? "originalFilingDateVerified" :
          cell.filingEvidence === "provider-unverified" ? "providerFilingDateUnverified" : "filingDateMissing"]++;
      }
      const expectedSlots = companies.length * input.years.length;
      rows.push({ ...base, dimension: "financial-field" as const, key: field, expectedSlots,
        ...Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, suppressed ? null : v])),
        availableShare: suppressed || !expectedSlots ? null : counts.present / expectedSlots,
        restatementKnownDenominator: suppressed ? null : counts.original + counts.restated,
        restatedShareOfKnownProvenance: suppressed || !(counts.original + counts.restated) ? null : counts.restated / (counts.original + counts.restated),
        explicitRestatedFlagShareOfPresent: suppressed || !counts.present ? null : counts.restated / counts.present,
        restatementUnknownShareOfPresent: suppressed || !counts.present ? null : counts.restatementUnknown / counts.present });
    }
  }
  const manifest = { contract: "stage10-retained-coverage-1", privacyMinimumCompanies: stage10PrivacyMinimumCompanies, identityDomain: stage10IdentityStates,
    fieldDomain: stage10Fields, provenanceShareRule: "known-provenance-rate-separate-from-explicit-true-flags-and-unknown-share",
    workbookHash: input.workbookHash, cutoff: input.cutoff, years: input.years,
    companies: input.companies, attempts: input.attempts, reviews: input.reviews, eligible: Array.from(eligible).sort((a, b) => a - b),
    cells: input.cells, sourceIdentity: input.sourceIdentity };
  return stage10CoverageSchema.parse({ contract: "stage10-retained-coverage-1", inputHash: contentHash(manifest),
    workbookHash: input.workbookHash, informationCutoff: input.cutoff, fiscalYears: input.years,
    fullWorkbookCompanies: input.companies.length, verifiedEligibleCompanies: eligible.size,
    admittedStage11To15Records: stage10EligibleCorpus(input.companies, eligible, input.cells.filter(c => input.years.includes(c.year)), input.cutoff).length,
    retainedSourceVersions: input.retainedVersions, selectedSourceVersions: input.selectedVersions, sourceGaps: input.sourceGaps,
    rows, scientificAcceptance: false, investmentEvidence: false,
    limitation: "Fixed full-workbook and verified immutable identity denominators; candidate history is not approval. Counts only;1–4company populations suppressed without dropping categories or denominators. Unknown restatement is not original. Explicit true-flag share is NOT total restatement prevalence: unknown share stays separate,and known-provenance rate is null when none is known. Provider filing dates are unverified proxies; no historical point-in-time or Stage11–15 promotion without genuine original dated evidence." });
}
