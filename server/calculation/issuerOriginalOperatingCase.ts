import { authenticatePrimaryIssuerCashflow } from "./issuerCashflowCase";
import { type IssuerReconciliation } from "./issuerCashflowReconciliation";
import { calculateCompanyFullCashflowCase, pairCompanyFullCashflowCase,
  valueCompanyFullCashflowCase } from "./companyFullCashflowCase";
import { contentHash } from "./analysisManifest";

export type OriginalIssuerInputs = {
  reconciliation: IssuerReconciliation;
  additionalClaims: { tag: string; id: string; context: string; value: number }[];
  netPpe: number; debt: number; inventory: number; otherCurrentAssets: number;
  operatingPayables: number; customerAdvances: number; minimumCash: number;
  maturities2025To2029: number[];
  renewableTaxCreditCash: number;
  supplementHash: string; primaryHash: string; publishedAt: string;
};
const plain = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ");

/** Additional actual balance-sheet/funding claims; old 166-fact audit stays frozen. */
export function extractOriginalIssuerInputs(html: string, supplement: string, reconciliation: IssuerReconciliation,
  provenance: Pick<OriginalIssuerInputs, "primaryHash" | "supplementHash" | "publishedAt">): OriginalIssuerInputs {
  const identity = reconciliation.identity, p = authenticatePrimaryIssuerCashflow(html, identity);
  const contexts = new Map(Array.from(html.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g))
    .map(m => [m[1], m[2]]));
  const usd = new Set(Array.from(html.matchAll(/<xbrli:unit id="([^"]+)">([\s\S]*?)<\/xbrli:unit>/g))
    .filter(m => m[2] === "<xbrli:measure>iso4217:USD</xbrli:measure>").map(m => m[1]));
  const additionalClaims: OriginalIssuerInputs["additionalClaims"] = [];
  const get = (tag: string, annual = false) => {
    const rows = p.facts.filter(f => {
      const c = contexts.get(f.context) ?? "";
      return f.name === tag && usd.has(f.unit) && !c.includes("<xbrli:segment>") &&
        c.includes(`>${identity.cik}</xbrli:identifier>`) && (annual ?
          c.includes("<xbrli:startDate>2024-01-01</xbrli:startDate>") && c.includes("<xbrli:endDate>2024-12-31</xbrli:endDate>") :
          c.includes("<xbrli:instant>2024-12-31</xbrli:instant>"));
    });
    if (!rows.length || new Set(rows.map(r => r.value)).size !== 1)
      throw new Error(`Additional exact FY2024 USD funding claim absent/ambiguous: ${tag}`);
    const f = rows[0];
    additionalClaims.push({ tag, id: f.id, context: f.context, value: f.value });
    return f.value;
  };
  const s = identity.symbol, text = plain(supplement);
  const terms = s === "FSLR" ? ["$5.3B", "$5.8B", "$1.95B", "$2.30B", "$1.65 billion", "$1.7 billion", "$60 million", "$70 million", "18GW", "20GW"] :
    s === "NEE" ? ["$3.43", "$3.45", "$3.70", "$3.63", "$4.00", "$3.85", "$4.32"] :
      ["55.0 billion", "working capital", "1.8 billion"];
  for (const term of terms) if (!text.includes(term)) throw new Error(`SEC supplemental forecast/source locator missing: ${term}`);
  if (s === "XOM") for (const term of ["Other spend of $0.9 billion", "27,551",
    "primarily reflects investments in the Low Carbon Solutions", "$27 billion to $29"])
    if (!plain(html).includes(term)) throw new Error(`Primary cash-capital/LCS allocation source absent: ${term}`);
  const netPpe = get("us-gaap:PropertyPlantAndEquipmentNet");
  const debt = s === "NEE" ? get("us-gaap:CommercialPaper") + get("us-gaap:OtherShortTermBorrowings") +
    get("us-gaap:LongTermDebtCurrent") + get("us-gaap:LongTermDebtNoncurrent") :
    get("us-gaap:DebtCurrent") + get(s === "XOM" ? "us-gaap:LongTermDebtAndCapitalLeaseObligations" : "us-gaap:LongTermDebtNoncurrent");
  const inventory = s === "XOM" ? get("us-gaap:EnergyRelatedInventory") +
    get("us-gaap:InventoryPartsAndComponentsNetOfReserves") : get("us-gaap:InventoryNet");
  const otherCurrentAssets = get("us-gaap:OtherAssetsCurrent");
  const operatingPayables = get(s === "XOM" ? "us-gaap:AccountsPayableAndAccruedLiabilitiesCurrent" :
    s === "NEE" ? "us-gaap:AccountsPayableCurrentAndNoncurrent" : "us-gaap:AccountsPayableCurrent");
  const customerAdvances = s === "FSLR" ? get("us-gaap:DeferredRevenueCurrent") + get("us-gaap:DeferredRevenueNoncurrent") : 0;
  const maturities2025To2029 = ["NextTwelveMonths", "YearTwo", "YearThree", "YearFour", "YearFive"].map((part, i) =>
    get(s === "XOM" && i === 0 ? "us-gaap:LongTermDebtCurrent" :
      `us-gaap:LongTermDebtMaturitiesRepaymentsOfPrincipalIn${part}`));
  const renewableTaxCreditCash = s === "NEE" ? get("nee:ProceedsFromSaleOfRenewableEnergyTaxCredits", true) : 0;
  if (s === "NEE" && !plain(html).includes("first ten years of commercial operation"))
    throw new Error("Primary PTC duration disclosure absent");
  return { reconciliation, additionalClaims, netPpe, debt, inventory, otherCurrentAssets, operatingPayables,
    customerAdvances, renewableTaxCreditCash, minimumCash: s === "FSLR" ? reconciliation.normalized.cashAndSecurities :
      reconciliation.historical.unrestrictedCash, maturities2025To2029, ...provenance };
}

