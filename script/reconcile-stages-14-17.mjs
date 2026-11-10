/**
 * Generate proposed records only. The parent merges all 300 clauses.
 * Existing execution receipts are read, never rerun or promoted to owner review.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const ledger = JSON.parse(readFileSync("docs/workplan_completion_ledger.json", "utf8"));
const sha = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const git = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const suiteLog = "generated-artifacts/workplan-completion/20261110T083052610508Z.log";
const suite = readFileSync(suiteLog, "utf8");
const operatorLog = "generated-artifacts/operator-contract/tests.log";
const P = "server/calculation/pairedResearchPipeline.ts";
const C = "server/calculation/pairedResearchCorpus.ts";
const G = "server/calculation/pairedCompanyGap.ts";
const F = "server/calculation/researchFamily.ts";
const W = "server/climateValuation/walkForward.ts";
const L = "server/calculation/pairedResearchLongOnly.ts";
const E = "server/calculation/pairedResearchEvents.ts";
const S = "server/calculation/pairedResearchSleeves.ts";
const pipelineTest = "script/paired-research-pipeline.test.ts";
const accountingTest = "script/paired-research-accounting.test.ts";
const gapTest = "script/paired-company-gap.test.ts";
const researchReport = "docs/Paired_Research_Pipeline_Engineering_Report.md";
const T = {
  gap: "paired median differs from difference of medians; nulls never silently selected",
  ranks: "peer ranks preserve ties and additive invariance; missing peers withhold scores",
  pipeline: "orchestrates frozen full family, ranks, dated accounting, inference, ablations and separate kernel without fixture acceptance",
  concurrent: "concurrent/repeated frozen requests retain incomplete family cells and paired uncertainty",
  windows: "completed windows and purged training are enforced; terminal insolvency cannot restart",
  future: "future inputs and revised substitutions cannot masquerade as origin archives",
  missing: "missing universe members and missing specifications remain nonrejections",
  cost: "zero explicit expenses recover gross; 25bp applies to both legs, not half turnover",
  events: "dated split/dividend/merger, short liability, collateral and expenses hand-reconcile",
  constraints: "sector-neutral active-weight overlay and quarterly drift preserve constraints",
  units: "future execution returns cannot change earlier selected units and weights",
  borrow: "unknown borrow is hypothetical, known unavailable borrow rejects and cannot earn spread support",
  warmup: "unchanged long-only kernel retains warm-up and capped past-only tilt",
  empty: "original assembly never converts an empty or unknown-vintage corpus to evidence",
  prospective: "prospective clock, full universe and input order cannot be forged into historical capture",
  ui: "default dashboard mounts no legacy model consumers; diagnostics require explicit opt-in",
  controls: "operator controls are explicitly disabled, not merely guarded by a server error",
  claims: "company views and exports do not consume unsupported climate outputs or physical gap",
  refs: "published references come from the real endpoint and retain validation and missing states",
  identities: "historical response identity mismatches fail without returning data",
  overlays: "ordered overlays preserve originals, zero and cutoff, reject orphan and wrong units",
  targets: "source-evidenced target base year is atomic, hashed, archived and consumed without defaults",
};
function execution(tests) {
  if (!tests?.length) return [];
  for (const name of tests) {
    if (!suite.includes(` - ${name}`)) throw Error(`No direct passing receipt for ${name}`);
  }
  if (!suite.includes("# tests 310") || !suite.includes("# pass 310") || !suite.includes("# fail 0"))
    throw Error("Prior full-suite receipt differs");
  return [{
    command: "npm run check && npx tsx --test script/*.test.ts && npm run build",
    executed_at: "2026-11-10T08:30:52Z",
    log: suiteLog, log_sha256: sha(suiteLog),
    result: "PASS: 310 TypeScript tests, 0 failed, 0 skipped; typecheck and build passed",
    count: 310, relevant_test_names: tests,
    evidence_scope: "Previously executed engineering regressions; not rerun by this reconciliation. Exact original commit was not recorded in this log; current working-tree hashes are separate evidence.",
    git_commit: null,
  }];
}
// Each entry: check, files, exact functions/behavior/formula, actual tests,
// unclosed criterion, dependency-ready action, numerical result/threshold.
const rows = {
  "S14-001": ["numerical", [G,C,P,gapTest], "pairedCompanyGap computes each matched projectedGrowth-impliedGrowth, preserves members/missingMembers, then median of paired gaps; incomplete pairs withhold score. adaptPairedResearchCorpus binds supplied members to retained payloads.", [T.gap,T.pipeline], "No authentic historical matched projection/valuation member panel; a fixture is not signal efficacy.", "Assemble reviewed original monthly paired-member/universe archives, then execute the frozen historical family.", "Fixture paired median 0 versus marginal-median difference 9; historicalEligible=false and scientificAcceptance=false."],
  "S14-002": ["numerical", [G,C,P,gapTest], "rankPairedCompanyGaps: score=2*(lower+(tied-1)/2)/(peerCount-1)-1; ties average, singleton/incomplete peer scores null. Pipeline uses supplied sector peers.", [T.ranks,T.pipeline], "Authentic sector-primary, absolute and sub-industry history/results not assembled; caller labels alone are not verified peer classifications.", "Freeze verified sector/sub-industry classifications and all three peer variants in the original-corpus protocol.", "Two-company scores [-1,1]; tied equal gaps [0,0]; incomplete peers [null,null]."],
  "S14-003": ["operational", [P,F,"script/run-paired-research-pipeline.ts"], "runPairedResearchPipeline validates strict protocol, ordered three endpoints, full specification list, frozenAt<evaluationStart, expected origins, costs, seed and block settings against externally supplied expectedProtocolHash.", [T.pipeline], "A supplied matching hash does not prove real pre-evaluation commitment, historical periods or independent review.", "Retain a genuine complete protocol and externally dated hash before scoring any authentic evaluation corpus.", "Protocol repetitions constrained 200..10000; specification/origin duplicates reject."],
  "S14-004": ["numerical", [C,P,pipelineTest], "Adapter marks complete only outcomeAvailableAt<=dataEnd; pipeline uses exact calendar one- or twelve-month holding endpoints, sector-excess total returns=((final+dividends)*endFx)/(executionPrice*executionFx)-1-sectorMean.", [T.windows,T.pipeline], "No actual historical next-month/12-month paired panel through 2026-01-22; 12-month overlapping primary inference still requires monthly sleeve-return/factor bridge.", "Assemble complete exact-window observations with dataEnd 2026-01-22 and final twelve-month origins around January 2025; report excluded windows.", "Twelve-month blockLength must be >=12. Annual endpoints are not interpolated into monthly performance."],
  "S14-005": ["operational", [C,"server/calculation/pairedResearchOriginalCorpus.ts",P], "adaptPairedResearchCorpus resolves universeHash and origin-bound payloads, rejects future informationAvailableAt/capture and incompatible members; original-corpus assembly selects only retained original candidates.", [T.future,T.empty], "Historical universe versions, authentic original filing availability plus declared lag and all origin controls remain missing.", "Acquire/review origin universe and original filings, explicitly freeze filing lag, bind each used value to retained payload.", "Unknown/revised source cannot be silently promoted to original-at-origin evidence."],
  "S14-006": ["numerical", [P,C,pipelineTest], "Pipeline training uses outcomeAvailableAt+embargoDays*86400000<evaluationStart; evaluation boundaries and complete targets are checked, twelve-month inference requires adequate blocks.", [T.windows], "No complete authentic train/validation/evaluation partition and three-year-overlap purge study; existing training/evaluation gates are not a complete protocol.", "Freeze all partitions and embargo length including three-year targets, then report origin-level boundary audit on real data.", "Strict inequality excludes an outcome/embargo ending exactly at evaluationStart."],
  "S14-007": ["exact", [P,"script/run-paired-research-pipeline.ts"], "Strict protocol disclosure literal and top-level returned disclosure are 'locked retrospective evaluation (prior exposure: 2020 onward)'; efficacy remains WITHHELD.", [T.pipeline], "Every downstream historical table/export and separately reserved truly unexamined period have not been audited.", "Bind disclosure to every evaluation output and enumerate separately any demonstrably never-examined period.", "Prior exposure is never relabelled genuine out-of-sample."],
  "S14-008": ["numerical", [C,P], "Corpus requires seven finite controls per security; regression features add the score/components to controls. Values must bind origin payloads.", [T.pipeline,T.future], "Seven supplied numbers do not establish reviewed value/size/momentum/quality/sector/region/intensity definitions or actual aligned histories.", "Specify and review all seven origin covariate transformations and assemble authentic controls-only and augmented design.", "Singular regression pivot below 1e-10 fails; unavailable is not zero improvement."],
  "S14-009": ["judgement", [F,P], "adjudicateResearchFamily retains all three primary hypotheses for every declared specification; each pass requires positive estimate, lower 95% paired interval>0 and Holm p<=0.05.", [T.pipeline,T.missing], "No actual locked historical family has been scored; threshold implementation alone cannot earn support.", "Complete authentic inputs and precommitment, then report every family cell and all three decisions without dropping failures.", "All three amended hypotheses require paired interval excluding zero and full-family Holm, not just raw p-values."],
  "S14-010": ["numerical", [P], "Pipeline computes date-level mean cross-sectional Spearman rank IC; circular date-block bootstrap preserves date rows, 95% quantiles at floor(.025*N), floor(.975*N), deterministic seed.", [T.pipeline,T.concurrent], "Actual historical IC and appropriate declared overlapping-return estimand not available.", "Freeze sampling frequency and >=horizon block length, score reviewed complete outcomes and retain paired uncertainty draws/settings.", "At least max(6,2*blockLength) complete date blocks; twelve-month target requires blockLength>=12."],
  "S14-011": ["numerical", [P], "Training fits controls-only and augmented models; evaluation compares squared errors under a common training-mean denominator and paired date blocks; endpoints are separately available/unavailable.", [T.pipeline,T.windows], "No real locked out-of-sample controls-only versus paired-signal R2 improvement with accepted interval.", "Execute precommitted common-sample evaluation and retain baseline/augmented predictions, losses and paired intervals.", "Positive evaluation-R2 improvement and lower paired95>0 plus full-family Holm<=.05 required."],
  "S14-012": ["numerical", [P,E,S], "Separate sector quantile long-short weights; accountResearchPeriod cost=sum(abs(target-prior))*25/10000, explicit borrow/financing/dividend liability; factor alpha estimated separately using supplied matched factors.", [T.cost,T.events,T.borrow], "Real geography/currency-matched factor history, borrow, execution and accepted monthly overlapping sleeve inference absent.", "Acquire reviewed factors and dated lifecycle/borrow records; freeze monthly sleeve-factor bridge and compute after-cost alpha interval.", "25 bp per one-way traded notional, not half turnover; both legs charged. Positive net alpha/lower95>0/Holm<=.05 required."],
  "S14-013": ["judgement", [F,P,"script/research-support-labels.test.ts"], "adjudicateResearchFamily now exposes passedHypotheses and exact decision: complete3=supported, complete2=supported for further research, complete<2=no demonstrated improvement; any missing endpoint=incomplete evidence. supported boolean remains true only for complete3; all actual unauthenticated corpus efficacy remains withheld.", [T.pipeline,T.missing], "Exact label engineering implemented, but no authentic locked historical family or empirical research decision exists.", "Apply tested exact 3/2/<2 qualified decisions only after authentic retained historical evidence and precommitment exist; two passing plus one missing stays incomplete.", "New five-case decision fixture covers3/2/1/0 passing and2+missing; full-family Holm and paired95 gates unchanged. Scientific/investment acceptance remains false."],
  "S14-014": ["operational", [C,P], "Pipeline rejects supplied factor currency/geography mismatches and produces attribution for externally supplied regional-developed and workbook factor arrays.", [T.pipeline], "No retained reviewed Kenneth French regional-developed factor download, FX convention and actual workbook factor construction for the historical panel.", "Retain licensed factor source/version, currency conversion and universe-built factor construction with date-level joins.", "Geography and currency must exactly match frozen protocol; matching labels are not source authenticity."],
  "S14-015": ["numerical", [P,pipelineTest], "Pipeline ablations report baseline-growth, plus-transition-demand, plus-carbon-drag, plus-intensity, using frozen training then evaluation MSE and controls-only MSE.", [T.pipeline], "Actual origin component histories and historical ablation improvements not assembled.", "Bind all four component histories to authentic original payloads, then execute and report the complete ablation ladder.", "Fixture asserts four ablations; not four empirical model improvements."],
  "S14-016": ["numerical", [F,P,"script/adjudicate-research-family.ts"], "Family is specifications x evaluation-r2/signal-ic/after-cost-long-short. Holm ordered adjusted p=max(previous,min(1,(M-rank)*p)); unavailable cells p=1 remain denominator; duplicates/undeclared results reject.", [T.pipeline,T.missing], "Full actual primary model/peer/target family and separate robustness declarations not authentically frozen or scored.", "Freeze complete family including all primary hypotheses and separately label robustness before evaluating retained history.", "Fixture 2 specifications x3 endpoints=6 tests; all 6 unavailable for unauthenticated engineering corpus."],
  "S14-017": ["operational", ["server/calculation/prospectiveSignal.ts","server/snapshots/prospectiveSignal.ts","script/capture-prospective-signal.ts"], "prepareProspectiveSignal freezes full universe/pairs; DB capture helper uses database clock, immutable transaction/advisory lock and idempotent duplicates; conflicting origin requests reject.", [T.prospective], "No genuine reviewed monthly live signal captured before its outcome; synthetic transaction checks are not prospective performance.", "Resolve genuine protocol/universe/current paired inputs, then authorized shell operator captures before later execution/outcomes; keep original receipt.", "capture clock<execution<outcome; no caller-supplied capture timestamp authority."],
  "S14-018": ["numerical", [P,researchReport], "Current pipeline scores company sectors and sector-excess targets; this is not a separately defined sector-level signal research analysis.", [], "Secondary sector-level aggregation protocol, estimand and actual research output are absent.", "Define/freeze sector aggregation and targets as secondary analysis, then run on the same reviewed origin corpus.", "No numerical sector-level efficacy result is claimed."],
  "S14-019": ["operational", [P,"script/run-paired-research-pipeline.ts"], "Runner verifies expectedProtocolHash and frozenAt ordering; content identity includes family.", [T.pipeline], "No authentic pre-scoring Git/external commitment receipt for a real complete evaluation protocol. Current code SHA is not protocol precommitment.", "Authorized owner retains dated immutable protocol/hash before scoring; do not retroactively claim commitment from supplied timestamps.", "No commits made by this work; protocol commitment acceptance remains unmet."],
  "S14-020": ["numerical", [C,P,pipelineTest], "Complete flag and purge/embargo gates exclude incomplete outcomes from estimation; future origin inputs are rejected even for incomplete periods.", [T.windows,"incomplete outcomes do not relax origin-relative future signal gates"], "Full real-panel twelve-month and three-year boundary audit remains missing.", "Run origin-level inclusion/purge tests on complete historical partition and retain exclusions, not only fixture checks.", "Complete iff outcomeAvailableAt<=dataEnd; training outcome+embargo<evaluationStart."],
  "S14-021": ["exact", [P,"script/run-paired-research-pipeline.ts"], "Frozen literal prior-exposure disclosure is returned with pipeline output.", [T.pipeline], "Disclosure on every eventual table/UI/download of real evaluation is not yet proven.", "Add schema-bound output disclosure to future real evaluation exports and audit all consumers.", "Required exact phrase retained; not a claim that every output has been reviewed."],
  "S14-022": ["numerical", [G,gapTest], "Known joint member fixture retains gaps [0,-90,10]; paired median is zero, unlike difference of marginal medians (10-1=9).", [T.gap], "", "Retain this regression while assembling authentic historical research; this fixture criterion alone does not establish efficacy.", "Expected paired median=0 exactly; marginal-median difference=9; an added missing member makes result null."],
  "S14-023": ["numerical", [G,gapTest], "Fixture company b adds one to every projected member growth relative to company a; b paired median rises from 0 to 1 and rank score becomes +1 versus a -1.", [T.ranks], "", "Retain directional perturbation regression; evaluate real signal only after the historical corpus gate.", "Positive gap perturbation produces expected ordered scores [-1,+1] exactly."],
  "S14-024": ["numerical", [G,gapTest], "Fixture adds 100 to every issuer median gap and verifies unchanged within-peer scores; equal gaps retain score zero.", [T.ranks], "", "Retain common-additive invariance regression for future peer variants.", "Scores [-1,1] unchanged after common +100; tie scores [0,0]."],
  "S14-025": ["exact", [P,F,pipelineTest], "Pipeline maps all frozen specifications and expected origins; missing origins/members remain explicit. Full-family hypotheses retain missing cells as nonrejections.", [T.missing,T.concurrent], "Complete authentic declared family results and robustness still absent; fixture inventory is not actual historical completion.", "Report every actual declared model/peer/target and endpoint with values or exact unavailable reason; never shrink denominator.", "Fixture family size=6; unavailable=6; passed=0."],
  "S14-026": ["operational", ["server/snapshots/prospectiveSignal.ts","script/check-prospective-signal-db.ts","docs/Prospective_Signal_Engineering.md"], "Existing prospective capture infrastructure and rollback-only development transaction receipt test clock/idempotence/conflict/rollback; not a real monthly live signal.", [T.prospective], "At least one genuine independently reviewed live month's pre-outcome capture remains absent.", "Authorized workspace operator supplies genuine archive-resolved signal and captures before execution/outcome using existing CLI.", "2026-11-10T05:27:31Z rollback helper receipt uses synthetic engineering identities, not prospective acceptance."],
  "S15-001": ["numerical", [W,P,L,"script/walk-forward.test.ts"], "walkForward: benchmark=cap/sum(cap); weights proportional benchmark*max(0,1+tilt*score); tilt=min(5,targetTE/trainingRisk) after 12-observation warm-up, past-only; drift, expense and terminal insolvency retained.", [T.warmup,T.units], "Actual paired new-gap long-only portfolio series and accepted origin market/eligibility inputs absent.", "Run unchanged kernel using genuine paired histories, retain warm-up/risk/weights/drift/cost traces and separate labels.", "Target tracking error=.02 annual; warm-up=12 observations; tilt cap=5. Legacy turnover display is half notional; costs use full notional."],
  "S15-002": ["numerical", [P,S,E], "Separate equal-within-sector top/bottom quantile long-short; tie boundary groups retained, overlapping tied legs rejected; gross/net and cash/borrow explicitly accounted.", [T.pipeline,T.borrow], "No actual eligible paired history, borrowed positions, matched factors or accepted overlapping monthly inference.", "Freeze quantile/weighting/exposure/cash/borrow conventions and execute genuine separate spread portfolio.", "Long leg +1, short -1 aggregate when sectors valid; unknown borrow is hypothetical, unavailable borrow rejects."],
  "S15-003": ["numerical", [L,P,accountingTest], "constrainedLongOnly projects desired tilt along benchmark-to-tilt line with sector-neutral totals, maximum active weight and participation*trailingLiquidity/capital trade bounds; infeasible constraints unavailable.", [T.constraints,"frozen long-only variants require origin eligibility and liquidity, never defaults"], "Actual dated eligibility/trailing liquidity/capital and full variant empirical reports absent; constraints enforced at rebalance, not continuously.", "Freeze real sector/active/liquidity limits and supply original origin inputs before running all variants.", "Quarterly off-months retain drifted holdings; no arbitrary default eligibility/liquidity."],
  "S15-004": ["exact", [P,C], "Pipeline returns distinct tracks A/B/prospective with unavailable reasons; evidence modes validated by adapter.", [T.pipeline,T.future], "Actual complete revised-history, original point-in-time and prospective tracks are not assembled.", "Report all three separately and retain unavailable by period when original/prediction requirements fail.", "Engineering-fixture mode never becomes real historical efficacy."],
  "S15-005": ["operational", [P,C,researchReport], "Track A labels supplied revised-history corpus conditional revised-history; unauthenticated corpora cannot earn family support.", [T.pipeline], "Actual new-gap revised-history run on full reviewed universe is missing; old-intensity/implied-growth proxy is not substitute.", "Assemble authentic revised-history paired projections/valuations and execute all frozen Track A variants.", "Historical efficacy WITHHELD; scientificAcceptance=false."],
  "S15-006": ["operational", [C,P,"server/calculation/pairedResearchOriginalCorpus.ts"], "Adapter rejects non-original/future retained sources for point-in-time mode; original-candidate assembly never invents unavailable original archives.", [T.future,T.empty], "Original-at-origin fundamentals and verified Stage9 retrospective projections absent; string mode cannot independently certify authenticity.", "Provide reviewed original source archives/availability and Stage9 input lineage for each eligible period; otherwise mark Track B unavailable.", "Retained CAT/XOM current captures are not historical monthly originals; NEE Jan27 release exceeds Jan22 cutoff."],
  "S15-007": ["operational", [P,"server/snapshots/prospectiveSignal.ts"], "Pipeline prospective track explicitly unavailable pending independently retained live signals; separate capture infrastructure exists.", [T.prospective,T.pipeline], "No genuine live archived monthly signal or complete future outcome exists.", "Capture authentic reviewed live monthly signal using existing operator CLI, then wait for complete outcomes before reporting returns.", "Synthetic pre-outcome clock fixture is not a prospective track record."],
  "S15-008": ["numerical", [P,E,pipelineTest], "Terminal stress uses supplied lifecycle!=continuing only, with settlement and zero residual units; continuing issuers keep actual marks. Event engine handles retained split/dividend/merger/cash delisting.", ["split, FX, distributions, short liability, financing and terminal settlement reconcile",T.events], "Real evidenced delisting/terminal flags and complete historical lifecycle/FX records not reconciled.", "Review Stage10 lifecycle flags and apply 0,-30,-100% stress only to evidenced/flagged issuers; report differences.", "Stress tuple [0,-.3,-1]; continuing company final observation never automatically stressed."],
  "S15-009": ["operational", [researchReport,"docs/Valuation_and_Research_Completion_Status.md"], "No completed 50-observation FMP price-plus-dividend return-index reconciliation exists in the inspected Stage14/15 engineering report.", [], "Required random sample, retained provider values/parameters, break definition and break rates missing.", "Freeze deterministic 50-observation random sample and tolerances, use permitted existing read-only provider access, retain comparison rows privately and publish aggregate break rates.", "Required n=50 quality check is not full-history verification; observed completed n=0 in this receipt."],
  "S15-010": ["numerical", [P,C], "Pipeline computes separate supplied regional/workbook factor alpha using period net returns and date-block intervals; geography/currency mismatch rejects.", [T.pipeline], "Authentic regional factors, workbook factor construction, FX joins and compatible monthly sleeve/factor estimand absent.", "Retain matched factor histories and currency conversion; compute alpha and interval at declared actual return frequency.", "Not valid to regress overlapping annual endpoints as monthly returns; incompatible frequency fails closed."],
  "S15-011": ["numerical", [P,L,S], "Protocol carries sensitivityCostBps, borrow multipliers, terminal stress and optional monthly/quarterly long-only variants; trajectories preserve accounting.", [T.constraints,T.pipeline], "Full actual [0,10,25,50,100]bp x monthly/quarterly x subperiods, drawdown and liquidity-capacity report incomplete.", "Freeze full sensitivity cross-product and metric formulas, supply authentic liquidity/market series, report every variant even unavailable.", "Required costs 0/10/25/50/100bp per one-way traded notional; fixture [0,50] is not full family."],
  "S15-012": ["judgement", [P,F,researchReport], "Runner explicitly returns efficacy WITHHELD/scientificAcceptance=false until authentic corpus gates; full family adjudicator is qualified research only.", [T.pipeline], "No actual locked empirical evaluation or owner research decision; proxy studies cannot substitute.", "After genuine family and portfolio reports exist, issue the exact qualified locked-protocol decision with failure/unavailability retained.", "No historical positive family result, investability or independent approval asserted."],
  "S15-013": ["numerical", [P,E,W,pipelineTest], "accountResearchPeriod independently reconciles endNav=1+netReturn; tradingCost=sum(abs(weight-prior))*bps/10000. Unit tests hand recompute expenses and both legs; legacy walkForward uses multiplicative cost timing.", [T.cost,T.events], "Independent full actual stored-series recomputation, including both distinct accounting conventions and complete variants, remains unperformed.", "Run independent accounting auditor over the authentic retained series and report gross/net/traded-notional/cash conventions for each engine.", "Fixture all explicit expenses zero recovers gross; 25bp expense matches full traded notional to tolerance 1e-12. Do not conflate legacy half-turnover label with cost notional."],
  "S15-014": ["exact", [P,L,pipelineTest], "Output labels existing-long-only-tilt-kernel-not-long-short-evidence and constrained-long-only-not-spread-evidence separately from quantile trajectories.", [T.pipeline], "Every future real UI/export/report label has not been audited; no actual empirical pair of reports.", "Keep labels/schema separate through all historical result exports and backtest UI; reject cross-evidencing.", "A long-only tracking-error result cannot satisfy Stage14 after-cost long-short endpoint."],
  "S15-015": ["numerical", [P,W,C,pipelineTest], "Future execution-return perturbation leaves earlier selected units/weights unchanged; origin payload/availability gates reject future fundamentals; warm-up uses past-only risk.", [T.units,T.future,T.warmup], "Full authentic historical holdings plus future-fundamental perturbation across every variant not checked.", "Extend same perturbation audit to original retained corpus and each monthly/quarterly constrained variant; retain holdings prefixes.", "Fixture compares accounting prefix through 8 periods and current selected units before perturbed future returns."],
  "S15-016": ["exact", ["server/calculation/analysisManifest.ts","server/snapshots/resultContract.ts","script/verify-portable-overlay-recovery.ts","script/check-nine-http-recovery.ts"], "Canonical manifests/result hashes pin analytical inputs; prior immutable-result retrieval and portable nine-output/XLSX recovery exist.", [T.concurrent], "Actual current workbook AND approved-source mutation/suspended historical HTTP/restore not proven. Portable fixture is not that lifecycle.", "After genuine auth/import/restore contract exists, mutate isolated DEV copies and verify prior golden analytical hashes via HTTP before/during/after restore.", "Existing nine HTTP stored results repeated exactly; portable report networkDenied=true; no unchanged rerun performed."],
  "S15-017": ["operational", [P,C], "Track B returns unavailable except supplied point-in-time corpus; adapter rejects incompatible/revised/future archive claims and unauthenticated family efficacy.", [T.future,T.empty], "Mode-level 'contract-checked; independent archive verification required' is not yet per-period unavailable reporting for every Stage9/original-filing failure.", "Implement explicit period-level Stage9 plus original-filing evidence assessment and unavailable reasons; never treat mode label as acceptance.", "Track B remains scientifically unavailable absent reviewed original-at-origin evidence."],
  "S15-018": ["numerical", [P,E,pipelineTest], "Fixture stress changes only lifecycle-flagged terminal company, leaves continuing issuer marked value positive, rejects held security disappearance without settlement.", ["split, FX, distributions, short liability, financing and terminal settlement reconcile"], "Fixture covers engine rule; authentic Stage10 evidenced/flagged companies and stress report not assembled.", "Bind actual lifecycle evidence and rerun retained stress audit including ordinary final observations that must remain unstressed.", "Unflagged continuing final observations are not delistings; only declared terminal lifecycle invokes stress."],
  "S15-019": ["numerical", [P,L,F], "Frozen specifications remain in results even missing; optional variants include unavailable reasons; stored trajectories expose quantities for accounting.", [T.pipeline,T.concurrent,T.missing], "Full declared real variant report and independent recomputation of every displayed metric from stored series absent.", "Implement stored-series report auditor for all declared variants, drawdown, subperiod and capacity metrics with explicit unavailable cells.", "No omission of a failed/missing family cell; actual empirical variant count not claimed."],
  "S16-001": ["operational", ["client/src/pages/dashboard.tsx","client/src/components/published-scenario-references.tsx","server/calculation/readiness.ts"], "Default dashboard shows bounded candidate/readiness/reference content and keeps legacy diagnostics opt-in; unsupported physical/market claims withheld.", [T.ui,T.refs], "Accepted four-measure forecast/Tier1 range, complete fan charts, scenario and measure toggles not integrated because analytical evidence remains incomplete.", "Integrate actual accepted Stage7/13 outputs with shared manifest and four-measure availability reasons; never fill absent measures.", "No Tier2 market-inference or scientific readiness inferred from successful rendering."],
  "S16-002": ["operational", ["client/src/components/analysis-selection.tsx","client/src/lib/analysis-selection.ts","docs/Regional_Historical_Replay.md"], "Selection IDs propagate to supported requests; historical identity mismatch rejects; unsupported regional history fails rather than silently current fallback.", [T.identities], "Regional/attribution/forecast-history headline views on one complete physical manifest and all required claim labels not fully delivered.", "Integrate actual accepted regional and historical outputs with shared manifest and exact within-model/archive/retrospective labels.", "Current-code archived-input replay is not restoration of old executable or original-vintage forecast."],
  "S16-003": ["operational", ["client/src/pages/climate-valuation.tsx","client/src/pages/decarb-gap-signal.tsx","client/src/components/company-operating-review.tsx",G], "Company UI retains descriptive peer/earnings diagnostics and reviewed-source availability; paired-gap calculation exists offline, unsupported physical gap filtered.", [T.claims], "No integrated real projected-vs-implied paired distribution/model selector/emissions/worked drilldown with accepted common inputs.", "Expose genuine matched company projection and valuation archives with unavailable reasons and drilldown; do not relabel earnings proxy as Stage14 gap.", "Actual historical whole-equity paired cases and efficacy not fabricated."],
  "S16-004": ["operational", ["client/src/pages/climate-valuation.tsx","client/src/pages/decarb-signal.tsx",P], "Current backtest consumers are legacy retrospective diagnostics; new pipeline carries disclosure/tracks/separate labels offline.", [T.claims,T.pipeline], "Complete new-gap backtest page with protocol, all tracks, prospective record, factor adjustment and full robustness missing.", "Wire only actual retained paired research report when available; render each missing section and reason now without invented metrics.", "Legacy SDG/intensity research is not the Stage14 locked signal."],
  "S16-005": ["operational", ["client/src/pages/dashboard.tsx","client/src/pages/climate-valuation.tsx","server/calculation/readiness.ts","server/calculation/publicValuationContract.ts"], "Public valuation contract removes unsupported physical outputs; current UI avoids unsupported market-climate displays and retains explicit unavailable provider/reference states.", [T.claims,T.refs], "Every component across every page has not been exhaustively rendered with all Tier2/four-market-measure/TrackB outputs absent.", "Create complete absent-output fixtures for every page and verify specific reasons in UI, API and exports.", "No zero/placeholder market-implied measures may substitute for missing evidence."],
  "S16-006": ["operational", ["server/operatorContract.ts","server/releaseSafety.ts","server/snapshots/overlayReview.ts","server/financialData/reviewStore.ts","client/src/pages/data-management.tsx"], "Existing authorized-shell review/capture commands preserve immutable archives and approval state; public writes remain forbidden. New read-only preflight records exact absent HTTP principal/role/import boundary.", [T.controls,T.targets], "Complete versioned carbon/SDG/financial/driver diffs and affected-analysis UI plus supported disposable HTTP importer absent; single deployed scheduler ownership not reverified here.", "Authorized workspace/auth maintainer provides genuine operator identity/role and isolated importer/restore contract; extend existing review/diff UI without changing collector cadence.", "New 8/8 middleware/preflight tests preserve public mutation403. No credentials, real approvals or DDL introduced."],
  "S16-007": ["exact", ["client/src/pages/methodology.tsx","client/src/lib/export-identity.ts","shared/outputFieldSemantics.ts","docs/System_Output_Register.md"], "Registries expose formulas/units/vintage and export data identity hashes normalized data; interpretation sheets carry selected IDs. Methodology remains partly hand-authored, with archived legacy content opt-in.", [T.claims], "Registry-generated complete methodology and manifest plus exact claim label on every download remain unaudited/incomplete; code-path census not dynamic proof.", "Generate methodology from authoritative registries and enumerate every export including charts; validate identity and label readback.", "SHA256 hashes normalized exported rows independent of filename/time; existing nine XLSX recovery proves fixture data, not every UI export."],
  "S16-008": ["judgement", ["script/ui-claims.test.ts","client/src/pages/methodology.tsx","docs/WORKPLAN_IMPLEMENTATION_REPORT.md"], "Current claim boundary warnings explicitly state withheld physical/market inference; legacy methodology is opt-in and superseded.", [T.ui,T.claims], "Complete Stage1 warning-removal inventory with underlying limitation resolution evidence absent.", "Enumerate original warnings and any removed warning; retain warning unless its specific scientific/source limitation has a linked accepted resolution.", "Replacement code or passing fixture alone cannot remove warning."],
  "S16-009": ["numerical", ["script/check-nine-http-recovery.ts","script/verify-portable-overlay-recovery.ts","client/src/lib/export-identity.ts"], "Previously executed nine endpoint replay/result retrieval and private bundled calculator/XLSX readback match exact data identities.", [], "Identical four-headline measure values and claim labels across all UI/API/download paths not proven; accepted physical headline measures incomplete.", "After actual measures exist, snapshot rendered values and export readback against same API result/manifest; retain current unsupported absence.", "Read-only nine HTTP and nine XLSX checks already passed and are not rerun; not a mutable-current refresh lifecycle."],
  "S16-010": ["operational", ["script/ui-claims.test.ts","client/src/pages/dashboard.tsx","client/src/pages/climate-valuation.tsx"], "Source-level regressions forbid unsupported consumers/default legacy claims; missing-state logic exists for references/provider/readiness.", [T.ui,T.claims,T.refs], "No complete all-pages rendered fixture with all market measures/Tier2/TrackB absent.", "Add browser/render fixture coverage for every route, all-absent state, loading and errors with actual reason assertions.", "Source inspection regression is not a desktop/mobile interaction or all-page screenshot review."],
  "S16-011": ["operational", ["server/operatorContract.ts","script/operator-contract.test.ts","script/check-overlay-concurrency-db.ts","server/snapshots/overlayReview.ts","server/dataIngestion/dataStore.ts"], "Existing review helpers are transaction-scoped; immutable selected contexts/private-copy rollback checks passed previously. New preflight truthfully denies absent privileged HTTP contract.", [T.overlays,T.concurrent], "Actual authenticated loader/review/capture, current-workbook+approved-source mutation, suspended historical HTTP request, next-current/export update and fullrestore unproven.", "Genuine auth maintainer identifies actual HTTP principal/role; authorized importer owner provides disposable DEV copies and exact restore; then execute lifecycle including rejected/failed cases without weakening403.", "Existing nine read-only HTTP checks compare same baseline selection, not distinct mutable-current versions or instrumented cache hit."],
  "S16-012": ["numerical", [G,P,pipelineTest,"script/verify-overlay-replay.ts"], "Paired gap rank perturbation and pipeline gap-to-portfolio plumbing exist; private overlay calculator replay exercises retained workbook independently.", [T.ranks,T.pipeline], "No actual reviewed company projection perturbation through authentic paired gap to backtest weights under end-to-end HTTP lifecycle.", "After genuine matched corpus and auth/import contract, perturb isolated company input and trace manifest/member gap/rank/weight across stored outputs.", "Do not count an old intensity proxy or synthetic fixture as historical company efficacy."],
  "S16-013": ["judgement", ["script/ui-claims.test.ts","docs/WORKPLAN_IMPLEMENTATION_REPORT.md","client/src/pages/methodology.tsx"], "Warnings and unsupported outputs are retained in current source; source-level claim tests contain legacy content.", [T.ui], "No exhaustive original-warning removal/resolution register has been reconciled.", "Inventory each original interim warning and link any removal to exact resolved limitation and evidence; leave unresolved warnings intact.", "No warning-removal approval is asserted in this record."],
  "S16-014": ["judgement", ["docs/Analysis_Wide_Historical_Selection.md","script/ui-claims.test.ts","client/src/pages/dashboard.tsx"], "Prior report records header preview and explicit error/empty handling; source tests prohibit unsupported fabricated climate claims.", [T.ui,T.refs], "Desktop AND mobile review of every page, including loading/empty/error states, remains unperformed; source tests are not visual review.", "Run all-page desktop/mobile review on actual preview once parent serves current code; record routes, viewports and missing/error states without auth bypass.", "No new screenshot or visual review claimed by this non-UI subtask."],
  "S17-001": ["operational", ["script/merge-clause-reconciliation.py","script/reconcile-stages-14-17.mjs","script/reconciliation-stages-14-17.test.ts","docs/workplan_completion_ledger.json"], "This proposed record embeds a 300-clause acceptance matrix with original ID/requirement/status, evidence paths and SHA256, Git evidence boundary and exact/numerical/operational/judgement check type. Parent merge requires all300 unique immutable contracts.", [], "Other workers' proposed clauses must replace provisional old-ledger matrix cells before integrated acceptance; matrix assembly is not criterion passage or owner review.", "Parent merges all300 disjoint original-clause records, regenerates matrix from merged statuses/evidence and checks immutable contract digest.", "74 complete proposed S14-17 records; 300 matrix rows; no central ledger changes by this worker."],
  "S17-002": ["operational", [".github/workflows/ci.yml","script/verify-portable-overlay-recovery.ts","pyproject.toml","uv.lock","package-lock.json"], "CI declares fresh checkout/Node22/locked Python/dependencies; private portable recovery bundles exact current Node and dependencies with Linux network namespace isolation.", [], "Full fresh-checkout Node22/pinnedPython/stagingDB reproduction of all required analyses not executed; private nine-calculator bundle is bounded recovery only.", "Provision supported isolated staging DB and genuine accepted inputs, then execute exact full reproduction pack on fresh checkout with Node22/lockedPython.", "Portable missing/corrupt/version checks passed and network TCP probe ENETUNREACH; compatible host ABI still required."],
  "S17-003": ["numerical", ["docs/Integrated_Member_Analysis.md","script/summarize-member-ensemble.ts","docs/Independent_FaIR_Benchmark_Protocol.md"], "Existing member-analysis/physical-engine reports distinguish conditional engineering controls from accepted calibrated ensemble.", [], "Clean reproduction of accepted global ensemble and all four measures absent; calibration/physical reference gates remain unmet.", "After accepted joint distributions and climate gates, run fresh environment ensemble and compare all measure output hashes/tolerances.", "A 10000-member fixture/control run is not calibrated real ensemble efficacy."],
  "S17-004": ["numerical", ["docs/Regional_Attribution_Controls.md","docs/Regional_FaIR_Coupling.md","script/verify-regional-accounting.ts"], "Existing matched regional/attribution control reports and accounting script provide bounded engineering results.", [], "Fresh staged clean reproduction of one accepted regional+attribution analysis with same global manifest not retained.", "Select actual accepted regional/attribution manifest and rerun in clean staging with source hashes and declared numerical tolerances.", "Within-model conditional attribution is not causal empirical proof."],
  "S17-005": ["numerical", ["docs/Historical_Diagnostics_and_Skill_Results.md","docs/Automatic_Archive_and_Result_Replay.md","docs/Regional_Historical_Replay.md"], "Immutable input/result replay infrastructure exists; reports distinguish archive, revised-history and retrospective simulation.", [], "Two genuine accepted forecast vintages cleanly reproduced in staged environment not shown; current-code selected-input replay is insufficient.", "Retain two actual origin manifests/executables/input vintages and run full clean reproduction without current-input substitution.", "Original-vintage research absence is not cured by historical snapshot IDs alone."],
  "S17-006": ["numerical", ["docs/Company_Review_Pack.md","docs/Conditional_Company_Climate_Cases.md","docs/Company_Valuation_Sensitivity_Results.md"], "Existing company controls/review pack/conditional cases document accounting and scientific boundaries.", [], "Clean reproduction of accepted company valuation AND emissions analysis on fully reviewed common evidence is absent; real issuer approval not requested or performed.", "Resolve authentic identity/dated market/accounting/climate-mapping gates and rerun one complete company pack in staging.", "No synthetic repricing or conditional bridge promoted to real whole-equity/emissions efficacy."],
  "S17-007": ["numerical", [P,"script/run-paired-research-pipeline.ts",researchReport], "Runnable paired pipeline produces immutable engineering output with full family inventory and withheld efficacy.", [T.pipeline], "One genuine new-gap backtest cleanly reproduced from accepted original data not available; proxy backtest cannot substitute.", "After actual paired panel and frozen protocol exist, reproduce one full stored accounting/holding/return series in clean staging.", "Engineering fixture family remains six unavailable hypotheses, not historical research."],
  "S17-008": ["judgement", ["docs/Company_Review_Pack.md",researchReport,"docs/Valuation_Comparison_Protocol.md"], "Reproduction paths and exact independent-review requirements are documented; developer tests do not act for owner.", [], "No explicit independent owner receipt for Stage11 comparison, Stage14 locked evaluation and Stage15 accounting.", "Owner independently reruns/checks complete reproduction pack and records identity/date/commands/results/tolerances; developer only answers questions.", "Owner review NOT performed or claimed."],
  "S17-009": ["operational", ["client/src/pages/dashboard.tsx","client/src/pages/methodology.tsx","script/ui-claims.test.ts"], "Default UI excludes legacy model consumers; legacy diagnostics/methodology retained behind explicit opt-in and tests remain.", [T.ui], "Literal retirement from all production UI not proven because opt-in legacy diagnostics remain; no new production deployment requested.", "Obtain exact retirement interpretation and remove production entry points if required while preserving comparator code/tests; retain warnings.", "Default-hidden is not identical to complete production UI retirement."],
  "S17-010": ["exact", ["docs/Application_Logic_and_Implementation.md","docs/Company_Review_Pack.md","docs/System_Output_Register.md"], "Existing application logic, output/source registries and company review pack are handover components.", [], "Complete current handover, parameter register, glossary and four accepted worked examples not reconciled end-to-end.", "Generate/refresh handover from accepted merged records; enumerate all parameters/glossary and four authentic worked examples with manifests and gaps.", "Documentation pointers alone do not verify original criterion."],
  "S17-011": ["judgement", ["docs/WORKPLAN_IMPLEMENTATION_REPORT.md","docs/Workplan_Status_and_Conclusions.md",researchReport], "Current reports explicitly withhold full completion and list calibration, source, model and historical-efficacy gaps.", [], "Final accepted completion statement and owner-reviewed original-scope backlog remain absent; no scope waived.", "After all-stage reconciliation publish truthful completion status and backlog covering calibration, NGFSPhaseVI, regions, valuation and prospective track.", "No completion, owner acceptance, commits or release asserted by this worker."],
  "S17-012": ["judgement", ["docs/workplan_completion_ledger.json","script/merge-clause-reconciliation.py"], "Ledger preserves all300 original clauses; merge tooling rejects missing/duplicate/changed contracts. This task proposes74, not a waived subset.", [], "Many mandatory criteria incomplete and no explicit owner-approved scope change exists.", "Complete dependency-ready original work and obtain explicit owner receipt for any scope change; never infer approval from test success.", "Passing source tests cannot satisfy unexecuted empirical/operational/owner criteria."],
  "S17-013": ["numerical", ["script/verify-portable-overlay-recovery.ts","script/verify-overlay-replay.ts","server/snapshots/resultContract.ts"], "Prior portable private bundle reproduces nine calculator outputs and XLSX exact hashes, checks missing/corrupt/version, outside checkout/node_modules under Linux network denial.", [], "Full clean original research/model reproduction and accepted numerical tolerances remain absent; bounded bundle does not cover all Stage17 analyses.", "Reproduce all required real analyses in staged fresh environment and compare stored hashes/tolerances without synthetic replacement.", "Prior portable report allNineAndXlsxMatch=true, networkDenied=true; integrity manifest is not signed provenance."],
  "S17-014": ["judgement", ["docs/Company_Review_Pack.md",researchReport], "Original requirement demands independent owner reproduction/checks; no developer action can manufacture that receipt.", [], "Owner review and tolerance comparison have not happened.", "Owner independently checks accepted pack and records per-analysis actual versus expected values/tolerances and signoff.", "No owner-approved scope change or owner match claimed."],
  "S17-015": ["operational", ["server/routes.ts","server/calculation/analysisManifest.ts",suiteLog,"generated-artifacts/workplan-completion/20261110T085410274732Z.log"], "Existing build-info reports hosting-supplied sourceCommit or null; health is liveness, not scientific readiness. Prior retained live receipt has sourceCommit da140f272a058d093662530e48c66dbc2266c9dc and health200.", [], "Current uncommitted worker edits have not been deployed; historical observed SHA is not current working tree or current displayed full model/data agreement.", "After separately authorized future release, owner compares exact productionSHA/health/model/data identities against selected manifest and records live receipt; no release in this task.", "Prior 2026-11-10T08:54:10Z observation only; no new production check or deployment performed."],
};

const operatorExecution = {
  command: "npx tsx --test script/operator-contract.test.ts",
  executed_at: "2026-11-10T09:13:56Z", log: operatorLog, log_sha256: sha(operatorLog),
  result: "PASS 8/8; zero failed/skipped. Direct releaseSafety middleware unit checks, not actual HTTP mutations.",
  count: 8, git_commit: null,
};
const labelExecution = {
  command: "npx tsx --test script/research-support-labels.test.ts script/research-family.test.ts script/operator-contract.test.ts",
  executed_at: "2026-11-10T09:20:07Z",
  log: "generated-artifacts/operator-contract/research-labels.log",
  log_sha256: sha("generated-artifacts/operator-contract/research-labels.log"),
  result: "PASS16/16, zero failed/skipped: five new decision fixtures, three existing full-family regressions, eight operator boundary checks.",
  count: 16, git_commit: null,
  evidence_scope: "Explicit engineering decision fixtures, not actual historical efficacy or independent owner review.",
};
const priorHttp = {
  command: "NODE_ENV=development npx tsx script/check-nine-http-recovery.ts",
  executed_at: null, log: "generated-artifacts/nine-http-recovery/test-final.log",
  log_sha256: sha("generated-artifacts/nine-http-recovery/test-final.log"),
  report: "generated-artifacts/nine-http-recovery/report.json",
  result: "PASS nine read-only paths: repeat, same-selection concurrency, stored retrieval, return-default, invalid selection422; publicPOST403.",
  count: 9, git_commit: null,
  evidence_scope: "Prior execution retained; exact timestamp not embedded in this log. No unchanged rerun. Not current-workbook mutation, distinct-selection or instrumented cache proof.",
};
const priorPortable = {
  command: "NODE_ENV=development npx tsx script/verify-portable-overlay-recovery.ts",
  executed_at: null, log: "generated-artifacts/portable-overlay-recovery/final.log",
  log_sha256: sha("generated-artifacts/portable-overlay-recovery/final.log"),
  report: "generated-artifacts/portable-overlay-recovery/report.json",
  result: "PASS nine calculator/XLSX hashes; missing/corrupt/version rejected; no checkout/node_modules resolution; Linux network namespace recovery and ENETUNREACH probe.",
  count: 9, git_commit: null,
  evidence_scope: "Prior private engineering fixture; exact execution date not embedded. No unchanged rerun, no whole-model scientific or clean-staging acceptance.",
};
const verified = new Set(["S14-022", "S14-023", "S14-024"]);
const missingFiles = new Set();
const sourceEvidence = files => files.map(path => {
  // Original-corpus assembly is a function in the existing corpus module.
  if (path === "server/calculation/pairedResearchOriginalCorpus.ts") path = C;
  if (path === ".github/workflows/ci.yml") path = ".github/workflows/validation.yml";
  if (!existsSync(path)) { missingFiles.add(path); return { path, sha256: null, missing: true }; }
  return { path, sha256: sha(path), check: "source inspection, not an execution receipt" };
});
const originals = ledger.stages.filter(s => s.stage >= 14 && s.stage <= 17).flatMap(s => s.requirements);
if (originals.length !== 74 || Object.keys(rows).length !== 74) throw Error("Expected all74 clauses");
const records = originals.map(original => {
  const [check, rawFiles, behavior, tests, gap, action, result] = rows[original.id] ?? [];
  if (!check) throw Error(`Unreviewed ${original.id}`);
  const files = [...new Set(rawFiles.map(path =>
    path === "server/calculation/pairedResearchOriginalCorpus.ts" ? C :
    path === ".github/workflows/ci.yml" ? ".github/workflows/validation.yml" : path))];
  const actualExecutions = execution(tests);
  if (original.id === "S17-001") actualExecutions.push({
    command: "npx tsx --test script/reconciliation-stages-14-17.test.ts",
    executed_at: "2026-11-10T09:21:49Z",
    log: "generated-artifacts/operator-contract/reconciliation-validation-final.log",
    log_sha256: sha("generated-artifacts/operator-contract/reconciliation-validation-final.log"),
    result: "PASS3/3: all74 protected original contracts/fields, complete evidence/check/ready-action schema, all300 unique matrix rows with sourceSHA/classification.",
    count: 3, git_commit: null,
    evidence_scope: "Validates proposed matrix structure, not passage of the300 criteria. Initial missing source-pointer failure retained in reconciliation-validation.log; fixed with explicit original-contract-only fallback, never invented execution.",
  });
  if (["S14-009","S14-013","S14-016"].includes(original.id)) actualExecutions.push(labelExecution);
  if (["S16-006", "S16-011"].includes(original.id)) actualExecutions.push(operatorExecution);
  if (["S15-016","S16-009","S16-011","S17-013"].includes(original.id)) actualExecutions.push(priorHttp);
  if (["S15-016","S16-007","S16-009","S17-002","S17-013"].includes(original.id)) actualExecutions.push(priorPortable);
  return {
    ...structuredClone(original),
    status: verified.has(original.id) ? "verified" : "partial",
    check_type: check,
    existing_evidence: [...new Set([...(original.existing_evidence ?? []), ...files,
      ...(original.id.startsWith("S14") || original.id.startsWith("S15") ? [researchReport] : [])])],
    evidence_caveat: verified.has(original.id)
      ? "Verified only the exact explicitly fixture-based numerical criterion from direct retained execution; no empirical efficacy, owner review or production acceptance."
      : "Clause-level source inspection plus only the actual bounded execution receipts listed. Partial implementation is not complete acceptance. Missing historical research is not replaced by proxy efficacy.",
    files_functions_changed: original.id === "S14-013"
      ? ["server/calculation/researchFamily.ts: adjudicateResearchFamily exact3/2/<2 qualified decision labels",
         "script/research-support-labels.test.ts: five explicit decision fixtures"]
      : original.id === "S16-006" || original.id === "S16-011"
      ? ["server/operatorContract.ts: operatorLifecyclePreflight/operatorContract",
         "script/operator-lifecycle-preflight.ts", "script/operator-contract.test.ts"]
      : ["script/reconcile-stages-14-17.mjs: clause-specific proposed record and acceptance-matrix generation"],
    implementation_files_functions: files.map(path => ({ path, behavior })),
    behaviour_delivered_this_run: "Reconciled original clause against exact existing functions and retained actual logs. " +
      (original.id === "S14-013"
        ? "Implemented exact complete-family3/2/<2 decision labels, retained all-three-only supported boolean and missing-evidence refusal;16 focused tests passed."
        : original.id === "S16-006" || original.id === "S16-011"
        ? "Added read-only existing-operator boundary preflight and eight passing public403/no-fabricated-principal tests. No privileged HTTP path or bypass."
        : "No analytical calculation or source data changed by this record."),
    delivered_behavior: behavior,
    inputs_versions_assumptions: [
      "Original protected id/requirement/source_section/origin copied verbatim from existing ledger; no original contract or scientific threshold relaxed.",
      "Working-tree source SHA256 receipts identify inspected files; current Git baseline is not a deployed revision, protocol precommitment or exact historical test commit.",
      ...(original.id.startsWith("S14") || original.id.startsWith("S15") ? [
        "Historical market/return data cutoff required by original plan: 2026-01-22. Paired projections and valuations require matching growth basis, currency, horizon and nominal definition.",
        "Synthetic ENGINEERING fixtures are explicitly labelled and never original issuer evidence, actual historical efficacy or owner review.",
      ] : [
        "Current-code archived-input replay is not an original-vintage forecast, authenticated current-source mutation lifecycle or complete old-executable restoration.",
      ]),
    ],
    formulas_and_thresholds: [behavior, result, "Original criterion retained verbatim in requirement; no owner-approved scope change assumed."],
    executions: [...(original.executions ?? []), ...actualExecutions],
    numerical_results: [result],
    scientific_acceptance: "not-assessed",
    owner_review: { status: "not-performed", receipt: null, caveat: "Developer work cannot supply independent owner checks." },
    git_commit: null,
    inspected_git_baseline: git,
    inspected_source_sha256: sourceEvidence(files),
    deployment_revision: null,
    remaining_gaps: gap ? [gap] : [],
    next_action: action,
    ready_action: {
      owner: ["S17-008","S17-014"].includes(original.id) ? "independent owner"
        : ["S16-006","S16-011"].includes(original.id) ? "genuine authentication maintainer + authorized workspace importer/database operator"
        : "implementation/research owner under existing authorization",
      action,
      can_execute_now_without_external_acceptance: !["S17-008","S17-014","S16-011","S17-015"].includes(original.id),
      restriction: "No purchases, DDL, real issuer approvals, production mutation, collector changes, commits, release or callback. Preserve public mutation403.",
    },
    blockers: gap ? [{
      kind: check === "judgement" ? "independent judgement and/or incomplete evidence" : "specific missing original-scope evidence/implementation",
      detail: gap, owner_action: action,
    }] : [],
    reconciled_at: new Date().toISOString(),
  };
});
if (missingFiles.size) throw Error(`Incorrect evidence paths: ${[...missingFiles].join(", ")}`);
const byId = new Map(records.map(r => [r.id,r]));
const allOriginals = ledger.stages.flatMap(stage => stage.requirements.map(r => ({ stage: stage.stage, ...r })));
if (allOriginals.length !== 300 || new Set(allOriginals.map(r=>r.id)).size !== 300)
  throw Error("Acceptance matrix requires all300 unique original clauses");
function inferredCheck(r) {
  if (r.check_type) return r.check_type;
  if (/owner|review|accept|licen[cs]e|disclos|judg/i.test(r.requirement)) return "judgement";
  if (/numer|interval|metric|formula|tolerance|converg|return|rank|forecast|temperature|emission/i.test(r.requirement)) return "numerical";
  if (/operat|deploy|archive|reproduc|database|scheduler|refresh|recovery/i.test(r.requirement)) return "operational";
  return "exact";
}
const matrix = allOriginals.map(original => {
  const r = byId.get(original.id) ?? original;
  const files = [...new Set(r.existing_evidence ?? [])].filter(path => typeof path === "string" && existsSync(path));
  const evidence = files.map(path => ({
    path, sha256: sha(path),
    evidence_kind: "source/report pointer; execution authority only from explicit executions",
  }));
  if (!evidence.length) evidence.push({
    path: "docs/workplan_completion_ledger.json",
    sha256: sha("docs/workplan_completion_ledger.json"),
    evidence_kind: `Original contract/status source for ${original.id} ONLY; no direct execution evidence retained in this matrix cell. Owning worker must reconcile.`,
  });
  return {
    stage: original.stage, id: original.id, requirement: original.requirement,
    status: r.status, check_type: inferredCheck(r),
    check_type_basis: byId.has(r.id) || r.check_type ? "clause-specific review" : "provisional text classification pending owning worker merge",
    evidence,
    executions: r.executions ?? [],
    inspected_git_baseline: git, git_commit: r.git_commit ?? null, deployment_revision: r.deployment_revision ?? null,
    remaining_gaps: r.remaining_gaps ?? [], next_action: r.next_action,
    proposed_stage14_17_record: byId.has(r.id),
    caveat: byId.has(r.id) ? "Proposed by this worker; parent merges." : "Current ledger status is provisional until owning worker records are merged; not independently reverified here.",
  };
});
byId.get("S17-001").acceptance_matrix = {
  version: "original-300-clause-proposed-matrix-1", count: matrix.length,
  original_contract_sha256: createHash("sha256").update(JSON.stringify(allOriginals.map(r => ({
    id:r.id, requirement:r.requirement, source_section:r.source_section, origin:r.origin,
  })))).digest("hex"),
  parent_must_regenerate_after_all_worker_records_merge: true,
  rows: matrix,
};
// Matrix has copies, not references to avoid recursively embedding S17-001.
const output = { records };
writeFileSync("docs/reconciliation-stages-14-17.json", JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({
  output: "docs/reconciliation-stages-14-17.json", records: records.length,
  stage_counts: Object.fromEntries([14,15,16,17].map(stage => [stage,records.filter(r=>r.id.startsWith(`S${stage}-`)).length])),
  verified: records.filter(r=>r.status==="verified").map(r=>r.id), matrix: matrix.length,
  ledger_edited: false,
}));
