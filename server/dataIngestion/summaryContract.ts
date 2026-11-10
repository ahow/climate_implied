import { describePersistedSummary } from "../../shared/dataManagementSemantics";
import { bindNestedOutput } from "../../shared/outputFieldSemantics";
export { describePersistedSummary,FETCH_SUMMARY_CONTRACT } from "../../shared/dataManagementSemantics";

/** Metadata only: strict producer-schema claims are bound separately.
 * Unknown historical JSON is neither traversed as known claims nor replaced,
 * stringified, hashed, dropped, or rewritten. The API returns the original runs.
 */
export function bindKnownPersistedSummary(value:unknown) {
  const interpretation=describePersistedSummary(value);
  return interpretation.availability==="available"
    ? bindNestedOutput("fetchSummaryProducer",interpretation.claims) : [];
}
