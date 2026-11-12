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
  "clean-covered-panel.tsx": query("One provisional observed source reconstruction; no accepted universe, forecast or market inference.",{
    absent:"Missing source response is explicitly unavailable, never zero.",
    partial:"Native CO2 accounting remains separate from null manufacturing/Stage7 results.",
    pending:"Refetch suppresses stale report and export.",
    error:"Exact schema/source/export error; no prior result substituted.",
    selection:"Current read-only producer identity must equal complete JSON/XLSX download; no archive claim.",
    zero:"Literal reconciliation zeros retained; missing measures remain null.",
    refusal:"Source, issuer and member prerequisites remain explicit.",
  }),
  "retirement-association-panel.tsx": query("Null/absent document is unavailable; valid sourced book arithmetic is partial economic evidence, not an issuer valuation.",{
    null:"Actual retirement valuation, market-implied pace and association estimates remain explicitly null; never zero.",
    loading:"Initial/refetch states suppress prior documents and export buttons.",
    error:"Schema/read/export error displays specific reason; no fallback file or prior result.",
    selection:"Fixed read-only source report independent of historical selection; downloaded complete body must equal current producer identity.",
    zero:"Exact finite source/derived zero retained; missing cash economics never zero-filled.",
    refusal:"Missing unit cash, liability, recovery, target and association sample reasons remain explicit.",
    scope:"Public primary-filing facts/book arithmetic and unscored protocol only. Offline conditional models do not confer scientific or owner acceptance.",
  }),
  "producer-reserve-panel.tsx": query("Absent/null report has a composed unavailable state; incomplete report or prospective identity is refused by the reader, never replaced by issuer summaries.", {
    null: "Market equity target, market-implied decline and FCFE remain explicitly Unknown (null); null solve decline/residual is unavailable, not zero.",
    loading: "useProducerReserve/useReadQuery and the state gate withhold cached results and exports on initial or background pending reads; accessible skeletons identify the current read.",
    error: "Read/schema/domain/path errors withhold success and exports; the state gate shows the actual error and read-only Retry. Export failures show a local error, never a fallback file.",
    selection: "Independent of historical archive and issuer presentation; the fixed same-origin endpoint accepts no query pins or numeric overrides. Identity changes remount export state; full response JSON/XLSX equality binds downloads.",
    zero: "Literal finite zero is preserved at exact returned precision; conditional replacement/WC/terminal zeros are explicitly assumptions, not missing observations.",
    refusal: "Base and sensitivity statuses, refusal reasons and source gaps are shown. Finite disclosed-reserve PV10 is not whole equity, FCFE, market-implied decline, owner/scientific approval or three-case acceptance.",
    scope: "Read-only actual worker report and complete prospective identity; current identity sourceArtifact primaryAuthentication is explicitly separate from unchanged frozen-report declaration-time source gaps. Missing current assessment is not a completed authentication. JSON export and literal-cell XLSX readback must equal the consumed response, with no formulas, changed sources or substituted identities.",
  }),
  "location-electricity-panel.tsx": query("Absent/null document is explicitly unavailable; a valid source-findings report remains partial issuer evidence, not an absent whole report or fabricated issuer execution.", {
    null: "Actual issuer result and site MWh/supplier/tariff/recovery/payment/collection remain Unknown (null). EIA availability date null stays unknown, never a fabricated release date.",
    loading: "useLocationElectricity/useReadQuery and the state gate suppress prior source rows and downloads while initially loading or refreshing; named skeletons replace findings.",
    error: "HTTP/schema/source/count/conversion/identity errors show explicit read-only Retry and no stale report. Export errors withhold the file, not fabricate issuer output.",
    selection: "Fixed same-origin endpoint is independent of archive and issuer controls; no query pins or assumption overrides. New identity remounts local export state; exact whole-document readback binds downloads.",
    zero: "Zero assigned issuer assumptions and coverage/execution counts are literal reported counts, not assumed tariff/consumption/cash zeros; null values are never zero-filled.",
    refusal: "Operating and construction properties stay distinct; EIA industrial prices remain regional context, never applicable issuer tariffs. No qualified execution, source/science approval or historical-origin claim.",
    scope: "Actual public source projection and server unit conversion only; optional companyProjection integration is acknowledged but not claimed executed. Exact missing inputs, source provenance and complete response identity remain visible.",
  }),
  "headline-drilldown.tsx": query("Without unchanged consumed headline producer identity, the review names unavailability and never requests a substitute parent.", {
    null: "No matched response is explicitly unavailable; signed native values including zero stay data, never fabricated regional allocations.",
    loading: "useReadQuery suppresses retained drilldown rows and JSON/XLSX links during actual initial or background pending reads.",
    error: "Read, derivation-hash or exact parent/mode/filter mismatch refuses rows and downloads; no current-input or other-manifest fallback.",
    selection: "Parent result key remounts controls; mode/year/sector/gas/driver form the exact query and download selection. Browser verifies derived content hash and complete parent identity.",
    zero: "Signed source-cell zero renders with toPrecision(8); negative land remains signed, not clipped or treated as missing.",
    refusal: "Global-only source account explicitly refuses inferred six-region/transport allocations. Contributions and nonadditive one-at-a-time sensitivities stay distinct.",
    scope: "Read-only retained native-parent derivation; no producer relabelling or scientific promotion. Exact JSON/XLSX are separate manifest-qualified attachments.",
  }),
  "retained-paired-research.tsx": query("Missing/invalid catalog or report has an explicit reason; valid empty authorized catalog is a publication gap, not a zero result.", {
    null: "Null origin cutoff/execution/end dates render Unavailable (null), not inferred dates. Unavailable sections retain their exact reasons.",
    loading: "Catalog and selected report loading suppress retained report content; accessible skeletons name the current read.",
    error: "Catalog/report errors win over retained success; retries are read-only and malformed or identity-mismatched results are withheld.",
    selection: "No automatic report selection. Eight exact SHA256 pins bind the reader URL, headers and verified report/origin/source/code content; changed selection never substitutes latest.",
    zero: "Finite metric zero and origin/training/evaluation count zero render literally; missing metrics are unavailable, not zero efficacy.",
    refusal: "Scientific acceptance, investment evidence and authenticity remain false. Engineering fixtures stay synthetic; Track A, Track B and prospective evidence remain separate.",
    scope: "Read-only public authorized projection on /decarb-gap; no private archive, publication control, recomputation or export. Prop children inherit validated parent result.",
  }),
  "scientific-evidence-strands.tsx": {
    inputKind: "pinned-reference",
    missing: "Shared program-level strand defaults are explicit imported evidence policy, not substitutes for submitted analytical inputs.",
    null: "Strand status/reason strings are rendered directly; no scientific result or missing observation is converted to zero.",
    refusal: "The three strands remain separate; diagnostic passes cannot change readiness gates or establish independent acceptance.",
    loading: "Synchronous supplied/shared evidence object; asynchronous financial-review loading belongs to its existing parent.",
    error: "No independent query in this component; parent financial-review read failure still withholds its supplied evidence.",
    selection: "Program-level policy does not certify caller-selected inputs, model output, vintage or source rights.",
    zero: "No numeric analytical result is consumed; statuses are not converted to booleans or readiness scores.",
    scope: "Direct SSR evidence in script/scientific-strands-warning.test.ts renders physical response, Stage9 skill and scenario interpretation independently.",
  },
  "registry-methodology.tsx": {
    inputKind: "pinned-reference",
    missing: "Synchronous checked-in definition registry, not caller-supplied analytical result rows; no fabricated source values.",
    null: "Registry strings are rendered verbatim; no unavailable analytical values are coerced to zero or assigned a vintage.",
    refusal: "Definitions explicitly do not establish scientific acceptance; historical declarations alone do not authenticate vintage.",
    loading: "Synchronous imported registries only; no asynchronous loading branch or previous selection cache exists.",
    error: "No independent network read in the card; the linked API is a separate read-only public definition endpoint.",
    selection: "No source selection, provider refresh or model rerun; exact current registry definitions are displayed.",
    zero: "Definition prose is rendered verbatim; numeric model results and their zero/missing branches are not consumed.",
    scope: "Registry-driven methodology, exact formulas/units/source/as-of/missingness/uncertainty and three separate scientific strands; direct SSR test, not browser interaction coverage.",
  },
  "carbon-pass-through-review.tsx": props("No caller-supplied analytical values: source-qualified evidence comes from the checked-in factual register; missing issuer inputs remain listed, never default coefficients.", {
    inputKind: "pinned-reference",
    null: "No nullable result props or substitute issuer outputs. Lower-bound-only evidence stays a strict bound; log-price elasticity is explicitly not a recovery ratio.",
    loading: "Synchronous imported factual register, not an asynchronous request; no loading branch or fabricated pending output.",
    error: "No independent API query in this card. Public export is a separate endpoint; failed endpoint reads cannot establish a coefficient or source approval.",
    selection: "No local selection or provider refresh; imported source identities/versions and remaining issuer requirements are displayed unchanged.",
    zero: "Fixed 0 qualified cases is an explicit non-admission disclosure, not measured zero pass-through or evidence of no exposure.",
    refusal: "Historical price ratios, omitted-sample spans and elasticities never establish issuer profit/cash or universal causal pass-through; no issuer assumption is admitted.",
    scope: "Static public source-qualified factual register, with PDF identities/rights and actual remaining issuer inputs. Not a coefficient control or an approval.",
  }),
  "qualified-missingness-review.tsx": query("Unidentified/malformed review envelopes, unknown source states and missing arrays/refusal details are explicit unavailable; valid empty review history differs from unavailable cells.", {
    null: "Null source measurement is never zero: unavailable/not-applicable remain unmeasured, below-threshold remains a bound. Null calculated value is Withheld; exact observed zero remains data.",
    loading: "Actual initial/background reads withhold retained source cells and download links via useReadQuery; loading is named.",
    error: "Read errors take precedence over retained source evidence. Malformed, mismatched or centralModelApplied-not-false envelopes withhold all cells and exports.",
    selection: "Exact revision query key owns historical review selection; returned revision must match an explicit selection. Latest is labeled a development review, never an original publication vintage.",
    zero: "Observed/calculated numeric zero remains explicit; null source values and sampled uncertainty are never synthesized as zero.",
    refusal: "Requires development-only classification and centralModelApplied=false. Review decisions cannot imply central-model, scientific or source-vintage acceptance.",
    scope: "Mounted only when optional build env DEV is exactly true. Private development filesystem view is API-gated separately; no public write control or source-path input.",
  }),
  "readonly-version-diff.tsx": query("Initial selection has no result; explicit exact SHA identities and kind are required. Missing/null/invalid result envelopes name unavailability and withhold counts/references/downloads.", {
    null: "Null nextCursor means this result page ended, not no affected analyses elsewhere. Missing counts or arrays refuse; valid zero counts remain zero.",
    loading: "Root query withholds retained values on pending reads; the supplied-result child renders only parent-authoritative ready data.",
    error: "Named query failures withhold previous diff. Unsupported versions, inconsistent history labels, duplicate populations and malformed hashes refuse display/export.",
    selection: "Editing from/to/kind hides prior result immediately; returned source identities must match current exact selection. Page cursors do not imply a full dependency census.",
    zero: "Explicit added/removed/changed zero and zero scanned results remain data, never inferred from missing evidence or failed reads.",
    refusal: "No raw values/source excerpts/filings or approval controls. Workbook/material archive does not establish approval. Revised history is never promoted by archive date.",
    scope: "Count/hash-only diffs plus exact archived manifest references. Root idle controls and supplied-result states are SSR-tested; interactive selection/pagination browser coverage is not claimed.",
  }),
  "workbook-money-audit.tsx": query("Missing/invalid/unidentified retained audit is explicit unavailable,never0money.", {
    loading: "Initial/background pending read suppresses previous counts and all download links.",
    error: "Named source/read/integrity error wins over cached success; no private exception bytes or stale counts.",
    selection: "Full strict report SHA256 verified against HTTP header; JSON/XLSX downloads pin expectedAuditHash; changed report409,never latest fallback.",
    null: "MonetaryTotals null is intentional unknown denomination/magnitude/FX withholding,not0. All actual numeric source zeros remain separate counts.",
    zero: "Source count0 is retained; FX0 and converted0 are explicit facts,not money. Identity review1 does not approve denomination.",
    refusal: "Missing production retained catalog returns503; no public refresh,paths,USD/scale/FX defaults,private values or approvals.",
    scope: "Actual existing audit of full2442 source companies and811572 numeric cells is descriptive. Safe source counts/date windows/hash pins only. Independently reported dimensionless PE is not withheld by this monetary audit alone.",
  }),
  "stage10-financial-coverage.tsx": query("Absent/malformed retained aggregate is explicit unavailable,never zero coverage.", {
    loading: "Actual initial/background pending read hides retained values and all download links; named loading status.",
    error: "Any read failure wins over retained success; explicit error,not zero values or not-queried identities.",
    selection: "Full report is frozen before local population/field presentation filters; exact workbook/cutoff/year/inputHash download pins; changed input409,no substitute.",
    null: "Privacy-suppressed counts are labeled Suppressed; undefined/zero-denominator shares unavailable. Unknown restatement is separate,not original or0%not-restated.",
    zero: "Actual zero counts retained; zero-denominator shares remain null. Current approval is not verified immutable financial eligibility.",
    refusal: "Source/storage corruption and unsupported original vintages refuse; no provider refresh or model/corpus approval.",
    scope: "Safe aggregate only,same inputHash API/UI/JSON/XLSX. Independent five-state lifecycle×seven-state identity joint for all full/eligible companies; dated source audit and denominator version; last workbook observation never delisting. Ten field sector×region categories remain unchanged; no private IDs/provider values.",
  }),
  "track-b-research.tsx": query("Empty source-pinned catalog is explicit; absent/malformed selected report has a named absence/invalid reason, never an indefinite loader.", {
    loading: "Actual catalog/report pending read suppresses previous success and download links; each has a named loading message.",
    error: "Catalog and selected report failures take precedence over retained data; no prior values or downloads are displayed.",
    selection: "Exact protocol/report/disclosure query key plus verified browser report/domain SHA256 and server identity headers; no automatic latest/current fallback.",
    null: "Every withheld period result remains explicit unavailable(null); null source/hash references have named absence, not zero.",
    zero: "No numerical TrackB efficacy is supplied; false acceptance flags and null results are distinct, never fabricated zero returns.",
    refusal: "Publication authorization is not Stage9 authentication; actual per-period failures, source hashes and operator publication prerequisites are shown.",
    scope: "Only genuine public catalog/allowlisted report reads and exact JSON/XLSX downloads. Isolated injected SSR states are engineering tests, never real approvals.",
  }),
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
  "category-trend-chart.tsx": props("Empty trends have a named absence. Missing/inconsistent historical evidence type refuses all history/downloads. With explicit valid revised type, missing category cells remain named gaps; no borrowed values.", { null: "Null/absent category cells and threshold years remain gaps, not a year zero or fixed-5gt replacement." }),
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
    error: "Lazy rows() executes inside the actual export try/catch; builder refusal, empty result and changed/malformed click-time UI selection explicitly refuse delivery and reset busy. JSON validation/stale-selection refusal allocates no URL; a final pre-click refusal revokes any allocated URL.",
    null: "Null cells preserved; validators enforce schema-specific finite numeric/nullable requirements.",
    selection: "Rows/payload, notes, bindings and requested UI selection are deep-copied before the first await; UI selection is compared before delivery. Requested UI state is not certified producer input/model/run identity; producerIdentity stays null.",
    scope: "Client artifact writer, not publication, approval, server write or source-byte escape hatch. Actual async handler/digest/package-boundary tests in download-selection-race.test.ts verify snapshots and delivery refusal, not producer provenance.",
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
    refusal: "Missing/inconsistent historical type code or exact label withholds history and downloads; no retrospective date is relabeled as an authentic vintage.",
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
    scope: "Dated human-induced GMST reference plus exact source/date/licence metadata; API download explicitly opts in to a manifest while the legacy export document stays unchanged. Direct SSR/isolated API readback is evidence, not browser-click coverage or scientific acceptance.",
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
  "methodology.tsx": controls("Static caveats,pinned WarmingValidationReference and independently queried DriverEvidenceDisclosure/TrackBResearch/Stage10FinancialCoverage. Reference is not a computed input; research/coverage are descriptive retained structural evidence,not model approval or efficacy."),
  "news-sentiment.tsx": query("Missing cached response, daily volume or positive-count sentiment observations have separate reasons.", {
    null: "No sentiment denominator => no neutral mean/percentage zero; no volume observations => weekly average unavailable. True volume zero remains zero.",
    refusal: "Operator-refresh-required and provider-configuration errors are distinct; UI never makes provider refresh calls.",
    selection: "Period is query-keyed; pending period hides prior cards. News stays current, not archived-company replay.",
    scope: "Allocated/pooled sentiment estimates and topic extrapolation are disclosed; no causal market/climate inference.",
  }),
};

