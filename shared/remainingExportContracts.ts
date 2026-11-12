/** The finite NON-signal browser consumers in methodologyDownloadCensus.
 *
 * Finite prospective implementations now cover every listed consumer.
 * Runtime claims remain conditional on actual source/material persistence,
 * closed replay and consumed response-object binding, never a registry flag.
 * This inventory never disables an existing download. In particular an approved indicator
 * hash, a source ID embedded in a report, or a UI selection is not a retained
 * material/model/code/completed-response binding. Keep each refusal local to
 * the actual missing parent; do not borrow the valuation producer namespace.
 */
export const remainingExportContracts = [
  { key: "category-scenarios", filenames: ["category-scenario-analysis"], source: "/api/projection/categories",
    missing: "Resolved prospectively: whole category producer, effective history/approved records, code/model/seeded execution and exact projection retained and replayed; storage outage stays honestly unbound.",
    projection: "Preserved category order; categoryName, temperatureRise, reductionRate and legacy fixed-5gt positive-residual year; threshold year nullable and missing status withheld. Neither residual diagnostic is net zero." },
  { key: "category-trends", filenames: ["category-trends-temperature", "category-trends-reductionRate", "category-trends-legacy-fixed-5gt-v1"], source: "/api/projection/categories/historical-trend",
    missing: "Resolved prospectively: whole category-history/material/code/model replay, all three finite metrics and nowcast bridge previews; history labels alone never attest provenance.",
    projection: "Preserved year order; seven finite category columns and selected median/reductionRate/legacy fixed-5gt positive-residual year; exact historical labels and explicit nowcast flag. Neither residual diagnostic is net zero." },
  { key: "company-coverage", filenames: ["company-coverage-YYYY-MM-DD.json"], source: "/api/calculation/company-coverage",
    missing: "Resolved prospectively: full repeatable-read workbook/day and review/source journal material, exact safe coverage algorithm/code/query/cutoff and report retained; lossless JSON inherits only consumed proof.",
    projection: "Lossless validated company-coverage-1 report JSON, with baseline/no-overlay restriction; no spreadsheet projection." },
  { key: "native-thresholds", filenames: ["native-mass-five-percent-2024-diagnostics"], source: "/api/emissions/candidate",
    missing: "Resolved: native-candidate-inputs/material-1 captures actual inventory and dated effective inputs; native candidate engine/model and deterministic seed/member contract, source archive and completed response verified before binding. native-candidate-consumer-1 replays exact threshold rows.",
    projection: "Preserved residual record order; thresholdExportRow plus native Gas and Region; no gas conversion or baseline borrowing." },
  { key: "native-trajectory", filenames: ["native-emissions-constant", "native-emissions-transition", "native-emissions-dashboard"], source: "/api/emissions/candidate",
    missing: "Resolved: exact native candidate selected scenario, native inventory/effective dated inputs, engine/model/code, deterministic no-random seed/member and completed response are retained and verified; native-candidate-consumer-1 projects every native trajectory row.",
    projection: "Preserved trajectory order; nativeExportColumns finite native species and sector paths; nonfinite/missing cells null, not zero." },
  { key: "emissions", filenames: ["global-emissions-trajectory"], source: "/api/projection",
    missing: "Resolved prospectively: full projection/effective inputs/approved source records/seeds/model/code/query retained and replayed; original detached trajectory links by object identity, clones cannot inherit proof.",
    projection: "All trajectory years in native order, not chart's every-second-point sampling; year and p10/p50/p90 annual conditional GtCO2e." },
  { key: "historical-trend", filenames: ["historical-trend-temperature", "historical-trend-reductionRate", "historical-trend-netZero"], source: "/api/projection/historical-trend",
    missing: "Resolved prospectively: whole history recalculation/effective inputs/model/code retained and replayed; exact metric/nowcast bridge projection, not original-vintage attestation.",
    projection: "Preserved observation order; all temperature/reduction/fixed-5gt/5-percent fields regardless displayed metric; exact historical labels and nowcast flag." },
  { key: "indicator-cards", filenames: ["climate-indicators"], source: "/api/indicators/historical",
    missing: "Resolved prospectively: full effective history/approved source records/code/result retained; all22 native-unit columns and original sparkline bridges replayed.",
    projection: "Preserved native year order; finite indicator dictionary keys in native numeric units; no display percent multiplication." },
  { key: "version-diff", filenames: ["readonly-version-diff"], source: "/api/data/version-diff",
    missing: "Resolved: readonly-diff-material-1 binds both verified source archives, exact scanned result page, source/code archive and source-backed:readonly-diff-1 completed result; readonly-diff-consumer-1 replays the actual projection.",
    projection: "Preserved fields order; from/to/kind/domain/field/counts/group content hashes and retained approval/history disclosures." },
  { key: "affected-analyses", filenames: ["affected-archived-analyses"], source: "/api/data/version-diff",
    missing: "Resolved: same retained readonly producer binds exact from/to archives, source/code, scan query/cursor/page and verified referenced result archives; readonly-diff-consumer-1 preserves the affected-analyses projection.",
    projection: "Preserved affectedAnalyses order; exact result/manifest/scenario/date/relation/historical class; paginated scan caveat, not exhaustive impact." },
  { key: "regional", filenames: ["legacy-global-intensity-counterfactual"], source: "/api/projection/regions",
    missing: "Resolved prospectively: actual selected/current resolved intensity release, full effective historical inputs and seeded legacy engine/code/model/completed counterfactual replayed; archived/current and PPP/nominal bases remain distinct.",
    projection: "Preserved regional order; warming/reduction/intensity/basis/fixed-5gt definition and conditional claim; not regional contributions." },
  { key: "sensitivity", filenames: ["indicator-sensitivity"], source: "/api/projection/sensitivity",
    missing: "Resolved prospectively: whole effective-input sensitivity baseline/shocks/model/code/result retained and replayed; all native exports versus first-ten chart/offsets remain distinct.",
    projection: "All native results in native order, not chart top ten; row baseline or shared baseline and lower/upper scenario medians, not probability quantiles." },
  { key: "temperature", filenames: ["temperature-distribution"], source: "/api/projection",
    missing: "Resolved prospectively: full projection/effective inputs/seeds/model/code/query retained; original PDF object links to whole parent, all export points remain distinct from density>0.001 chart.",
    projection: "Every native PDF point in native order, not chart probability>0.001 filter; temperature degrees C and probability density per degree C." },
  { key: "threshold-diagnostic", filenames: ["selected-2024-five-percent-diagnostic-v2"], source: "multiple selected diagnostic parents",
    missing: "Resolved prospectively: original diagnostic objects link exact retained whole-parent property/index paths; context labels remain captured UI presentation, never provenance; mixed bound/unbound collections refuse bound claims.",
    projection: "Preserved diagnostics order; thresholdExportRow; selected baseline and crossing rule, explicit nulls; context is display metadata only." },
  { key: "indicator-detail", filenames: ["indicator-time-series-<registered-key>"], source: "/api/data/indicator/:key",
    missing: "Resolved prospectively: full actual effective history/approved source metadata/selected definition/proposal release/query/code retained; all22 finite keys replayed without promoting proposals or original-vintage labels.",
    projection: "Preserved series order; year/native-unit value/nowcast type/source/method/asOfDate; missing date text empty, unavailable value blank." },
  { key: "news-volume", filenames: ["weekly-news-volume"], source: "/api/news/climate",
    missing: "Resolved prospectively: whole consumed provider-derived volume/sample cache release, collection time/window/query time/code retained; original upstream response/request ID unavailable is explicit; browser Sunday timezone captured separately.",
    projection: "Daily dates bucketed via local Sunday setDate/getDay then ISO day; summed provider counts; ISO week keys ascending." },
  { key: "news-sentiment-trend", filenames: ["monthly-sentiment-trend"], source: "/api/news/climate",
    missing: "Resolved prospectively: same whole retained news release and exact pooled-ratio/fallback/rounding algorithm; counts remain allocated estimates, never population classifications.",
    projection: "Preserved monthly sentiment order; sampled mean or pooled fallback, allocated positive/neutral/negative estimates and provider total." },
  { key: "news-sentiment-breakdown", filenames: ["monthly-sentiment-breakdown"], source: "/api/news/climate",
    missing: "Resolved prospectively: same whole retained news release; rounded class shares divide reported volume total, not sum allocated classes; zero denominator remains null.",
    projection: "Preserved monthly order; Math.round(classCount/total*100), nonpositive total produces null, not zero." },
  { key: "news-topic", filenames: ["coverage-by-topic"], source: "/api/news/climate",
    missing: "Resolved prospectively: same whole retained news release; exact nonexclusive title-keyword match, 5-percent floor, rounded extrapolation and sampled/pooled sentiment fallback; not observed topic counts.",
    projection: "Preserved topicBreakdown order; topic/count/avgSentiment; extrapolation and pooled fallback remain conditional claims." },
] as const;

export type RemainingExportKey = typeof remainingExportContracts[number]["key"];
export function remainingExportState(key: RemainingExportKey) {
  if (!remainingExportContracts.some(contract => contract.key === key)) throw new Error("Unknown finite export contract");
  return "closed";
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

