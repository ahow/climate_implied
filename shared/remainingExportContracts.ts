/** The finite NON-signal browser consumers in methodologyDownloadCensus.
 *
 * Except the implemented readonly consumers, these remain unimplemented
 * producer contracts, NOT permission blockers or producer declarations.
 * This inventory never disables an existing download. In particular an approved indicator
 * hash, a source ID embedded in a report, or a UI selection is not a retained
 * material/model/code/completed-response binding. Keep each refusal local to
 * the actual missing parent; do not borrow the valuation producer namespace.
 */
export const remainingExportContracts = [
  { key: "category-scenarios", filenames: ["category-scenario-analysis"], source: "/api/projection/categories",
    missing: "Whole category-scenario response has no retained completed-result/material/code/model binding.",
    projection: "Preserved category order; categoryName, temperatureRise, reductionRate and legacy fixed-5gt positive-residual year; threshold year nullable and missing status withheld. Neither residual diagnostic is net zero." },
  { key: "category-trends", filenames: ["category-trends-temperature", "category-trends-reductionRate", "category-trends-legacy-fixed-5gt-v1"], source: "/api/projection/categories/historical-trend",
    missing: "Whole category-history response has no retained completed-result/material/code/model binding; historical type labels alone do not attest the producer.",
    projection: "Preserved year order; seven finite category columns and selected median/reductionRate/legacy fixed-5gt positive-residual year; exact historical labels and explicit nowcast flag. Neither residual diagnostic is net zero." },
  { key: "company-coverage", filenames: ["company-coverage-YYYY-MM-DD.json"], source: "/api/calculation/company-coverage",
    missing: "Coverage sourceId identifies a workbook, not a retained coverage calculation, material archive, model version or code archive.",
    projection: "Lossless validated company-coverage-1 report JSON, with baseline/no-overlay restriction; no spreadsheet projection." },
  { key: "native-thresholds", filenames: ["native-mass-five-percent-2024-diagnostics"], source: "/api/emissions/candidate",
    missing: "Whole native candidate response and baseline evidence have no retained completed-result/material/code/model binding; detached residual records cannot attest their producer.",
    projection: "Preserved residual record order; thresholdExportRow plus native Gas and Region; no gas conversion or baseline borrowing." },
  { key: "native-trajectory", filenames: ["native-emissions-constant", "native-emissions-transition", "native-emissions-dashboard"], source: "/api/emissions/candidate",
    missing: "Whole selected-scenario native candidate response has no retained completed-result/material/code/model binding.",
    projection: "Preserved trajectory order; nativeExportColumns finite native species and sector paths; nonfinite/missing cells null, not zero." },
  { key: "emissions", filenames: ["global-emissions-trajectory"], source: "/api/projection",
    missing: "Whole projection response has no retained completed-result/material/code/model binding; detached emissionsTrajectory is not a producer parent.",
    projection: "All trajectory years in native order, not chart's every-second-point sampling; year and p10/p50/p90 annual conditional GtCO2e." },
  { key: "historical-trend", filenames: ["historical-trend-temperature", "historical-trend-reductionRate", "historical-trend-netZero"], source: "/api/projection/historical-trend",
    missing: "Whole historical-recalculation response has no retained completed-result/material/code/model binding; revised-history class is not original-vintage attestation.",
    projection: "Preserved observation order; all temperature/reduction/fixed-5gt/5-percent fields regardless displayed metric; exact historical labels and nowcast flag." },
  { key: "indicator-cards", filenames: ["climate-indicators"], source: "/api/indicators/historical",
    missing: "Whole effective historical-indicator response has no retained completed-result/material/code/model binding; approved overrides alone omit historical-base and effective-value production.",
    projection: "Preserved native year order; finite indicator dictionary keys in native numeric units; no display percent multiplication." },
  { key: "version-diff", filenames: ["readonly-version-diff"], source: "/api/data/version-diff",
    missing: "Resolved: readonly-diff-material-1 binds both verified source archives, exact scanned result page, source/code archive and source-backed:readonly-diff-1 completed result; readonly-diff-consumer-1 replays the actual projection.",
    projection: "Preserved fields order; from/to/kind/domain/field/counts/group content hashes and retained approval/history disclosures." },
  { key: "affected-analyses", filenames: ["affected-archived-analyses"], source: "/api/data/version-diff",
    missing: "Resolved: same retained readonly producer binds exact from/to archives, source/code, scan query/cursor/page and verified referenced result archives; readonly-diff-consumer-1 preserves the affected-analyses projection.",
    projection: "Preserved affectedAnalyses order; exact result/manifest/scenario/date/relation/historical class; paginated scan caveat, not exhaustive impact." },
  { key: "regional", filenames: ["legacy-global-intensity-counterfactual"], source: "/api/projection/regions",
    missing: "Regional intensity snapshot confirmation is not a retained counterfactual-result/material/code/model binding; external-current intensity cannot stand in for selected archived intensity.",
    projection: "Preserved regional order; warming/reduction/intensity/basis/fixed-5gt definition and conditional claim; not regional contributions." },
  { key: "sensitivity", filenames: ["indicator-sensitivity"], source: "/api/projection/sensitivity",
    missing: "Whole sensitivity response has no retained completed-result/material/code/model binding including each shock and shared baseline.",
    projection: "All native results in native order, not chart top ten; row baseline or shared baseline and lower/upper scenario medians, not probability quantiles." },
  { key: "temperature", filenames: ["temperature-distribution"], source: "/api/projection",
    missing: "Whole projection response has no retained completed-result/material/code/model binding including simulation inputs/seed; detached pdf is not a producer parent.",
    projection: "Every native PDF point in native order, not chart probability>0.001 filter; temperature degrees C and probability density per degree C." },
  { key: "threshold-diagnostic", filenames: ["selected-2024-five-percent-diagnostic-v2"], source: "multiple selected diagnostic parents",
    missing: "Detached diagnostic arrays and UI context labels lack their whole parent response bindings and exact per-record parent path; baselineEvidenceId alone is not producer attestation.",
    projection: "Preserved diagnostics order; thresholdExportRow; selected baseline and crossing rule, explicit nulls; context is display metadata only." },
  { key: "indicator-detail", filenames: ["indicator-time-series-<registered-key>"], source: "/api/data/indicator/:key",
    missing: "Whole selected indicator-detail response has no retained effective-series/source-release/proposal/code producer binding; dynamic key and presentation definition are not provenance.",
    projection: "Preserved series order; year/native-unit value/nowcast type/source/method/asOfDate; missing date text empty, unavailable value blank." },
  { key: "news-volume", filenames: ["weekly-news-volume"], source: "/api/news/climate",
    missing: "Whole news response has no retained provider-release/query-window/code producer binding; mutable provider/cache result is not a material archive.",
    projection: "Daily dates bucketed via local Sunday setDate/getDay then ISO day; summed provider counts; ISO week keys ascending." },
  { key: "news-sentiment-trend", filenames: ["monthly-sentiment-trend"], source: "/api/news/climate",
    missing: "Whole news response has no retained provider-release/query-window/sampling/code producer binding for sampled means and allocated monthly classifications.",
    projection: "Preserved monthly sentiment order; sampled mean or pooled fallback, allocated positive/neutral/negative estimates and provider total." },
  { key: "news-sentiment-breakdown", filenames: ["monthly-sentiment-breakdown"], source: "/api/news/climate",
    missing: "Whole news response has no retained provider-release/query-window/sampling/code producer binding for classification allocation and denominators.",
    projection: "Preserved monthly order; Math.round(classCount/total*100), nonpositive total produces null, not zero." },
  { key: "news-topic", filenames: ["coverage-by-topic"], source: "/api/news/climate",
    missing: "Whole news response has no retained provider-release/query-window/topic-matching/code producer binding; extrapolated counts with 5-percent floor are not observed classifications.",
    projection: "Preserved topicBreakdown order; topic/count/avgSentiment; extrapolation and pooled fallback remain conditional claims." },
] as const;

export type RemainingExportKey = typeof remainingExportContracts[number]["key"];
export function remainingExportState(key: RemainingExportKey) {
  return key === "version-diff" || key === "affected-analyses" ? "closed" : "unimplemented";
}

/** Matching is exact or belongs to a finite UI parameter domain. A filename
 * never grants provenance: it can only select a mandatory refusal contract. */
export function remainingExportContract(filename: string) {
  const name = filename.replace(/\.xlsx$/, "");
  return remainingExportContracts.find(contract =>
    (contract.filenames as readonly string[]).includes(name) ||
    contract.key === "company-coverage" && /^company-coverage-\d{4}-\d{2}-\d{2}\.json$/.test(name) ||
    contract.key === "native-trajectory" && /^native-emissions-/.test(name) ||
    contract.key === "category-trends" && /^category-trends-/.test(name) ||
    contract.key === "historical-trend" && /^historical-trend-/.test(name) ||
    contract.key === "indicator-detail" && /^indicator-time-series-/.test(name));
}

