import { THRESHOLD_DIAGNOSTIC_LABEL, THRESHOLD_DIAGNOSTIC_VERSION } from "./thresholdDiagnostic";

/** Presentation/description contracts only. Never use these as numeric inputs. */
export const GORDON_DEFINITION = "g = r - 1/PE; fully distributable earnings; steady-state comparator, not five-year reverse-DCF growth or a physical decarbonisation rate";
export function gordonLabelFromPercent(costOfEquityPct = 8): string {
  if (!Number.isFinite(costOfEquityPct) || costOfEquityPct <= 0 || costOfEquityPct > 100)
    throw new Error("Gordon cost of equity must be finite and in (0,100]");
  return `Gordon baseline (r = ${Number(costOfEquityPct.toPrecision(12))}%)`;
}
export const FIXED_5GT_DESCRIPTOR = Object.freeze({
  label: "Legacy fixed-5gt-v1 year (5 GtCO2e)",
  thresholdLabel: "Legacy fixed-5gt-v1 annual threshold (5 GtCO2e/year)",
  description: "Legacy fixed-5gt-v1 year (5 GtCO2e); first annual p50 <= 5 GtCO2e; null means not reached within the simulated horizon. Positive residual, not 5% of 2024 and not net zero.",
});
export const SELECTED_FIVE_PERCENT_DESCRIPTOR = Object.freeze({
  label: THRESHOLD_DIAGNOSTIC_LABEL,
  version: THRESHOLD_DIAGNOSTIC_VERSION,
  description: "Year emissions reach 5% of 2024; first annual value <= 0.05 * the same selected evidenced 2024 baseline. Missing or mismatched evidence withholds; no crossing is censored at the actual horizon. No interpolation/extrapolation; positive residual, not net zero.",
});
export const RETIRED_FINANCE_RESIDUAL_DESCRIPTOR = Object.freeze({
  label: "Retired formula: year emissions reach 5% of fixed baseline",
  description: "Archived exponential finance illustration, not the selected-2024-five-percent-v2 diagnostic. Fixed-baseline extrapolated years and historical numeric examples are retained, not recalculated or accepted. Positive residual, not net zero.",
});
export function residualQuantityExportNotes() {
  return [{ Field: "Annual threshold label", Value: FIXED_5GT_DESCRIPTOR.thresholdLabel },
    ...[FIXED_5GT_DESCRIPTOR, SELECTED_FIVE_PERCENT_DESCRIPTOR].flatMap(descriptor => [
    { Field: "Quantity label", Value: descriptor.label },
    { Field: descriptor.label, Value: descriptor.description },
  ])];
}