/** Finite reviewed additions, keyed by exact file AND actual declaration.
 * A newly introduced sibling is refused until separately reviewed. */
export const economicBridgeComponentPolicies: Record<string, Policy> = {
  "clean-covered-panel.tsx#CleanCoveredPanel":filePolicies["clean-covered-panel.tsx"],
  "clean-covered-panel.tsx#CleanCoveredPanelContent":{...filePolicies["clean-covered-panel.tsx"],inputKind:"supplied-result"},
  "clean-covered-panel.tsx#CleanCoveredReportView":{...filePolicies["clean-covered-panel.tsx"],inputKind:"supplied-result"},
  "retirement-association-panel.tsx#RetirementAssociationPanel": filePolicies["retirement-association-panel.tsx"],
  "retirement-association-panel.tsx#RetirementAssociationPanelContent": {
    ...filePolicies["retirement-association-panel.tsx"],inputKind:"supplied-result",
  },
  "retirement-association-panel.tsx#RetirementAssociationReportView": {
    ...filePolicies["retirement-association-panel.tsx"],inputKind:"supplied-result",
  },
  "producer-reserve-panel.tsx#ProducerReservePanel": filePolicies["producer-reserve-panel.tsx"],
  "producer-reserve-panel.tsx#ProducerReservePanelContent": {
    ...filePolicies["producer-reserve-panel.tsx"], inputKind: "supplied-result",
  },
  "producer-reserve-panel.tsx#ProducerReserveReportView": {
    ...filePolicies["producer-reserve-panel.tsx"], inputKind: "supplied-result",
    loading: "Parent current-read gate mounts this report only when ready; local downloading state disables both export buttons and labels the selected exact-readback operation.",
    error: "Parent owns report-read errors and unmounts stale content. This view catches download errors, reports refusal and offers retry without a fallback file.",
  },
  "producer-reserve-panel.tsx#ReserveLiteral": props("Undefined is explicitly not returned; unsupported/nonfinite values are unavailable. Objects and arrays recurse through supplied values, with explicit empty-array text.", {
    null: "Explicit null renders Unknown (null), distinct from undefined, finite zero and false.",
    loading: "Synchronous literal renderer; parent current-read gate owns pending suppression, not an independent request or skeleton.",
    error: "Synchronous field presentation; unsupported/nonfinite values have named unavailable text. Parent owns read/schema errors.",
    selection: "Current supplied literal is authoritative; no query, local selection, remembered values or numeric conversion.",
    zero: "Finite numeric zero renders literally, false remains false, and all finite values retain exact server numeric precision.",
    scope: "Supplied JSON presentation through block-capable containers; arrays emit ol and objects emit dl, with regression across every consumer. No calculations or export writer.",
  }),
  "producer-reserve-panel.tsx#Disclosure": controls("Native details/summary disclosure renders the parent's supplied title/children. Opening changes presentation only; no result selection, numeric input, export or data request."),
  "producer-reserve-panel.tsx#Result": props("Validated supplied solve status, reason, domain hash, roots and iteration count are displayed; no root or result is computed in this child.", {
    null: "Decline/residual null are explicitly Unknown (null); empty roots remain an empty-array disclosure, never a root at zero.",
    loading: "Parent report/state gate owns pending suppression; this synchronous solve child has no fetch, skeleton or retained result.",
    error: "Parent reader validates solve/domain consistency; this child displays the supplied refusal reason without independently fetching or repairing a solve.",
    selection: "Each parent base/sensitivity/refusal solve is authoritative; no child cache or cross-case substitution.",
    scope: "Base, sensitivity and refusal solve presentation only; unique conditional roots do not imply market identification or accepted issuer cases. Roots use a valid block-capable wrapper.",
  }),
  "location-electricity-panel.tsx#LocationElectricityPanel": filePolicies["location-electricity-panel.tsx"],
  "location-electricity-panel.tsx#LocationElectricityPanelContent": {
    ...filePolicies["location-electricity-panel.tsx"], inputKind: "supplied-result",
  },
  "location-electricity-panel.tsx#LocationElectricityReportView": {
    ...filePolicies["location-electricity-panel.tsx"], inputKind: "supplied-result",
    loading: "Parent current-read gate mounts the report only when ready. Local download checking disables both format buttons; it does not compute an issuer bridge.",
    error: "Parent handles failed report reads and withholds cached content; local export errors refuse the file and display the exact failure for retry.",
  },
  "location-electricity-panel.tsx#Source": props("Validated supplied public source identity/URL/locator/hash and dates are displayed; a missing source is a reader-contract failure, not substituted evidence.", {
    null: "Available-at null remains Unknown (null); observed capture time is not substituted as a historical availability claim.",
    loading: "Parent report gate owns source-read pending suppression; this synchronous details disclosure performs no request.",
    error: "Parent schema validates the source; no child authentication/fetch/fallback is performed. Non-HTTP URL text is not promoted to an external link.",
    selection: "Exact source attached to the current property or price row is authoritative; expanding details changes presentation only.",
    zero: "No numeric measurements are consumed; historicalOriginClaim false stays literal false, not a readiness score.",
    scope: "Public source metadata and external source link only, not new source authentication, historical-origin approval, private bytes or an export writer.",
  }),
};

