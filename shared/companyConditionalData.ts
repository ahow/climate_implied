/** Explicit public aggregate allowlist. No evidence/source file is read at runtime. */
export type ConditionalIssuer = "NEE" | "FSLR" | "XOM";
export interface ConditionalFact {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  classification: "sourced-derived" | "conditional";
  formula: string;
  sourceLocator: string;
  boundary: string;
}
export interface ConditionalCompany {
  issuer: ConditionalIssuer;
  name: string;
  experimentVersion: string;
  evidenceDocument: string;
  informationContext: string;
  qualifiedOriginalIssuers: 0;
  qualifiedOriginalPairs: 0;
  facts: readonly ConditionalFact[];
  sourced: readonly string[];
  conditions: readonly string[];
  missingness: readonly string[];
  refusalReasons: readonly string[];
}

const NEE: ConditionalCompany = {
  issuer: "NEE", name: "NextEra Energy",
  experimentVersion: "nee-component-cash-waterfall-1-funding-guard",
  evidenceDocument: "docs/nee-project-cash-waterfall-evidence.json",
  informationContext: "Revised history: FY2024 annual available 2025-02-14, after retained 2025-01-31 reference. Not a point-in-time signal. Separate nee-related-partner-cash-2 source component uses XPLR's FY2024annual filed2025-02-21, also after the retained reference. Its counterparty-side category cash partition is not a replacement for this legacy24path experiment, NEE's consolidated NCI or the unknown811m operating-affiliate subset. Separately frozen nee-renewables-ii-source-claims-1 uses declared executed February17,2025LLCterms: conditional normalized AvailableCash claims only, no observed or future common cash added.",
  qualifiedOriginalIssuers: 0, qualifiedOriginalPairs: 0,
  facts: [
    { id: "fplDividend", label: "FPL gross dividend to parent", value: 3700000000, unit: "USD", classification: "sourced-derived", formula: "Authenticated historical gross FPL dividend", sourceLocator: "computedHistoricalWaterfallsUsd.fplGrossDividendToParent", boundary: "Gross historical transfer; not sustainable common FCFE." },
    { id: "parentContribution", label: "Parent gross contribution to FPL", value: 3400000000, unit: "USD", classification: "sourced-derived", formula: "Authenticated historical gross parent contribution", sourceLocator: "computedHistoricalWaterfallsUsd.parentGrossContributionToFpl", boundary: "Separate gross funding leg, not netted out of disclosure." },
    { id: "netParentCash", label: "Net cash to parent", value: 300000000, unit: "USD", classification: "sourced-derived", formula: "3,700,000,000 - 3,400,000,000 = 300,000,000", sourceLocator: "computedHistoricalWaterfallsUsd.netCashToParent", boundary: "FPL subsidiary-to-parent bridge only." },
    { id: "fplCashChange", label: "FPL cash change after transfers", value: 61000000, unit: "USD", classification: "sourced-derived", formula: "361,000,000 - 3,700,000,000 + 3,400,000,000 = 61,000,000", sourceLocator: "computedHistoricalWaterfallsUsd.fplCashChangeAfterParentTransfers", boundary: "Historical cash bridge, not future distributable cash." },
    { id: "cashResidual", label: "Four financing/cash reconciliation residuals", value: 0, unit: "USD", classification: "sourced-derived", formula: "All four reported financing and cash reconciliation residuals = 0", sourceLocator: "computedHistoricalWaterfallsUsd.allFourFinancingAndCashReconciliationResiduals", boundary: "Arithmetic reconciliation does not identify missing legal priorities." },
    { id: "beforeCommon", label: "Consolidated before common issuance/dividends", value: 2183000000, unit: "USD", classification: "sourced-derived", formula: "Historical gross financing cash waterfall", sourceLocator: "computedHistoricalWaterfallsUsd.consolidatedBeforeCommonIssuanceAndDividends", boundary: "Includes disposals, DMI, related-party flows, tax and working capital. Does not replace retained USD169m selected common-FCFE base." },
    { id: "withoutDmi", label: "Same waterfall without new DMI proceeds", value: -74000000, unit: "USD", classification: "sourced-derived", formula: "Same historical waterfall, excluding new DMI proceeds", sourceLocator: "computedHistoricalWaterfallsUsd.sameWaterfallWithoutNewDmiProceeds", boundary: "Not an observed alternative historical cash flow." },
    { id: "unknownGrossInflow", label: "Gross other noncommon inflow", value: null, unit: "USD", classification: "sourced-derived", formula: "Not identifiable from net other financing", sourceLocator: "computedHistoricalWaterfallsUsd.grossOtherNoncommonInflow", boundary: "Unknown is not zero; net cash cannot bound offsetting gross claims." },
    { id: "unknownGrossOutflow", label: "Gross other noncommon outflow", value: null, unit: "USD", classification: "sourced-derived", formula: "Not identifiable from net other financing", sourceLocator: "computedHistoricalWaterfallsUsd.grossOtherNoncommonOutflow", boundary: "Unknown is not zero." },
    { id: "conditionalCases", label: "Complete conditional paths", value: 24, unit: "paths", classification: "conditional", formula: "6 original stub/g combinations × 2 cash-return treatments × 2 policy treatments", sourceLocator: "outcomes.fullNewCases", boundary: "24 conditional floor calculations; not qualified cases." },
    { id: "negativeFunding", label: "Negative annual common-funding rows", value: 48, unit: "rows", classification: "conditional", formula: "Count of negative annual common-owner cash rows in the frozen paths", sourceLocator: "outcomes.negativeAnnualCommonFundingRows", boundary: "Negative contributions remain signed in PV; no guaranteed subscriptions." },
    { id: "relatedPartnerGrossDistributions", label: "Counterparty cash: NEE indirect-owner category", value: 422000000, unit: "USD nominal FY2024", classification: "sourced-derived", formula: "XPLR816m partner cash distributions =335m public units +481m other owners;481m =422m NEE-category +59m other owners", sourceLocator: "docs/nee-related-source-followup-evidence.json#calculation.grossDistributionsInNeeIndirectOwnershipCategoryUsd", boundary: "XPLR Note2NEE-indirect-owner category, primarily NEEEquity/NEER interests; not NEE's outgoing NCI or a certified422m subset of811m operating affiliate distributions.58m contribution is an equity movement, not certified cash;364m difference is NOT certified net cash. New component, no future common cash added or old24paths rescored." },
  ],
  sourced: [
    "Historical FPL and non-FPL cash-return normalization is mature-portfolio calibration, not marginal project return guidance.",
    "Operating geography distinguishes FPL and NEER US/Canada; net MW do not identify sales weights, equity cash share or credit eligibility.",
  ],
  conditions: [
    "Frozen 2025 stub, 2026–2030 steps, 2031–2040 fade, 2041 terminal; 2.5%/3.25%/4% nominal growth and original 10% common discount sensitivity.",
    "Future funded-capital cash yields are source-calibrated conditions. Replacement includes fuel within total capital cash, not twice.",
    "All AFUDC held in a non-distributable zero-return reserve, never released. No future DMI/NCI proceeds, disposals, common issuance or related-party funding.",
    "Policy cash capped at historical USD1.304bn nominal through 2029, runs off to zero in 2039, paired with all-future-policy-cash-zero paths. Not post-2025/FEOC legal certification.",
    "Indexed USD740m DMI reserve and USD653m maximum net other-financing reserve do not certify gross legal distributions.",
  ],
  missingness: [
    "NEE consolidated project gross cash/tax waterfalls remain missing. Separate executed XPLR RenewablesII/GenesisLLCexhibits10.16/10.18 now source AvailableCash definitions, monthly priorities, conditional flip/call terms, tax allocation rules and contractual buyout IRRs. These are unconsolidated counterparty rules, not NEE consolidated DMI or commissioning project returns. Actual AvailableCash/history/current units, NEE811m CFOsubset and contribution cash mapping remain unresolved.",
    "Future project/cohort marginal cash returns, AFUDC debt/equity split, and precise fuel/amortization schedules are not established.",
    "Unapproved NEER developments and US/Canada cash/credit attribution remain unresolved.",
  ],
  refusalReasons: [
    "Positive conditional floors do not identify hidden gross legal waterfalls or source marginal returns.",
    "Historical common-FCFE recovery CAGR is not activity growth, project IRR or management guidance. No reverse root or uniqueness certification.",
  ],
};

