import { contentHash } from "../calculation/analysisManifest";
import type { Stage10Company } from "./stage10Coverage";
import { stage10LifecycleSourceKinds, type Stage10LifecycleState } from "../../shared/stage10Coverage";
export type LifecycleEvidence = {
  companyId: number; isin: string; state: Stage10LifecycleState;
  kind: "provider-listing" | "exchange-listing" | "corporate-action";
  sourceKind: typeof stage10LifecycleSourceKinds[number]; endpoint: string;
  capturedAt: string; effectiveAt: string; sourceHash: string; fact: string | boolean;
};
const endpoint = "https://financialmodelingprep.com/stable/profile";
/** Exact retained security binding only. An inactive provider flag is an
 * unknown reason,NEVER a delisting or acquisition. No workbook observations. */
export function lifecycleProfileEvidence(company: Stage10Company, profile: Record<string, any>, capturedAt: string,
  sourceHash: string, sourceKind: LifecycleEvidence["sourceKind"]): LifecycleEvidence[] {
  if (profile.isin !== company.isin || typeof profile.symbol !== "string" || !profile.symbol ||
    typeof profile.exchange !== "string" || !profile.exchange ||
    typeof profile.isActivelyTrading !== "boolean") return [];
  return [{ companyId: company.id, isin: company.isin, state: profile.isActivelyTrading ? "listed" : "unknown",
    kind: "provider-listing", sourceKind, endpoint, capturedAt, effectiveAt: capturedAt, sourceHash, fact: profile.isActivelyTrading }];
}
export function resolveStage10Lifecycle(company: Stage10Company, evidence: LifecycleEvidence[], cutoff: string) {
  const valid = evidence.filter(e => e.companyId === company.id && e.isin === company.isin &&
    /^[a-f0-9]{64}$/.test(e.sourceHash) && /^https:\/\//.test(e.endpoint) &&
    Number.isFinite(Date.parse(e.capturedAt)) && Number.isFinite(Date.parse(e.effectiveAt)) &&
    Date.parse(e.capturedAt) <= Date.parse(cutoff) && Date.parse(e.effectiveAt) <= Date.parse(cutoff) &&
    (e.kind === "provider-listing" ? (e.endpoint === endpoint && ((e.state === "listed" && e.fact === true) || (e.state === "unknown" && e.fact === false))) :
      e.kind === "exchange-listing" ? e.state === "listed" && e.fact === "listed" :
        ["acquired", "merged", "delisted"].includes(e.state) && e.fact === e.state));
  if (!valid.length) return { state: "unknown" as Stage10LifecycleState, proofs: [] as LifecycleEvidence[] };
  const latestTime = Math.max(...valid.map(e => Date.parse(e.effectiveAt)));
  const latest = valid.filter(e => Date.parse(e.effectiveAt) === latestTime);
  const known = latest.filter(e => e.state !== "unknown");
  const states = new Set(known.map(e => e.state));
  if (states.size !== 1 || (!known.length)) return { state: "unknown" as Stage10LifecycleState, proofs: [] as LifecycleEvidence[] };
  const state = known[0].state;
  // A provider active flag alone cannot undo an earlier verified terminal
  // corporate event: genuine subsequent exchange-listing evidence is required.
  if (state === "listed" && !known.some(e => e.kind === "exchange-listing") &&
    valid.some(e => ["acquired", "merged", "delisted"].includes(e.state)))
    return { state: "unknown" as Stage10LifecycleState, proofs: [] as LifecycleEvidence[] };
  return { state, proofs: known };
}
export function auditStage10Lifecycles(companies: Stage10Company[], evidence: LifecycleEvidence[], cutoff: string) {
  if (evidence.some(e => e.kind !== "provider-listing" || e.endpoint !== endpoint))
    throw new Error("No retained trusted exchange/action resolver provisioned; classifier fixtures are not authorized real census sources");
  const resolved = new Map(companies.map(c => [c.id, resolveStage10Lifecycle(c, evidence, cutoff)]));
  const nonUnknown = companies.filter(c => resolved.get(c.id)!.state !== "unknown");
  const unverified = nonUnknown.filter(c => !resolved.get(c.id)!.proofs.length);
  if (unverified.length) throw new Error("Nonunknown lifecycle lacks verification source");
  const sourceRows = stage10LifecycleSourceKinds.map(sourceKind => {
    const available = evidence.filter(e => e.sourceKind === sourceKind &&
      Number.isFinite(Date.parse(e.capturedAt)) && Date.parse(e.capturedAt) <= Date.parse(cutoff));
    const used = nonUnknown.filter(c => resolved.get(c.id)!.proofs.some(e => e.sourceKind === sourceKind));
    const dates = available.map(e => e.capturedAt).sort();
    return { sourceKind, endpoint, sourceSetHash: contentHash(available), evidenceRecords: available.length,
      usedNonUnknownCompanies: used.length, firstCapturedAt: dates[0] ?? null, lastCapturedAt: dates.at(-1) ?? null };
  });
  return { resolved, sourceRows, known: nonUnknown.length, audited: nonUnknown.length,
    sourceSetHash: contentHash({ cutoff, evidence }), unverified: 0 as const };
}
