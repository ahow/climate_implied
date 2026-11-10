/** Read-only evidence reconciliation. Writes only the requested proposed records;
 * never updates central ledgers, runs studies, fetches data or approves identities. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const root = "generated-artifacts/company-operating-corpus/primary-filings";
const ledgerPath = "docs/workplan_completion_ledger.json";
const ledgerBytes = readFileSync(ledgerPath);
const ledger = JSON.parse(ledgerBytes.toString("utf8"));
const protectedFields = ["id", "requirement", "source_section", "origin"] as const;
const allCanonicalClauses = ledger.stages.flatMap((s: any) => s.requirements);
assert.equal(allCanonicalClauses.length, 300, "Original global contract must retain all 300 clauses");
// Match merge-clause-reconciliation.py's json.dumps(sort_keys=True), including
// ASCII escaping and separators, so this is the same global contract digest.
function pythonCanonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(pythonCanonical).join(", ")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.keys(value).sort().map(k => `${pythonCanonical(k)}: ${pythonCanonical(value[k])}`).join(", ")}}`;
  return JSON.stringify(value).replace(/[\u0080-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
const contract = (clauses: any[]) => sha(pythonCanonical(clauses.map(r =>
  Object.fromEntries(protectedFields.map(k => [k, r[k] ?? null])))));
const originalContractHash = contract(allCanonicalClauses);
const sourceHash = ledger.source_sha256, amendmentsHash = ledger.amendments_sha256;
assert.match(sourceHash, /^[a-f0-9]{64}$/);
assert.match(amendmentsHash, /^[a-f0-9]{64}$/);
const filing = json(`${root}/readiness-report.json`);
const market = json(`${root}/market-reference-attempt.json`);
const shares = json(`${root}/share-review/report.json`);
const d8path = "generated-artifacts/valuation-comparison/6969aecefbcde9427d7b597181bc1fc62534eff3e9dbd2be776a0bb6b3f835a9.json";
const d8 = json(d8path);
const betaPath = "generated-artifacts/company-beta/growth-b4f7f4b28405d3d3c46fb57fed9ecfab4a8c4c76a2f76365e8c6621e99a09d98.json";
const beta = json(betaPath);
const fslrPath = "generated-artifacts/company-operating-corpus/FSLR-five-year-conditional-results.json";
const fslr = json(fslrPath);
const fslrFullLatest = json("generated-artifacts/company-operating-corpus/fslr-full-cashflow/latest.json");
const fslrFull = json(fslrFullLatest.reportPath);
const fslrReleaseText = readFileSync(fslrFull.source.path, "utf8");
for (const label of ["UNAUDITED CONSOLIDATED BALANCE SHEETS", "UNAUDITED CONSOLIDATED STATEMENTS OF OPERATIONS",
  "UNAUDITED CONSOLIDATED STATEMENTS OF CASH FLOWS"])
  assert.ok(fslrReleaseText.includes(label), `Primary source classification missing: ${label}`);
const financialBasis = {
  selected_original_case: { fiscal_year: 2024, source_type: "FY2024 annual report containing Form 10-K",
    source_path: `${root}/FSLR-2024.pdf`, source_sha256: filing.cases[0].facts.sourceHash,
    unchanged: true },
  new_distinct_conditional_experiment: { historical_anchor_fiscal_year: 2025, guidance_year: 2026,
    forecast_calendar_years: [2027, 2028, 2029, 2030, 2031],
    source_type: "unaudited-issuer-earnings-release", is_form_10k: false,
    source_url: fslrFull.source.url, published_date: "2026-02-24",
    source_hash: fslrFull.source.sourceHash, assumption_freeze_at: fslrFull.freezeReceipt.frozenAt,
    qualification: "Separate FY2025-anchor/2026-guidance frozen conditional experiment; NOT a replacement, latest-filing claim, or relabelling of the selected FY2024 case." },
  original_case_basis_silently_replaced: false,
};
const fslrMarketAttempt = market.attempts.find((a: any) => a.symbol === "FSLR");
const asOfPriceTreatment = {
  price_date: fslrMarketAttempt.quoteDate, captured_at: market.startedAt,
  assumption_freeze_at: fslrFull.freezeReceipt.frozenAt,
  last_available_close_can_be_legitimate_asof_information: true,
  quote_predating_freeze_is_itself_blocker: false,
  capture_before_freeze: Date.parse(market.completedAt) <= Date.parse(fslrFull.freezeReceipt.frozenAt),
  qualification: "A last available close captured before freeze may legitimately inform a current as-of analysis; it does NOT authorize backdating newly frozen assumptions to that close or establish a complete paired market reference.",
  actual_unresolved_pair_requirements: [
    "Exact primary total-common shares/classes effective on the price date, or an explicitly evidenced/reviewed as-of share/action bridge; none supplied by the existing receipts.",
    "Reviewed issuer/security/financial basis and authorized price use; XOM succession remains review-only, never an automatic ticker join.",
    "Justified sustainable terminal/reinvestment and common-claim boundary; none selected to force a value.",
    "Five calendar-year 2027–2031 schedules are not automatically a complete valuation horizon from November 2026: any remaining-2026 stub and cash-flow timing need explicit treatment.",
  ],
  original_exact_date_pair_gate_and_historical_cutoffs_relaxed: false,
  actual_qualified_pairs: 0,
};
const existingLog = (stage: number, suffix = "00") => `generated-artifacts/workplan/stage-${stage}-${suffix}.log`;
const logSummary = (path: string) => {
  const text = readFileSync(path, "utf8");
  return { path, sha256: sha(text),
    tests: Number(text.match(/^# tests (\d+)$/m)?.[1] ?? 0),
    pass: Number(text.match(/^# pass (\d+)$/m)?.[1] ?? 0),
    fail: Number(text.match(/^# fail (\d+)$/m)?.[1] ?? 0),
    executionDate: null, dateCaveat: "Existing log has no execution timestamp; filesystem time is not substituted." };
};
type Evidence = {
  checkType: string; functions: string[]; behavior: string; inputs: string; formulas: string[];
  command: string | null; executionDate: string | null; logs: unknown[]; results: unknown;
  thresholds: string[]; revisions: string[]; gaps: string[]; nextAction: string;
};
const evidence: Record<string, Evidence> = {
  identity: {
    checkType: "existing-synthetic-contract-tests-and-real-full-denominator-refusal",
    functions: ["server/financialData/identity.ts:acceptIdentity", "server/financialData/identity.ts:reconcileIdentities",
      "server/financialData/mappingDiagnostics.ts:diagnoseMapping", "server/financialData/provider.ts:assessMapping"],
    behavior: "Exact evidence remains candidate; wrong ISIN/currency/exchange/ADR and ambiguous classes refuse. Lifecycle unknown and review state must remain distinct. Developer performs no approval.",
    inputs: "Original 2,442 structurally valid ISINs; provider listing/class evidence; explicit review decisions.",
    formulas: ["coverage=accepted/eligible with original denominator preserved"],
    command: "npx tsx --test script/isin.test.ts script/financial-identity.test.ts script/financial-mapping.test.ts script/financial-review.test.ts script/statement-history.test.ts script/minor-currencies.test.ts",
    executionDate: null, logs: [logSummary(existingLog(10)), { path: existingLog(10, "01"), sha256: sha(readFileSync(existingLog(10, "01"))) }],
    results: { originalUniverse: 2442, eligible: 2442, acceptedInHistoricalAudit: 1, unresolvedInHistoricalAudit: 2441,
      historicalCoverage: 1 / 2442, historicalAuditPassed: false, newlyApproved: 0,
      caveat: "Historical audit counts are not asserted to be a refreshed current approval ledger." },
    thresholds: [">=95% accepted among verified-listed eligible, plus full-baseline status reconciliation",
      "50 accepted-match stratified audit: zero unexplained errors", "50 unmatched plus 50 ambiguous root-cause cases"],
    revisions: ["No ticker-only merge; unknown lifecycle cannot inflate completion"],
    gaps: ["No new complete lifecycle/full-universe checkpoint or accepted-match audit",
      "Root-cause 50+50 audit, independent review and region/sector coverage not established here"],
    nextAction: "Complete primary listing/class/lifecycle evidence and required audits; submit candidates to existing independent review workflow.",
  },
  currency: {
    checkType: "existing-synthetic-unit-and-input-normalization-contracts",
    functions: ["server/financialData/currencies.ts:majorCurrency", "server/financialData/currencies.ts:normalizeMonetaryValue",
      "server/financialData/statementHistory.ts:normalizeStatementHistory"],
    behavior: "Minor units are case-sensitive, not FX; statement/quote mismatches and publication proxies remain explicit.",
    inputs: "Native statement currencies, quote units, fiscal/filing dates; GBp/ZAc/ILA fixtures.",
    formulas: ["minor-unit value / 100 => major-unit value only for explicitly recognized denominations",
      "FCFE=CFO-capex+cash debt proceeds-cash debt repayments; CFO working capital not deducted twice"],
    command: "npx tsx --test script/statement-history.test.ts script/minor-currencies.test.ts",
    executionDate: null, logs: [logSummary(existingLog(10))], results: "16 combined Stage 10 tests passed; not a full workbook currency audit.",
    thresholds: ["No implicit FX or mixed-currency aggregate", "All original/restated/publication flags remain explicit"],
    revisions: ["No latest FY2025 provider values replace frozen FY2024 filing controls"],
    gaps: ["Workbook-wide profit/cap currency audit, dated FX for every conversion and sector/region history/restatement coverage absent"],
    nextAction: "Audit native workbook and statements; attach dated FX receipts only where required; report missingness by sector/region.",
  },
  filing: {
    checkType: "actual-retained-primary-document-accounting-extraction-not-forward-case",
    functions: ["script/prepare-company-primary-filings.ts:definitions and filing extraction", "server/calculation/companyFilingPair.ts:buildCompanyFilingPair"],
    behavior: "Hash-retained FY2024 reports produce three separate historical bridges and refuse unresolved common claims/market evidence. Mirrored filing bytes are not SEC-authentication approval.",
    inputs: "FY2024 FSLR/NEE/XOM PDF and text hashes; signed document dates 2025-02-25/2025-02-14/2025-02-19.",
    formulas: ["FCFE=CFO-identified capital spend+cash debt proceeds-cash debt repayments",
      "NEE broad NEER investing+nuclear fuel+other capex differs from provider's narrower 8.514bn capex field"],
    command: "npx tsx script/prepare-company-primary-filings.ts",
    executionDate: filing.cases[0].facts.observedAt.slice(0, 10),
    logs: [{ path: `${root}/readiness-report.json`, sha256: sha(readFileSync(`${root}/readiness-report.json`)) }],
    results: { primaryReports: 3, baseFcfeUsd: filing.cases.map((c: any) => ({ symbol: c.facts.symbol, fcfe: c.baseFcfe })),
      actualWholeEquityPairs: 0, completeCases: 0 },
    thresholds: ["Exact retained source/text hashes", "No negative-base recovery invented", "Unresolved NCI/reinvestment/credit timing blocks completion"],
    revisions: ["FY2024 explicit historical choice; not latest-year substitution", "FSLR FY2025 guidance experiment kept separate from FY2024 filing bridge"],
    gaps: ["NEE differential membership/NCI, broad investing and financing sustainability",
      "XOM investments/acquisitions/divestments and common cash claim allocation",
      "FSLR negative historical FCFE and prospective capex/45X monetization timing"],
    nextAction: "Resolve issuer-specific common-equity and reinvestment boundaries with primary statement notes before forward-case acceptance.",
  },
  shares: {
    checkType: "actual-primary-sources-and-successful-provider-receipts-with-explicit-date-refusals",
    functions: ["server/calculation/companyShareEvidence.ts:primaryCommonSharesSchema",
      "server/calculation/companyShareEvidence.ts:reviewCompanyShareReference", "script/review-company-primary-shares.ts",
      "script/validate-company-filing-private.ts"],
    behavior: "Dated exact common counts are not EPS averages, float or marketCap/price. All four observations fail legitimate same-date quote pairing. New XOM primary succession supports REVIEW only.",
    inputs: "Three retained FY2024 cover common counts; issuer-hosted XOM Q3 2026 10-Q and filing index; existing nine successful FMP receipts and three Nov 9 dated quotes.",
    formulas: ["Whole common equity=sum(class-specific price*class shares) only after class/date/claim review",
      "issued-treasury=outstanding where both counts explicit; rounded millions cannot establish exact shares"],
    command: "npx tsx script/review-company-primary-shares.ts",
    executionDate: shares.generatedAt.slice(0, 10),
    logs: [{ path: `${root}/share-review/acquisition.log`, sha256: sha(readFileSync(`${root}/share-review/acquisition.log`)) },
      { path: `${root}/share-review/report.json`, sha256: sha(readFileSync(`${root}/share-review/report.json`)) }],
    results: { observations: 4, blockedChecks: 4, successfulFmpCalls: 9, datedQuotes: 3,
      quotesCapturedAt: market.startedAt, quoteDates: market.attempts.map((a: any) => a.quoteDate),
      successionEffectiveDate: "2026-07-01", newPrimarySourceCaptureTimes: shares.receipts.map((r: any) => r.capturedAt),
      newPrimaryReceipts: shares.receipts.map((r: any) => ({ url: r.url, sha256: r.sha256, capturedAt: r.capturedAt })),
      primarySuccession: "Outstanding predecessor common exchanged 1:1; predecessor treasury cancelled; unchanged consolidated reporting basis; successor registrant EMHC.",
      splitEvidence: "NEE four-for-one effective 2020-10-26; not reapplied to adjusted data",
      identityApproved: false, actualPairs: 0 },
    thresholds: ["Exact priceDate=sharesDate=referenceDate; no carry-forward/interpolation",
      "Primary publication must precede reference; actual capture time never backdated",
      "All common classes and unrounded shares; corporate action/ISIN continuity review separate"],
    revisions: ["Provider outcome corrected to successful-but-evidence-incomplete, not provider failure",
      "XOM successor primary evidence replaces unexplained mismatch with review-only continuity candidate, never automatic identity acceptance"],
    gaps: ["No primary exact share observation on 2026-11-09", "FY2024 facts and November 2026 quote cannot silently share an information set",
      "XOM primary filing does not authenticate old/new ISIN", "Known split and redomicile are not complete action histories"],
    nextAction: "Obtain primary common shares/classes/actions effective on a legitimate authorized quote date and review successor ISIN/class chain; otherwise retain zero pairs.",
  },
  valuation: {
    checkType: "existing-synthetic-numerical-solver-and-retained-actual-diagnostic-sensitivity",
    functions: ["server/calculation/cashFlowValuation.ts:cashFlowValue", "server/calculation/cashFlowValuation.ts:reverseCashFlowGrowth",
      "server/calculation/companyFilingPair.ts:buildCompanyFilingPair"],
    behavior: "FCFE uses cost of equity, no net-debt subtraction; FCFF requires explicit bridge/WACC. Financials/nonpositive base/unbracketed targets unavailable. Five growth years, ten-year fade, terminal year 15.",
    inputs: "Synthetic perpetuity/recovery fixtures; retained CAT/CVX/NEE diagnostic grid; no new market data.",
    formulas: ["PV=sum(CF_t/(1+r)^t,t=1..15)+CF15*(1+gT)/(r-gT)/(1+r)^15",
      "g_t=g1 (t<=5); g_t=g1+(gT-g1)*(t-5)/10 (6..15)",
      "Gordon g=r-E/P remains primary; nonpositive/missing earnings unavailable"],
    command: "npx tsx --test script/cash-flow-valuation.test.ts script/valuation-solver.test.ts script/valuation-integrity.test.ts script/valuation-statistics.test.ts script/valuation-comparison.test.ts script/completed-cash-flow.test.ts",
    executionDate: null, logs: [logSummary(existingLog(11))],
    results: { combinedSyntheticTests: 18, passed: 18, priorDiagnosticCases: 54, priorAllSolved: true,
      maximumPriorRelativeRepricingError: 1.23e-15, source: "docs/Company_Valuation_Sensitivity_Results.md" },
    thresholds: ["Textbook known-growth reproduction 0.01 percentage point", "Diagnostic repricing relative error <=1e-8",
      "r>terminal growth; fixed growth bracket [-50%,50%]; no extrapolation"],
    revisions: ["Original terminal range 2.5–4% differs from separately frozen 1–3% diagnostic grid; grid is not silently original protocol",
      "Existing rates 6/8/10% and terminal 1/2/3% are diagnostic assumptions, not selected to pass",
      "Cashflow CFO correction removes second WC deduction; earnings/reinvestment solver is a separate model"],
    gaps: ["Reliable debt-data FCFF cross-check, financial-sector residual income model and seven-criterion full comparison not complete",
      "54 mixed-date diagnostics and nine synthetic filing pairs are not actual paired issuer forecasts"],
    nextAction: "Finish reliable company-date inputs, appropriate financials model or explicit not-modelled coverage, and all seven criteria without changing Gordon.",
  },
  d8: {
    checkType: "existing-actual-revised-history-negative-result-read-only-no-rerun",
    functions: ["server/financialData/asOfValuation.ts:buildAsOfRows", "server/financialData/completedCashFlow.ts:completedCashFlowOutcomes",
      "server/calculation/valuationComparison.ts:compareValuationModels"],
    behavior: "Common eligible paired completed three-year FCFE outcomes, equal-origin weighting, circular blocks; both forecast and signal lower bounds must exceed zero. Never auto-promotes.",
    inputs: "27 retained candidates, origins July 2017–2022; original 2026-11-09 evaluation cutoff; revised-history statements.",
    formulas: ["actual FCFE CAGR=(FCFE_t4/FCFE_t1)^(1/3)-1",
      "MAE improvement=MAE_Gordon-MAE_DCF", "IC improvement=IC_DCF-IC_Gordon"],
    command: "Historical only: npx tsx script/build-asof-valuation-rows.ts generated-artifacts/company-worked-inputs/*.json ; npx tsx script/compare-valuation-models.ts <retained asof-input>",
    executionDate: "2026-11-10", logs: [{ path: d8path, sha256: sha(readFileSync(d8path)) }],
    results: { supplied: d8.coverage.supplied, complete: d8.coverage.completeAvailable,
      originCounts: d8.diagnostics.map((d: any) => ({ date: d.date, n: d.count })),
      forecastMAEImprovement: d8.forecastMAEImprovement, forecast95: d8.forecastImprovement95,
      signalICImprovement: d8.signalICImprovement, signal95: d8.signalIcImprovement95,
      passes: d8.passesNumericalGate, primaryModel: "Gordon retained" },
    thresholds: [">=10 common companies per origin; >=6 consecutive annual origins; >=2 blocks",
      "2,000 replications; block length 3; seed 20261110; paired 95% intervals; both strict lower bounds >0"],
    revisions: ["138 supplied, 88 complete; unchanged exact fiscal-date endpoints and maturity exclusions",
      "Earlier 11-candidate outcome availability audit is not latest paired coverage",
      "Common-8% failure remains failure; no beta sensitivity overrides it"],
    gaps: ["Validation signal uses implied growth proxy, not new Stage 14 gap signal",
      "All seven criteria with intervals, independent identity review and original-vintage data remain incomplete"],
    nextAction: "Preserve failed result/Gordon primary; develop separately frozen genuine projection-gap validation only after inputs meet criteria.",
  },
  beta: {
    checkType: "existing-completed-frozen-sensitivity-read-only-no-refit-no-rerun",
    functions: ["server/financialData/historicalBeta.ts:historicalBeta", "script/compare-beta-growth.ts",
      "server/financialData/asOfValuation.ts:buildAsOfRows"],
    behavior: "Protocol 73095d6 rates remain frozen; same 88 pairs/outcomes. Narrow leave-one-out peer proxy, not investable market-beta evidence.",
    inputs: "60 monthly returns from 61 workbook observations, prior June cutoff, >=10 other peer contributors, revised history.",
    formulas: ["beta=cov(issuer,peer)/var(peer)", "shrunk beta=0.5*beta+0.5",
      "cost of equity=3%+5%*shrunk beta"],
    command: "Historical only: npx tsx script/compare-beta-growth.ts (not rerun in this increment)",
    executionDate: "2026-11-10", logs: [{ path: betaPath, sha256: sha(readFileSync(betaPath)) }],
    results: beta.summaries,
    thresholds: ["No current beta backfill; missing windows unavailable", "r>3% terminal and r<100%; no clipping",
      "Same three-origin 2,000-draw seed-20261110 bootstrap; not D8 reselection"],
    revisions: ["No protocol 73095d6 change; no 88-pair rerun; no return scoring or common-eight failure override"],
    gaps: ["Risk-free/ERP are assumed sensitivities, not contemporaneous dated rates; broad benchmark absent"],
    nextAction: "Retain existing sensitivity labels; do not repeat or use it to promote reverse DCF.",
  },
  projection: {
    checkType: "existing-pure-engine-contracts-and-three-real-accounting-controls-not-climate-forecasts",
    functions: ["server/financialData/companyBaseline.ts:reconcileCompanyBaseline",
      "server/calculation/companyProjection.ts:projectCompanyMembers",
      "server/calculation/researchCorrections.ts:pairedGrowthGap",
      "server/calculation/companyProjectionAsOf.ts:projectCompanyAsOf",
      "server/calculation/companyProjectionReplay.ts:pinCompanyProjection"],
    behavior: "Unique weighted operating exposures sum to one; per-exposure cumulative activity, history-bounded margin, explicit attribution/nonoperating/other cash. Scope 3 never direct charge. Aligned members and same definitions required.",
    inputs: "Five ordered annual paths, 2–1,000 supplied members, scoped tonnes/intensities, explicit liable fractions/pass-through and cash schedules.",
    formulas: ["revenue=base revenue*sum(weight*cumulative sector activity)*share multiplier",
      "emissions_scope=base tonnes_scope*activity ratio*intensity multiplier_scope",
      "drag=(S1*liable1+S2*liable2)*effective price*(1-pass-through)",
      "FCFE=net income+depreciation+other cash-capex-increase WC+net borrowing",
      "paired gap member=projected member-implied same-ID member; not difference of marginal medians"],
    command: "npx tsx --test script/workplan-corrections.test.ts script/company-projection.test.ts script/company-baseline.test.ts",
    executionDate: null, logs: [logSummary(existingLog(12))],
    results: { combinedTests: 9, passed: 9,
      accountingControls: "CAT/CVX/NEE source-backed constant and no-new-net-borrowing; no climate interpretation",
      controlBaseFcfeBillions: { CAT: 9.619, CVX: 18.612, NEE: 16.384 },
      fullClimateIssuerCases: 0 },
    thresholds: ["Exposure sum within 1e-9", "No missing explicit cash bridge entries",
      "Five-year nominal currency/basis/horizon/member identity equality before gap comparison"],
    revisions: ["Added mandatory nonOperatingIncome/incomeAttributionAdjustment/otherCashAdjustments",
      "FY2024 primary NEE broader capex bridge is 0.169bn, not narrow provider control 16.384bn; do not silently mix definitions"],
    gaps: ["No three full actual climate-linked issuer projections", "Operating-geography/market-cap/emissions coverage, empirical share reversion and joint uncertainty not supplied",
      "Retrospective input publication evidence must be checked independently; source-only replay tests do not establish historical vintage"],
    nextAction: "Populate real issuer scope/segment/geography and full annual cash schedules; replay using explicit as-of evidence; keep controls separate.",
  },
  channels: {
    checkType: "existing-actual-primary-climate-channel-plus-labelled-conditional-assumptions",
    functions: ["server/calculation/companyConditionalCases.ts:buildFplSolarCases",
      "server/calculation/companyCashflowBridge.ts:calculateFplCashBridge",
      "server/calculation/companyConditionalCases.ts:calculateCcsOperatingChannel",
      "server/calculation/solarManufacturingCase.ts:solarManufacturingPolicyBridge",
      "server/calculation/issuerConditionalFiveYear.ts:buildFslrIssuerFiveYear"],
    behavior: "FPL solar mechanism incremental only; XOM contracted CCS tonnes not a tariff/FCFE; CAT data-center growth rejected as climate causality; FSLR policy retention remains separately frozen conditional issuer experiment.",
    inputs: "FPL 1,192MW 2027 solar, national historical $1,865/kW proxy, 59.6% equity and 10.95% allowed ROE; XOM ~9m contracted tonnes/year; FSLR 2026 guidance and FY2025 historical rows.",
    formulas: ["FPL capex=MW*1000*$perKW; depreciation=capex/30; equity earnings=admitted average rate base*0.596*0.1095",
      "collections=revenue-increase receivables; FCFE=CFO-capex+debt draw-principal",
      "XOM delivered tonnes=contract tonnes*explicit delivery fraction; fee/cost derivatives only",
      "FSLR credit included in gross profit: remove lost credit once; cash credit=recognized credit-change credit receivable"],
    command: "Historical: npx tsx script/build-company-conditional-cases.ts ; npx tsx script/run-issuer-conditional-five-year.ts (not rerun)",
    executionDate: fslr.provenance.frozenAt.slice(0, 10),
    logs: [{ path: fslrPath, sha256: sha(readFileSync(fslrPath)) }],
    results: { fslrFrozenAt: fslr.provenance.frozenAt, fslrInputHash: fslr.inputHash,
      fslrAssumptionHash: fslr.assumptionHash,
      fslrPaths: fslr.members.map((m: any) => ({ id: m.id, years: m.years.length, finiteFiveYearPv: m.fiveYearFcfePv })),
      fslrTerminalValue: null, fslrWholeEquityPairs: 0,
      incrementalFplCashChannels: 1, physicalOnlyXomChannels: 1, fullCompleteCases: "0/3" },
    thresholds: ["Cash-versus-earnings FCFE reconciliation absolute residual <=0.00001 USD",
      "All assumptions labelled; no probabilities or total-company extrapolation from incremental asset"],
    revisions: ["FPL now has incremental cash bridge, not merely allowed-ROE ledger",
      "FSLR has two five-year issuer-boundary paths; finite-horizon PV is not whole equity",
      "FY2024 FSLR negative-base filing control never replaces FY2025/guidance conditional experiment"],
    gaps: ["NEE full consolidated FPL/NEER/corporate claims missing", "XOM CCS prices/costs/ownership/capex/tax/financing missing",
      "FSLR terminal/reinvestment, same-date shares/quote, supported opening working capital and owner review missing"],
    nextAction: "Keep existing finite FSLR experiment; resolve dated shares and explicit terminal/reinvestment evidence; complete NEE and XOM issuer-wide annual ledgers without invented tariffs.",
  },
  fullPath: {
    checkType: "new-self-contained-synthetic-five-year-ledger-and-same-path-whole-equity-tests",
    functions: ["server/calculation/companyFullCashflowCase.ts:calculateCompanyFullCashflowCase",
      "server/calculation/companyFullCashflowCase.ts:pairCompanyFullCashflowCase"],
    behavior: "Requires five annual revenue-margin-collections-cash-tax-other-WC-capex-debt/noncommon-claim schedules and evidenced terminal assumptions. Forward includes annual losses; reverse refuses losses if monotonicity not guaranteed. No production/default model changes.",
    inputs: "Explicit whole-common-issuer nominal USD ledger; source/assumption IDs with availability; no real issuer forecast is auto-populated.",
    formulas: ["revenue=nonclimate revenue+climate revenue; collections=revenue-change trade receivables",
      "EBIT=revenue*preclimate margin-climate operating cost+recognized credit",
      "CFO=EBIT+D&A+other noncash-recognized credit+cash credit-change AR-other WC-interest-cash tax+other operating cash",
      "FCFE=CFO-capex+cash debt proceeds-repayments-noncommon claims",
      "Forward PV=actual FCFE1..5 discounted + explicit 6..15 continuation + terminal at15",
      "Reverse CF_t=FCFE_t*(1+a)^t for t<=5; fade continuation growth to same terminal; solve price*explicit shares",
      "discount exponent=actual days from reference to explicit calendar year-end cash-flow date/365.25; same in forward and reverse"],
    command: "npx tsx --test script/company-share-evidence.test.ts script/company-full-cashflow-case.test.ts script/company-filing-pair.test.ts",
    executionDate: shares.generatedAt.slice(0, 10),
    logs: [{ path: `${root}/share-review/focused-tests.log`, sha256: sha(readFileSync(`${root}/share-review/focused-tests.log`)) }],
    results: { focusedTestFiles: 3, pass: 3, fail: 0,
      actualSourceBackedConditionalFslrInputsToEngine: fslrFull.cashSchedulesExecuted,
      distinctIssuerCashSchedules: 1, actualWholeEquityPairs: 0 },
    thresholds: ["Five consecutive annual years; AR continuity", "r>terminal; explicit terminal evidence IDs",
      "Fixed [-50%,50%] adjustment bracket and 100 bisections; repricing <=1e-8",
      "Same identity/class/currency/reference/price/share dates; reviewed dated reference required"],
    revisions: ["Reverse result is a path-preserving annual FCFE adjustment, NOT endpoint CAGR or climate activity growth",
      "Existing common-8%/beta/Gordon methods untouched", "New synthetic infrastructure is not a completed actual issuer case"],
    gaps: ["FSLR source-backed frozen schedules now execute without terminal or market evidence; consolidated NEE/XOM schedules remain unfinished",
      "Same-date market reference and sustainable continuation not established; no terminal selected merely to force a pair"],
    nextAction: "Review computed FSLR annual schedules and stress/one-factor cash sensitivities; complete NEE/XOM economics separately, while withholding unqualified whole-equity pairs and retaining 0/3.",
  },
  fslrActual: {
    checkType: "actual-primary-input-backed-frozen-conditional-cash-schedules-plus-independent-accounting-reconciliation",
    functions: ["server/calculation/fslrFullCashflowCase.ts:freezeFslrFullCashflowAssumptions",
      "server/calculation/fslrFullCashflowCase.ts:calculateFslrFrozenFullCashflow",
      "server/calculation/companyFullCashflowCase.ts:calculateCompanyFullCashflowCase",
      "script/run-fslr-full-cashflow-case.ts", "script/validate-company-filing-private.ts"],
    behavior: "Persist assumption document BEFORE calculation; run actual retained primary guidance/balance/earnings/cash rows through full engine. Two main cases plus eight one-factor sensitivities, not ten issuers. No market/terminal requirement blocks cash-ledger implementation.",
    inputs: "FSLR primary unaudited FY2025 release/2026 guidance retained from original capture; FY2024 primary filing phase-down context; new govinfo primary IRS/Treasury final-rule PDF; frozen midpoints, historical stock/sales ratios, explicit cash/financing assumptions.",
    formulas: ["activity=17.6GW annual constant-throughput assumption; sales=5.05bn, aggregate revenue/watt allocation proxy not observed ASP",
      "pre-credit operating margin=(2.5bn-2.145bn-0.6225bn)/5.05bn",
      "recognized45X=2.145bn*statutory phase-down*scenario retention; phase-down=1/1/1/0.75/0.5 for 2027–2031",
      "trade AR=annual sales*(FY2025 AR/FY2025 sales) base, FY2024 ratio stress; inventory similarly; changes consume cash once",
      "credit cash=recognized credit-change separate credit receivable; haircut sensitivity applies to gross credit cash only, no second WC/credit deduction",
      "cash tax=max(0,model pretax)*explicit 20%/30% assumed cash rate; not historical accrual rate",
      "FCFE=CFO-total PP&E capex+cash debt proceeds-repayments; debt closing=opening+draw-repayment",
      "Independent earnings-route reconciliation includes trade/inventory/credit WC and cash-transfer discount once"],
    command: "npx tsx script/run-fslr-full-cashflow-case.ts",
    executionDate: fslrFull.calculatedAt.slice(0, 10),
    logs: [{ path: fslrFullLatest.reportPath, sha256: sha(readFileSync(fslrFullLatest.reportPath)) },
      { path: fslrFullLatest.freezePath, sha256: sha(readFileSync(fslrFullLatest.freezePath)) },
      { path: "generated-artifacts/company-operating-corpus/fslr-full-cashflow/technical-case-v4.log",
        sha256: sha(readFileSync("generated-artifacts/company-operating-corpus/fslr-full-cashflow/technical-case-v4.log")) },
      ...["focused-tests-v4.log", "focused-typecheck-v4.log", "private-validation-v4.log"].map(name => ({
        path: `generated-artifacts/company-operating-corpus/fslr-full-cashflow/${name}`,
        sha256: sha(readFileSync(`generated-artifacts/company-operating-corpus/fslr-full-cashflow/${name}`)),
      }))],
    results: { frozenAt: fslrFull.freezeReceipt.frozenAt, calculatedAt: fslrFull.calculatedAt,
      assumptionHash: fslrFull.frozenAssumptionHash, assumptionsPersistedBeforeCalculation: true,
      sourceCaptureAt: fslrFull.source.originalCaptureAt,
      primaryPolicyUrl: fslrFull.policySource.url, primaryPolicyHash: fslrFull.policySource.sha256,
      policyCapturedAt: fslrFull.policySource.capturedAt,
      scenarios: 10, annualRows: 50, distinctIssuersWithComputedConditionalFullCashSchedules: 1,
      ratios: fslrFull.ratios,
      baseAndStress: fslrFull.cases.slice(0, 2).map((c: any) => ({
        id: c.id, annualFcfe: c.ledger.years.map((y: any) => y.fcfe),
        cumulativeFiveYearFcfe: c.cumulativeFiveYearFcfe,
        maximumAbsoluteReconciliationResidual: Math.max(...c.reconciliations.map((r: any) => Math.abs(r.residual))) })),
      terminalValue: null, actualWholeEquityPairs: 0, completeIssuerCases: "0/3" },
    thresholds: ["Freeze-before-compute byte hash and analytical hash", "Cash/earnings residual <=0.00001 USD for all 50 rows",
      "No forced positive stress/recovery; stressed 2027 and 2031 losses retained", "No terminal chosen merely to produce whole-equity value"],
    revisions: ["Earlier statement 'no supplied schedules' is superseded by actual primary-input-backed conditional schedules through new engine",
      "New engine allows cash-schedule-only execution with ALL terminal inputs absent; partial terminal inputs still throw and all original valuation tests remain",
      "Initial v2 full-engine experiment lacked statutory 2030/2031 phase-down; retained v2 is superseded by v3/v4, sourcing 75%/50% from primary final rule",
      "v4 explicitly persists every sensitivity member's parameters and code hashes before calculation; no economic results/phase-down changed from v3",
      "Original separate FSLR finite-PV experiment unchanged; no beta/Gordon/common-eight/three-case criterion change"],
    gaps: [...fslrFull.remainingGaps.map((gap: string) => gap.startsWith("Existing November 9 quote")
      ? "November 9 last available close was captured before the November 10 freeze and may be legitimate as-of information; missing dated common shares/reviewed identity, sustainable terminal basis and explicit calendar/stub-horizon treatment—not quote age alone—still withhold the qualified pair. No freeze backdating or cutoff relaxation."
      : gap),
      "Constant 17.6GW annual sold-volume scenario assumes sufficient new/renewed orders; disclosed historical backlog is not represented as covering all 2027–2031 sales.",
      "Dated February 2026 guidance is an explicit frozen experiment anchor, not a claim that it is latest guidance as of the November freeze."],
    nextAction: "Review actual computed source-backed FSLR base/stress annual schedules, primary future tax/credit eligibility/collection/advance-payment/maturity evidence and sensitivities; establish legitimate dated shares before any market comparison. Continue consolidated NEE/XOM separately.",
  },
  identification: {
    checkType: "existing-refusal-and-definition-contract-only-no-actual-identified-pathway",
    functions: ["server/calculation/researchCorrections.ts:valuationScenarioEligibility",
      "server/calculation/researchCorrections.ts:pairedGrowthGap"],
    behavior: "Missing mapping gives unavailable; evidence strings never authorize market expectations; expansion requires separate coverage-model review; default model-implied-consistent label.",
    inputs: "Submitted mapping/expansion/identification evidence references, not authenticated causal estimates.",
    formulas: ["physical emissions=activity*intensity, never growth*100", "covered aggregate=sum evidenced company/segment emissions; global expansion requires an explicit population model"],
    command: "npx tsx --test script/workplan-corrections.test.ts",
    executionDate: null, logs: [logSummary(existingLog(13))], results: { tests: 4, pass: 4, fail: 0,
      actualIdentifiedSegments: 0, tier1ActualGlobalRanges: 0, tier2MarketExpectationClaims: 0 },
    thresholds: ["D13 loose and tight owner-confirmed pre-result thresholds: NOT EVIDENCED/NOT INVENTED",
      "Robustness, event response and assumption-range width are necessary assessments, not standalone identification"],
    revisions: ["Amendment corrects original unconditional Tier1/global expansion: missing defensible mapping => unavailable",
      "Stronger label cannot be earned from declared references or narrow sensitivity alone"],
    gaps: ["No evidenced valuation-to-activity inversion or complete assumption registry by segment",
      "Both threshold sets, actual policy events/control/price-deck tests and monthly revised series not run",
      "No global coverage/expansion model, four physical metrics through Stage7 or controlled valuation-emissions association with intervals",
      "No separately justified carbon-price-equivalent model"],
    nextAction: "First document defensible segment activity mapping; predeclare both threshold sets through proper review without inventing values; then test. Otherwise return unavailable/not identifiable.",
  },
};

function assign(stage: number, text: string) {
  if (stage === 10) return /currenc|FX|fundamental|statement|cash.flow|restated/i.test(text) ? ["currency", "filing"] : ["identity", "shares"];
  if (stage === 11) {
    if (/beta|risk.free|discount rate:|WACC/i.test(text)) return ["beta", "valuation"];
    if (/D-8|criteria|seven|comparison|selection|validation.period|signal value|forecast validity|incremental information|plausibility|stability/i.test(text)) return ["d8", "valuation"];
    return ["valuation", "filing", "fullPath", "fslrActual"];
  }
  if (stage === 12) {
    if (/worked|three|utility|producer|industrial|Report back/i.test(text)) return ["channels", "fullPath", "shares", "fslrActual"];
    return ["projection", "channels", "fullPath", "fslrActual"];
  }
  return ["identification", ...( /activity|physical|pure|utility|producer|assumption/i.test(text) ? ["channels"] : [])];
}
type CheckType = "exact" | "numerical" | "operational" | "judgement";
// Criterion-specific review classification; verbose evidence descriptions belong
// in check_scope, never in the four-value check_type field.
const criterionTypes: Record<number, CheckType[]> = {
  10: ["judgement", "exact", "judgement", "exact", "operational", "operational", "numerical",
    "numerical", "judgement", "numerical", "judgement", "operational", "numerical", "numerical"],
  11: ["exact", "exact", "numerical", "numerical", "exact", "judgement", "numerical",
    "exact", "numerical", "numerical", "numerical", "exact", "operational", "operational",
    "exact", "exact", "exact", ...Array<CheckType>(21).fill("numerical"),
    "numerical", "exact", "exact", "numerical", "judgement"],
  12: ["judgement", "numerical", "judgement", "judgement", "judgement", "exact",
    "numerical", "numerical", "numerical", "numerical", "operational", "exact",
    "numerical", "numerical", "numerical", "exact", "judgement", "numerical"],
  13: ["judgement", "judgement", "judgement", "judgement", "judgement", "numerical",
    "judgement", "numerical", "numerical", "numerical", "judgement", "numerical",
    "judgement", "numerical", "operational", "judgement", "exact", "exact",
    "numerical", "numerical", "judgement", "judgement"],
};
assert.deepEqual(Object.fromEntries(Object.entries(criterionTypes).map(([k, v]) => [k, v.length])),
  { 10: 14, 11: 43, 12: 18, 13: 22 });
const retainedRegressionLog = "generated-artifacts/workplan-completion/20261110T083052610508Z.log";
const retainedRegressionText = readFileSync(retainedRegressionLog, "utf8");
type AtomicProfile = { functions: string[]; tests: string[]; names: string[]; artifacts: string[]; inputs: string };
const atomicProfiles: Record<string, AtomicProfile> = {
  identity: { functions: ["server/financialData/identity.ts:acceptIdentity", "server/financialData/identity.ts:reconcileIdentities",
    "server/financialData/mappingDiagnostics.ts:diagnoseMapping", "server/financialData/provider.ts:assessMapping"],
    tests: ["script/financial-identity.test.ts", "script/financial-mapping.test.ts", "script/mapping-diagnostics.test.ts"],
    names: ["explicit review must agree with the checked security and currency",
      "whole universe reconciles without dropping difficult identities or duplicating issuers"],
    artifacts: ["generated-artifacts/financial-data/mapping-audit.json", existingLog(10, "01")],
    inputs: "ISIN/venue/class/ADR candidate evidence and explicit review objects; retained 2,442-company candidate census, not identity approval." },
  rootAudit: { functions: ["script/audit-mapping-root-causes.ts", "script/reassess-mapping-audit.ts",
    "server/financialData/mappingDiagnostics.ts:diagnoseMapping"], tests: ["script/mapping-diagnostics.test.ts"],
    names: ["matching diagnostics distinguish absent providers, excluded listings and unresolved joins"],
    artifacts: ["generated-artifacts/financial-data/root-cause-audit.json", "generated-artifacts/financial-data/reassessed-root-causes.json"],
    inputs: "Retained deterministic 50 unmatched + 50 ambiguous sample from the FULL 2,442-company census; cohort is not silently relabelled the earlier 200-company pilot." },
  matching: { functions: ["server/financialData/provider.ts:figiRequest", "server/financialData/provider.ts:assessMapping",
    "script/audit-financial-mappings.ts", "script/prepare-company-review.ts"],
    tests: ["script/financial-mapping.test.ts"], names: ["exact evidence remains a candidate, never an automatic issuer merge"],
    artifacts: ["generated-artifacts/financial-data/mapping-audit.json", "docs/Company_Review_Pack.md"],
    inputs: "ISIN-first includeUnlistedEquities jobs, bounded profiles, resumable retained census and 27-candidate review packet; zero approvals by this work." },
  currency: { functions: ["server/financialData/currencies.ts:majorCurrency", "server/financialData/currencies.ts:normalizeMonetaryValue",
    "server/financialData/review.ts:financialCalculation", "server/financialData/statementHistory.ts:normalizeStatementHistory"],
    tests: ["script/minor-currencies.test.ts", "script/statement-history.test.ts"],
    names: ["minor-unit normalization is explicit, case-sensitive and never assumes FX",
      "minor-unit quote snapshots require an explicit market-cap denomination"],
    artifacts: [], inputs: "GBp/ZAc/ILA minor-unit and currency-mismatch fixtures; normalization is not a dated FX conversion or a whole-workbook currency audit." },
  statements: { functions: ["server/financialData/statementHistory.ts:normalizeStatementHistory",
    "server/financialData/completedCashFlow.ts:completedCashFlowOutcomes", "script/audit-completed-cash-flow.ts"],
    tests: ["script/statement-history.test.ts", "script/completed-cash-flow.test.ts"],
    names: ["annual cash-flow history avoids double working-capital deduction and reconciles debt"],
    artifacts: ["docs/Company_Coverage_Expansion_Results.md"],
    inputs: "Retained annual candidate statements with fiscal/filing dates and explicit restatement/publication limitations; not complete sector/region histories." },
  cash: { functions: ["server/calculation/cashFlowValuation.ts:cashFlowValue", "server/calculation/cashFlowValuation.ts:reverseCashFlowGrowth"],
    tests: ["script/cash-flow-valuation.test.ts"],
    names: ["cash-flow DCF recovers a perpetuity and its known growth without a payout shortcut",
      "loss-making, financial and unbracketed companies are not forced into a solution"],
    artifacts: ["docs/Company_Valuation_Sensitivity_Protocol.md", "docs/Company_Valuation_Sensitivity_Results.md"],
    inputs: "Explicit cash-flow basis/discount basis, positive starting cash flow, bounded growth, same nominal currency; synthetic base CF100, equity1000, r10%, terminal0." },
  financialRefusal: { functions: ["server/calculation/cashFlowValuation.ts:cashFlowValue",
    "server/calculation/companyProjection.ts:projectCompanyMembers"],
    tests: ["script/cash-flow-valuation.test.ts", "script/company-projection.test.ts"],
    names: ["loss-making, financial and unbracketed companies are not forced into a solution",
      "company projection refuses missing mappings, invalid fractions and unsupported financials"],
    artifacts: [], inputs: "businessType='financial' fixture supplied to industrial valuation/projection entry points." },
  reinvestment: { functions: ["server/calculation/reverseValuation.ts:equityValue",
    "server/calculation/reverseValuation.ts:reverseEquityGrowth", "server/calculation/researchCorrections.ts:fcfeFromOperatingCashFlow"],
    tests: ["script/valuation-solver.test.ts", "script/workplan-corrections.test.ts"],
    names: ["constant-growth reinvestment fixture reproduces closed-form equity value",
      "reported OCF never deducts working capital twice"], artifacts: ["docs/Developer_Workplan_Amendments.md"],
    inputs: "Separate earnings/ROE reinvestment model and amended CFO-based FCFE convention; these are not interchangeable models." },
  solver: { functions: ["server/calculation/cashFlowValuation.ts:cashFlowValue",
    "server/calculation/cashFlowValuation.ts:reverseCashFlowGrowth", "server/calculation/reverseValuation.ts:reverseEquityGrowth",
    "server/financialData/asOfValuation.ts:buildAsOfRows", "script/build-asof-valuation-rows.ts"],
    tests: ["script/cash-flow-valuation.test.ts", "script/valuation-solver.test.ts"],
    names: ["cash-flow DCF recovers a perpetuity and its known growth without a payout shortcut",
      "reverse solver recovers known well-posed growth without forcing ambiguous cases"],
    artifacts: ["generated-artifacts/valuation-sensitivity/0f24be7551772e0f6d8e6eeaa8276db27e1df73524609d640778167a4c8d85d5.json",
      "generated-artifacts/valuation-comparison/asof-audit-3df0abd96e1ea8994c576cd42097cfeec8b0c7c54899ab86e6dbf3b101bb5f85.json"],
    inputs: "Known-growth/perpetuity fixtures and 54 retained numerical rate/financing diagnostics; neither is an empirical forecast study." },
  beta: { functions: ["server/financialData/historicalBeta.ts:historicalBeta", "script/compare-beta-growth.ts"],
    tests: ["script/company-beta.test.ts"], names: ["past-only beta recovers known slope and ignores future observations"],
    artifacts: [betaPath, "docs/Company_Beta_Sensitivity_Protocol.md"],
    inputs: "Existing 60-month, half-to-one-shrunk peer-proxy beta; assumed RF3%/ERP5%; common8% retained. No refit/rerun." },
  gordon: { functions: ["server/financialData/asOfValuation.ts:buildAsOfRows",
    "server/climateValuation/decarbConversion.ts:impliedGrowthFromPE",
    "server/climateValuation/valuationStatistics.ts:positivePE"],
    tests: ["script/asof-valuation.test.ts", "script/valuation-integrity.test.ts", "script/valuation-statistics.test.ts"],
    names: ["invalid valuations never silently become zero-growth companies",
      "P/E requires finite positive inputs; valid high multiples are not silently capped"],
    artifacts: ["generated-artifacts/valuation-comparison/asof-audit-3df0abd96e1ea8994c576cd42097cfeec8b0c7c54899ab86e6dbf3b101bb5f85.json"],
    inputs: "Positive earnings yield yields g=r-E/P; nonpositive annual earnings excluded/countable in retained as-of audit, never replaced with zero growth." },
  asof: { functions: ["server/financialData/asOfValuation.ts:buildAsOfRows"],
    tests: ["script/asof-valuation.test.ts"],
    names: ["uses only statements filed before the July observation and FY t+1→t+4 outcomes"],
    artifacts: ["docs/AsOf_Valuation_Prediction_Protocol.md", "docs/AsOf_Valuation_Comparison_Results.md"],
    inputs: "Frozen annual July 2017–2022 revised-history origins, publication filters and unchanged exact-fiscal-endpoint rule; not monthly full-universe histories." },
  d8: { functions: ["server/calculation/valuationComparison.ts:compareValuationModels",
    "server/financialData/asOfValuation.ts:buildAsOfRows"], tests: ["script/valuation-comparison.test.ts"],
    names: ["D8 requires both strict improvements; tied IC cannot pass"],
    artifacts: [d8path, "docs/AsOf_Valuation_Comparison_Results.md", "docs/Valuation_Comparison_Protocol.md"],
    inputs: "Existing 88 completed common pairs, six annual origins, three-origin blocks/2,000 draws/seed20261110; failed selection result remains frozen." },
  sensitivity: { functions: ["script/company-valuation-sensitivity.ts",
    "server/calculation/cashFlowValuation.ts:reverseCashFlowGrowth"], tests: ["script/cash-flow-valuation.test.ts"],
    names: ["cash-flow DCF recovers a perpetuity and its known growth without a payout shortcut"],
    artifacts: ["docs/Company_Valuation_Sensitivity_Results.md"],
    inputs: "54 retained diagnostics on 6/8/10% discount, 1/2/3% terminal, two financing choices; not the original ±1pp ranking-change criterion." },
  projection: { functions: ["server/calculation/companyProjection.ts:projectCompanyMembers"],
    tests: ["script/company-projection.test.ts"],
    names: ["company member cash flows reconcile and Scope 3 is never a direct liability"],
    artifacts: [], inputs: "Synthetic 1,000 supplied five-year members, weighted EU/US power exposures, explicit margins, scoped tonnes/intensities and liable fractions." },
  scope3: { functions: ["server/calculation/companyProjection.ts:projectCompanyMembers"],
    tests: ["script/company-projection.test.ts"],
    names: ["company member cash flows reconcile and Scope 3 is never a direct liability"],
    artifacts: [existingLog(12)], inputs: "Source fixture S1=100, S2=50, S3=1000; first activity ratio1.02; S1 liability1, S2 liability0; price1; pass-through0.5. S3 changed to999999." },
  paired: { functions: ["server/calculation/pairedCompanyGap.ts:pairedCompanyGap",
    "server/calculation/pairedCompanyGap.ts:rankPairedCompanyGaps",
    "server/calculation/researchCorrections.ts:pairedGrowthGap"],
    tests: ["script/paired-company-gap.test.ts", "script/workplan-corrections.test.ts"],
    names: ["paired median differs from difference of medians; nulls never silently selected"],
    artifacts: [], inputs: "Matching basis/currency/nominal/horizon/growth-definition and member IDs; mismatched horizon3 versus5 rejected." },
  additive: { functions: ["server/calculation/pairedCompanyGap.ts:rankPairedCompanyGaps",
    "server/climateValuation/decarbGapCalculator.ts:computeDecarbGapScores"],
    tests: ["script/paired-company-gap.test.ts", "script/valuation-statistics.test.ts"],
    names: ["peer ranks preserve ties and additive invariance; missing peers withhold scores",
      "common climate and equity-cost changes do not create a new within-peer ranking"],
    artifacts: [existingLog(11)], inputs: "Two same-peer finite gaps shifted by common +100; separate three-company common climate/equity-cost perturbation fixture." },
  history: { functions: ["server/calculation/companyProjectionAsOf.ts:validateCompanyInputEvidence",
    "server/calculation/companyProjectionAsOf.ts:projectCompanyAsOf"],
    tests: ["script/company-asof.test.ts"], names: ["all company input leaves require exact dated evidence; order is deterministic"],
    artifacts: [], inputs: "Per-material-leaf source/value hashes and availability cutoff; synthetic evidence and revised historical statements do not prove original publisher vintages." },
  fslr: { functions: ["server/calculation/fslrFullCashflowCase.ts:freezeFslrFullCashflowAssumptions",
    "server/calculation/fslrFullCashflowCase.ts:calculateFslrFrozenFullCashflow",
    "server/calculation/companyFullCashflowCase.ts:calculateCompanyFullCashflowCase"],
    tests: ["script/fslr-full-cashflow-case.test.ts", "script/company-full-cashflow-case.test.ts"],
    names: [], artifacts: [fslrFullLatest.reportPath, fslrFullLatest.freezePath,
      "generated-artifacts/company-operating-corpus/fslr-full-cashflow/focused-tests-v4.log",
      "generated-artifacts/company-operating-corpus/fslr-full-cashflow/private-validation-v4.log"],
    inputs: "Distinct NEW FY2025 UNAUDITED issuer release/2026-guidance conditional experiment, not the selected FY2024 10-K case; frozen ten schedules/50 annual rows." },
  channels: { functions: ["server/calculation/companyConditionalCases.ts:calculateCcsOperatingChannel",
    "server/calculation/companyCashflowBridge.ts:calculateFplCashBridge",
    "server/calculation/companyConditionalCases.ts:calculateFplSolarCohort"],
    tests: ["script/company-conditional-cases.test.ts", "script/company-cashflow-bridge.test.ts"],
    names: ["CCS operating throughput and monetary derivatives reconcile without fabricated pricing"],
    artifacts: ["docs/Conditional_Company_Climate_Cases.md"],
    inputs: "FPL incremental solar cash channel, XOM physical CCS derivatives, CAT refused causal shortcut; none is a consolidated three-issuer valuation inversion." },
  identification: { functions: ["server/calculation/researchCorrections.ts:valuationScenarioEligibility"],
    tests: ["script/workplan-corrections.test.ts"],
    names: ["robustness does not manufacture identification or a global scenario"],
    artifacts: ["docs/Developer_Workplan_Amendments.md"],
    inputs: "Declared mapping/expansion/identification references; no mapping => unavailable, no numerical D13 thresholds invented." },
  containment: { functions: ["server/calculation/researchCorrections.ts:valuationScenarioEligibility",
    "server/calculation/publicValuationContract.ts:publicValuationResult"],
    tests: ["script/workplan-corrections.test.ts", "script/public-valuation-contract.test.ts", "script/ui-claims.test.ts"],
    names: ["robustness does not manufacture identification or a global scenario",
      "public valuation contract removes unsupported values even from cached nested rows",
      "company views and exports do not consume unsupported climate outputs or physical gap"],
    artifacts: [], inputs: "Current refusal/withholding path: marketExpectationClaim remains false even when declaration references are supplied; unsupported physical outputs removed from nested public results." },
};
type AtomicReview = { profile: string; status: "partial" | "verified"; behavior: string; result: string; gap: string; next: string };
const atomicReviews: Record<string, AtomicReview> = {};
function review(id: string, profile: string, behavior: string, result: string, gap: string, next: string, verified = false) {
  assert.ok(!atomicReviews[id], `Duplicate atomic review ${id}`);
  atomicReviews[id] = { profile, behavior, result, gap, next, status: verified ? "verified" : "partial" };
}
review("S10-001", "identity", "Audited lifecycle evidence separately from candidate identity and preserved the original denominator.", "2442 candidate records exist; diagnoseMapping retains lifecycle unknown rather than inferring delisting from workbook endpoints.", "The retained census lacks a complete independently sourced lifecycle field per company and pre-coverage lifecycle eligibility record.", "Complete the lifecycle/source census without changing the original 2442 denominator.");
review("S10-002", "identity", "Checked each required review state rather than treating candidates as approvals.", "Candidate/ambiguous/unmatched and unknown lifecycle are distinct; audit errors are stored as error, not a complete seven-state contract.", "Not-queried, provider-error and awaiting-review states are not yet reconciled across every consumer/census row.", "Produce the seven-state census and reader assertions; do not merge unqueried/error/review states.");
review("S10-003", "rootAudit", "Inspected the actual 100-case root-cause receipts and their sample provenance.", "100/100 completed: 50 unmatched/50 ambiguous; same-sample reassessment yields34 unmatched/50 ambiguous/16 candidates.", "Those 100 were sampled from the full2442 census, not demonstrably the originally specified earlier200 cohort.", "Document the cohort difference and reconcile the original200-case population instead of claiming exact cohort completion.");
review("S10-004", "matching", "Checked ISIN-first/includeUnlistedEquities, venue/class/ADR guards and minor-unit coverage.", "OpenFIGI payload includes includeUnlistedEquities=true; exact venue/class candidates remain review-only.", "Primary-listing evidence/review and coverage of all intended venues/classes remain incomplete; minor units do not solve those decisions.", "Finish primary-listing/class review and unsupported venue cases while preserving ADR and currency gates.");
review("S10-005", "matching", "Read full-census checkpoints and private batch-review preparation without executing approval.", "2442 attempted, zero unattempted in retained candidate audit; 27-issuer/270-period review packet, no developer approvals.", "Full-census ambiguous-case review and decisions through the existing independent workflow are not complete.", "Complete the ambiguous batch review using existing workflow; never auto-approve candidates.");
review("S10-006", "statements", "Checked annual statement normalization, filing-date fields and actual retained history scope.", "Retained candidate histories and publication/restatement caveats exist; source normalization avoids silent zeros.", "Versioned overlays do not yet cover all listed fields/issuers, segments and original-versus-restated provenance.", "Report field-by-field overlay coverage and original/restated evidence before claiming complete fundamentals ingestion.");
review("S10-007", "currency", "Separated arithmetic minor-unit normalization from the requested whole-workbook currency/FX audit.", "GBp/ZAc/ILA convert by0.01; USD/GBP mismatch is refused; no implicit FX fixture conversion.", "No completed workbook profit/market-cap currency audit with dated FX receipts for every required conversion.", "Finish that workbook audit and attach dated FX receipts, not inferred currency conversions.");
review("S10-008", "identity", "Compared required dual-status census fields against all retained candidate records.", "2442 candidate rows reconcile, but rows do not all carry lifecycle plus the full review-state schema.", "Complete paired lifecycle/review-state counts are missing, notwithstanding the candidate row count.", "Publish all2442 dual-status rows and reconcile their category totals.");
review("S10-009", "identity", "Checked whether non-unknown lifecycle labels have source lineage.", "diagnoseMapping explicitly leaves lifecycle unknown; provider inactive flags are evidence for review, not approved lifecycle changes.", "A full-population source audit for any non-unknown lifecycle labels is not retained.", "Enumerate every non-unknown lifecycle assignment and verify its listing/action source.");
review("S10-010", "identity", "Evaluated the95% rule with restricted coverage, not a shrunken successful denominator.", "Historical approved coverage is1/2442; no assertion that this satisfies95% verified-listed coverage.", "Verified-listed eligible population and approval coverage within it are not fully evidenced.", "Report both full-baseline and verified-listed denominators with restricted acceptance coverage.");
review("S10-011", "identity", "Looked specifically for the stratified50-accepted-match audit, not candidate unit fixtures.", "No retained50-accepted-case independent audit was found; candidate checks do not substitute.", "The required50 accepted matches/zero unexplained errors audit is absent.", "Select and independently audit50 accepted matches with strata and error dispositions.");
review("S10-012", "identity", "Inspected duplicate company/issuer rejection and resumable candidate collection.", "reconcileIdentities rejects duplicate company/issuer acceptance; collection resumes by company ID.", "No retained end-to-end re-run/aggregate-exposure evidence proves both no duplicate writes and no double-counted issuer exposure.", "Retain that bounded rerun and issuer-aggregate reconciliation when permitted; do not substitute the helper fixture.");
review("S10-013", "currency", "Verified existing currency fixtures and separately assessed aggregate coverage.", "Minor units and statement-currency mismatches have passing retained tests.", "The second conjunct—no actual aggregate mixing unconverted currencies—lacks a whole-aggregate audit.", "Audit aggregate inputs/conversions and retain native/converted currency lineage.");
review("S10-014", "statements", "Checked requested history-coverage/restatement reporting dimensions.", "Candidate history/outcome counts exist, but are not full sector×region field/restatement coverage.", "Cash-flow/net-debt/restated shares by sector and region are not completely reported.", "Produce that sector×region coverage table with explicit missing/restated categories.");
review("S11-001", "d8", "Inspected the parameter-register and pre-result specification obligation itself.", "Separate valuation/as-of/beta protocols are retained; a unified pre-build complete parameter register is not established.", "Complete specification and timing evidence for every original choice remains missing.", "Reconcile each original specification choice and its pre-result register provenance.");
review("S11-002", "cash", "Checked FCFE/cost-of-equity and FCFF/WACC bridge handling independently of forecast selection.", "FCFE receives no second debt subtraction; FCFF fixture requires net debt/minority/preferred bridge.", "Actual reliable-debt FCFF cross-check coverage has not been established.", "Run/document FCFF cross-checks only where reliable debt/claim evidence exists; otherwise disclose unavailable coverage.");
review("S11-003", "reinvestment", "Applied the binding CFO working-capital correction and examined reinvestment linkage.", "CFO100−capex30+borrowing10=80; earnings route also80; separate ROE model prices reinvestment.", "Actual projected growth/reinvestment is not uniformly tied to supported returns on capital; the cash-growth solver embeds composition.", "Document issuer reinvestment/return links without subtracting WC twice or equating the two valuation models.");
review("S11-004", "beta", "Reviewed existing company-specific discount-rate sensitivity without repeating it.", "60-month shrunk beta and common8% variant exist; RF3%/ERP5% are assumptions.", "Observed risk-free/ERP ranges and reliable observed-debt-cost WACC coverage remain incomplete.", "Keep the frozen sensitivity; supply dated rate/debt-cost range evidence before broader rate claims.");
review("S11-005", "financialRefusal", "Confirmed the expressly permitted financial-institution not-modelled alternative at both industrial entry points.", "cashFlowValue and projectCompanyMembers return status='not-modelled' for businessType='financial'; retained named tests pass.", "", "Retain the explicit financial refusal regression; residual-income implementation is not required to satisfy this alternative.", true);
review("S11-006", "cash", "Reviewed the loss-maker refusal rather than fabricating normalized margin recovery.", "Nonpositive cash flow is not-modelled; no unsupported recovery is forced.", "The required revenue×identified-history/peer-margin recovery branch and loss-maker solution accounting are not complete.", "For any recovery case document identifiable margins; otherwise retain and count no-defensible-solution.");
review("S11-007", "gordon", "Checked the Gordon equation and explicit unavailable counting for nonpositive earnings.", "buildAsOfRows uses r−netIncome/marketCap only for positive earnings and records 'Gordon unavailable: non-positive earnings'; retained audit counts exclusions.", "", "Keep Gordon formula/exclusion counting and original primary-model status; this does not accept the comparison stage.", true);
review("S11-008", "cash", "Checked the stated three-stage reverse-DCF architecture itself.", "cashFlowValuation implements years1–5 constant growth, years6–15 linear fade and a year15 perpetuity.", "", "Retain three-stage architecture and numerical fixtures; report separate criterion-specific input/assumption limitations.", true);
review("S11-009", "solver", "Checked solution of the stage1 growth root against market equity for well-posed supplied inputs.", "Known zero-growth perpetuity recovered within1e-10; existing54 diagnostics reprice within1e-8, without extrapolating missing roots.", "", "Retain bounded root/repricing tests; no empirical forecast or coverage acceptance follows from this numerical criterion.", true);
review("S11-010", "cash", "Checked linear fade and terminal-domain restrictions against the original terminal-range specification.", "Ten-year linear fade and r>terminal checks exist; default as-of terminal3% is in range.", "The separate diagnostic grid1–3% is not the original complete2.5–4% terminal-range assessment.", "Report the original terminal-range treatment explicitly, keeping the separately labelled diagnostic grid distinct.");
review("S11-011", "cash", "Inspected growth-domain checks: finite growth is not constrained below the discount rate.", "Conditional growth is allowed in(-1,1], while r>terminal is enforced separately; finite stage growth may exceed r.", "", "Retain separation of finite growth and terminal convergence; do not impose g_stage1<r.", true);
review("S11-012", "asof", "Checked price-only reverse valuation and the separate analyst-anchor sensitivity requirement.", "Default solves from supplied price/market value without using analyst estimates.", "No completed analyst-anchored FMP-estimate sensitivity is evidenced.", "Keep price-only primary solving; document an explicitly separate analyst-anchor sensitivity if implemented.");
review("S11-013", "asof", "Compared actual origin frequency with the requested monthly revised-history histories.", "Retained main study has six annual July origins, not complete monthly workbook histories.", "Both valuation models' monthly full-period histories remain missing.", "Build the requested monthly revised-history series with the unchanged publication/identity rules.");
review("S11-014", "d8", "Checked predeclared D8 and its required downstream model-selection sequence.", "Actual common8% comparison failed; no promotion; the validation signal was an implied-growth proxy.", "The genuine Stage12 projection→Stage14 validation-gap sequence is incomplete.", "Preserve failed results and finish the genuine gap-based validation sequence without retrospective selection changes.");
for (const [id, cell] of [["S11-015","Criterion"],["S11-016","Measure"],["S11-017","Preferred"]])
  review(id, "d8", `Preserved canonical seven-criteria table header '${cell}' and assessed its required comparison-pack context.`, "Header text is unchanged; it is not independent evidence that all seven metrics were computed.", "The complete seven-criterion comparison pack remains incomplete; this header is not a separate efficacy success.", "Complete the seven-metric comparison table without treating a preserved header as empirical evidence.");
for (const [ids, label, result, gap, next, profile] of [
  [["S11-018","S11-019","S11-020"],"Analytical coverage","88 complete annual common pairs and54 conditional numerical diagnostics are reported.","Eligible-company well-posed-solution shares by sector, with financials separately, are incomplete.","Report well-posed solutions and exclusions by sector/financial category on the fixed denominator.","d8"],
  [["S11-021","S11-022","S11-023"],"Plausibility","Solver bounds are explicit, not empirical comparable-company growth percentiles.","No completed realised-five-year comparable-company1st/99th-percentile outlier comparison.","Construct the comparable-company realised-growth distribution and report outlier shares.","d8"],
  [["S11-024","S11-025","S11-026"],"Stability","Annual-origin outputs exist; their frequency does not establish monthly stability.","No month-on-month rank correlation restricted to little-changed fundamentals/prices.","Produce the specified low-change monthly rank-stability comparison.","asof"],
  [["S11-027","S11-028","S11-029"],"Incremental information","The retained study measures forecast MAE and proxy-signal IC, not incremental controlled explanatory power.","No controlled realised-growth/return information beyond earnings yield is demonstrated.","Fit/report the prespecified controlled incremental-information comparisons without relabelling raw correlation.","d8"],
  [["S11-030","S11-031","S11-032"],"Forecast validity","Existing88-pair completed FCFE study reports DCF MAE improvement−0.0091997627 and95% interval below zero.","Original rank correlations for completed three-year FCFE, earnings and revenue are not all reported; MAE alone is not that table criterion.","Report each original target/rank statistic and coverage while retaining the negative MAE result.","d8"],
  [["S11-033","S11-034","S11-035"],"Signal value","Existing IC difference0.0478016 has95% interval[−0.1833903,0.2789936], using implied-growth proxy signals.","Not the Stage14 new paired projection-gap validation signal built on each model.","Complete genuine paired-gap validation-period IC with overlap-aware intervals.","d8"],
  [["S11-036","S11-037","S11-038"],"Assumption sensitivity","54 rate/terminal/financing diagnostics establish solution ranges, not requested rank changes.","The ±1pp discount/±1pp terminal ranking-change comparison is absent.","Compute/report the exact predeclared ranking-change measure separately from grid solution ranges.","sensitivity"],
] as [string[],string,string,string,string,string][]) {
  for (const id of ids) review(id, profile, `Audited canonical '${label}' table cell ${id} against that metric, not general solver acceptance.`, result, gap, next);
}
review("S11-039", "solver", "Checked numerical solver efficacy and explicit refusal/counting, not issuer forecast completion.", "Known-growth fixture error<0.0001 growth units (=0.01pp); monotone cash solver zero-growth error<1e-10;54/54 retained diagnostics solved/repriced≤1e-8; unbracketed/nonpositive cases refuse.", "", "Retain textbook/root/refusal regressions and count unavailable cases; no market-prediction acceptance is implied.", true);
review("S11-040", "gordon", "Inspected the full conjunctive fixture requirement, including missing earnings and financial handling.", "Positive/bad-PE fixtures and permitted financial refusal tests exist.", "A direct named missing-earnings Gordon fixture is not evidenced in the inspected valuation-integrity/statistics tests; do not infer it from other invalid inputs.", "Add/identify the explicit missing-earnings fixture and retain the permitted financial refusal; no financial residual-income model is demanded when refused.");
review("S11-041", "d8", "Checked evidence that the criteria/rule commit precedes first results, rather than merely that protocols now exist.", "Protocol and retained-result hashes exist; chronology is not independently established here.", "Exact commit-before-any-results ordering evidence remains missing.", "Attach immutable rule-commit and first-result timestamps/revisions without inventing chronology.");
review("S11-042", "d8", "Checked the comparison pack against all seven original metrics.", "Actual MAE/IC and diagnostic sensitivities exist.", "Sector coverage, empirical plausibility, monthly stability, controlled incremental information, all-target rank validity and exact ranking sensitivity are incomplete.", "Complete all seven metric rows with intervals; retain failed/inconclusive findings.");
review("S11-043", "d8", "Verified acceptance containment: incomplete model selection is not represented as accepted Stage11.", "compareValuationModels has automaticPromotionAllowed=false; retained actual gate=false; published result retains Gordon primary and states incomplete genuine gap validation.", "", "Keep Stage11 unaccepted until the required selection sequence is complete; this verifies honest containment, not completion of that sequence.", true);
review("S12-001", "projection", "Checked operating-geography versus flagged headquarters fallback mapping.", "Engine accepts explicit weighted region/sector mappings; accounting controls use flagged fallback.", "Full issuer operating-geography disclosures/mix mappings are not populated.", "Complete company operating-region/sector weights and separately report flagged HQ fallback.");
review("S12-002", "projection", "Checked regional activity compounding and market-share treatment separately.", "Exposure activity compounds by region/sector and supplied marketShareMultiplier.", "No evidenced mean-reversion law tying issuer market share to sector share is implemented/populated.", "Specify and evidence the mean-reversion mechanism without inventing observed coefficients.");
review("S12-003", "projection", "Checked sourced margin bounds and liable-emissions-only carbon drag.", "Supplied bounds constrain margins and nonliable scopes do not enter charge formula.", "Actual company/peer margin-range and jurisdiction-liability inputs are incomplete.", "Populate margin/history/peer and liability evidence, retaining explicit bounds.");
review("S12-004", "projection", "Inspected the Scope1 regional-liability input rather than assuming universal taxation.", "Scope1 emissions are multiplied by an explicit liable fraction.", "Company/jurisdiction-specific applicable regime and liability evidence is incomplete.", "Map actual Scope1 facilities/regimes and effective liable fractions.");
review("S12-005", "projection", "Inspected Scope2 as an explicit electricity-price channel.", "Scope2 has a separate liable fraction and is not forced into every issuer's charge.", "Electricity-price/pass-through mappings by operating location are not populated.", "Source location-specific Scope2 electricity-price exposure/pass-through rather than inventing a direct tax.");
review("S12-006", "scope3", "Verified Scope3 has no direct carbon liability and any demand response must already enter activity.", "Charge formula uses only Scope1/Scope2; increasing Scope3 from1000 to999999 leaves projected growth unchanged.", "", "Retain the no-direct-Scope3-charge regression; do not create a second demand or tax channel.", true);
review("S12-007", "projection", "Checked the carbon-drag equation and its pass-through evidence requirement.", "Formula uses liable Scope1/2 tonnes×effective price×(1−passThrough).", "Sector literature and actual price/pass-through ranges are not fully supplied.", "Attach sector/jurisdiction price/pass-through evidence before interpreting actual company drag.");
review("S12-008", "fslr", "Checked line-by-line FCFE compatibility without confusing endpoint CAGR with path-adjustment growth.", "New distinct FSLR experiment computes ten frozen five-year cash schedules/50 rows; selectedFY2024 case unchanged.", "A qualified same-basis market pair, justified continuation and explicit November2026 stub/horizon treatment remain absent; cash schedules themselves now exist.", "Resolve matched market/continuation/horizon basis while retaining computed cash schedules and distinct FY2025 experiment.");
review("S12-009", "projection", "Inspected activity×intensity by scope and explicit delivery/double-counting requirements.", "Engine computes all scoped tonnes from supplied activity and intensity, without stacking target abatement.", "Actual regional technology intensity paths and target-delivery credibility evidence are not populated.", "Supply those paths/delivery assumptions and identify only genuinely additional abatement.");
review("S12-010", "projection", "Distinguished supplied fixture members from a supported joint uncertainty sample.", "Fixture supplies1000 members and engine preserves them deterministically.", "No actual evidenced joint sampling of activity/share/margin/carbon price/pass-through paired to valuation inputs.", "Freeze and populate the joint-member model with dependencies and matched valuation inputs.");
review("S12-011", "history", "Checked historical-cutoff guards and vintage labels rather than calling revised history original vintages.", "Material-leaf checks refuse missing/future/conflicting evidence; retained financial history remains revised.", "No complete Stage9-linked original-company-input retrospective projection set is evidenced.", "Audit publisher vintage/classification/source cutoffs for each historical company run; otherwise retain revised-history label.");
review("S12-012", "projection", "Looked for the exact one-company perturbation/leaves-peers-unchanged efficacy check.", "Pure company engine is issuer-local and refuses malformed inputs.", "No retained named fixture directly perturbs one issuer's fundamentals while asserting all peer outputs unchanged.", "Add/identify that exact peer-isolation fixture; no terminal/whole-case requirement is needed for this criterion.");
review("S12-013", "additive", "Verified common additive gap shifts cannot change within-peer ranks, while nonadditive heterogeneous effects are not prohibited.", "rankPairedCompanyGaps retains scores[-1,1] after every finite median gap is shifted+100; separate common-climate/equity-cost fixture also retains ranking.", "", "Retain these additive-invariance/tie/missing-peer regressions; do not demand complete issuer or terminal data for this fixture criterion.", true);
review("S12-014", "projection", "Checked physical-scope reconciliation and the separate double-counting test obligation.", "Current code has activity×scope intensity and no extra target-abatement factor; retained fixture explicitly checks first-year Scope1=102.", "A dedicated retained all-scope/additional-abatement double-counting check is not demonstrated by the single Scope1 assertion.", "Add/identify the exact all-scope reconciliation and no-double-abatement fixture; no market-pair work is a prerequisite.");
review("S12-015", "scope3", "Verified the requested liable-emissions/Scope3 fixture exactly.", "At activity1.02, liableScope1=102 and drag=102×1×0.5=51; changing Scope3 to999999 leaves growth unchanged.", "", "Maintain the existing named no-Scope3-charge fixture; this does not require complete company forecasts.", true);
review("S12-016", "paired", "Verified definition compatibility is enforced before comparing projected and implied growth.", "pairedCompanyGap compares the full definition hash including FCFE/FCFF, currency, horizon, growthDefinition and nominal; retained fixture rejects horizon3 versus5.", "", "Retain matching-definition and mismatch regressions; separately label the new path-adjustment output rather than calling it CAGR.", true);
review("S12-017", "fslr", "Counted distinct technical issuer cases, not sensitivities or incremental subsidiaries.", "One distinct FSLR conditional full cash schedule family exists; FPL is incremental and XOM CCS physical-only; complete case count remains0/3.", "No utility+oil/gas+industrial trio meets the original end-to-end criteria.", "Complete NEE/XOM consolidated economics and qualified same-basis pairing; do not count FSLR sensitivity members as issuers.");
review("S12-018", "projection", "Checked coverage reporting population and operating-map basis.", "Engine returns geographyBasis; candidate accounting/technical examples are not full coverage.", "Market-cap/emissions coverage and operating-geography-versus-HQ shares are not fully reported.", "Publish those fixed-population coverage denominators and mapping-basis shares.");
review("S13-001", "channels", "Checked sector-first valuation-to-activity identification rather than merely climate-channel plausibility.", "FPL/CCS/solar channels exist as conditional ledgers or physical sensitivities.", "No completed sector-first valuation inversion with defensible segment activity mapping.", "Document the chosen segment's price-to-physical-activity map and its boundary.");
review("S13-002", "channels", "Checked producer reserve/cash-flow valuation to implied production decline.", "XOM CCS delivery is a different service channel, not oil/gas reserve decline.", "Producer reserves, commodity deck, cost/capex and reserve-to-production inversion not completed.", "Build the explicit reserves/production/cash-flow model rather than relabelling CCS tonnes.");
review("S13-003", "channels", "Checked coal-heavy utility retirement pace inversion.", "FPL solar additions do not identify a coal-fleet retirement schedule.", "Coal-unit ownership, retirement liabilities/recovery and valuation-to-retirement mapping absent.", "Source the fleet/retirement economics and derive the covered utility retirement model.");
review("S13-004", "channels", "Checked clean-technology deployment-growth inference from valuation.", "FSLR physical volume is a frozen guidance-anchor assumption, not a price-solved deployment path.", "Deployment-to-cash economics and a defensible price inversion are not identified.", "State the eligible pure-play deployment map and inversion assumptions without treating frozen sales as market expectations.");
review("S13-005", "identification", "Inspected completeness of valuation-to-activity assumptions.", "Explicit assumptions exist for individual conditional channels and FSLR cash schedules.", "Full commodity/margin/rate/capital-allocation registries for actual segment inversions are missing.", "Publish each inversion's complete assumption set before computing a valuation-consistent path.");
review("S13-006", "identification", "Checked the diversified-company conditional-association extension.", "No actual controlled diversified-company regression is claimed.", "Declared conventional-driver controls and transition-exposure association estimates are absent.", "Freeze controls and fit/report only a conditional association, not climate causation.");
review("S13-007", "identification", "Checked predeclared identification assessment rather than accepting reference strings as proof.", "Helper distinguishes submitted evidence from established identification.", "No full pre-result segment identification protocol/tests are evidenced.", "Predeclare the identification assessment before segment results.");
review("S13-008", "identification", "Checked robustness to actual control sets and price decks.", "A narrow cash sensitivity or declaration is not that robustness assessment.", "No segment inversion comparison across defensible control sets/commodity decks.", "Run/report the predeclared control/deck alternatives once the mapping exists.");
review("S13-009", "identification", "Checked climate-policy event responses for the identified segment hypothesis.", "No event-study outcome has been invented from channel plausibility.", "Dated event definition/windows/counterfactual and actual response tests missing.", "Freeze events/windows/control handling and report all specified policy-news checks.");
review("S13-010", "identification", "Checked the stated assumption-range-width test.", "Sensitivity spans are not automatically an identified narrow range.", "No predeclared segment width metric/threshold and complete defensible-assumption result set.", "Specify the width criterion before scoring and report all declared assumption sets.");
review("S13-011", "identification", "Checked both D13 threshold sets and their distinct dashboard/report roles.", "No numerical thresholds have been fabricated to earn Tier2.", "Owner-confirmed loose/tight values and segment results against both are absent.", "Obtain/record pre-result threshold decisions and test both sets without changing them after results.");
review("S13-012", "identification", "Applied the binding Tier1 amendment: unavailable is valid where no defensible mapping exists.", "Helper returns Tier1 unavailable without mapping; no global physical range is manufactured.", "Mapped Tier1 segment scenarios/four Stage7 metrics and a justified optional global expansion model are not implemented.", "Build only defensible covered scenarios; expand globally only with a separate reviewed coverage model.");
review("S13-013", "identification", "Checked evidence needed for stronger Tier2 physical measures.", "Default contract does not infer market expectation from supplied evidence strings.", "No earned segment Tier2 measures or qualifying global-emissions coverage model exist.", "Keep not-identifiable/unavailable until the segment evidence earns the stronger claim.");
review("S13-014", "identification", "Checked the emissions-valuation association and separate carbon-price-equivalent model.", "No association estimate is relabelled a causal carbon price.", "Actual controlled association with sign/interval/units and any duration/tax/pass-through translation model absent.", "Estimate/report the qualified association; translate only through an independently documented model.");
review("S13-015", "identification", "Checked monthly revised-history Tier1/Tier2 series availability.", "Current conditional channel outputs are not a monthly valuation-consistent pathway archive.", "Monthly covered Tier1 ranges and earned-only Tier2 series are not built.", "Construct monthly series only after mappings and as-of inputs are supportable.");
review("S13-016", "identification", "Checked owner confirmation and commit-before-results of both threshold sets.", "No thresholds or owner approval are invented.", "Exact confirmation/commit chronology and tighter-set results for every segment missing.", "Record both threshold decisions/chronology and complete tighter-set reporting before stronger labels.");
review("S13-017", "identification", "Checked full declared assumption coverage for every actual Tier1 scenario.", "FSLR frozen economic assumptions are not themselves a Tier1 valuation-to-emissions scenario set.", "No complete declared Tier1 scenario/assumption manifest and all-set range report.", "Build that manifest/range report for actual mapped Tier1 scenarios.");
review("S13-018", "identification", "Checked the required Tier1 emissions lineage rather than substituting company operating algebra.", "Company projection has activity×intensity code, but no actual Tier1 price→activity→emissions path is claimed.", "Retained Tier1-specific lineage test from valuation through physical activity/intensity is absent.", "Add/retain that exact Tier1 lineage fixture when its mapping exists; never use growth×100.");
review("S13-019", "identification", "Checked covered-global emissions share and expansion sensitivity.", "No unsupported listed-to-global coverage fraction is supplied.", "Scoped listed-universe/global denominator and alternative expansion results absent.", "Report compatible emissions denominators and all justified expansion alternatives.");
review("S13-020", "identification", "Checked covered and expanded population accounting separately.", "The helper refuses unreviewed expansion; it does not provide aggregate reconciliation.", "No actual covered/expanded population reconciliation with emissions totals.", "Retain both population ledgers and reconcile their aggregate accounts.");
review("S13-021", "containment", "Verified current refusal/withholding prevents unsupported market-implied climate outputs; not-identifiable is not treated as failure.", "marketExpectationClaim stays false even with submitted references; nested public cached physical fields are removed; retained UI/export containment tests pass.", "", "Keep current claim containment. Any future stronger segment label must introduce its own evidenced gate; lack of identified segments is not a regression of current refusal.", true);
review("S13-022", "identification", "Checked association reporting sign/interval/units and the prohibition on unsupported carbon-price labels.", "Current contract makes no translated carbon-price association claim.", "The required actual association estimate with interval/sign/units remains missing.", "Report the association on declared units; keep carbon-price translation unavailable absent a documented model.");
assert.equal(Object.keys(atomicReviews).length, 97, "Every canonical criterion needs its own atomic review");
const retainedSensitivity = json("generated-artifacts/valuation-sensitivity/0f24be7551772e0f6d8e6eeaa8276db27e1df73524609d640778167a4c8d85d5.json");
const aboveDiscountExample = retainedSensitivity.cases.flatMap((c: any) => c.rows.map((r: any) => ({
  symbol: c.symbol, discountRate: r.discountRate, growth: r.result?.growth,
}))).find((r: any) => typeof r.growth === "number" && r.growth > r.discountRate);
assert.ok(aboveDiscountExample, "Existing retained sensitivity must actually evidence finite growth above discount");
atomicReviews["S11-011"].result += ` Read-only retained example: ${aboveDiscountExample.symbol} stage growth=${aboveDiscountExample.growth}, r=${aboveDiscountExample.discountRate}; no rerun.`;
atomicProfiles.cash.artifacts.push("generated-artifacts/valuation-sensitivity/0f24be7551772e0f6d8e6eeaa8276db27e1df73524609d640778167a4c8d85d5.json");
const metadataInspectionAt = new Date().toISOString();
function atomicExecution(profile: AtomicProfile, id: string, checkType: CheckType) {
  const namedChecks = profile.names.map(name => {
    const lineIndex = retainedRegressionText.split("\n").findIndex(line => /^ok \d+ - /.test(line) && line.endsWith(name));
    assert.ok(lineIndex >= 0, `Retained passing named check missing for ${id}: ${name}`);
    return { name, passing_log_line: lineIndex + 1 };
  });
  const artifacts = profile.artifacts.map(path => ({ path, sha256: sha(readFileSync(path)) }));
  return [
    ...(namedChecks.length ? [{
      command: "npm run check && npx tsx --test script/*.test.ts && npm run build",
      executed_at: "2026-11-10T08:30:52Z", log: retainedRegressionLog,
      log_sha256: sha(retainedRegressionText), exit_code: 0, check_type: checkType,
      check_scope: "Previously executed named criterion-relevant engineering checks ONLY; full-suite receipt retained, NOT rerun by this review.",
      relevant_tests: namedChecks, evidence_scope: "Synthetic numerical/contract efficacy where the criterion requests it; not actual issuer calibration.",
    }] : []),
    { command: `npx tsx script/reconcile-company-stages-10-13.ts (read-only atomic evidence inspection: ${id})`,
      executed_at: metadataInspectionAt, check_type: checkType,
      check_scope: "Current source/test/retained-artifact inspection only; no model, study, collector or regression-suite execution.",
      artifacts },
  ];
}
const records: any[] = [];
const counts: Record<number, number> = { 10: 0, 11: 0, 12: 0, 13: 0 };
for (const stage of ledger.stages.filter((s: any) => s.stage >= 10 && s.stage <= 13)) {
 for (const clause of stage.requirements) {
  const ids = assign(stage.stage, clause.requirement);
  const criterionIndex = Number(clause.id.split("-")[1]) - 1;
  const checkType = criterionTypes[stage.stage][criterionIndex];
  assert.ok(checkType, `Missing criterion classification: ${clause.id}`);
  counts[stage.stage]++;
  const executions = ids.map(id => ({
    evidence_id: id, command: evidence[id].command,
    execution_date: evidence[id].executionDate,
    executed_at: id === "fslrActual" ? fslrFull.calculatedAt : null,
    execution_time_caveat: id === "fslrActual"
      ? "Exact calculation timestamp from persisted private report; assumption freeze precedes calculation."
      : "Exact timestamp not supplied by this evidence summary; never inferred from filesystem time.",
    check_type: checkType, check_scope: evidence[id].checkType, logs: evidence[id].logs,
    results: evidence[id].results,
    evidence_scope: "Direct retained evidence; historical studies are not rerun by this generator. Synthetic checks do not establish actual issuer completion.",
  }));
  records.push({
    ...clause,
    // These four values are copied verbatim, never reconstructed or reindexed.
    id: clause.id, requirement: clause.requirement,
    source_section: clause.source_section, origin: clause.origin,
    stage: stage.stage, status: "partial",
    check_type: checkType,
    check_scope: ids.map(id => evidence[id].checkType).join("; "),
    executions: [...(clause.executions ?? []).map((e: any) => ({
      ...e, check_type: checkType, check_scope: e.check_scope ?? e.check_type ?? "Retained prior execution for this exact criterion; original command/results preserved.",
    })), ...executions],
    financial_basis: financialBasis,
    asof_price_treatment: asOfPriceTreatment,
    source_sha256: sourceHash, amendments_sha256: amendmentsHash,
    global_contract_sha256: originalContractHash,
    global_contract_clauses: 300,
    evidence_ids: ids,
    existing_evidence: [...new Set([...(clause.existing_evidence ?? []),
      ...ids.flatMap(id => evidence[id].logs.map((l: any) => l.path))])],
    evidence_caveat: "Exact canonical-ledger criterion reviewed against direct source/functions and retained execution evidence, not a stale stage-level pointer. Engineering/conditional results do not establish complete acceptance. The NEW FY2025-anchor source is an UNAUDITED ISSUER EARNINGS RELEASE, NOT Form 10-K, and supports only a distinct conditional experiment; selected FY2024 case remains unchanged. A last available close captured before freeze can be legitimate as-of information: quote age alone is not a blocker. Missing shares/identity/terminal/horizon requirements remain, without cutoff relaxation or backdating.",
    behaviour_delivered_this_run: ids.map(id => evidence[id].behavior).join(" "),
    inputs_versions_assumptions: ids.map(id => ({ evidence_id: id, inputs: evidence[id].inputs })),
    numerical_results: ids.map(id => ({ evidence_id: id, result: evidence[id].results })),
    scientific_acceptance: "not-approved",
    remaining_gaps: ids.flatMap(id => evidence[id].gaps),
    next_action: ids.map(id => evidence[id].nextAction).join(" "),
    functions: [...new Set(ids.flatMap(id => evidence[id].functions))],
    behaviorAndInputs: ids.map(id => ({ evidenceId: id, behavior: evidence[id].behavior, inputs: evidence[id].inputs })),
    formulas: ids.flatMap(id => evidence[id].formulas),
    commandsAndDates: ids.map(id => ({ command: evidence[id].command, executionDate: evidence[id].executionDate })),
    countsLogsAndResults: ids.map(id => ({ evidenceId: id, logs: evidence[id].logs, results: evidence[id].results })),
    thresholds: ids.flatMap(id => evidence[id].thresholds),
    revisions: ids.flatMap(id => evidence[id].revisions),
    gaps: ids.flatMap(id => evidence[id].gaps),
    nextAction: ids.map(id => evidence[id].nextAction),
  });
  // Replace the earlier broad evidence-group draft with the individual-criterion
  // finding. Groups may index background artifacts; they never decide status or
  // manufacture unrelated gaps for an exact fixture/refusal criterion.
  const record = records[records.length - 1];
  const atomic = atomicReviews[clause.id];
  assert.ok(atomic, `Canonical criterion has no atomic review: ${clause.id}`);
  assert.ok(!(clause.status === "verified" && atomic.status !== "verified"),
    `Cannot downgrade verified ${clause.id} without evidenced criterion regression`);
  const profile = atomicProfiles[atomic.profile];
  const codeAndTestPaths = [...new Set([...profile.functions.map(f => f.split(":")[0]), ...profile.tests])];
  for (const path of codeAndTestPaths) readFileSync(path); // Required direct source inspection, no silent missing dependency.
  record.status = atomic.status;
  record.check_scope = `${clause.id} ONLY: ${atomic.behavior} ${atomic.status === "verified"
    ? "The exact permitted branch/fixture/containment criterion is fulfilled; no broader stage acceptance follows."
    : "Only the listed criterion-specific unfinished conjunct prevents verification."}`;
  record.evidence_ids = [`atomic:${clause.id}`];
  delete record.focused_verification; // Remove blanket receipts inherited from an earlier proposal merge.
  record.prior_existing_evidence = clause.existing_evidence ?? [];
  record.existing_evidence = [...new Set([...codeAndTestPaths, ...profile.artifacts,
    ...(profile.names.length ? [retainedRegressionLog] : [])])];
  record.files_functions_changed = ["script/reconcile-company-stages-10-13.ts (new atomic review metadata)",
    "script/company-stage-reconciliation.test.ts (new atomic metadata assertions)",
    "docs/reconciliation-stages-10-13.json (regenerated proposals only)"];
  record.prior_files_functions_changed = clause.files_functions_changed ?? [];
  record.pre_existing_files_functions_inspected = profile.functions.concat(profile.tests);
  record.source_change_provenance = codeAndTestPaths.map(path => ({
    path, classification: path.includes("fslrFullCashflowCase") || path.includes("companyFullCashflowCase") || path.includes("fslr-full-cashflow-case")
      ? "earlier-company-increment; NOT changed or rerun by atomic reconciliation"
      : "pre-existing implementation/test; inspected, NOT changed by atomic reconciliation",
  }));
  record.inspected_source_sha256 = Object.fromEntries([...codeAndTestPaths,
    "script/reconcile-company-stages-10-13.ts", "script/company-stage-reconciliation.test.ts"]
    .map(path => [path, sha(readFileSync(path))]));
  record.behaviour_delivered_this_run = atomic.behavior;
  record.inputs_versions_assumptions = [profile.inputs];
  record.functions = profile.functions;
  record.executions = atomicExecution(profile, clause.id, checkType);
  record.numerical_results = [{ criterion: clause.id, result: atomic.result,
    scope: atomic.status === "verified" ? "Exact criterion only, not stage/scientific acceptance" : "Partial evidence for this criterion only" }];
  record.behaviorAndInputs = [{ criterion: clause.id, behavior: atomic.behavior, inputs: profile.inputs }];
  record.formulas = [clause.requirement]; // Preserve the actual criterion's formula/conditions, not unrelated group equations.
  record.commandsAndDates = record.executions.map((e: any) => ({ command: e.command, executed_at: e.executed_at }));
  record.countsLogsAndResults = [{ criterion: clause.id, result: atomic.result,
    retained_named_checks: profile.names, retained_logs: profile.names.length ? [retainedRegressionLog] : [] }];
  record.thresholds = [{ source: "unchanged canonical criterion", requirement: clause.requirement,
    no_new_thresholds: true }];
  record.revisions = [atomic.status === "verified"
    ? "Corrected blanket partial classification: this exact alternative/fixture/containment criterion is satisfied. No criterion regression is evidenced; unrelated issuer/terminal/study gaps have been removed."
    : "Atomic partial finding: only this criterion's own missing evidence/conjunct is listed; no stage-wide gap is substituted."];
  record.remaining_gaps = atomic.gap ? [atomic.gap] : [];
  record.gaps = record.remaining_gaps;
  record.next_action = atomic.next;
  record.nextAction = [atomic.next];
  record.scientific_acceptance = "not-conferred-by-this-criterion-review";
  record.status_review = { prior_canonical_status: clause.status, current_proposed_status: atomic.status,
    criterion_regression_evidenced: false,
    explanation: atomic.status === "verified"
      ? "Verification/restoration follows the exact existing permitted behavior and retained named checks, not new model work."
      : "No claim of model regression; this is the criterion's remaining conjunct/evidence gap, not an issuer-wide acceptance condition." };
  record.evidence_caveat = `${clause.id}: direct code/test/retained-receipt review, not the canonical stale stage-level pointer. ${atomic.status === "verified"
    ? "Only the exact criterion is verified; no empirical issuer forecast or stage-wide acceptance is inferred."
    : `Not fully verified because: ${atomic.gap}`}`;
  const needsFinancialBasis = ["S11-002", "S11-003", "S12-008", "S12-017"].includes(clause.id);
  if (!needsFinancialBasis) {
    delete record.financial_basis;
    delete record.asof_price_treatment;
  } else {
    record.evidence_caveat += " The NEW FY2025 anchor is an UNAUDITED ISSUER EARNINGS RELEASE, NOT Form10-K, used only for a distinct conditional experiment; selectedFY2024 case is unchanged. Last-available-close age alone is not a blocker; actual shares/identity/terminal/horizon requirements and cutoffs remain.";
  }
 }
}
assert.deepEqual(counts, { 10: 14, 11: 43, 12: 18, 13: 22 });
assert.equal(records.length, 97);
assert.equal(new Set(records.map(r => r.id)).size, 97);
const proposedById = new Map(records.map(r => [r.id, r]));
for (const originalClause of allCanonicalClauses) {
  const proposal = proposedById.get(originalClause.id);
  if (proposal) for (const key of protectedFields)
    assert.deepEqual(proposal[key], originalClause[key], `${originalClause.id}.${key} changed`);
}
assert.equal(contract(allCanonicalClauses.map((r: any) => proposedById.get(r.id) ?? r)), originalContractHash);
assert.equal(ledger.source_sha256, sourceHash);
assert.equal(ledger.amendments_sha256, amendmentsHash);
const relevantPaths = [...new Set(records.flatMap(r => r.functions)
  .map(f => f.split(":")[0]).filter(f => f.endsWith(".ts")))];
// Read source directly and validate named functions, not central-ledger claims.
const sourceInspections = relevantPaths.map(path => {
  const text = readFileSync(path, "utf8");
  const functions = [...new Set(records.flatMap(r => r.functions)
    .filter(f => f.startsWith(path + ":")).map(f => f.slice(path.length + 1))
    .filter(f => /^[A-Za-z]\w*$/.test(f)))];
  return { path, sha256: sha(text), functions: functions.map(name => {
    const line = text.split("\n").findIndex(l => new RegExp(`\\b(?:function|const)\\s+${name}\\b`).test(l)) + 1;
    assert.ok(line > 0, `Named source function missing: ${path}:${name}`);
    return { name, line };
  }) };
});
for (const record of records) {
  record.direct_code_inspections = sourceInspections.filter(s =>
    record.functions.some((f: string) => f.split(":")[0] === s.path));
}
const output = { records };
const path = "docs/reconciliation-stages-10-13.json";
writeFileSync(path, JSON.stringify(output, null, 2) + "\n");
assert.equal(sha(readFileSync(ledgerPath)), sha(ledgerBytes), "Generator must not change central ledger");
console.log(JSON.stringify({ path, records: records.length, perStage: counts, completeAcceptedStages: 0,
  completeIssuerCases: "0/3", centralLedgersChanged: false, globalClauses: 300,
  contractHash: originalContractHash, source_sha256: sourceHash, amendments_sha256: amendmentsHash }));