const FSLR: ConditionalCompany = {
  issuer: "FSLR", name: "First Solar",
  experimentVersion: "fslr-paid-spare-capacity-post-credit-1",
  evidenceDocument: "docs/fslr-paid-spare-capacity-evidence.json",
  informationContext: "Revised history, NOT a point-in-time signal: retained reference/price cutoff remains 2025-02-21 and is NOT backdated. Legacy frozen experiment fslr-paid-spare-capacity-post-credit-1 remains separate from new source pack issuer-cash-collections-source-1 and new integration fslr-source-cohort-integrated-1. New integration uses the retained issuer-original-operating-funding-3 source-conditioned2.5%ledger, NOT the legacy48paid-capacity paths. Added facts use disclosures published 2025-02-25(FY2024annual), 2025-04-29, 2026-04-30 and 2026-10-29(latest source publication cutoff; report period through2026Q3). Selected receipts occurred2024–February2026. Later2025/2026collection outcomes and the new integration were NOT known at the February21,2025cutoff; this does not assert that every constituent historical amount lacked prior disclosure. New integration was frozen 2026-11-11. Legacy facility payment/completion remains conditional, distinct from subsequently observed tax-credit receipts. Separate fslr-grant-scope-1 diagnoses FY2024programme/noncash scope without new cash, valuation or qualification adjustment.",
  qualifiedOriginalIssuers: 0, qualifiedOriginalPairs: 0,
  facts: [
    { id: "openingPpe", label: "Opening 2025 net PP&E", value: 5413683000, unit: "USD", classification: "sourced-derived", formula: "Retained opening net PP&E", sourceLocator: "paidCapitalAndPhysicalAssumptions.openingNetPpe2025Usd", boundary: "Source anchor, not evidence that remaining capacity was paid." },
    { id: "capex", label: "Conditional 2025 capital spend", value: 1400000000, unit: "USD", classification: "conditional", formula: "Frozen total 2025 capital-spend bridge", sourceLocator: "paidCapitalAndPhysicalAssumptions.capitalSpend2025Usd", boundary: "Includes USD700m expected remaining facility budget; not added again." },
    { id: "depreciation", label: "2025 depreciation in bridge", value: 423498000, unit: "USD", classification: "conditional", formula: "Retained depreciation path", sourceLocator: "paidCapitalAndPhysicalAssumptions.depreciation2025Usd", boundary: "Not a plant-level marginal wear observation." },
    { id: "closingPpe", label: "Conditional closing 2025 net PP&E", value: 6390185000, unit: "USD", classification: "conditional", formula: "5,413,683,000 + 1,400,000,000 - 423,498,000 = 6,390,185,000", sourceLocator: "paidCapitalAndPhysicalAssumptions.closingNetPpe2025Usd", boundary: "Conditional payment/completion, not observed cash payment." },
    { id: "budgetRemainder", label: "Unallocated other budget residual", value: 700000000, unit: "USD", classification: "conditional", formula: "1,400,000,000 - 700,000,000 = 700,000,000", sourceLocator: "paidCapitalAndPhysicalAssumptions.unallocatedOtherBudgetResidualUsd", boundary: "Arithmetic remainder, not an asset-level allocation or observed cost of the entire 4 GW expansion." },
    { id: "cases", label: "Complete conditional cases", value: 48, unit: "cases", classification: "conditional", formula: "6 stored baselines × 2 ceilings × 2 cash-cost treatments × 2 credit valuations", sourceLocator: "outcomes.newCompleteCases", boundary: "Not 48 qualified issuers or original cases." },
    { id: "positiveTerminals", label: "Positive post-credit terminal rows", value: 18, unit: "rows", classification: "conditional", formula: "18 positive + 30 nonpositive = 48 terminal rows", sourceLocator: "outcomes.terminalPositiveCases", boundary: "Nine distinct terminal configurations paired across credit histories; not independent successes." },
    { id: "positivePlans", label: "Positive whole funded-plan values", value: 9, unit: "cases", classification: "conditional", formula: "18 positive terminals - 9 with nonpositive funded-plan value = 9", sourceLocator: "outcomes.conditionalPositiveFundedValues", boundary: "Positive terminal alone does not qualify a funded plan." },
    { id: "zeroCreditPositive", label: "Zero-future-credit positive funded values", value: 0, unit: "cases", classification: "conditional", formula: "Count of positive funded values under all post-stub credit value zero", sourceLocator: "outcomes.allPostStubCreditZeroPositiveFundedValues", boundary: "Adverse value assumption, not statutory ineligibility." },
    { id: "negativeFunding", label: "Negative common-funding years retained", value: 520, unit: "rows", classification: "conditional", formula: "Signed negative common-funding rows across 48 paths", sourceLocator: "outcomes.negativeCommonFundingYearsRetained", boundary: "Not forced shareholder commitments or negative quoted share prices." },
    { id: "cohortTransferFace", label: "Three selected credit-transfer cohorts: face", value: 2258800000, unit: "USD nominal", classification: "sourced-derived", formula: "(857.2 + 701.9 + 699.7) million", sourceLocator: "docs/issuer-cash-collections-evidence.json#newCalculatedResults.totalTransferFaceUsd", boundary: "2024/2025-origin grouped agreements; face is not income, collected cash or total corporate credit generation. Later reports through 2026-10-29; not known at original cutoff." },
    { id: "cohortTransferCash", label: "Three selected cohorts: net proceeds received", value: 2154900000, unit: "USD nominal", classification: "sourced-derived", formula: "(818.6 + 668.1 + 668.2) million; received across 2024–2026", sourceLocator: "docs/issuer-cash-collections-evidence.json#newCalculatedResults.totalContractProceedsAndObservedTransferCashUsd", boundary: "Selected contracts fully collected by February2026; not total CFO or all grant receivables. Payment-year and generation-year differ." },
    { id: "cohortFaceCashDifference", label: "Selected face less proceeds", value: 103900000, unit: "USD nominal", classification: "sourced-derived", formula: "2,258,800,000 - 2,154,900,000 = 103,900,000", sourceLocator: "docs/issuer-cash-collections-evidence.json#newCalculatedResults.faceLessProceedsUsd", boundary: "Already reflected in net proceeds; not a second cash deduction or independently identified fee/opex." },
    { id: "cohortTreasuryCash", label: "Treasury receipt for 2024-origin credits", value: 117600000, unit: "USD nominal received January2026", classification: "sourced-derived", formula: "Separately disclosed Treasury cash117.6million; not inferred credit face", sourceLocator: "docs/issuer-cash-collections-evidence.json#newCalculatedResults.treasuryCashOnlyUsd", boundary: "Receipt confirmed in April/October2026reports; principal/interest split and opening GAAPcarrying amount unknown. Not new2026generation." },
    { id: "cohortSelectedCash", label: "Three transfers plus Treasury: selected cash", value: 2272500000, unit: "USD nominal, receipts 2024–2026", classification: "sourced-derived", formula: "2,154,900,000 + 117,600,000 = 2,272,500,000", sourceLocator: "docs/issuer-cash-collections-evidence.json#newCalculatedResults.selectedTransferPlusTreasuryCashUsd", boundary: "Selected historical receipts only; no full-company CFO/credit-generation or current eligibility claim." },
    { id: "cohortRemainingClaims", label: "Selected transfers: remaining proceeds", value: 0, unit: "USD nominal after February2026collection", classification: "sourced-derived", formula: "Selected agreed proceeds - selected observed transfer receipts = 0", sourceLocator: "docs/issuer-cash-collections-evidence.json#newCalculatedResults.closingIdentifiedTransferContractProceedsUsd.2026", boundary: "Zero for ONLY these three contracts, not zero all-company grants, future collections, recourse or indemnity." },
    { id: "cohortIncludingFiservFace", label: "Four groups including 2023-origin Fiserv: face", value: 2946000000, unit: "USD nominal", classification: "sourced-derived", formula: "2,258,800,000 + 687,200,000 = 2,946,000,000", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#completeKnownCohortIndexDerivedAggregates.combinedFaceUsd", boundary: "Four grouped transfers/eight agreements; 2023-origin Fiserv cash was received2024, not added again after2025cutoff." },
    { id: "cohortIncludingFiservProceeds", label: "Four groups: combined transfer proceeds", value: 2814600000, unit: "USD nominal, receipts 2024–2026", classification: "sourced-derived", formula: "2,154,900,000 + 659,700,000 = 2,814,600,000", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#completeKnownCohortIndexDerivedAggregates.combinedTransferProceedsUsd", boundary: "Net transfer receipts; Fiserv loss belongs2023recognition, not a second2024cash charge. Rounded issuer deal amounts." },
    { id: "cohortIncludingFiservDifference", label: "Four groups: face less proceeds", value: 131400000, unit: "USD nominal", classification: "sourced-derived", formula: "2,946,000,000 - 2,814,600,000 = 131,400,000", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#completeKnownCohortIndexDerivedAggregates.combinedFaceLessProceedsUsd", boundary: "Includes prior2023Fiservdifference; do not subtract again from already-net CFO/cash receipts." },
    { id: "cohortIncludingFiservCash", label: "Four transfers plus Treasury: identified cash", value: 2932200000, unit: "USD nominal, receipts 2024–2026", classification: "sourced-derived", formula: "2,814,600,000 + 117,600,000 = 2,932,200,000", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#completeKnownCohortIndexDerivedAggregates.combinedIdentifiedTransferPlusTreasuryCashUsd", boundary: "Known selected cohorts, not all grants, tax offsets or company cash. Source observations later than original reference." },
    { id: "cohortHistoricalCreditCash", label: "Identified 2024 operating credit receipts", value: 1275700000, unit: "USD nominal received2024", classification: "sourced-derived", formula: "659,700,000 Fiserv2023origin + 616,000,000 Visa2024origin", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#historicalNormalizationComputed.identified2024OperatingCreditCashUsd", boundary: "Income recognition and receipt years differ. Two narrative receipts have combined rounding bound±100,000; historical CFO is not restated." },
    { id: "cohortCfoRemainder", label: "2024 CFO less identified credit receipts", value: -57701000, unit: "USD nominal FY2024 diagnostic", classification: "sourced-derived", formula: "1,217,999,000 - 1,275,700,000 = -57,701,000", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#historicalNormalizationComputed.cfoLessOnlyIdentifiedCreditCashUsd", boundary: "Diagnostic remainder, NOT grant-free recurring FCFE. Do not also remove recognized grants and grant-WC cash again." },
    { id: "cohortUnallocatedGrantBridge", label: "Unallocated grant-bridge residual", value: 8721000, unit: "USD nominal FY2024 diagnostic", classification: "sourced-derived", formula: "1,014,121,000 income-grant benefits + 270,300,000 grant-CFO adjustment - 1,275,700,000 identified cash", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#historicalNormalizationComputed.unallocatedIncomeGrantPlusCfoAdjustmentLessIdentifiedCashUsd", boundary: "Unattributed residual, NOT observed India/other-grant cash; total grants receivable is not all45X." },
    { id: "cohortGrantBookCfoResidual", label: "Grant CFO versus book-movement residual", value: 19676000, unit: "USD nominal FY2024 diagnostic", classification: "sourced-derived", formula: "270,300,000 CFOeffect - 250,624,000 reported grant-book decrease", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#historicalNormalizationComputed.cfoVersusBookMovementUnattributedUsd", boundary: "Unattributed, not assumed FX, cash or a source-qualified GAAPprogram rollforward. India asset-grant cash schedule remains unknown." },
    { id: "cohortUsEligibleWatts", label: "Actual US-eligible output by component channel", value: null, unit: "eligible watts; period/channel unresolved", classification: "sourced-derived", formula: "Not identified from global4.3GWproduced/4.1GWsoldQ32026 or revenue share", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#actualVolumeEligibility.actualUsEligibleWatts", boundary: "Unknown, not zero. Fully-US17c/Wversusinternational-initiated/US-completed7c/Ware issuer expectations, not MACR/FEOC/deemed-sale certification." },
    { id: "cohortPriorCreditCash2026", label: "Prior-credit cash inserted in 2026 integration", value: 212800000, unit: "USD nominal received January/February2026", classification: "sourced-derived", formula: "117,600,000 Treasury2024origin + 95,200,000 October2025sale balance", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#cashIntegrationExecuted.actualPriorCreditCashInserted2026Usd", boundary: "Inserted only after removing overlapping forecast2025carry; no new income/tax/WC/excesscash addition." },
    { id: "cohortPreCutoffReservePv", label: "New splice: Visa pre-cutoff/reserved PV adjustment", value: 264507698.69760892, unit: "USD PV at retained2025-02-21cutoff", classification: "conditional", formula: "Source-dated finite cash replacement at original10%discount; VisaQ1receipt reserved if before cutoff", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#cashIntegrationExecuted.timingTreatments[0].finiteCashDeltaPvUsd", boundary: "NEW fslr-source-cohort-integrated-1 on one retained2.5%case, not the legacy48paid-capacity paths, a whole-equity value or certified global lower bound. Later facts not known at cutoff." },
    { id: "cohortPostCutoffVisaPv", label: "New splice: Visa post-cutoff March31 PV adjustment", value: 465108662.4538152, unit: "USD PV at retained2025-02-21cutoff", classification: "conditional", formula: "Pre-cutoff-reserved finite adjustment + 202,600,000 discounted from assumed2025-03-31", sourceLocator: "docs/fslr-cohort-integrated-evidence.json#cashIntegrationExecuted.timingTreatments[1].finiteCashDeltaPvUsd", boundary: "March31is a Q1timing boundary, not observed payment day. Not a certified global upper bound, market pair or original completion;0/3 remains." },
    { id: "grantScopeReported45x", label: "Specific FY2024 MD&A45X cost-of-sales benefit", value: 997600000, unit: "USD nominal FY2024 income; narrative rounded0.1m", classification: "sourced-derived", formula: "Source reports997.6million45Xcredits as cost-of-sales reduction; not the1,014.121m all-income-grant table", sourceLocator: "docs/fslr-grant-scope-evidence.json#calculation.reportedSpecific45xCostSalesUsd", boundary: "FY2024annual published2025-02-25, after retained2025-02-21. Specific disclosure, not gross sold face/eligible watts/cash. Scope difference16.521m plus mixed-scope−7.8m reproduces8.721m; neither component certifies other-program cash. No new cash/GAAPtotal adjustment." },
    { id: "grantScopeNoncashSupplement", label: "Asset-grant proceeds-to-be-received disclosure", value: 171920000, unit: "USD FY2024 annual-duration NONCASH supplement", classification: "sourced-derived", formula: "CFOstatement supplemental noncash investing/financing disclosure171,920thousand; native c-1annual context", sourceLocator: "docs/fslr-grant-scope-evidence.json#calculation.noncashSupplementCurrentUsd", boundary: "NOT collected cash or automatically an instant receivable.19.712m difference to prior supplement and19.711m asset-benefit stock change are crosschecks only; neither certifies the19.676m book/CFOresidual as cash/FX. New fslr-grant-scope-1 diagnostics do not change32cashrows or the retained two conditional revised-history outcomes;0/3 remains. Whole-equity values are not in this public allowlist." },
  ],
  sourced: [
    "FY2024 disclosure expects USD700m remaining US facility investment during 2025, included in the total capital-spend budget.",
    "19 GW is the legacy forward2025shipment-guidance midpoint, not FY2024actual or guaranteed demand. New public cohort facts separately tag2023/2024/2025credit origins and2024/2025/2026receipts; source publication cutoff2026-10-29, never backdated to2025-02-21.",
  ],
  conditions: [
    "Capacity paid/completed inside the existing bridge; 21/25 GW ceilings do not widen the original bound. No extra fixed plant below the selected ceiling.",
    "From 2026 modeled production equals sales; existing real finished goods are held, not drawn down. No inferred permanent throughput loss or yield upgrade.",
    "Five years of nonnegative unit increments fade over ten years; terminal real output is flat. 2.5%/3.25%/4% nominal growth is ASP/cost/replacement inflation, not pricing-power evidence.",
    "Legacy inherited credit schedule versus all post-stub credit value zero remains unchanged; extra global units earn no additional US credit. Separate NEWcohort splice removes matching forecast net cash/carry BEFORE inserting actual net receipts, with no second discount, recognition, tax, otherWC or excesscash addition. VisaQ12025timing is pre-cutoff/reserved or assumedMarch31; known months use monthend, midyear-contract2025cash uses yearend/no pre-contract advances assumption, not stub-proration. These are conditional date/reserve treatments, not observed days or a new operating grid. Original2.5%terminal unchanged; no re-scoring other endpoints.",
  ],
  missingness: [
    "Legacy remaining facility payment/completion was not observed; this does not negate later source-confirmed credit collections. Actual US-eligible watts/channel split and component/PFE/deemed-sale cost shares remain unknown, not inferred from global volume or UScustomer revenue.",
    "Plant-level marginal cash costs, utilization wear curves, future contract rollover and post-2025 law/FEOC eligibility remain unresolved. New unmatched273.4mcredit-face-equivalent remains a conditional forecast, not audited recognized credit. Grant residuals8.721m/19.676m are not observed other-grant/FXcash; remaining India/grant balances are reserved without assumed zero cash or writeoff.",
  ],
  refusalReasons: [
    "Actual FY2024 FCFE is negative: actual-to-year-five CAGR and the original actual-based reverse growth pair are undefined, not replaced with positive guidance.",
    "In the legacy48paid-capacity paths, all zero-credit signed plan NPVs are negative; positive terminal cash does not imply positive whole funded-plan value. New cohort finite PV adjustments are not new zero-credit plan valuations.",
    "Legacy4%extra-wear sensitivity has approximately negativeUSD170.5mterminal annualFCFE. New finite sourcecash integration is technically executed, not full original technical completion: remaining economic/legal conditions are not merely owner review. Owner review pending, not requested. Neither version claims a market-target root, uniqueness or original qualification:0/3.",
  ],
};

const XOM: ConditionalCompany = {
  issuer: "XOM", name: "Exxon Mobil",
  experimentVersion: "xom-permit-geography-incremental-carbon-cash-1",
  evidenceDocument: "docs/xom-climate-liability-evidence.json",
  informationContext: "Revised history: FY2024 observations appear in 2026 registry snapshots; February 2025 filing is after retained January 2025 price cutoff.",
  qualifiedOriginalIssuers: 0, qualifiedOriginalPairs: 0,
  facts: [
    { id: "reportedEmissions", label: "Selected permit reported emissions", value: 3070057, unit: "tCO2e/year (FY2024)", classification: "sourced-derived", formula: "564,699 + 2,505,358 = 3,070,057", sourceLocator: "authoritativeClaims.additiveSelectedPermitReportedTco2e", boundary: "Two selected English permits; not native CO2, corporate Scope 1 or global equity emissions." },
    { id: "deliveredUnits", label: "Selected delivered allowances", value: 1509112, unit: "UKA (FY2024)", classification: "sourced-derived", formula: "0 + 1,509,112 = 1,509,112", sourceLocator: "authoritativeClaims.selectedDeliveredUka2024", boundary: "Delivered annual units, not purchased units or allowance bank." },
    { id: "shortage", label: "Reported tonnes minus delivered units", value: 1560945, unit: "tCO2e minus UKA (annual arithmetic)", classification: "sourced-derived", formula: "3,070,057 - 1,509,112 = 1,560,945", sourceLocator: "authoritativeClaims.selectedReportedTonnesMinusDeliveredUnits", boundary: "Before banks/purchases/transfers. Subsequent Article 18 source qualification confirms 1 allowance/tCO2e; the frozen experiment is not rerun. This difference is not observed purchase need, cash expense or group liability." },
    { id: "observedExpense", label: "Observed company carbon expense", value: null, unit: "USD", classification: "sourced-derived", formula: "Not identified in retained observations", sourceLocator: "integrationGuard.observedCompanyCarbonExpense", boundary: "Embedded baseline expense remains intact; historical expense is not zero." },
    { id: "observedPrice", label: "Observed company-paid allowance price", value: null, unit: "GBP/UKA", classification: "sourced-derived", formula: "Not identified in retained observations", sourceLocator: "integrationGuard.observedCompanyPaidUkaPrice", boundary: "Auction prices and scenario increments are not company cash observations." },
    { id: "observedBank", label: "Observed uncommitted bank", value: null, unit: "UKA", classification: "sourced-derived", formula: "Not identified in retained observations", sourceLocator: "integrationGuard.observedUncommittedBank", boundary: "Unknown historical holdings must not become zero." },
    { id: "grossIncrement", label: "First-year GBP25 incremental gross cost", value: 39023625, unit: "GBP/year", classification: "conditional", formula: "1,560,945 × 25 = 39,023,625", sourceLocator: "conditionalForwardCalculation.scenarios[1].firstYearGrossIncrementalGbp", boundary: "GBP25 is a price-increment stress, not total price or observed market quote." },
    { id: "cashIncrement", label: "First-year incremental common cash", value: -48779531.25, unit: "USD/year", classification: "conditional", formula: "-39,023,625 × 1.25 = -48,779,531.25", sourceLocator: "conditionalForwardCalculation.scenarios[1].firstYearIncrementalCashUsd", boundary: "Conditional USD/GBP1.25, no pass-through, no marginal tax shield; no double deduction of baseline expense." },
    { id: "cases", label: "Integrated conditional components", value: 24, unit: "components", classification: "conditional", formula: "6 stored original baselines × 4 new component scenarios", sourceLocator: "conditionalForwardCalculation.integratedCases", boundary: "Not twenty-four qualified original whole-company cases." },
  ],
  sourced: [
    "Selected operating jurisdiction is England from registry regulator evidence, not headquarters or a global-average allocation. Subsequent primary-source qualification: Article 18(2)/(3), https://www.legislation.gov.uk/uksi/2020/1265/2024-12-31/data.xml (made 2020-11-11; historical view 2024-12-31; original publication date unestablished), confirms 1 allowance per tonne CO2 equivalent. See docs/xom-source-inputs-evidence.json; this is not current-law or installation-native-gas certification.",
    "Exact Esso Petroleum Company Limited voting ownership is 100% at 2024-12-31; not a measured equity-emissions allocation or complete common-cash waterfall.",
  ],
  conditions: [
    "The frozen experiment holds FY2024 absolute permit-reported tCO2e flat and originally treated 1 UKA/tCO2e as conditional. Subsequent Article 18 primary-source qualification confirms the statutory 1 allowance/tCO2e denomination without changing that historical experiment or its numbers. Complete installation permit/monitoring annex, native-gas mass and permit/site crosswalk remain unverified.",
    "Only incremental price shocks are rebuilt; unidentified baseline carbon expense stays embedded. GBP1/FX1 are normalization coefficients; GBP25/FX1.25 are stress coordinates.",
    "Future opening uncommitted bank zero, bank-first settlement, emissions-year purchases and no speculative sales are prospective conventions, not observed purchase dates or account balances.",
    "Future allocation held at FY2024 units or zero; no pass-through/no shield or half recovery with one-year collection lag. Revenue, collections and incremental receivables reconcile separately.",
    "Preserve original capital, replacement, debt, tax, reserves and dated stub. Reject terminal integration if temporary bank support eventually depletes; no terminal bank liquidation.",
  ],
  missingness: [
    "Statutory activity-to-gas rows are source-qualified, but complete installation permit/monitoring annex, native CO2 gas-specific tonnes and corporate GHG scope/equity reconciliation remain unverified; reported tCO2e is not silently relabelled native CO2.",
    "Historical allowance banks, sale cash, company-paid prices, purchase/transfer dates and embedded carbon expense are unknown.",
    "The exact UK ETS permit/site crosswalk remains unverified. A separately retrieved historical Fawley EPR permit is not proof of UK-E-IN-11402 identity or FY2024 UK ETS monitoring/site coverage. The separate chemical operator is excluded because exact ownership linkage is missing.",
    "The statutory allowance denomination is now source-qualified, not an outstanding unit gap. Global coverage, other jurisdictions, complete permit/native-gas annex, future awards, observed dated FX and measured pass-through/tax realization remain unresolved; banks, purchases and company-paid prices are still unverified.",
  ],
  refusalReasons: [
    "Two selected permits do not establish whole-company climate liability, global coverage, a market price forecast or current-law certification.",
    "No historical expense removal, total-price deduction, CCS tariff, reverse scoring or root/uniqueness claim. Subsequent CF evidence (docs/xom-contract-permit-evidence.json): FY2024 filing https://www.sec.gov/Archives/edgar/data/1324404/000132440425000006/cf-20241231.htm (filed 2025-02-20) uses metric CO2 capacity; FY2022 filing https://www.sec.gov/Archives/edgar/data/1324404/000132440423000006/cf-20221231.htm (filed 2023-02-23) defines its original tons as short tons, not retrospectively metric. CF capture equipment investment is client capex, not XOM transport/storage capex, replacement or common cash; capacity is not minimum billing, realized capture or a fee.",
  ],
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** Same schema, additive public source references only. Never reads evidence files. */
export function conditionalFactEvidenceReference(company: Pick<ConditionalCompany, "evidenceDocument">, fact: Pick<ConditionalFact, "sourceLocator">) {
  return /^docs\/[\w-]+\.json#.+$/.test(fact.sourceLocator) ?
    fact.sourceLocator : `${company.evidenceDocument}#${fact.sourceLocator}`;
}

export const conditionalCompanySummary = deepFreeze({
  schemaVersion: "company-conditional-public-1",
  scope: "Supplemental S12/S16 research only; not original closure",
  readOnly: true,
  sourceApproval: "immutable-public-derived-aggregate-allowlist",
  qualifiedOriginalIssuers: 0,
  requiredOriginalIssuers: 3,
  qualifiedOriginalPairs: 0,
  tier2Promoted: false,
  efficacyPromoted: false,
  originalClosure: false,
  frozenProtocolsChanged: false,
  companies: [NEE, FSLR, XOM],
} as const);

/** One export surface shared by the API, JSON and XLSX. No client-provided data. */
export function getConditionalCompanySummary(issuer?: ConditionalIssuer) {
  return {
    ...conditionalCompanySummary,
    companies: conditionalCompanySummary.companies.filter(company => !issuer || company.issuer === issuer),
  };
}

export function conditionalExportCells(value: unknown, path = ""): Array<{ field: string; jsonValue: string }> {
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) =>
      conditionalExportCells(child, path ? `${path}.${key}` : key));
  }
  return [{ field: path, jsonValue: JSON.stringify(value) }];
}
