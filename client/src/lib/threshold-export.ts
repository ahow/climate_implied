import {
  THRESHOLD_DIAGNOSTIC_LABEL, type ThresholdDiagnostic,
} from "@shared/thresholdDiagnostic";

/** Numeric nulls survive workbook serialization; status explains withheld vs censored. */
export function thresholdExportRow(d: ThresholdDiagnostic, contextLabel: string | null = null) {
  return {
    Context: contextLabel,
    Diagnostic: d.label,
    Version: d.version,
    [THRESHOLD_DIAGNOSTIC_LABEL]: d.year,
    Status: d.status,
    Reason: d.reason,
    "Baseline year": d.baselineYear,
    "Selected 2024 baseline": d.baselineValue,
    "Baseline evidence": d.baselineEvidenceId,
    "Threshold fraction": d.thresholdFraction,
    "Threshold value": d.thresholdValue,
    "Horizon year": d.horizonYear,
    Selection: d.basis?.selectionId ?? null,
    Trajectory: d.basis?.trajectoryId ?? null,
    Member: d.basis?.memberId ?? null,
    "Gas basis": d.basis?.gasBasis ?? null,
    Unit: d.basis?.unit ?? null,
    "Crossing rule": d.crossingRule,
    "Not net zero": d.notNetZero,
  };
}

export const thresholdExportBindings = {
  Context: { id: "thresholdDiagnostic.contextLabel", transform: "Display scenario/reference-year label from the source UI row; null if not supplied; not original-vintage evidence" },
  Diagnostic: { id: "thresholdDiagnostic.label", transform: "Identity" },
  Version: { id: "thresholdDiagnostic.version", transform: "Identity" },
  [THRESHOLD_DIAGNOSTIC_LABEL]: { id: "thresholdDiagnostic.year", transform: "Identity; null preserved; see status" },
  Status: { id: "thresholdDiagnostic.status", transform: "Identity; withheld is not right-censored" },
  Reason: { id: "thresholdDiagnostic.reason", transform: "Identity; null preserved" },
  "Baseline year": { id: "thresholdDiagnostic.baselineYear", transform: "Identity" },
  "Selected 2024 baseline": { id: "thresholdDiagnostic.baselineValue", transform: "Identity; never borrow from another selection" },
  "Baseline evidence": { id: "thresholdDiagnostic.baselineEvidenceId", transform: "Identity; null preserved" },
  "Threshold fraction": { id: "thresholdDiagnostic.thresholdFraction", transform: "Identity fraction, not percent" },
  "Threshold value": { id: "thresholdDiagnostic.thresholdValue", transform: "0.05 * selected evidenced 2024 baseline; null if withheld" },
  "Horizon year": { id: "thresholdDiagnostic.horizonYear", transform: "Identity; no extrapolation" },
  Selection: { id: "thresholdDiagnostic.basis.selectionId", transform: "Identity; null preserved" },
  Trajectory: { id: "thresholdDiagnostic.basis.trajectoryId", transform: "Identity; null preserved" },
  Member: { id: "thresholdDiagnostic.basis.memberId", transform: "Identity; null preserved" },
  "Gas basis": { id: "thresholdDiagnostic.basis.gasBasis", transform: "Identity; no gas conversion" },
  Unit: { id: "thresholdDiagnostic.basis.unit", transform: "Identity; no unit conversion" },
  "Crossing rule": { id: "thresholdDiagnostic.crossingRule", transform: "Identity" },
  "Not net zero": { id: "thresholdDiagnostic.notNetZero", transform: "Identity" },
};
