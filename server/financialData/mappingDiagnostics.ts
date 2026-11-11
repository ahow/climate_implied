import { assessMapping, type Profile, type FigiCandidate } from "./provider";
export function diagnoseMapping(isin: string, profiles: Profile[], figis: FigiCandidate[]) {
  const assessment = assessMapping(isin, profiles, figis);
  const reasons: string[] = [];
  if (!profiles.length) reasons.push("no-fmp-profile");
  if (!figis.some(f => f.marketSector === "Equity")) reasons.push("no-openfigi-equity");
  if (profiles.some(p => p.isin !== isin)) reasons.push("provider-isin-mismatch");
  if (profiles.some(p => p.isAdr)) reasons.push("adr-excluded");
  if (profiles.some(p => p.isActivelyTrading === false)) reasons.push("provider-reports-inactive");
  if (profiles.some(p => !p.symbol || !p.currency || !p.exchange)) reasons.push("incomplete-profile");
  if (assessment.candidates.length > 1) {
    const classes = new Set(assessment.candidates.map(c => c.shareClassFIGI));
    reasons.push(classes.size === 1 ? "multiple-listings-same-share-class" : "multiple-share-classes");
  }
  if (profiles.length && figis.length && !assessment.candidates.length)
    reasons.push("no-supported-exchange-ticker-share-class-join");
  if (assessment.candidates.length === 1) reasons.push("candidate-awaiting-independent-issuer-review");
  return { ...assessment, identityReviewState: assessment.status === "candidate-needs-issuer-review" ? "candidate-awaiting-review" :
    assessment.status, reasons, lifecycle: "unknown",
    lifecycleMeaning: "Provider observations retained for review; no automatic lifecycle approval" };
}
/** Offline sampled-audit consumer: missing evidence is not a successful empty
 * response; failed queries cannot become unmatched through an empty fallback. */
export function reassessRetainedMapping(row: Record<string, any>) {
  if (row.status === "error" || row.identityReviewState === "provider-error" || row.figi?.error)
    return { ...row, status: "error", identityReviewState: "provider-error", accepted: false,
      reasons: ["provider-query-failed-retained-not-unmatched"], lifecycle: "unknown" };
  if (row.status === "not-queried") return { ...row, identityReviewState: "not-queried", accepted: false, lifecycle: "unknown" };
  if (["invalid-identifier", "out-of-scope"].includes(row.status))
    return { ...row, identityReviewState: "out-of-scope", accepted: false, lifecycle: "unknown" };
  if (!Array.isArray(row.profiles) || !Array.isArray(row.figi?.data)) throw new Error("Retained provider evidence missing; cannot reassess as unmatched");
  return diagnoseMapping(row.isin, row.profiles, row.figi.data);
}