export const originalIssuerAssumptions = Object.freeze({
  version: "issuer-original-operating-funding-3",
  terminalGrowthRange: [.025, .0325, .04], initialNominalGrowth: .0325, discountRate: .10,
  nonXomCashTaxRate: .21, fslrForecastRevenue2025: (5.3e9 + 5.8e9) / 2,
  fslrForecastOperatingIncome2025: (1.95e9 + 2.30e9) / 2,
  fslrForecastCredit2025: (1.65e9 + 1.70e9) / 2,
  fslrTemporaryStartup2025: (60e6 + 70e6) / 2,
  fslrTerminationReserve: 115e6, fslrAncillaryGrantReserve: (4186 + 484) * 1e3,
  fslrGlobalWattsSold: (18e9 + 20e9) / 2, fslrCreditUsdPerEligibleWatt: .17,
  fslrCashPerFaceCredit: 818.6 / 857.2, fslrCreditReceivableYears: .25,
  fslrCapex2025: (1.3e9 + 1.5e9) / 2, fslrUsCustomerShare: 3904844 / 4206289,
  neeAdjustedEps2024: 3.43, neeAdjustedEps2025To2027: [(3.45 + 3.70) / 2, (3.63 + 4.00) / 2, (3.85 + 4.32) / 2],
  neeAfudc2025To2029: [205e6, 260e6, 275e6, 295e6, 310e6],
  xomCashCapex2025: (27e9 + 29e9) / 2,
  rationale: [
    "Revised-history CONDITIONAL operating FCFE assessment, not point-in-time knowledge or original earnings/ROE adapter completion. FY2024 historical observations and actual dated price/shares remain unchanged.",
    "3.25% initial nominal growth is the midpoint of the USER-REQUESTED 2.5–4% nominal range, NOT an estimated inflation rate, empirical growth forecast or fitted climate coefficient. Ten annual growth steps fade to each requested terminal endpoint; every operating/funding stock and terminal cash is explicitly reconciled.",
    "Keep source FY2024 fixed-capital leverage debt/net PP&E and effective D&A/opening net PP&E ratios. After source budgets, cash PP&E is D&A PLUS nominal growth times opening net PP&E, with a full historical cash-investment floor for XOM. No half-turnover, invented asset life or assumed free growth.",
    "Debt balance follows fixed source debt/net PP&E leverage. Cash interest uses source cash interest/debt on opening debt, gross maturities are refinanced, and only the change in debt finances investment. Historical debt repayment is not a new cost twice. Continuing financing availability is conditional, not observed or approved.",
    "Use actual long-term maturities FY2025-2029 plus a recurring short-debt bucket; beyond published maturities use source annual repayment/debt share. No assumed future debt contract or observed rollover. Source FSLR undrawn revolver matures in 2028; no indefinite committed facility asserted.",
    "Leverage uses reported CARRYING debt, not an invented face value. Published long-term maturities are principal amounts; each gross principal bucket is matched by refinancing, so noncash issuance-cost/book differences do not create distributable cash. Net new financing is at par without extra issuance fees beyond the source cash-interest/cost reserve, explicitly conditional.",
    "Grow source operating receivables, inventories, other current operating assets, payables and minimum cash with revenue. Cash reserve building consumes FCFE. FSLR customer advance terms continue proportionally only as a declared forward commercial-financing assumption, never as guaranteed post-backlog cash.",
    "No release of opening minimum cash/current securities, no double net-debt deduction, no interest income, no SBC addback and no share-count inference from market capitalization. Other unmodelled balance-sheet balances stay nominally fixed, not asserted zero or sold.",
    "FSLR future 2025 joint guidance midpoints are analyst combinations, NOT joint issuer guidance or replacement FY2024 actuals. Strip forecast 45X, all historical ancillary grant benefits and a $115m annual recurring-margin reserve anchored to the disclosed INCREASE in terminations. This reserve is NOT an observed total termination amount.",
    "FSLR source 2025 separately classified $60–70m startup cost may cease after the planned H2-2025 last facility commissioning in one member; the other member retains it. The $50–60m ramp/underutilization cost is NEVER added back. No invented learning-curve margin or future plant expansion.",
    "FSLR real global sales stay at 19 GW; all post-2025 nominal revenue growth is ASP, not invented actual volume. US eligible watts are a FORWARD credit-equivalent assumption from issuer 2025 forecast credit divided by disclosed $0.17/W, not observed US output or US invoicing share.",
    "FSLR 45X uses fixed nominal $/W, not inflation-indexed credits. Apply source-law 100/75/50/25/0% phase-down for 2029/2030/2031/2032/2033+, historical Visa cash/face discount, and quarter-year outstanding cash. No future India PLI/asset grant/R&D benefit is booked. Current law after the FY2024 disclosure is not legally certified.",
    "FSLR all pre-reference grant receivables and unclassified Visa residual are expressly assigned ZERO distributable release in this downside funding assessment; no observed writeoff or collection is claimed. This avoids an optimistic dated cash addition or double counting unknown Visa/receivable classification. Restricted assets stay restricted. Potential collection is disclosed separately, never silently omitted.",
    "NEE guidance-proxy member applies issuer adjusted-EPS midpoint growth to consolidated normalized EBIT/revenue only as a declared cash-return PROXY, NOT management EBIT/NEER IRR guidance. Hold last 2027 growth through 2030 then fade; comparison member uses only requested nominal growth. This proxy does not close the undisclosed project cash-return series.",
    "NEE first five source approved capital budgets are accrual, less disclosed equity AFUDC, with no change in construction payables. Allocate reported nuclear fuel within those budgets, add corporate cash/fund/other investing once, retain nuclear amortization separately. Cash conversion remains conditional, not an observed schedule.",
    "NEE no new DMI inflows or grants. Source-conditioned policy cash is capped at actual FY2024 $1.304bn annual renewable-credit sale proceeds, unchanged nominally through approved 2029 build budgets, then linearly retired over ten years to zero by 2039. The ten-year horizon is anchored to source PTC duration; uniform cohort retirement and no new terminal cohorts are explicit assumptions, NOT observed eligibility, ITC/PTC mix, transfers or tax-credit owners. Stress removes this future policy cash entirely.",
    "NEE transfer proceeds reduce actual cash tax in primary reporting. Here pre-credit cash tax is calculated first and separate cashPolicyCredit is the sole policy offset; no historical negative cash tax, refundable credit, book HLBV income or tax-credit receivable release is added again. This cash-tax-policy bridge is NOT an operating-income credit or an observed future entitlement.",
    "NEE historical $740m DMI payments plus entire $597m net other-financing outflow become a declared future non-common payment reserve, indexed with nominal prices. It is NOT a source assertion of gross NCI cash. $401m redeemable NCI is reserved once in the stub, no HLBV/common-income cash addback.",
    "XOM operating EBIT excludes affiliate accrual and other income; affiliate dividends enter once, except a disclosed-remittance-risk member assumes zero FUTURE affiliate dividends. Actual pension/long-term cash drains, taxes, full additional investments and contingent/NCI payments remain charged. No tax refund, asset sales, NCI funding or advance collections finance the forecast.",
    "XOM source 2025 Cash Capex is NET of advance collections/project NCI funding. Add back historical excluded inflows when using its midpoint as a gross floor; do not pretend the $28bn net figure is a gross no-funding forecast. Fixed-capital growth requirements can exceed this source floor.",
    "XOM unidentified existing CCS amounts remain within the historical consolidated business; incremental new CCS revenues, 45Q receipts and tariffs are ZERO by assumption, not observed zero activity. MD&A Other Capex is only PRIMARILY LCS and not a separable CCS budget. No fabricated tariff/fee/throughput margin or positive climate-return claim.",
    "Negative annual FCFE is a required common-capital contribution, not magically financed. In the conditional funded-plan valuation existing owners voluntarily meet ALL calculated negative cash pro rata, maintaining group ownership; no unmodelled external investor funds them. Report those contributions and funding residuals explicitly. No actual subscription commitment, constant future share count or compulsory public-common capital call asserted. Nonpositive terminal cash REFUSES a perpetual equity pair; no invented recovery.",
    "21% cash tax on positive pre-credit core pretax cash for FSLR/NEE is a US-statutory-rate sensitivity, not jurisdictional tax guidance. XOM retains actual cash-tax burden indexed. No credits are added to CFO twice. 10% USD cost of equity is a fixed sensitivity, not beta estimation or owner approval.",
  ],
});

