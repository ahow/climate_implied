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
  informationContext: "Revised history: FY2024 annual available 2025-02-14, after retained 2025-01-31 reference. Not a point-in-time signal.",
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
    "Targeted-return, flip/call priorities and project-specific gross cash/tax distributions are missing.",
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
  informationContext: "FY2024 source and forward guidance underpin a separately frozen conditional paid-capacity experiment; expected 2025 payment/completion is not observed.",
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
  ],
  sourced: [
    "FY2024 disclosure expects USD700m remaining US facility investment during 2025, included in the total capital-spend budget.",
    "19 GW is the forward 2025 shipment-guidance midpoint, not FY2024 actual or guaranteed demand.",
  ],
  conditions: [
    "Capacity paid/completed inside the existing bridge; 21/25 GW ceilings do not widen the original bound. No extra fixed plant below the selected ceiling.",
    "From 2026 modeled production equals sales; existing real finished goods are held, not drawn down. No inferred permanent throughput loss or yield upgrade.",
    "Five years of nonnegative unit increments fade over ten years; terminal real output is flat. 2.5%/3.25%/4% nominal growth is ASP/cost/replacement inflation, not pricing-power evidence.",
    "Inherited credit schedule versus all post-stub credit value zero; extra global units earn no additional US credit. Credit receivable is not silently released.",
  ],
  missingness: [
    "Actual remaining facility payment/completion was not observed.",
    "Plant-level marginal cash costs, utilization wear curves, future contract rollover and post-2025 law/FEOC eligibility remain unresolved.",
  ],
  refusalReasons: [
    "Actual FY2024 FCFE is negative: actual-to-year-five CAGR and the original actual-based reverse growth pair are undefined, not replaced with positive guidance.",
    "All zero-credit signed plan NPVs are negative; positive terminal cash does not imply positive whole funded-plan value.",
    "At 4% the extra-wear sensitivity has approximately negative USD170.5m terminal annual FCFE. No market-target root, uniqueness claim or original qualification.",
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
    { id: "shortage", label: "Reported tonnes minus delivered units", value: 1560945, unit: "tCO2e minus UKA (annual arithmetic)", classification: "sourced-derived", formula: "3,070,057 - 1,509,112 = 1,560,945", sourceLocator: "authoritativeClaims.selectedReportedTonnesMinusDeliveredUnits", boundary: "Before banks/purchases/transfers. Conversion to purchase need requires conditional 1 UKA/tCO2e; not observed cash expense or group liability." },
    { id: "observedExpense", label: "Observed company carbon expense", value: null, unit: "USD", classification: "sourced-derived", formula: "Not identified in retained observations", sourceLocator: "integrationGuard.observedCompanyCarbonExpense", boundary: "Embedded baseline expense remains intact; historical expense is not zero." },
    { id: "observedPrice", label: "Observed company-paid allowance price", value: null, unit: "GBP/UKA", classification: "sourced-derived", formula: "Not identified in retained observations", sourceLocator: "integrationGuard.observedCompanyPaidUkaPrice", boundary: "Auction prices and scenario increments are not company cash observations." },
    { id: "observedBank", label: "Observed uncommitted bank", value: null, unit: "UKA", classification: "sourced-derived", formula: "Not identified in retained observations", sourceLocator: "integrationGuard.observedUncommittedBank", boundary: "Unknown historical holdings must not become zero." },
    { id: "grossIncrement", label: "First-year GBP25 incremental gross cost", value: 39023625, unit: "GBP/year", classification: "conditional", formula: "1,560,945 × 25 = 39,023,625", sourceLocator: "conditionalForwardCalculation.scenarios[1].firstYearGrossIncrementalGbp", boundary: "GBP25 is a price-increment stress, not total price or observed market quote." },
    { id: "cashIncrement", label: "First-year incremental common cash", value: -48779531.25, unit: "USD/year", classification: "conditional", formula: "-39,023,625 × 1.25 = -48,779,531.25", sourceLocator: "conditionalForwardCalculation.scenarios[1].firstYearIncrementalCashUsd", boundary: "Conditional USD/GBP1.25, no pass-through, no marginal tax shield; no double deduction of baseline expense." },
    { id: "cases", label: "Integrated conditional components", value: 24, unit: "components", classification: "conditional", formula: "6 stored original baselines × 4 new component scenarios", sourceLocator: "conditionalForwardCalculation.integratedCases", boundary: "Not twenty-four qualified original whole-company cases." },
  ],
  sourced: [
    "Selected operating jurisdiction is England from registry regulator evidence, not headquarters or a global-average allocation.",
    "Exact Esso Petroleum Company Limited voting ownership is 100% at 2024-12-31; not a measured equity-emissions allocation or complete common-cash waterfall.",
  ],
  conditions: [
    "Hold FY2024 absolute permit-reported tCO2e flat. One UKA per reported tCO2e is explicitly conditional; statutory covered-gas annex was not retrieved.",
    "Only incremental price shocks are rebuilt; unidentified baseline carbon expense stays embedded. GBP1/FX1 are normalization coefficients; GBP25/FX1.25 are stress coordinates.",
    "Future opening uncommitted bank zero, bank-first settlement, emissions-year purchases and no speculative sales are prospective conventions, not observed purchase dates or account balances.",
    "Future allocation held at FY2024 units or zero; no pass-through/no shield or half recovery with one-year collection lag. Revenue, collections and incremental receivables reconcile separately.",
    "Preserve original capital, replacement, debt, tax, reserves and dated stub. Reject terminal integration if temporary bank support eventually depletes; no terminal bank liquidation.",
  ],
  missingness: [
    "Native CO2 gas-specific tonnes and corporate GHG scope/equity reconciliation are unavailable.",
    "Historical allowance banks, sale cash, company-paid prices, purchase/transfer dates and embedded carbon expense are unknown.",
    "Specific site address for the generic registry installation is unidentified. The separate chemical operator is excluded because exact ownership linkage is missing.",
    "Global coverage, other jurisdictions, statutory unit annex, future awards, observed dated FX and measured pass-through/tax realization remain unresolved.",
  ],
  refusalReasons: [
    "Two selected permits do not establish whole-company climate liability, global coverage, a market price forecast or current-law certification.",
    "No historical expense removal, total-price deduction, CCS tariff, reverse scoring or root/uniqueness claim.",
  ],
};

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
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
