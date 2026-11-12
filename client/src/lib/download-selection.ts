import { currentSelection, type AnalysisSelection } from "./analysis-selection";

/** Capture before the click handler's first await. This is requested UI state,
 * not evidence of the data producer's selected inputs or model/run identity. */
export function captureDownloadSelection(): AnalysisSelection | null {
  return structuredClone(currentSelection());
}

/** No late current-selection substitution. A changed or malformed selection
 * refuses delivery, even when data/hash preparation itself succeeded. */
export function requireUnchangedDownloadSelection(requested: AnalysisSelection | null) {
  if (JSON.stringify(requested) !== JSON.stringify(currentSelection()))
    throw new Error("Requested UI analysis selection changed while preparing export; request the export again.");
}
