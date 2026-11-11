/** Reviewed CAT scenario identity, not a scientific-readiness or native-gas gate.
 * NDC-only references must never inherit the optimistic full-commitments label.
 * Changes to the pinned publication require review of this binding too.
 */
export const ALL_COMMITMENTS_LABEL = "All announced commitments delivered";
export const CAT_ALL_COMMITMENTS_NAME = "Optimistic scenario (net-zero pledges)";
export const CAT_ALL_COMMITMENTS_DEFINITION = "Assumes governments achieve all announced targets, including long-term net-zero announcements and proposals. An optimistic conditional case, not an equally likely forecast.";

export function hasReviewedAllCommitmentsLabel(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const scenario = value as Record<string, unknown>;
  return scenario.id === "all-announced-commitments" &&
    scenario.label === ALL_COMMITMENTS_LABEL &&
    scenario.publishedName === CAT_ALL_COMMITMENTS_NAME &&
    scenario.definition === CAT_ALL_COMMITMENTS_DEFINITION;
}