export function buildOriginalIssuerOperatingCase(input: OriginalIssuerInputs, options: {
  terminalGrowth: number; variant: "source-conditioned" | "constraint";
  referenceDate: string; frozenAt: string; historicalBaseFcfe: number;
}) {
  const a = originalIssuerAssumptions, r = input.reconciliation, o = r.normalized, symbol = r.identity.symbol;
  if (!(a.terminalGrowthRange as readonly number[]).includes(options.terminalGrowth))
    throw new Error("Requested original nominal terminal range only");
  for (const v of [input.netPpe, input.debt, input.minimumCash, o.revenue, o.depreciation, o.interest])
    if (!Number.isFinite(v) || v <= 0) throw new Error("Positive authentic source funding inputs required");
  const evidenceIds = ["primary-fy2024", "sec-forward-disclosure", "frozen-forward-assumptions"];
  const assumptionHash = contentHash({ a, options, sourceInputHash: contentHash(input) });
  const evidence = [
    { id: evidenceIds[0], kind: "primary-disclosure" as const, availableAt: input.publishedAt,
      sha256: input.primaryHash, rationale: "Exact selected FY2024 primary claims; prior reconciliation preserved" },
    { id: evidenceIds[1], kind: "primary-disclosure" as const, availableAt: options.frozenAt,
      sha256: input.supplementHash, rationale: "Retained SEC 8-K same-accession exhibit; source forward outlook, not realized future observations" },
    { id: evidenceIds[2], kind: "frozen-analyst-assumption" as const, availableAt: options.frozenAt,
      sha256: assumptionHash, rationale: a.rationale.join("\n") },
  ];
  const fixedDa = symbol === "NEE" ? o.fixedAssetDepreciation : o.depreciation;
  const daRate = fixedDa / input.netPpe, leverage = input.debt / input.netPpe;
  const interestRate = o.interest / input.debt;
  const shortDebt = Math.max(0, (symbol === "FSLR" ? o.debt :
    input.debt) - input.maturities2025To2029[0] - (symbol === "FSLR" ? 373354e3 :
      symbol === "NEE" ? 72385e6 : 36755e6));
  const eps = [a.neeAdjustedEps2024, ...a.neeAdjustedEps2025To2027];
  const lastGuidedGrowth = eps[3] / eps[2] - 1;
  let netPpe = input.netPpe, debt = input.debt, revenue = o.revenue;
  let receivables = o.receivables;
  let otherWc = input.inventory + input.otherCurrentAssets + input.minimumCash -
    input.operatingPayables - input.customerAdvances;
  let priceIndex = 1, creditReceivable = 0;
  const rows: any[] = [], funding: object[] = [];
  const activity: {
    year: number; nonCausalNominalRevenue: number; manufacturingCreditSeparateFromCustomerSales: boolean;
    globalSolarWattsAssumed: number | null; solarAspUsdPerWattAssumed: number | null;
    usEligibleCreditEquivalentWattsAssumed: number | null; usCustomerRevenueAssumed: number | null;
    creditPhaseAsDisclosed: number | null; incrementalCcsCashRevenue: number | null; ccsTariff: null;
    lowerEmissionCapitalAllocationAssumed: number | null; lowerEmissionAllocationBasis: string | null;
    noObservedFutureActivityClaim: boolean;
  }[] = [];
  for (let year = 2025; year <= 2041; year++) {
    const fadeStep = Math.max(0, Math.min(10, year - 2030));
    const initialGrowth = symbol === "NEE" && options.variant === "source-conditioned" ?
      (year <= 2027 ? eps[year - 2024] / eps[year - 2025] - 1 : lastGuidedGrowth) : a.initialNominalGrowth;
    const growth = initialGrowth + (options.terminalGrowth - initialGrowth) * fadeStep / 10;
    const priceGrowth = a.initialNominalGrowth + (options.terminalGrowth - a.initialNominalGrowth) * fadeStep / 10;
    priceIndex *= 1 + priceGrowth;
    const openingPpe = netPpe, openingDebt = debt, openingReceivables = receivables;
    if (year === 2025 && symbol === "FSLR") revenue = a.fslrForecastRevenue2025;
    else revenue *= 1 + growth;
    const revenueScale = revenue / o.revenue;
    const depreciation = daRate * openingPpe + (symbol === "NEE" ? o.nuclearAmortization * priceIndex : 0);
    const fixedDepreciation = daRate * openingPpe;
    const nuclearFuel = symbol === "NEE" ? o.nuclearFuel * priceIndex : 0;
    let ppeSpend = fixedDepreciation + growth * openingPpe;
    if (symbol === "FSLR" && year === 2025) ppeSpend = a.fslrCapex2025;
    if (symbol === "NEE" && year <= 2029)
      ppeSpend = r.capitalBudgets[year - 2025] - a.neeAfudc2025To2029[year - 2025] -
        nuclearFuel + o.corporateCapex * priceIndex;
    if (symbol === "XOM") {
      const advances = 3299e6 * priceIndex;
      // Gross up source NET cash-capex outlook before excluding financing inflows.
      const grossFloor = (a.xomCashCapex2025 + 1926e6 + 32e6) * priceIndex;
      ppeSpend = Math.max(ppeSpend, grossFloor - advances);
    }
    netPpe += ppeSpend - fixedDepreciation;
    debt = leverage * netPpe;
    const netBorrowing = debt - openingDebt;
    const roll = year <= 2029 ? input.maturities2025To2029[year - 2025] + shortDebt :
      o.annualRollover / input.debt * openingDebt;
    const debtProceeds = roll + Math.max(0, netBorrowing), debtRepayments = roll + Math.max(0, -netBorrowing);
    const interestPaid = interestRate * openingDebt;
    const otherAssets = (input.inventory + input.otherCurrentAssets + input.minimumCash -
      input.operatingPayables - input.customerAdvances) * revenueScale;
    const increaseOtherOperatingWorkingCapital = otherAssets - otherWc;
    otherWc = otherAssets;
    receivables = o.receivables * revenueScale;
    let coreMargin = o.operatingProfit / o.revenue;
    if (symbol === "FSLR") {
      const recurring2025 = a.fslrForecastOperatingIncome2025 - a.fslrForecastCredit2025 -
        a.fslrTerminationReserve - a.fslrAncillaryGrantReserve +
        (year >= 2026 && options.variant === "source-conditioned" ? a.fslrTemporaryStartup2025 : 0);
      coreMargin = recurring2025 / a.fslrForecastRevenue2025;
    }
    const coreProfit = revenue * coreMargin;
    const phase = year <= 2029 ? 1 : year === 2030 ? .75 : year === 2031 ? .5 : year === 2032 ? .25 : 0;
    const recognizedPolicyCredit = symbol === "FSLR" ? a.fslrForecastCredit2025 * phase : 0;
    const closingCreditReceivable = recognizedPolicyCredit * a.fslrCashPerFaceCredit * a.fslrCreditReceivableYears;
    const neePolicyRunoff = year <= 2029 ? 1 : Math.max(0, (2039 - year) / 10);
    const cashPolicyCredit = symbol === "NEE" ? (options.variant === "source-conditioned" ?
      input.renewableTaxCreditCash * neePolicyRunoff : 0) :
      recognizedPolicyCredit * a.fslrCashPerFaceCredit - (closingCreditReceivable - creditReceivable);
    creditReceivable = closingCreditReceivable;
    let otherOperatingCash = o.otherCash * priceIndex;
    if (symbol === "XOM" && options.variant === "constraint") otherOperatingCash -= o.affiliateCash * priceIndex;
    const cashTax = symbol === "XOM" ? o.cashTax * priceIndex :
      Math.max(0, coreProfit - interestPaid + otherOperatingCash) * a.nonXomCashTaxRate;
    const otherInvestment = symbol === "FSLR" ? (o.reinvestment - o.depreciation) * priceIndex :
      symbol === "NEE" ? (o.fundNet + o.otherInvesting) * priceIndex : (3299e6 + 27e6) * priceIndex;
    const capitalSpend = ppeSpend + nuclearFuel + otherInvestment;
    const nonCommonCashClaims = o.claims * priceIndex;
    const row = { year, cashFlowDate: `${year}-12-31`, evidenceIds,
      nonClimateRevenue: revenue, climateRevenue: 0,
      operatingMarginBeforeClimateCostsAndCredits: coreMargin,
      climateOperatingCost: 0, recognizedPolicyCredit, cashPolicyCredit,
      depreciation, otherNonCash: 0, openingReceivables, closingReceivables: receivables,
      increaseOtherOperatingWorkingCapital, interestPaid, cashTax, otherOperatingCash,
      capitalSpend, debtProceeds, debtRepayments, nonCommonCashClaims };
    rows.push(row);
    funding.push({ year, nominalGrowth: growth, priceGrowth, openingPpe, closingPpe: netPpe,
      cashPpe: ppeSpend, fixedDepreciation, openingDebt, closingDebt: debt,
      sourceFixedCapitalLeverage: leverage, rollover: roll, netBorrowing,
      cashReserve: input.minimumCash * revenueScale,
      fixedCapitalResidual: openingPpe + ppeSpend - fixedDepreciation - netPpe,
      debtResidual: openingDebt + debtProceeds - debtRepayments - debt });
    activity.push({ year, nonCausalNominalRevenue: revenue, manufacturingCreditSeparateFromCustomerSales: symbol === "FSLR",
      globalSolarWattsAssumed: symbol === "FSLR" ? a.fslrGlobalWattsSold : null,
      solarAspUsdPerWattAssumed: symbol === "FSLR" ? revenue / a.fslrGlobalWattsSold : null,
      usEligibleCreditEquivalentWattsAssumed: symbol === "FSLR" ? a.fslrForecastCredit2025 / a.fslrCreditUsdPerEligibleWatt : null,
      usCustomerRevenueAssumed: symbol === "FSLR" ? revenue * a.fslrUsCustomerShare : null,
      creditPhaseAsDisclosed: symbol === "FSLR" ? phase : null,
      incrementalCcsCashRevenue: symbol === "XOM" ? 0 : null, ccsTariff: null,
      lowerEmissionCapitalAllocationAssumed: symbol === "XOM" ? capitalSpend * (851 / 27551) : null,
      lowerEmissionAllocationBasis: symbol === "XOM" ?
        "Forward proportional allocation from FY2024 $851m Other/$27,551m total Capex; Other is PRIMARILY LCS, not observed CCS cash or additional spend" : null,
      noObservedFutureActivityClaim: true });
  }
  const stubRow = rows[0], annualRows = rows.slice(1, 6), continuationRows = rows.slice(6, 16), terminalRow = rows[16];
  // Use the same canonical cash ledger for the entire path, including stub year.
  const cash = (y: typeof stubRow) => y.nonClimateRevenue * y.operatingMarginBeforeClimateCostsAndCredits +
    y.depreciation + y.cashPolicyCredit - (y.closingReceivables - y.openingReceivables) -
    y.increaseOtherOperatingWorkingCapital - y.interestPaid - y.cashTax + y.otherOperatingCash -
    y.capitalSpend + y.debtProceeds - y.debtRepayments - y.nonCommonCashClaims;
  const stubFraction = (Date.parse("2025-12-31T00:00:00Z") - Date.parse(`${options.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  const stubSettlement = symbol === "NEE" ? o.stubReserve : symbol === "FSLR" ? o.stubReserve : 0;
  const engineInput = { symbol, cik: r.identity.cik, security: r.identity.security,
    currency: "USD" as const, referenceDate: options.referenceDate,
    frozenAt: options.frozenAt, firstYear: 2026, baseFcfe: options.historicalBaseFcfe,
    evidence, years: annualRows, boundary: "whole-issuer-common-equity" as const, unresolvedAccountingClaims: [],
    discountRate: a.discountRate, terminalGrowth: options.terminalGrowth,
    continuationGrowthAtYear5: (funding[5] as any).nominalGrowth, terminalEvidenceIds: evidenceIds,
    informationContext: { mode: "revised-history-conditional" as const,
      modelAsOf: `${options.referenceDate}T23:59:59.999Z`, informationCutoff: options.frozenAt },
    stub: { cashBasis: "FCFE-whole-issuer-common-equity" as const, currency: "USD" as const, throughDate: "2025-12-31",
      rationale: "Source-derived full 2025 accrual/capital/funding row multiplied by remaining days, one dated year-end payment; settlement reserve once. This is frozen interpolation, not observed post-reference cash. Legacy grant/Visa release is zero explicitly.",
      completenessEvidenceIds: evidenceIds, cashFlows: [{ date: "2025-12-31", fcfe: cash(stubRow) * stubFraction - stubSettlement, evidenceIds }] },
    continuation: { years: continuationRows, terminalYear: terminalRow,
      rationale: "Ten separately funded operating years; nominal growth fades to requested terminal range. D&A, cash reinvestment, capital/WC/minimum cash stocks, net debt financing, tax, credit runoff and all common/non-common cash reconcile." } };
  const ledger = calculateCompanyFullCashflowCase(engineInput);
  const all = [...ledger.years, ...ledger.continuationYears, ledger.terminalYear!];
  const requiredCommonContributions = all.filter(y => y.fcfe < 0).map(y => ({ year: y.year, amount: -y.fcfe }));
  const terminal = ledger.terminalYear!, terminalStocks = funding[16] as any;
  const terminalNetWcGrowth = terminal.receivablesIncrease + terminal.increaseOtherOperatingWorkingCapital;
  const terminalCommonGrowthFunding = options.terminalGrowth * terminalStocks.openingPpe -
    terminalStocks.netBorrowing + terminalNetWcGrowth;
  const terminalCashBeforeGrowth = terminal.fcfe + terminalCommonGrowthFunding;
  const terminalGrowthCapitalDenominator = terminalStocks.openingPpe * (1 - leverage) +
    terminalNetWcGrowth / options.terminalGrowth;
  return { id: `${symbol}-${options.variant}-g${options.terminalGrowth}-original-v3`, engineInput, ledger,
    funding, activity, sourceInputHash: contentHash(input), assumptionHash,
    requiredCommonContributions, sourceForwardAssumptions: a.rationale,
    terminalFunding: { cashBeforeGrowth: terminalCashBeforeGrowth,
      commonGrowthFundingRequired: terminalCommonGrowthFunding,
      terminalFcfe: terminal.fcfe, requestedNominalGrowth: options.terminalGrowth,
      conditionalFrozenTerminalGrowthBudgetCeiling: terminalCashBeforeGrowth / terminalGrowthCapitalDenominator,
      definition: "Conditional funding budget at this terminal cash/capital stock, not an estimated company growth rate or coefficient chosen to fit price" },
    economicGaps: [
      ...(symbol === "NEE" ? ["EPS growth proxy is not disclosed annual NEER/FPL project cash returns; future non-common $597m reserve is a declared allocation, not authenticated gross distribution/waterfall."] : []),
      ...(symbol === "XOM" ? ["CCS tariff, incremental realized throughput, operating margin and exact low-carbon cash-capital allocation remain undisclosed; zero incremental CCS revenue is a downside assumption, not CCS economics completion."] : []),
      ...(symbol === "FSLR" ? ["Source-law 45X eligibility after amendments, future advance/rollover terms and recurring margin/startup normalization remain declared conditions, not observed approvals."] : []),
    ],
    qualifiedOriginalCases: 0, productionEligible: false };
}

/** Execute dependency-ready canonical same-path arithmetic only. Signed early
 * cash can be retained in forward PV; legacy reverse refuses those paths. */
export function assessOriginalIssuerOperatingCase(built: ReturnType<typeof buildOriginalIssuerOperatingCase>,
  market: Parameters<typeof pairCompanyFullCashflowCase>[1]) {
  const x = built.engineInput, rows = [...built.ledger.years, ...built.ledger.continuationYears];
  const terminal = built.ledger.terminalYear!;
  const funding = rows.map(y => ({ year: y.year, investorContribution: Math.max(0, -y.fcfe),
    commonDistribution: Math.max(0, y.fcfe),
    residual: y.fcfe + Math.max(0, -y.fcfe) - Math.max(0, y.fcfe) }));
  // A positive year five is a conservative LEGACY shortcut, not a requirement
  // for an explicitly funded, separately scheduled signed ten-year continuation.
  const gaps = built.ledger.gaps.filter(g => g !== "Year-five FCFE must be positive for this continuation; no invented recovery.");
  if (gaps.length || terminal.fcfe <= 0)
    return { pairing: "blocked" as const, gaps, forward: null, pair: null, funding };
  for (const key of ["symbol", "cik", "security", "currency", "referenceDate"] as const)
    if (market[key] !== x[key]) throw new Error("Original funded-plan market identity/currency/date mismatch");
  if (!market.datedReferenceReviewed || market.priceDate !== market.sharesDate ||
      market.referenceDate !== market.priceDate || market.price <= 0 || market.shares <= 0)
    throw new Error("Exact dated price/primary common shares and currency review required");
  const time = (date: string) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  const stubPv = x.stub.cashFlows.reduce((s, y) => s + y.fcfe / (1 + x.discountRate) ** time(y.date), 0);
  const coefficients = [stubPv, ...rows.map(y => y.fcfe / (1 + x.discountRate) ** time(y.cashFlowDate)),
    terminal.fcfe / (x.discountRate - x.terminalGrowth) / (1 + x.discountRate) ** time(rows[14].cashFlowDate)];
  const value = (adjustment: number) => coefficients.reduce((s, c, t) => s + c * (1 + adjustment) ** t, 0);
  const forwardWholeEquity = value(0), forward = { forwardWholeEquity, stubPresentValue: stubPv,
    terminalPresentValue: coefficients[16], method: "Same dated 15-year FCFE/terminal polynomial; explicit pro-rata funding, no clamp of negative annual cash" };
  if (built.ledger.status !== "blocked") {
    const canonical = valueCompanyFullCashflowCase(x);
    if (Math.abs(canonical.forwardWholeEquity - forwardWholeEquity) > .01)
      throw new Error("Explicit signed valuation differs from canonical dated cash arithmetic");
    const canonicalPair = pairCompanyFullCashflowCase(x, market);
    if (canonicalPair.pairing === "conditional-same-basis-whole-equity")
      return { pairing: canonicalPair.pairing, gaps: [], forward, pair: canonicalPair, funding,
        reverseProof: { type: "canonical-all-positive-explicit-path", domain: [-.5, .5] } };
  }
  if (forwardWholeEquity <= 0)
    return { pairing: "blocked" as const, gaps: ["Conditional pro-rata funded plan has nonpositive signed NPV; no positive common equity valuation or abandonment option invented"],
      forward, pair: null, funding };
  const target = market.price * market.shares;
  const targetCoefficients = coefficients.map((c, i) => i === 0 ? c - target : c);
  const signs = targetCoefficients.filter(c => c !== 0).map(Math.sign);
  const signChanges = signs.slice(1).reduce((n, s, i) => n + Number(s !== signs[i]), 0);
  let certificate = signChanges === 1 && targetCoefficients[0] < 0 ? "Descartes-one-positive-root" : "";
  // Rigorous interval lower bounds for d/dz sum(c_t*z^t), z in [0.5,1.5].
  // Every positive term is bounded at interval left, every negative at right.
  let minimumDerivativeLowerBound = Infinity;
  let certifiedBelowTargetPrefixIntervals = 0, minimumCrossingDerivative = Infinity;
  if (!certificate) {
    let crossingRegion = false, prefixCertificate = true;
    const margin = coefficients.reduce((s, c) => s + Math.abs(c), 0) * 1e-10;
    for (let i = 0; i < 512; i++) {
      const lo = .5 + i / 512, hi = .5 + (i + 1) / 512;
      const bound = coefficients.slice(1).reduce((s, c, j) =>
        s + (j + 1) * c * (c >= 0 ? lo : hi) ** j, 0);
      minimumDerivativeLowerBound = Math.min(minimumDerivativeLowerBound, bound);
      const upperValue = coefficients.reduce((s, c, j) => s + c * (c >= 0 ? hi : lo) ** j, 0);
      if (!crossingRegion && upperValue < target - margin) certifiedBelowTargetPrefixIntervals++;
      else {
        crossingRegion = true;
        minimumCrossingDerivative = Math.min(minimumCrossingDerivative, bound);
        if (bound <= margin) prefixCertificate = false;
      }
    }
    if (minimumDerivativeLowerBound > margin)
      certificate = "positive-derivative-512-interval-polynomial-bounds";
    else if (prefixCertificate && crossingRegion)
      certificate = "no-root-prefix-then-positive-derivative-512-interval-bounds";
  }
  if (!certificate || value(-.5) > target || value(.5) < target)
    return { pairing: "reverse-unavailable" as const,
      gaps: [!certificate ? "Signed-path uniqueness is not certified; no sampled monotonicity or fitted recovery" :
        "Target outside fixed [-50%,50%] adjustment bracket; no extrapolation"], forward, pair: null, funding,
      reverseProof: { signChanges, minimumDerivativeLowerBound: Number.isFinite(minimumDerivativeLowerBound) ? minimumDerivativeLowerBound : null } };
  let lo = -.5, hi = .5;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (value(mid) < target) lo = mid; else hi = mid;
  }
  const impliedAnnualFcfeAdjustment = (lo + hi) / 2;
  const relativeRepricingError = Math.abs(value(impliedAnnualFcfeAdjustment) / target - 1);
  if (relativeRepricingError > 1e-8) throw new Error("Signed original-range exact-path repricing failed");
  return { pairing: "signed-explicit-conditional-same-basis" as const, gaps: [], forward,
    pair: { forwardWholeEquity, marketWholeEquity: target, impliedAnnualFcfeAdjustment, relativeRepricingError,
      definition: "Fixed-stub path-preserving FCFE adjustment; NOT climate/activity/earnings growth, a probability or scientific approval",
      conditionalOwnerFunding: "All future negative FCFE met voluntarily pro rata by current owners; source input is not a capital subscription commitment" },
    funding, reverseProof: { type: certificate, signChanges,
      minimumDerivativeLowerBound: Number.isFinite(minimumDerivativeLowerBound) ? minimumDerivativeLowerBound : null,
      certifiedBelowTargetPrefixIntervals,
      minimumCrossingDerivative: Number.isFinite(minimumCrossingDerivative) ? minimumCrossingDerivative : null,
      domain: [-.5, .5] } };
}
