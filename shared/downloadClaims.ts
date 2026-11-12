/** Authoritative download claim labels. Shared by the UI, API and writers. */
export const exportContracts = {
  coverage: {
    status: "Descriptive revised-workbook company coverage",
    interpretation: "Full-workbook and eligible financial-identity denominators, separate emissions scopes and explicit operating-geography versus HQ-fallback mapping; no geography inferred from headquarters.",
    limitation: "Known-value shares exclude unknown values and are not total-universe estimates. Workbook market cap uses its USD-million convention without implied FX. Company scope3 sums are not a global physical inventory. Source/review integrity is not scientific acceptance or original-vintage proof.",
  },
  native: {
    status:"Uncalibrated native-emissions candidate",
    interpretation:"Global deterministic conditional emissions using native gas masses and AR6 GWP100 reporting. No temperature, regional climate or ensemble probability claim.",
    limitation:"Control/illustrative/dashboard inputs are not approved calibrated policy forecasts. Published inventory uncertainty is not forecast uncertainty; retained hashes are not publication-vintage proof. Separate residual diagnostics use5% of the same captured2024 native-gas baseline, not CO2e or physical net zero; no crossing is censored at the actual simulated horizon.",
  },
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
