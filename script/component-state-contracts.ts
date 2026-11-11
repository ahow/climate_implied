/**
 * Reviewed engineering policies keyed to REAL source files/components. The census
 * supplies every dynamic expression/guard/path, not invented field registry slots.
 * "Inherited" means a parent read/prop contract, not a newly tested branch.
 */
type Policy = {
  inputKind: "queried-evidence" | "supplied-result" | "presentation-control" | "pinned-reference";
  missing: string; null: string; refusal: string; loading: string; error: string;
  selection: string; zero: string; scope: string;
};
const props = (missing: string, extra: Partial<Policy> = {}): Policy => ({
  inputKind: "supplied-result",
  missing, null: missing, refusal: "No scientific or market-identification inference from a missing diagnostic.",
  loading: "isLoading prop renders skeleton; query state is owned by the route parent.",
  error: "Parent route owns failed-read reason; this prop-only component does not fetch.",
  selection: "Replaced props are authoritative; no local prior-result cache.", zero: "Finite numeric zero is data, not absence.",
  scope: "Presentation of supplied diagnostics only; exports retain evidence class and nulls.", ...extra,
});
const query = (missing: string, extra: Partial<Policy> = {}): Policy => ({
  inputKind: "queried-evidence",
  missing, null: missing, refusal: "Service-provided refusal/limitations are displayed, without model or approval promotion.",
  loading: "useReadQuery withholds retained data on actual pending reads; server-only optimistic observer fetching does not erase an idle ready cache.",
  error: "useReadQuery withholds retained success; component shows the named read failure and read-only retry.",
  selection: "Current query key owns selection identity; no current-data or previous-selection substitution.",
  zero: "Finite numeric zero is retained; missing booleans are not false.",
  scope: "Read-only public/provenance presentation; no private source bytes or mutations.", ...extra,
});
const controls = (scope: string): Policy => ({
  inputKind: "presentation-control",
  missing: "No analytical result fields consumed.", null: "No analytical result fields consumed.",
  refusal: "Control state cannot establish scientific readiness.",
  loading: "Only control/presentation state, not an analytical result request.",
  error: "Only control/presentation state; no numeric fallback.",
  selection: "Changes presentation/control value; it is not a result.", zero: "Not a numeric result consumer.", scope,
});
export const filePolicies: Record<string, Policy> = {
  "analysis-selection.tsx": query("Unprovisioned/empty archive inventory is explicit; invalid saved IDs require reset.", {
    loading: "useReadQuery suppresses prior inventory options while pending; loading is explicit. Apply is busy/disabled during verification.",
    error: "Inventory errors and apply-verification errors are explicit. Failed verification leaves current selection unchanged.",
    selection: "Verifies workbook/indicator and optional overlay/regional response headers before session selection and full reload; fresh cache prevents late prior-request reuse.",
    scope: "Archive identifiers and availability only, never archive bytes. Current news/provider/review records remain current.",
  }),
  "analysis-snapshot-status.tsx": query("Not-provisioned status, missing archive inventory and missing preview counts/headers have distinct messages.", {
    null: "Null/missing/nonfinite company/observation counts mean unavailable, not zero. Null date means not supplied; invalid date explicitly labeled. Missing overlay flag is unavailable, not No. Null preview has no current fallback.",
    error: "Malformed inventory page/items/identity records and failed reads render inventory-specific failure; no retained choices or preview fallback.",
    selection: "Workbook-only inventory gates the preview query key. Missing selected baseline disables preview. Mismatched returned IDs are explicitly flagged; current implementation shows labeled returned values, not verified selected values.",
  }),
  "app-sidebar.tsx": controls("Navigation labels/href and active route only."),
  "backtest-summary.tsx": props("No result and incomplete calibration summary have separate messages; missing accounting fields remain unavailable.", {
    null: "Null accounting/cumulative values are not coerced to zero or −100% return.",
    error: "Explicit error prop displays its refusal message, ahead of retained data.",
    loading: "Route parent owns pending-read suppression; absent data displays no-current-selection result.",
    refusal: "Warnings and non-tolerance calibration statuses are shown; no target-TE guarantee.",
  }),
  "category-comparison.tsx": props("Empty scenarios have a named absence; partial temperature/reduction fields show unavailable and incomplete-input reason.", { null: "Null fixed-5gt year is right-censored; omitted year is unavailable. Selected-2024 threshold is displayed separately." }),
  "category-filter.tsx": controls("Category selection forwarded to parent query; no result values."),
  "category-trend-chart.tsx": props("Empty trends have a named absence. Missing category cells have a named reason and remain blank gaps; no borrowed category values.", { null: "Null/absent category cells and threshold years remain gaps, not a year zero or fixed-5gt replacement." }),
  "company-conditional-summary.tsx": query("No published public aggregates and no selected issuer summary are distinct branches.", {
    missing: "Missing company metadata, facts/disclosure arrays, fact value/classification/unit/formula/boundary/locator each has a named reason. Incomplete selected company disables export links; no other issuer is substituted.",
    null: "Explicit null fact value is Unknown (null); omitted/non-finite value is unavailable. Missing disclosure array differs from empty disclosure list.",
    loading: "useReadQuery withholds prior complete company/facts/export links during actual pending read.",
    error: "Service/content-type/envelope/duplicate-or-unknown-issuer refusal shows no-source-substitution message; retained data and links are withheld.",
    selection: "Issuer selection changes public frozen snapshot presentation only; archive selection does not rewrite these public aggregates.",
    zero: "Hardcoded 0/3 qualified is a fixed non-promotion disclosure, not inferred missing numeric output.",
    scope: "Public metadata/aggregate fields only; unknown private keys never rendered. No runtime private/source file reads, aggregate recomputation or approval promotion.",
  }),
  "company-coverage.tsx": query("Strict coverage JSON validator refuses malformed/incomplete reports.", {
    null: "Null share means unavailable (no denominator); true zero share renders 0.00%.",
    refusal: "Baseline-only coverage rejects active overlays; response sourceId must match selected workbook.",
    selection: "Observation-date query key and selected workbook source confirmation; no zero-coverage inference from errors.",
    scope: "Whole-workbook coverage denominators, known-value exclusions, null/missing/conflicted/invalid counts, separate HQ/operating shares; validated complete JSON export only.",
  }),
  "company-operating-review.tsx": query("No packets is distinct from a partial packet missing source IDs, gap details, identity, decision or eligibility.", {
    null: "Null decision date means no decision; missing eligibility is unavailable, never Not executable.",
    refusal: "Remaining gap reasons are shown; conditional execution eligibility is not scientific acceptance.",
    selection: "Current review inventory only. No issuer approval/editing on this screen.",
  }),
  "download-data-button.tsx": props("Empty/invalid rows disable or refuse export rather than fabricating a workbook.", {
    loading: "Export preparation state belongs to the button; it does not fetch analytical results.",
    error: "Lazy rows() executes inside the actual export try/catch; builder refusal and empty result have explicit no-completed-download errors and reset busy. JSON validator refusal allocates no URL.",
    null: "Null cells preserved; validators enforce schema-specific finite numeric/nullable requirements.",
    selection: "Download uses only current supplied rows/payload; interpretation and evidence class travel with export.",
    scope: "Client artifact writer, not publication, approval, server write or source-byte escape hatch.",
  }),
  "driver-evidence-disclosure.tsx": query("Missing/malformed indicator array or IDs refused; partial definition/publisher/rawUnit/role/evidenceState/reason are unavailable. Missing status is named. Full coverage requires actual 22 registered IDs, not 22 unknown unique IDs.", {
    refusal: "Reported role/reason/evidence state does not establish calibration or central eligibility.",
    zero: "Zero returned records is an empty registry, not zero indicator values.",
  }),
  "emissions-candidate-review.tsx": query("Empty scenario trajectory, absent residual diagnostics and incomplete readiness details have distinct reasons.", {
    null: "Missing milestone emissions are Not available, not zero. Strict residual schema rejects malformed supplied diagnostics.",
    refusal: "Candidate remains uncalibrated; supplied missing-calibration reasons are displayed. Published CAT references stay independent.",
    selection: "Scenario is in query URL/key. Pending/error suppress prior scenario data; archive inputs use analysisFetch provenance.",
  }),
  "emissions-chart.tsx": props("Empty supplied trajectory has a selected-trajectory absence message; no headline anchor substituted.", { scope: "Legacy aggregate CO2e trajectory only; not native species mass or calibrated forecast uncertainty." }),
  "financial-provider-status.tsx": query("Absent configuration/state/quote price/timestamp are explicitly unavailable, not false, verified, zero or epoch.", {
    null: "Null quote price/time stay unavailable. Explicit zero price/time remain numeric observations; nullable metadata says Not available.",
    refusal: "Checking/not-configured/error states never imply verified access; verified access is not approved model-input status.",
    selection: "Current saved startup diagnostic, independent of archived analysis. Reload is GET only, not provider refresh.",
  }),
  "financial-review.tsx": query("Absent inventory is not an empty queue; missing nested identity/quote/statement/calculation refuses snapshot interpretation.", {
    null: "Null/missing ratio has supplied refusal reason or no-ratio reason. Numeric zero is preserved.",
    refusal: "Readiness missing checks/boolean outcome is unavailable, not disabled/not-passed. Empty checks cannot establish readiness. Missing limitations cannot establish validity.",
    selection: "Current saved financial reviews/readiness only; separate from historical workbook and operator approvals.",
  }),
  "historical-trend-chart.tsx": props("Empty recalculation observations are explicit; missing dates never display undefined.", {
    null: "Selected-2024 threshold null remains withheld/censored per status; no fixed-5gt substitution.",
    scope: "Revised-history recalculation, not original-vintage forecast validation; nowcasts are separately marked.",
  }),
  "indicator-cards.tsx": props("Latest missing field displays Unavailable; missing/zero first denominator yields Change unavailable.", {
    null: "Latest null field is not backfilled from older year. Finite zero latest value is retained.",
    missing: "Empty history has explicit no-values/no-date-range reason; omitted years are unavailable, never default 2010/2024. Latest missing field is not backfilled.",
    scope: "Source/estimate/nowcast interpretation retained, not causal indicator efficacy.",
  }),
  "metric-toggle.tsx": controls("Metric display toggle only; legacy comparator remains separate from selected-2024 threshold."),
  "operator-only-notice.tsx": controls("Static operator boundary/help disclosure; not an analytical result."),
  "publication-methodology-notes.tsx": controls("Published API-contract instructions and caveats; not dynamic scientific evidence."),
  "published-scenario-references.tsx": query("Incomplete/invalid published reference rejected in entirety: no reference values shown.", {
    refusal: "Strict complete reference metadata/scenarios/milestones required. External references do not validate dashboard candidate.",
    selection: "Pinned independent publication, not selected analysis archive or legacy recalculation.",
    scope: "Published CAT medians/ranges and source/licence metadata only; no central model promotion.",
  }),
  "query-read-errors.tsx": query("No active failed queries means no error banner.", {
    loading: "Does not render result data; named active failed reads only.",
    error: "Lists active failed endpoint prefixes; retries reads only.",
    selection: "Inactive old-selection failures are excluded; prefix-filtered active errors only.",
    zero: "No numeric results consumed.",
  }),
  "read-result-reason.tsx": props("Named emptyReason describes the specific missing result; no generic numeric substitution.", {
    loading: "Loading current selection explicitly withholds previous results.",
    error: "Error takes precedence and explicitly withholds previous result.",
    selection: "Parent supplies current-query availability and reason; zero availability is tested via non-null check.",
  }),
  "regional-comparison.tsx": props("Empty regional results and incomplete per-region inputs have named reasons.", {
    null: "Null fixed-5gt year is not reached by horizon; omitted is unavailable. Missing temperature/reduction/intensity fields never toFixed-crash.",
    scope: "Legacy global intensity counterfactual, not regional warming or source-evidenced regional inventory.",
  }),
  "sensitivity-chart.tsx": props("Empty sensitivity and incomplete baseline/ranges are withheld; no 2.7°C default.", {
    scope: "Conditional legacy sensitivity only. Active tooltip missing payload has named reason; label/category/baseline/low/high/range each independently unavailable. Actual zero baseline remains 0.00°C, never default 2.7.",
  }),
  "target-input-disclosure.tsx": query("Missing qualifiedFields/target subset explicitly unavailable; no target values inferred.", {
    refusal: "Input semantics registry is not reviewed targets or original-vintage/scientific acceptance.",
    zero: "No company target numeric result values consumed; formula examples are static definitions.",
  }),
  "temperature-gauge.tsx": props("Missing temperature distribution refuses gauge. Missing reductionRate is unavailable, not zero.", {
    null: "Explicit null fixed-5gt year means no crossing; omitted means unavailable. Selected-2024 threshold is separate and never borrowed.",
    scope: "Opt-in unsupported legacy diagnostic; no standalone market or physical forecast claim.",
  }),
  "temperature-histogram.tsx": props("Empty PDF explicitly unavailable. Missing median/P10/P90 are independently named unavailable even when supplied PDF exists; true zero quantiles retained.", { scope: "Legacy model-conditional density, not calibrated forecast uncertainty." }),
  "theme-provider.tsx": controls("Theme/context preference only; no analytical results."),
  "theme-toggle.tsx": controls("Light/dark control only; no analytical results."),
  "threshold-diagnostic-details.tsx": props("Null diagnostic is Withheld — 2024 baseline unavailable; no threshold download.", {
    null: "Diagnostic baseline/threshold nulls remain withheld; never borrow legacy fixed-5gt or another trajectory's baseline.",
    refusal: "Supplied diagnostic reason is displayed; positive residual is not net zero.",
    scope: "Selected-2024 threshold/native lineage stays separate from legacy fixed-5gt comparator.",
  }),
  "warming-validation-reference.tsx": {
    inputKind: "pinned-reference",
    missing: "Complete recursively frozen shared reference is imported, not supplied by a query or optional prop. Missing semantic IDs throw; no fabricated absent-data or backfill branch is claimed.",
    null: "Source publicationDate is explicitly null and rendered as publication day unknown; metadata creation/retrieval dates are not substituted. Headline export decadal bounds remain null, not borrowed headline uncertainty.",
    refusal: "Reference-only/no-offset/no-calculation/no-model-acceptance qualification is adjacent. Literal1.37 is the2025 SR1.5 trend endpoint, not ordinary Annual1.38 or a replacement physical constant.",
    loading: "No asynchronous read or loading state: local pinned shared reference renders immediately. No pending-read branch or retained-query-data behavior is claimed.",
    error: "No network read/error state or silent numeric fallback. Unknown shared semantic IDs fail explicitly; rendering depends on the complete fixed reference contract.",
    selection: "No selectable year/issuer/archive/model props or query key. Reference2025headline,2016–2025decade and2024inventory remain separate; archive selection cannot rewrite them.",
    zero: "Published nonzero constants are formatted directly; zero is not used as a missing-data default. No hypothetical zero-input branch is claimed for this immutable reference.",
    scope: "Dated human-induced GMST reference plus exact source/date/licence metadata; local JSON data URI uses the same shared export document as GET export. Direct SSR/download decoding is evidence, not browser-click coverage or scientific acceptance.",
  },
  "climate-valuation.tsx": props("Page-level summary/group absent states are independent of public conditional aggregates.", {
    missing: "Summary count missing/invalid has named count-not-returned reason. Partial imputation total/fraction/count remains unavailable. Malformed group collections are refused per section. Missing P/E stays blank, not null→zero; invalid-date rows are withheld with a reason.",
    null: "Null P/E is unavailable, not zero. True finite P/E/count zero remains numeric. Null/missing/invalid source dates never coerce to Unix epoch: those rows cannot reach dated charts or exports. Four physical measures remain explicitly withheld.",
    loading: "useReadQuery suppresses previous response. AnalysisSection empties chart/export rows while pending; current export is disabled.",
    error: "Named summary/section failure; AnalysisSection has no previous values or export rows.",
    selection: "Cost-of-equity/scoring/dataset/archive selection parameterize company diagnostics; public conditional summaries remain independent.",
    scope: "Descriptive P/E and explicit public aggregate surfaces only; no invented earned Tier2 or efficacy outputs.",
  }),
  "dashboard.tsx": query("Indicator absent/error is explicit; legacy opt-in projection requires returned distribution/metrics.", {
    null: "Missing reductionRate never becomes zero; omitted fixed-5gt year never becomes not-reached.",
    selection: "Active category parameterizes legacy projection URL; scenario child owns its own query; no stale pending/error display.",
    scope: "Published references, uncalibrated candidate and opt-in unsupported legacy are independent surfaces.",
  }),
  "data-management.tsx": query("Missing indicator list/pending counts/history have separate reasons; no detail response is not perpetual loading.", {
    null: "Applied value/series tooltip null is unavailable, not zero. Missing baseline stays absent. Null/malformed definition or series blocks unlabeled/unproven downloads.",
    refusal: "Persisted summary interpretation depends on source manifest evidence. Unverified legacy raw summary is labeled, not promoted.",
    selection: "Indicator detail key owns dialog read; prior indicator series is not retained during pending/error; current review records are not archive replay.",
    scope: "Read-only operator evidence. Direct state-gate/tooltip tests and separate component-portal-followup-evidence.json cover portal/focus/current-read/zero-source hover; neither asserts every field permutation.",
  }),
  "decarb-gap-signal.tsx": query("Group denominators, absent summary count, absent subsets and unavailable backtests each have named reasons.", {
    null: "Invalid/null group P/E means unavailable; finite equal P/E gap and explicit companyCount zero remain zero. Undated source rows are omitted with a reason; latest group and affected derived-period accounting cannot backfill a date.",
    refusal: "Physical rate and physical-vs-valuation gap withheld because no valuation-to-activity mapping/comparable definitions.",
    selection: "Measure explicitly chooses its P/E field pair; missing SDG fields never fall through to present carbon/ambition fields. Current-key pending/error rows and exports cannot reuse current retained or another-geography success. Group series never substitutes physical climate measures.",
  }),
  "decarb-signal.tsx": query("Each of carbon/SDG/ambition group gaps explains missing dataset/groups/invalid P/E separately.", {
    null: "Latest-date missing series is unavailable, not backfilled from an earlier month. An undated observation withholds that group's latest headline and affected derived-period accounting; dated rows/independent groups remain available. Equal valid P/E gives real zero gap.",
    refusal: "Physical comparison withheld: no defensible valuation-to-activity mapping.",
    selection: "Scoring/geography/dataset keys own group results; pending/error never shows prior selected result.",
  }),
  "methodology.tsx": controls("Static methodological definitions/caveats, pinned WarmingValidationReference and independently queried DriverEvidenceDisclosure. Reference is not a computed result or model input. No market/Tier2/TrackB numeric results."),
  "news-sentiment.tsx": query("Missing cached response, daily volume or positive-count sentiment observations have separate reasons.", {
    null: "No sentiment denominator => no neutral mean/percentage zero; no volume observations => weekly average unavailable. True volume zero remains zero.",
    refusal: "Operator-refresh-required and provider-configuration errors are distinct; UI never makes provider refresh calls.",
    selection: "Period is query-keyed; pending period hides prior cards. News stays current, not archived-company replay.",
    scope: "Allocated/pooled sentiment estimates and topic extrapolation are disclosed; no causal market/climate inference.",
  }),
};

