/** Versioned residual diagnostic, deliberately separate from physical net zero. */
export const THRESHOLD_DIAGNOSTIC_VERSION = "selected-2024-five-percent-v2" as const;
export const THRESHOLD_DIAGNOSTIC_LABEL = "Year emissions reach 5% of 2024";

export interface ThresholdBasis {
  selectionId: string;
  trajectoryId: string;
  memberId: string;
  gasBasis: string;
  unit: string;
}

export interface ThresholdBaseline2024 extends ThresholdBasis {
  year: 2024;
  value: number;
  evidenceId: string;
}

export interface ThresholdDiagnostic {
  version: typeof THRESHOLD_DIAGNOSTIC_VERSION;
  label: typeof THRESHOLD_DIAGNOSTIC_LABEL;
  year: number | null;
  status: "reached" | "right-censored" | "withheld";
  reason: string | null;
  baselineYear: 2024;
  baselineValue: number | null;
  baselineEvidenceId: string | null;
  thresholdFraction: 0.05;
  thresholdValue: number | null;
  horizonYear: number;
  basis: ThresholdBasis | null;
  crossingRule: "first annual value <= 0.05 * selected 2024 baseline; no interpolation or extrapolation";
  notNetZero: true;
}

export function thresholdDiagnosticDisplay(diagnostic?: ThresholdDiagnostic | null): string {
  if (!diagnostic || diagnostic.status === "withheld") return "Withheld — 2024 baseline unavailable";
  return diagnostic.status === "right-censored"
    ? `Not reached by ${diagnostic.horizonYear}`
    : String(diagnostic.year);
}
