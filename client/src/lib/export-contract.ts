import { currentSelection } from "./analysis-selection";
/** Interpretation travels with downloaded data, rather than only with its page. */
export const exportContracts = {
  legacy: {
    status: "Unsupported legacy diagnostic",
    interpretation: "Not a validated climate forecast. Aggregate GHG is passed through a CO2-only response with a fixed warming offset. Regional values are global counterfactuals, not regional temperatures.",
    limitation: "Positive residual-emissions thresholds are not net zero. No threshold date is extrapolated beyond 2100; null means not reached within the simulated horizon. Quantile labels do not establish calibrated predictive uncertainty.",
  },
  indicators: {
    status: "Source indicator data",
    interpretation: "Source observations and available estimates, not a climate forecast.",
    limitation: "Current revised history is not original publication-vintage evidence. Collection and approval status must be checked separately.",
  },
  valuation: {
    status: "Descriptive valuation diagnostic",
    interpretation: "P/E and earnings-yield comparisons. Gordon growth is a steady-state comparator, not five-year cash-flow growth or an inferred emissions reduction.",
    limitation: "Does not identify market climate expectations. Carbon intensity, where reported, is per market capitalisation, not revenue. Missing financial or identity evidence is not an approval.",
  },
  backtest: {
    status: "Retrospective research",
    interpretation: "Historical strategy diagnostics, not validated investment evidence or a forecast of future returns.",
    limitation: "Revised-history inputs, legacy selections and incomplete lifecycle/borrow/FX evidence limit inference. This is not acceptance of the new paired valuation-gap model.",
  },
  news: {
    status: "Descriptive news analysis",
    interpretation: "Article coverage and sentiment summaries, not climate projections or market expectations.",
    limitation: "Coverage depends on the source and retrieval window; sentiment is not a verified causal effect.",
  },
} as const;

export type ExportKind = keyof typeof exportContracts;

export function exportNotes(kind: ExportKind, filename: string, exportedAt: string) {
  const selection = currentSelection();
  const contract = exportContracts[kind];
  if (!contract) throw new Error("Unknown export interpretation");
  return [
    { Field: "Analysis input selection", Value: selection
      ? `Workbook ${selection.workbook}; indicators ${selection.indicators}; regional inputs ${selection.regional ?? "not selected"}. Applies only to supported analytical views, not news, published references or provider/data-management records. Current-code replay, not original-vintage evidence.`
      : "Current inputs; no archived analysis selection" },
    { Field: "File", Value: filename },
    { Field: "Export time (not observation or publication date)", Value: exportedAt },
    { Field: "Evidence status", Value: contract.status },
    { Field: "Interpretation", Value: contract.interpretation },
    { Field: "Limitations", Value: contract.limitation },
    { Field: "Reproducibility", Value: "This is a view export, not an immutable analysis archive. An export timestamp does not identify the input vintage or model run." },
    { Field: "Units and missingness", Value: "Use the column headings for units. Empty cells mean missing or unavailable, not zero. Do not combine different growth definitions or horizons." },
  ];
}