export const focusedRenderComponents = new Set([
  "FinancialProviderStatus", "FinancialReview", "ScientificValidation", "Snapshot",
  "CompanyOperatingReview", "ReadResultReason", "TemperatureGauge", "BacktestSummary",
  "CategoryComparison", "RegionalComparison", "SensitivityChart", "ThresholdDiagnosticDetails",
  "CategoryTrendChart",
  "CompanyConditionalSummary", "ConditionalFactRow", "DisclosureList", "ClimateValuation",
  "AnalysisSection", "SummaryCard", "ValuationPETooltip", "IndicatorDetailReadState",
  "IndicatorSeriesTooltip", "IndicatorCards", "IndicatorDetailDialog",
  "AnalysisSelectionControl", "SummaryCount", "SnapshotDate", "AnalysisSnapshotStatus", "AppSidebar",
  "CategoryFilter", "CompanyCoverage", "DownloadDataButton", "DownloadJsonButton", "DriverEvidenceDisclosure",
  "EmissionsCandidateReview", "EmissionsChart", "LoadingDetails", "HistoricalTrendChart", "MetricToggle",
  "OperatorOnlyNotice", "PublicationMethodologyNotes", "PublishedScenarioReferences", "QueryReadErrors",
  "CustomTooltip", "TargetInputDisclosure", "TemperatureHistogram", "ThemeProvider", "ThemeToggle",
  "ThresholdDiagnosticDownload", "Dashboard", "LegacyDashboard", "DataManagement", "DecarbGapSignal",
  "TimeSeriesChartTooltip", "BacktestTooltip", "DecarbSignal", "Methodology", "NewsSentiment",
  "WarmingValidationReference",
]);
const remainingCohort = new Set([
  "AnalysisSelectionControl", "SummaryCount", "SnapshotDate", "AnalysisSnapshotStatus", "AppSidebar",
  "CategoryFilter", "CompanyCoverage", "DownloadDataButton", "DownloadJsonButton", "DriverEvidenceDisclosure",
  "EmissionsCandidateReview", "EmissionsChart", "LoadingDetails", "HistoricalTrendChart", "MetricToggle",
  "OperatorOnlyNotice", "PublicationMethodologyNotes", "PublishedScenarioReferences", "QueryReadErrors",
  "CustomTooltip", "TargetInputDisclosure", "TemperatureHistogram", "ThemeProvider", "ThemeToggle",
  "ThresholdDiagnosticDownload", "Dashboard", "LegacyDashboard", "DataManagement", "DecarbGapSignal",
  "TimeSeriesChartTooltip", "BacktestTooltip", "DecarbSignal", "Methodology", "NewsSentiment",
]);
const valuationIndicatorCohort = new Set([
  "CompanyConditionalSummary", "ConditionalFactRow", "DisclosureList", "ClimateValuation",
  "AnalysisSection", "SummaryCard", "ValuationPETooltip", "IndicatorDetailReadState",
  "IndicatorSeriesTooltip", "IndicatorCards", "IndicatorDetailDialog",
]);
export function contractFor(file: string, name: string) {
  const policy = filePolicies[file.split("/").at(-1)!];
  if (!policy) throw new Error(`No reviewed state policy for actual consumer ${file}#${name}`);
  const inheritedProps = ["SummaryCount", "SnapshotDate", "Snapshot", "AnalysisSection", "SummaryCard", "DisclosureList", "ConditionalFactRow", "ValuationPETooltip", "IndicatorDetailReadState", "IndicatorSeriesTooltip", "CustomTooltip", "TimeSeriesChartTooltip", "BacktestTooltip", "ThresholdDiagnosticDownload"].includes(name);
  return {
    ...policy,
    ...(inheritedProps && !["AnalysisSection", "IndicatorDetailReadState"].includes(name) ? {
      inputKind: "supplied-result",
      loading: "Parent read/section owns loading and stale-result suppression; this child renders only supplied fields.",
      error: "Parent read/section owns failed-read reason; this child does not independently fetch.",
      selection: "Current parent-supplied item/value is authoritative; no child query or prior-selection cache.",
    } : {}),
    ...(name === "IndicatorDetailReadState" ? {
      inputKind: "supplied-result",
      loading: "Loading selected indicator skeleton only; previously supplied child details are withheld.",
      error: "Named detail read failure takes precedence, withholding prior children.",
      null: "Successful null/absent detail has named no-response/no-values reason, not indefinite loading. Invalid key/label/unit/precision or series year/value/source/method/asOfDate withholds values/downloads. Empty series differs from absent series; missing proposal history is not complete review.",
    } : {}),
    ...(name === "ClimateValuation" ? { inputKind: "queried-evidence" } : {}),
    ...(name === "IndicatorSeriesTooltip" ? {
      missing: "Inactive => no tooltip; active missing payload => no observation reason; missing value/year/unit/source/status each named. Empty or whitespace source text is explicitly Source not returned.",
      null: "actual null may use explicitly supplied estimated value; both absent remain unavailable, never zero.",
      zero: "Finite observed/estimated zero remains formatted with source/estimate qualifier.",
    } : {}),
    ...(name === "IndicatorDetailDialog" ? {
      missing: "Closed modal returns before child JSX construction. Missing/invalid/unregistered/mismatched selected definition never constructs DownloadDataButton or calls finiteExportBindings; no placeholder export key is supplied.",
      scope: "Actual modal SSR tests cover closed state and selected absent/partial/unregistered definition construction. Follow-up structural/handler tests require unconditional DialogTitle/Description, focusable card trigger restoration and genuine same-key read-only refetch. Parent browser confirmation of focus/portal warning clearance remains separate.",
    } : {}),
    ...(name === "LoadingDetails" ? {
      inputKind: "presentation-control",
      missing: "Only the parent-supplied loading label is rendered; no numeric result fields.",
      null: "No numeric result fields.",
      loading: "Accessible loading label and skeleton only; no prior result content.",
    } : {}),
    ...(["CustomTooltip", "TimeSeriesChartTooltip", "BacktestTooltip"].includes(name) && file.includes("decarb") ? {
      missing: "Inactive => no tooltip; active missing/null/nonobject series rows => explicit unavailable observation. All six real chart consumers use filterNull=false so absent rendered series receive their own named not-returned reason instead of being omitted. Missing date/name/value is explicit; zero is 0.00 pp or 0.00%, never bare %. Native nested source body is directly executed.",
      null: "Null return/gap is unavailable, not 0 pp or 0%; actual multiplier zero separately means −100% return, not missing.",
    } : {}),
    ...(name === "CustomTooltip" && file.includes("sensitivity") ? {
      missing: "Inactive has no tooltip; active absent payload has explicit sensitivity-observation-unavailable reason. Missing label/category/baseline/low/high/range has its own named reason.",
      null: "Null baseline/low/high/range is unavailable. Actual baseline zero stays 0.00°C; no default 2.7.",
    } : {}),
    ...(name === "ThresholdDiagnosticDownload" ? {
      missing: "Empty diagnostics array disables export; supplied withheld diagnostic exports its actual null year/baseline/threshold, status and reason rather than inventing a crossing.",
      null: "Null selected baseline/year and explicit withheld/right-censored status are preserved by thresholdExportRow; no fixed-5gt substitution.",
    } : {}),
    ...(["DecarbSignal", "DecarbGapSignal"].includes(name) ? {
      null: "Cumulative benchmark/portfolio null stays unavailable, never −100%. Missing activeReturn/trackingError stays unavailable, not 0%. Nonpositive benchmark withholds ratio/annualization; missing overweight/underweight counts are unavailable. Finite multiplier 1 and TE 0 preserve +0.0% / 0.00%.",
    } : {}),
    focusedEvidence: name === "WarmingValidationReference"
      ? "script/warming-validation-reference.test.ts: direct imported component SSR verifies1.37SR1.5headline,1.24[1.0–1.5]decade,2024inventory,source/date qualifications,five global field IDs and decoded local JSON equality. script/component-state-census.test.ts directly renders the61stconsumer and checks reachability/policy/finite count; old60component suites are not rerun or claimed reverified."
      : ["IndicatorDetailDialog", "IndicatorSeriesTooltip"].includes(name)
      ? "script/valuation-indicator-partial-state.test.ts plus script/indicator-portal-followup.test.ts: actual modal construction, persistent accessible header/trigger/refetch handlers and empty-source zero tooltip. Browser focus/portal follow-up remains separate."
      : remainingCohort.has(name)
      ? "script/remaining-component-contracts.test.ts: actual imported component SSR, or actual nested source body invocation for tooltips/LoadingDetails. Exact named fields/states in tests; portal/hover/archive/issuer/download interactions remain planned separately."
      : valuationIndicatorCohort.has(name)
      ? "script/valuation-indicator-partial-state.test.ts: exact nested public/valuation/modal-gate/tooltip/card cases named in focused tests; not browser interaction coverage."
      : focusedRenderComponents.has(name)
      ? "script/component-partial-state.test.ts: focused SSR assertions; exact tested states are named in test cases."
      : "Not individually rendered by the new focused SSR suite. Source guards are enumerated; existing route fixture evidence is not expanded into component/field branch coverage.",
  };
}