export const focusedRenderComponents = new Set([
  "CleanCoveredPanel","CleanCoveredPanelContent","CleanCoveredReportView",
  "ProducerReservePanel", "ProducerReservePanelContent", "ProducerReserveReportView", "ReserveLiteral", "Disclosure", "Result",
  "RetirementAssociationPanel", "RetirementAssociationPanelContent", "RetirementAssociationReportView",
  "LocationElectricityPanel", "LocationElectricityPanelContent", "LocationElectricityReportView", "Source",
  "HeadlineDrilldownReview", "RetainedHeadlineDrilldown",
  "RetainedPairedResearch", "RetainedPairedResearchReport", "EvidenceSection", "ReportSkeleton",
  "ProducerDownloadLink",
  "ScientificEvidenceStrands",
  "RegistryMethodology",
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
  "TrackBResearch",
  "Stage10FinancialCoverage",
  "WorkbookMoneyAudit",
  "CarbonPassThroughReview", "QualifiedMissingnessReview", "ReadonlyVersionDiff", "VersionDiffResult",
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
  const basename = file.split("/").at(-1)!;
  const economicKey = `${basename}#${name}`;
  const economicFile = ["producer-reserve-panel.tsx", "location-electricity-panel.tsx","retirement-association-panel.tsx","clean-covered-panel.tsx"].includes(basename);
  const policy = economicFile ? economicBridgeComponentPolicies[economicKey] : filePolicies[basename];
  if (!policy) throw new Error(`No reviewed state policy for actual consumer ${file}#${name}`);
  const inheritedProps = ["RetainedPairedResearchReport", "EvidenceSection", "ReportSkeleton", "SummaryCount", "SnapshotDate", "Snapshot", "AnalysisSection", "SummaryCard", "DisclosureList", "ConditionalFactRow", "ValuationPETooltip", "IndicatorDetailReadState", "IndicatorSeriesTooltip", "CustomTooltip", "TimeSeriesChartTooltip", "BacktestTooltip", "ThresholdDiagnosticDownload", "VersionDiffResult"].includes(name);
  return {
    ...policy,
    ...(name === "HeadlineDrilldownReview" ? {
      inputKind: "supplied-result",
      loading: "Only the exact retained child performs an asynchronous read; an unbound parent renders a synchronous unavailable state without starting one.",
      error: "Malformed, cloned or changed supplied producer object is refused before child query construction; child owns exact derivation read failures.",
    } : {}),
    ...(name === "ProducerDownloadLink" ? {
      missing: "No consumed server-bound response object means no exact retained download link; no current object or query fallback.",
      null: "Null and cloned/derived payloads have no WeakMap proof and render no retained producer link.",
      selection: "Exact result id belongs to the consumed server response object, not browser selection or cloned chart rows; query structural sharing cannot carry stale proof.",
      scope: "Separate retained source-response download; no producer identity is assigned to transformed chart/XLSX rows. Producer header originates only from server archive verification.",
    } : {}),
    ...(inheritedProps && !["AnalysisSection", "IndicatorDetailReadState"].includes(name) ? {
      inputKind: "supplied-result",
      loading: "Parent read/section owns loading and stale-result suppression; this child renders only supplied fields.",
      error: "Parent read/section owns failed-read reason; this child does not independently fetch.",
      selection: "Current parent-supplied item/value is authoritative; no child query or prior-selection cache.",
    } : {}),
    ...(name === "ReportSkeleton" ? {
      inputKind: "presentation-control",
      missing: "Skeleton carries only a supplied CSS size; no catalog, report or metric fields are read.",
      null: "Skeleton has no nullable evidence payload or numeric data.",
      loading: "Accessible parent status names the catalog/report read; this child displays only a noninteractive visual placeholder.",
      error: "Parent owns errors and withholds this placeholder when the read fails.",
      selection: "No independent selection; parent suppresses previously selected results.",
      zero: "No numeric evidence or metric is consumed.",
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
    focusedEvidence: economicFile
      ? "script/economic-bridge-ui.test.ts imports both actual client SSR suites: current-read loading/refresh/error/absent/null/ready/partial source findings, real worker values, literal zero/null/false, empty arrays, source/domain/count/conversion/approval refusals, exact JSON/XLSX source/identity readback and all-consumer DOM nesting. Hook wrappers are separately mounted with an idle QueryClient cache; child declarations are rendered through actual report trees. No browser clicks, source approval, private bytes or all-field permutations claimed."
      : ["HeadlineDrilldownReview", "RetainedHeadlineDrilldown"].includes(name)
      ? "script/headline-drilldown-ui.test.ts: actual module SSR with scoped query harness covers unbound parent, loading/error/absent/ready/zero and exact download selection; script/headline-drilldown.test.ts verifies retained producer replay, hash/filter refusals and actual HTTP/JSON/XLSX. No interactive browser coverage claimed."
      : ["RetainedPairedResearch", "RetainedPairedResearchReport", "EvidenceSection", "ReportSkeleton"].includes(name)
      ? "client/src/components/retained-paired-research.test.ts (included by script/retained-paired-research-ui.test.ts): actual imported SSR covers catalog/report missing/invalid/loading/error/ready, no default selection, null dates, finite zero and unavailable sections; verified fetch/header/content tests. No browser interaction or genuine publication approval claimed."
      : name === "ScientificEvidenceStrands"
      ? "script/scientific-strands-warning.test.ts: direct SSR of each shared status/reason; no implied asynchronous branch or input certification."
      : name === "RegistryMethodology"
      ? "script/methodology-download.test.ts: direct SSR of exact registry definitions, historical labels and three independent evidence strands; no asynchronous result branches."
      : ["CarbonPassThroughReview", "QualifiedMissingnessReview", "ReadonlyVersionDiff", "VersionDiffResult"].includes(name)
      ? "script/readonly-new-card-states.test.ts: actual imported SSR covers static factual source card, development review loading/error/null/invalid/empty/ready/zero and background pending suppression; idle diff controls and supplied-result malformed/empty/zero/ready states. No interactive selection/pagination browser coverage claimed. script/readonly-diff-history.test.ts separately checks isolated HTTP and XLSX readback."
      : name === "ProducerDownloadLink"
      ? "script/producer-download.test.ts: actual imported component SSR bound/null/cloned response objects, exact retained link identity, mounted response/export/readback and concurrent/cache provenance isolation; no genuine database-backed browser journey claimed."
      : name === "WorkbookMoneyAudit"
      ? "script/workbook-money-integration.test.ts: actual imported component SSR loading/error/absent/invalid/ready with strict full-report hash and pinned downloads; real HTTP/XLSX safe-count/date/reason equality and source/query/hash refusals. Synthetic engineering is not real approval; old63component browser suite not rerun."
      : name === "Stage10FinancialCoverage"
      ? "script/stage10-retained-coverage.test.ts: actual component SSR loading,error,absent,invalid,ready identity/lifecycle/source-audit/hash/download states; real HTTP/JSON/XLSX with positive dated listing evidence. script/stage10-lifecycle.test.ts checks35-cell independent join,marginals,dates/source refusals and unchanged eligibility. Synthetic engineering is not real approval; original62component/browser suite not rerun."
      : name === "TrackBResearch"
      ? "script/track-b-admission.test.ts: direct imported TrackBResearch SSR covers catalog/report loading,error,empty,missing,invalid and exact selected absent-period reasons/download identities. Actual DEV filesystem resolver/HTTP/XLSX/browser-hash tests exercise the same contract; no old61component suite or browser interaction rerun is claimed."
      : name === "WarmingValidationReference"
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
