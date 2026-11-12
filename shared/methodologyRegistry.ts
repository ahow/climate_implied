import { fieldSemantics } from "./fieldSemantics";
import { outputFieldSemantics } from "./outputFieldSemantics";
import { exportContracts } from "./downloadClaims";
import { HISTORICAL_TYPES } from "./historicalTypes";
import { scientificEvidenceStatuses } from "./scientificEvidence";
import { supplementalSheetBindings } from "./supplementalSheetBindings";

/** No copied formulas, inferred vintages, runtime evidence files or Git reads.
 * The same definitions consumed by calculators' output bindings drive this view.
 */
export function methodologyRegistry() {
  return {
    version: "methodology-registry-v1",
    boundary: "Definitions describe implemented quantities, not scientific acceptance or completeness of source evidence.",
    coreFields: fieldSemantics,
    outputFields: outputFieldSemantics,
    downloadClaims: exportContracts,
    historicalTypes: HISTORICAL_TYPES,
    scientificEvidence: scientificEvidenceStatuses(),
    supplementalSheets: {
      "Field semantics": supplementalSheetBindings("Field semantics"),
      "Column bindings": supplementalSheetBindings("Column bindings"),
    },
  };
}
