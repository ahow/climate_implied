import type { RetainedPairedPin } from "../client/src/components/retained-paired-research-contract";

/** Only a reviewed source change can authorize exact public bytes. No real
 * redistribution review has been supplied. Synthetic DEV pins do not belong here. */
export const retainedPairedResearchCatalog: readonly RetainedPairedPin[] = Object.freeze([]);
export const RETAINED_PAIRED_PREREQUISITE = "An authorized workspace operator must review the exact offline paired-pipeline public projection and source redistribution rights, retain its published disclosure, add all eight exact hashes by a reviewed source change to server/retainedPairedResearchCatalog.ts, then run the catalog-gated offline publisher. No HTTP approval, arbitrary path, private archive fallback or latest-report substitution is supported.";
