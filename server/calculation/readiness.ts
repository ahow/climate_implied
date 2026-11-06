import { PROMOTION_REQUIREMENTS, promotionDecision } from "./evaluation";
export function calculationReadiness() {
  // No external evidence is silently inferred from passing engineering fixtures.
  const verifiedEvidence: Record<string, boolean> = {};
  const reasons: Record<string, string> = {
    "native-pathways": "Four native HFC pathways and a complete all-announced-commitments scenario remain unresolved.",
    "independent-fair-reference": "841-member upstream reference execution succeeded; an independent numeric reference is not supplied.",
    "historical-forcing": "Historical gas/forcing inputs through the current inventory year are not independently reconciled.",
    "human-induced-validation": "Separate anthropogenic validation against published warming uncertainty is pending.",
    holdout: "Evaluation machinery is implemented; eligible historical-vintage holdout evidence is not available.",
    "consumer-consistency": "Legacy consumers remain in use; candidate output migration is not certified.",
    "production-runtime": "FaIR runs offline; the production Node service does not execute Python.",
  };
  return {
    defaultEngine: "legacy-dashboard",
    candidateEnabled: promotionDecision(verifiedEvidence).canPromote,
    checks: PROMOTION_REQUIREMENTS.map(id => ({ id, label: id.replaceAll("-", " "), passed: verifiedEvidence[id] === true, reason: reasons[id] })),
    limitations: ["A successful build or reference execution does not authorize scientific default promotion."],
  };
}
