/**
 * Stage 1 frontend output register. This is claim containment, not scientific
 * promotion or an inventory of backend/API/export consumers outside client/.
 * DownloadDataButton exports supplied rows plus a mandatory interpretation sheet.
 * See docs/System_Output_Register.md for the source-level API/export census.
 */
export const uiClaimRegister = [
  {
    route: "/",
    consumers: ["PublishedScenarioReferences", "EmissionsCandidateReview", "IndicatorCards"],
    policy: "Published references retain source/version/licence/caveats; indicators and candidate evidence are not physical forecasts.",
    exports: "IndicatorCards: source indicator rows. EmissionsCandidateReview: deterministic native-gas mass and AR6 GWP100 sector/reporting totals; no temperature or probability output.",
  },
  {
    route: "/ (explicit legacy opt-in)",
    consumers: ["TemperatureGauge", "TemperatureHistogram", "EmissionsChart", "SensitivityChart", "RegionalComparison", "HistoricalTrendChart", "CategoryTrendChart", "CategoryComparison"],
    policy: "Unsupported legacy model diagnostics: CO2-only response on aggregate GHG plus fixed 1.1C offset. Fixed-5-Gt milestone may extrapolate beyond 2100. No standalone regional temperature interpretation.",
    exports: "Existing chart downloads remain legacy diagnostics, reachable only inside opt-in view; not promoted, rebased or repaired.",
  },
  {
    route: "/climate-valuation",
    consumers: ["AnalysisSection", "SummaryCard", "ValuationNotice"],
    policy: "P/E comparison only; Gordon formula described as steady-state baseline. Intensity per market cap. No physical valuation conversion.",
    exports: "P/E rows only. Temperature, carbon-price, physical-rate and net-zero exports removed.",
  },
  {
    route: "/decarb-signal",
    consumers: ["DecarbSignal", "BacktestSummary", "ValuationNotice"],
    policy: "Group earnings-yield gaps computed directly from P/E, not legacy converted rates. No global physical-rate comparison. Backtests remain retrospective research.",
    exports: "Group earnings-yield gaps in pp; retrospective returns and tracking-error rows. No physical-rate comparison exports.",
  },
  {
    route: "/decarb-gap",
    consumers: ["DecarbGapSignal", "BacktestSummary", "ValuationNotice"],
    policy: "Peer earnings-yield gap and Gordon baseline, legacy-selected company subsets. Physical gap and distribution withheld. Legacy backtest ranking does not establish climate expectations or investment validity.",
    exports: "Group earnings-yield gaps in pp; retrospective returns and tracking-error rows. Physical gap distribution export removed.",
  },
  {
    route: "/data-management",
    consumers: ["IndicatorDetailDialog", "FinancialReview", "FinancialProviderStatus", "ScientificValidation"],
    policy: "Read-only source/provenance, financial review and calculation-readiness inspection. No collection, approval, rejection or manual editing.",
    exports: "Indicator historical source rows; no write or model-promotion action.",
  },
  {
    route: "/methodology",
    consumers: ["Methodology", "PublicationMethodologyNotes"],
    policy: "Current limitations first. Old interpretations and formulas archived in closed opt-in details.",
    exports: "None.",
  },
  {
    route: "/news-sentiment",
    consumers: ["NewsSentiment"],
    policy: "Existing descriptive news/sentiment view; not climate, valuation-to-activity or milestone output.",
    exports: "Existing descriptive news/sentiment rows; no climate conversion introduced.",
  },
] as const;
