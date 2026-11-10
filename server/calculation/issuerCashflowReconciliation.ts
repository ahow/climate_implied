import { authenticatePrimaryIssuerCashflow } from "./issuerCashflowCase";

type Identity = { symbol: string; cik: string; security: string; fiscalEnd: string };
type SourceRow = { name: string; id: string; context: string; value: number; locator: string };
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

/** Exact selected-issuer/date/unit facts only. Segmented revenue/government-grant
 * facts require an explicit expected value and the same FY2024 duration. */
export function extractIssuerCashflowReconciliation(html: string, identity: Identity) {
  const primary = authenticatePrimaryIssuerCashflow(html, identity), rows: SourceRow[] = [];
  const contexts = new Map(Array.from(html.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g))
    .map(m => [m[1], m[2]]));
  const usd = new Set(Array.from(html.matchAll(/<xbrli:unit id="([^"]+)">([\s\S]*?)<\/xbrli:unit>/g))
    .filter(m => m[2] === "<xbrli:measure>iso4217:USD</xbrli:measure>").map(m => m[1]));
  const read = (name: string, options: { expected?: number; instant?: string; segmented?: boolean } = {}) => {
    const matches = primary.facts.filter(f => {
      const context = contexts.get(f.context) ?? "";
      return f.name === name && usd.has(f.unit) && context.includes(`>${identity.cik}</xbrli:identifier>`) &&
        (options.segmented || !context.includes("<xbrli:segment>")) &&
        (options.expected === undefined || f.value === options.expected) &&
        (options.instant ? context.includes(`<xbrli:instant>${options.instant}</xbrli:instant>`) :
          context.includes("<xbrli:startDate>2024-01-01</xbrli:startDate>") &&
          context.includes("<xbrli:endDate>2024-12-31</xbrli:endDate>"));
    });
    if (!matches.length || new Set(matches.map(f => f.value)).size !== 1)
      throw new Error(`Exact FY2024 issuer reconciliation line absent/ambiguous: ${name}`);
    const f = matches[0];
    if (!rows.some(r => r.id === f.id)) rows.push({ name, id: f.id, context: f.context, value: f.value,
      locator: `SEC selected FY2024 accession, iXBRL ${f.id}; ${name}; ${f.context}` });
    return f.value;
  };
  const a = (name: string) => read(name);
  const instant = (name: string, date = "2024-12-31") => read(name, { instant: date });
  const cfo = a("us-gaap:NetCashProvidedByUsedInOperatingActivities");
  const cfi = a("us-gaap:NetCashProvidedByUsedInInvestingActivities");
  const cff = a("us-gaap:NetCashProvidedByUsedInFinancingActivities");
  const fx = a("us-gaap:EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents");
  const cashChange = a("us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect");
  const cashClose = instant("us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents");
  const cashOpen = instant("us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "2023-12-31");
  const unrestrictedCash = instant("us-gaap:CashAndCashEquivalentsAtCarryingValue");
  const residuals: Record<string, number> = {
    cashStatement: cfo + cfi + cff + fx - cashChange, openingToClosing: cashOpen + cashChange - cashClose,
  };
  let operatingReconciliation: number[], investingReconciliation: number[], financingReconciliation: number[];
  let normalized: Record<string, number>, allocation: string[], capitalBudgets: number[] = [];
  if (identity.symbol === "XOM") {
    const ni = a("us-gaap:ProfitLoss"), da = a("us-gaap:DepreciationDepletionAndAmortization");
    const deferred = a("us-gaap:DeferredIncomeTaxExpenseBenefit");
    const pension = a("us-gaap:PensionAndOtherPostretirementBenefitsExpenseReversalOfExpenseNoncash");
    const obligations = a("xom:OtherLongTermObligationsExpenseAndPaymentsAdjustment");
    const affiliateDifference = a("us-gaap:IncomeLossFromEquityMethodInvestmentsNetOfDividendsOrDistributions");
    const assetGain = a("us-gaap:GainLossOnDispositionOfAssets1");
    const other = a("us-gaap:IncreaseDecreaseInOtherOperatingCapitalNet");
    const ar = a("us-gaap:IncreaseDecreaseInAccountsAndNotesReceivable");
    const otherWc = a("us-gaap:IncreaseDecreaseInInventories") +
      a("us-gaap:IncreaseDecreaseInOtherOperatingAssets") - a("us-gaap:IncreaseDecreaseInAccountsPayable");
    operatingReconciliation = [ni, da, deferred, pension, obligations, -affiliateDifference,
      -assetGain, -other, -ar, -otherWc];
    const ppe = a("us-gaap:PaymentsToAcquirePropertyPlantAndEquipment");
    const advances = a("xom:AdditionalInvestmentsAndAdvances");
    const assetSales = a("us-gaap:ProceedsFromSalesOfBusinessAffiliateAndProductiveAssets");
    const advanceCollections = a("us-gaap:ProceedsFromSaleAndCollectionOfReceivables");
    const acquiredCash = a("us-gaap:CashAcquiredFromAcquisition");
    investingReconciliation = [-ppe, -advances, assetSales, advanceCollections, acquiredCash];
    const contingent = a("us-gaap:PaymentForContingentConsiderationLiabilityFinancingActivities");
    const minorityDividends = a("us-gaap:PaymentsOfDividendsMinorityInterest");
    const minorityChanges = a("us-gaap:ProceedsFromPaymentsToMinorityShareholders");
    const minorityInflows = a("xom:ProceedsFromNoncontrollingInterestsForMajorProjects");
    const commonDividends = a("us-gaap:PaymentsOfDividendsCommonStock");
    const buybacks = a("us-gaap:PaymentsForRepurchaseOfCommonStock");
    financingReconciliation = [a("us-gaap:ProceedsFromIssuanceOfLongTermDebt"),
      -a("us-gaap:RepaymentsOfLongTermDebt"), a("us-gaap:ProceedsFromShortTermDebtMaturingInMoreThanThreeMonths"),
      -a("us-gaap:RepaymentsOfShortTermDebtMaturingInMoreThanThreeMonths"),
      a("us-gaap:ProceedsFromRepaymentsOfOtherDebt"), -contingent, -commonDividends,
      -minorityDividends, minorityChanges, minorityInflows, -buybacks];
    const equityAccrual = read("us-gaap:Revenues", { expected: 6194e6, segmented: true });
    const otherIncome = read("us-gaap:Revenues", { expected: 4144e6, segmented: true });
    const sales = read("us-gaap:Revenues", { expected: 339247e6, segmented: true });
    const ebit = a("us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest") +
      a("us-gaap:InterestExpense");
    const dividendsFromAffiliates = equityAccrual - affiliateDifference;
    normalized = { revenue: sales, operatingProfit: ebit - equityAccrual - otherIncome,
      depreciation: da, interest: a("us-gaap:InterestPaidNet"), cashTax: a("us-gaap:IncomeTaxesPaidNet"),
      otherCash: dividendsFromAffiliates + pension + obligations, reinvestment: ppe + advances + contingent,
      claims: minorityDividends - minorityChanges, receivables: instant("us-gaap:ReceivablesNetCurrent"),
      annualRollover: a("us-gaap:RepaymentsOfLongTermDebt") +
        a("us-gaap:RepaymentsOfShortTermDebtMaturingInMoreThanThreeMonths") -
        a("us-gaap:ProceedsFromRepaymentsOfOtherDebt"),
      excessCash: 0, legacyGrant: 0, stubReserve: 0,
      affiliateCash: dividendsFromAffiliates, historicalOtherWcIncrease: otherWc };
    residuals.cashInterest = a("us-gaap:InterestPaid") - normalized.interest - a("us-gaap:InterestPaidCapitalized");
    allocation = [
      "Source income statement separates $339.247bn operating sales, $6.194bn equity affiliate accrual income and $4.144bn other income. Normalize operating EBIT by excluding all equity accrual and all other income, not by grossing CFO up.",
      "Replace equity accrual ONCE with $6.385bn actual affiliate cash dividends (accrual less signed cash-flow adjustment). Hold dividends nominally flat conditionally; no guarantee of future distributions.",
      "Retain reported negative pension and long-term-obligation cash adjustments as recurring conditional cash drains. No deferred-tax addback after explicit cash tax, asset-sale gains, other income, acquisition cash or advance collections projected.",
      "Repeat full reported cash PP&E and additional investments/advances; include contingent consideration financing payment as an additional common-cash investment charge. No maintenance reduction to D&A.",
      "Deduct gross NCI dividends plus all net changes in NCI, and exclude NCI funding inflows. Future full outflow recurrence is an assumption, not ownership-percentage or contract evidence.",
      "Reported net interest plus capitalized interest reconciles total cash interest. Capitalized interest remains inside reported cash PP&E; do not charge it a second time.",
      "Freeze existing notes/accounts receivables at reported balance. Only additional stress receivables consume cash; historical WC movements are reconciled, not silently repeated.",
      "All unrestricted opening cash is reserved for operations; two months of historical operating cash costs exceed cash. No excess release or interest income from cash is assumed. This is a conditional reserve, not a proven optimal cash balance.",
    ];
  } else if (identity.symbol === "NEE") {
    const ni = a("us-gaap:ProfitLoss"), da = a("us-gaap:DepreciationAndAmortization");
    const nuclearAmortization = a("nee:NuclearFuelAndOtherAmortization");
    operatingReconciliation = [ni, da, nuclearAmortization,
      -a("us-gaap:UnrealizedGainLossOnDerivativesAndCommodityContracts"),
      -a("nee:UnrealizedGainLossOnOnEquitySecuritiesHeldInDecommissioningFunds"),
      -a("us-gaap:ForeignCurrencyTransactionGainLossBeforeTax"),
      a("us-gaap:DeferredIncomeTaxExpenseBenefit"), -a("nee:CostRecoveryClausesAndFranchiseFees"),
      -a("us-gaap:IncomeLossFromEquityMethodInvestments"),
      a("us-gaap:EquityMethodInvestmentDividendsOrDistributions"),
      -a("us-gaap:GainLossOnDispositionOfAssets1"),
      -a("us-gaap:IncreaseDecreaseInRecoverablePropertyDamageCosts"),
      a("us-gaap:OtherOperatingActivitiesCashFlowStatement"),
      -a("us-gaap:IncreaseDecreaseInOtherCurrentAssets"),
      -a("us-gaap:IncreaseDecreaseInOtherNoncurrentAssets"),
      a("us-gaap:IncreaseDecreaseInOtherCurrentLiabilities"),
      a("us-gaap:IncreaseDecreaseInOtherNoncurrentLiabilities")];
    const nuclearFuel = a("us-gaap:PaymentsForProceedsFromNuclearFuel");
    const corporateCapex = a("nee:OtherCapitalExpenditures");
    const fundNet = a("us-gaap:PaymentsToInvestInDecommissioningFund") - a("us-gaap:ProceedsFromDecommissioningFund");
    const otherInvesting = a("us-gaap:PaymentsForProceedsFromOtherInvestingActivities");
    investingReconciliation = [-a("nee:CapitalExpendituresOfFPL"), -a("nee:IndependentPowerInvestments"),
      -nuclearFuel, -corporateCapex, a("us-gaap:ProceedsFromSaleOfProductiveAssets"),
      a("nee:ProceedsfromSaleofIndependentPowerInvestments"), -fundNet, -otherInvesting];
    const dmi = a("nee:PaymentsToDifferentialMembershipInvestors");
    const otherFinancing = a("us-gaap:ProceedsFromPaymentsForOtherFinancingActivities");
    financingReconciliation = [a("us-gaap:ProceedsFromIssuanceOfLongTermDebt"),
      -a("us-gaap:RepaymentsOfLongTermDebt"), a("nee:SaleOfDifferentialMembershipInterests"), dmi,
      a("us-gaap:ProceedsFromRepaymentsOfCommercialPaper"), a("us-gaap:ProceedsFromOtherShortTermDebt"),
      -a("us-gaap:RepaymentsOfOtherShortTermDebt"), a("us-gaap:ProceedsFromRepaymentsOfRelatedPartyDebt"),
      a("us-gaap:ProceedsFromIssuanceOfCommonStock"), -a("us-gaap:PaymentsOfDividends"), otherFinancing];
    const revenue = a("us-gaap:RegulatedAndUnregulatedOperatingRevenue");
    const operatingProfit = a("us-gaap:OperatingIncomeLoss") -
      a("us-gaap:DisposalGroupNotDiscontinuedOperationGainLossOnDisposal") -
      a("us-gaap:UnrealizedGainLossOnDerivativesAndCommodityContracts");
    normalized = { revenue, operatingProfit, depreciation: da + nuclearAmortization,
      fixedAssetDepreciation: da, nuclearAmortization, nuclearFuel,
      interest: a("us-gaap:InterestPaidNet"), cashTax: 0,
      otherCash: a("us-gaap:EquityMethodInvestmentDividendsOrDistributions") -
        a("us-gaap:IncreaseDecreaseInRecoverablePropertyDamageCosts"),
      claims: -dmi - otherFinancing, reinvestment: da + nuclearFuel + corporateCapex + fundNet + otherInvesting,
      receivables: instant("us-gaap:AccountsReceivableNetCurrent"),
      inventoryRatio: instant("us-gaap:InventoryNet") / revenue,
      netPpe: instant("us-gaap:PropertyPlantAndEquipmentNet"), corporateCapex, fundNet, otherInvesting,
      annualRollover: a("us-gaap:RepaymentsOfLongTermDebt") + a("us-gaap:RepaymentsOfOtherShortTermDebt") -
        a("us-gaap:ProceedsFromRepaymentsOfCommercialPaper"),
      excessCash: 0, legacyGrant: 0, stubReserve: instant("us-gaap:RedeemableNoncontrollingInterestEquityCarryingAmount") };
    const totalNci = instant("us-gaap:MinorityInterest");
    const dmiBook = Math.abs(read("nee:NoncontrollingInterestsAssociatedWithDifferentialMembershipInterests",
      { expected: -9062e6, instant: "2024-12-31", segmented: true }));
    const hlbvIncome = read("nee:IncomeAssociatedWithDifferentialMembershipInterests",
      { expected: 1329e6, segmented: true });
    const nciAccountingIncome = a("us-gaap:NetIncomeLossAttributableToNonredeemableNoncontrollingInterest");
    const commonIncome = a("us-gaap:NetIncomeLoss");
    residuals.commonIncomeAllocation = commonIncome - (ni - nciAccountingIncome);
    Object.assign(normalized, { totalNciBook: totalNci, dmiBook, otherNciBook: totalNci - dmiBook,
      hlbvAccountingIncome: hlbvIncome, nciAccountingIncome, commonIncome,
      observedDmiCashPayments: -dmi, unclassifiedOtherFinancingNetOutflow: -otherFinancing });
    const restricted = instant("us-gaap:RestrictedCashAndCashEquivalentsAtCarryingValue");
    const marginReceipts = instant("nee:CashReceivedDerivativeExchangeTraded");
    residuals.cashClassification = unrestrictedCash + restricted - marginReceipts - cashClose;
    // Approved future budgets are dated FY2024 instant disclosures, not cash outcomes.
    const suffixes = ["FirstYear", "SecondYear", "ThirdYear", "FourthYear", "FifthYear"];
    const fpl = [8425, 10520, 9905, 10170, 10585], neer = [11045, 7485, 3840, 1470, 1195];
    capitalBudgets = suffixes.map((suffix, i) =>
      read(`nee:PlannedCapitalExpenditures${suffix}`, { expected: fpl[i] * 1e6, instant: "2024-12-31", segmented: true }) +
      read(`nee:PlannedCapitalExpenditures${suffix}`, { expected: neer[i] * 1e6, instant: "2024-12-31", segmented: true }));
    allocation = [
      "Consolidated NEE, not FPL-only: reconcile every CFO adjustment and all investing/financing rows. HLBV income allocation is not cash: do not add the $1.248bn NCI loss or $1.329bn differential-membership accounting earnings to common FCFE.",
      "Source Note 1 says third-party economics follow LLC cash/tax allocation and flip/call terms, not ownership percentages. Conditional future cash allocation is $740m annual DMI payment plus $597m all-other-noncommon cash reserve, calibrated to the entire reported net other-financing outflow; the latter is NOT claimed to be observed NCI cash.",
      "Assume no future DMI/other NCI funding inflows, no new non-common interests in modeled new projects, and continued annual claim reserve through terminal. Existing flip/call dates and gross other-NCI distribution series are not disclosed; this explicit allocation is a sensitivity, not a contract forecast.",
      "Reserve the entire $401m reported redeemable NCI balance in the stub as a conditional cash redemption, not an observed exercise or contractual valuation.",
      "Use Note 15 approved FY2025-2029 FPL plus NEER gross capital budgets. They include AFUDC and are NOT exact cash-outflow schedules. Future cash payment timing, AFUDC and construction-payable changes need a separate conversion, not an asserted observed cash forecast.",
      "Add corporate capex, nuclear fuel where not already inside NEER budgets, net special-fund investment and other investing without treating restricted/special-use funds as excess cash.",
      "Precise missing forward series: Note 15 approved project budgets do not disclose a matching issuer-wide annual 2026-2040 cash revenue/operating-cost/commissioning/maintenance schedule or contractual gross NCI allocations. No invented asset turnover, project return or asset life is used to make terminal cash positive.",
      "Historical nuclear amortization and nuclear fuel purchases are distinct: add $299m amortization once and retain $399m cash fuel spending. Approved NEER budgets already include nuclear fuel; do not add it twice in those budget years.",
      "A source-budget funding constraint can be calculated, but full original 2.5–4% nominal terminal funding cannot be certified from these budgets. Existing low-tax/refund/transfer history does not justify perpetually recurring refunds or an FPL-only return proxy.",
      "Restricted cash is $159m less $244m exchange-traded derivative receipts, explaining negative $85m net restricted cash and the apparent $1.487bn versus $1.402bn cash presentation difference. Special-use funds are not distributable cash.",
    ];
  } else if (identity.symbol === "FSLR") {
    const da = a("us-gaap:DepreciationAmortizationAndAccretionNet");
    operatingReconciliation = [a("us-gaap:NetIncomeLoss"), da,
      a("us-gaap:AssetImpairmentCharges"), a("us-gaap:ShareBasedCompensation"),
      a("us-gaap:DeferredIncomeTaxesAndTaxCredits"), -a("us-gaap:GainLossOnSaleOfBusiness"),
      a("us-gaap:OtherOperatingActivitiesCashFlowStatement"),
      -a("us-gaap:IncreaseDecreaseInAccountsReceivable"), -a("us-gaap:IncreaseDecreaseInInventories"),
      -a("fslr:IncreaseDecreaseInGovernmentGrantsReceivable"),
      -a("us-gaap:IncreaseDecreaseInOtherOperatingAssets"),
      a("us-gaap:IncreaseDecreaseInIncomeTaxesPayableNetOfIncomeTaxesReceivable"),
      a("us-gaap:IncreaseDecreaseInAccountsPayableAndAccruedLiabilities"),
      a("us-gaap:IncreaseDecreaseInDeferredRevenue"), a("us-gaap:IncreaseDecreaseInOtherOperatingLiabilities")];
    investingReconciliation = [-a("us-gaap:PaymentsToAcquirePropertyPlantAndEquipment"),
      -a("us-gaap:PaymentsToAcquireAvailableForSaleSecuritiesDebt"),
      a("us-gaap:ProceedsFromMaturitiesPrepaymentsAndCallsOfAvailableForSaleSecurities"),
      a("us-gaap:ProceedsFromDivestitureOfBusinessesNetOfCashDivested"),
      -a("us-gaap:PaymentsToAcquireBusinessesNetOfCashAcquired"),
      -a("us-gaap:PaymentsForProceedsFromOtherInvestingActivities")];
    financingReconciliation = [a("us-gaap:ProceedsFromIssuanceOfDebt"), -a("us-gaap:RepaymentsOfDebt"),
      -a("us-gaap:PaymentsRelatedToTaxWithholdingForShareBasedCompensation"),
      a("us-gaap:ProceedsFromPaymentsForOtherFinancingActivities")];
    const grants = [1009451e3, 4186e3, 484e3].map(expected =>
      read("us-gaap:GovernmentAssistanceAmount", { expected, segmented: true }));
    const cashAndSecurities = unrestrictedCash + instant("us-gaap:AvailableForSaleSecuritiesDebtSecuritiesCurrent");
    const deferredRevenue = instant("us-gaap:DeferredRevenueCurrent") +
      instant("us-gaap:DeferredRevenueNoncurrent");
    normalized = { revenue: a("us-gaap:Revenues"), operatingProfit: a("us-gaap:OperatingIncomeLoss") -
      a("us-gaap:GainLossOnSaleOfBusiness") - sum(grants), depreciation: da, interest: a("us-gaap:InterestPaid"),
      cashTax: 0, otherCash: a("us-gaap:ForeignCurrencyTransactionGainLossBeforeTax") +
        a("us-gaap:OtherNonoperatingIncomeExpense"),
      reinvestment: da + a("us-gaap:PaymentsForProceedsFromOtherInvestingActivities") -
        a("us-gaap:ProceedsFromPaymentsForOtherFinancingActivities"),
      claims: 0, receivables: instant("us-gaap:AccountsReceivableNetCurrent"),
      annualRollover: a("us-gaap:RepaymentsOfDebt"), excessCash: Math.max(0, cashAndSecurities - deferredRevenue),
      legacyGrant: instant("us-gaap:GrantsReceivableCurrent"),
      stubReserve: a("us-gaap:CapitalExpendituresIncurredButNotYetPaid"),
      debt: instant("us-gaap:DebtCurrent") + instant("us-gaap:LongTermDebtNoncurrent"),
      cashAndSecurities, operatingCashReserve: Math.min(cashAndSecurities, deferredRevenue),
      noncurrentGrantReceivable: instant("us-gaap:GrantsReceivableNoncurrent") };
    allocation = [
      "Audit correction to v1, NOT a rewrite: remove all three disclosed income-based grant benefits (cost of sales, R&D and startup), not only the cost-of-sales credit. No future government benefit in operations or terminal.",
      "Audit correction to v1: charge the full reported contingent-consideration/other-financing net outflow as a recurring conditional cash reserve, in addition to D&A maintenance plus other investing. Finance-lease principal is not separately charged again from that aggregate.",
      "Retain reported opening trade receivables as required operating capital, not an unobserved 30-day opening balance or a free cash release. Other existing working-capital balances remain nominally fixed.",
      "Source current and noncurrent grant receivables are not invented future cash. A future stub needs Visa remaining proceeds, other 45X receivables and conditional six-installment India subsidy modeled separately. Do not silently omit them, assume full face collection, or claim an observed writeoff.",
      "Unrestricted cash plus current securities are entirely reserved against customer advances/deferred revenue, which exceed that liquidity. Zero excess-cash add-on is a stated conservative reserve assumption, not proved excess-cash fair value. Restricted securities/cash are excluded. Future interest income is zero, so no double capitalization of cash earnings.",
      "Debt is not subtracted again from FCFE. Gross future proceeds and principal repayments are matched rollovers; reported cash interest remains charged in stub, annual rows and terminal. Rollover availability is conditional, not observed future financing.",
      "Treat compensation expense as cash-equivalent (no SBC addback); do not deduct historical common share-withholding payments again as non-common claims. Historical full cash reconciliation separately includes those common-related financing payments.",
      "The noncash-PP&E funding amount is an explicit one-off stub settlement reserve, NOT certified closing debt or observed payment timing. Maintenance D&A sufficiency, cash-tax rate, cash reserve and grant collections remain analyst assumptions.",
    ];
  } else throw new Error("Issuer reconciliation not defined");
  residuals.operating = sum(operatingReconciliation) - cfo;
  residuals.investing = sum(investingReconciliation) - cfi;
  residuals.financing = sum(financingReconciliation) - cff;
  if (Object.values(residuals).some(value => Math.abs(value) > .01))
    throw new Error(`Historical cash reconciliation failed: ${JSON.stringify(residuals)}`);
  return { identity, normalized, capitalBudgets, allocation, rows, residuals,
    historical: { cfo, cfi, cff, fx, cashOpen, cashClose, cashChange, unrestrictedCash,
      operatingReconciliation, investingReconciliation, financingReconciliation },
    sourceAuthentication: "All extracted monetary facts bind selected issuer CIK, exact FY2024 duration/instant and USD; primary historical cash statements reconcile." };
}

export type IssuerReconciliation = ReturnType<typeof extractIssuerCashflowReconciliation>;

/** Concrete source-budget constraints, not another zero-growth market rerun.
 * A zero-cash-tax sensitivity exposes funding needs without inventing project yields. */
export function calculateIssuerFundingConstraints(reconciliation: IssuerReconciliation) {
  const o = reconciliation.normalized, symbol = reconciliation.identity.symbol;
  const beforeTaxBeforeInvestment = o.operatingProfit + o.depreciation + o.otherCash -
    o.interest - o.claims;
  if (symbol === "NEE") {
    return { basis: "Conditional source-level run rate before cash tax and new-project returns, after broad non-common reserve; future budget is gross/accrual, not certified cash",
      annualBeforeTaxCashRunRateBeforeNewInvestment: beforeTaxBeforeInvestment,
      budgetYears: reconciliation.capitalBudgets.map((grossApprovedBudget, i) => {
        const allInGrossBudget = grossApprovedBudget + o.corporateCapex + o.fundNet + o.otherInvesting;
        return { year: 2025 + i, grossApprovedBudget, allInGrossBudget,
          budgetLessBeforeTaxRunRate: allInGrossBudget - beforeTaxBeforeInvestment };
      }),
      terminalAssessment: "WITHHELD: no 2030+ approved cash-capital schedule or source-matched incremental operating returns; no arbitrary yield/life/turnover coefficient added",
      requiredTerminalGrowthRange: [.025, .04],
      missingSeries: [
        "Gross other-NCI cash distribution/call/flip schedule beyond $740m DMI and $597m net other-financing aggregate (Note 1 noncontrolling interests; cash flow financing and equity statements)",
        "Note 15 approved budgets to cash conversion including AFUDC, construction payables, project commissioning and new revenue/cost/tax cash",
        "Issuer-wide NEER/FPL/corporate post-2029 maintenance and growth reinvestment, nuclear fuel and new claims funding; no FPL allowed ROE substituted",
      ] };
  }
  if (symbol === "FSLR") {
    const otherInvestingAndFinancing = o.reinvestment - o.depreciation;
    return { basis: "FY2024 stripped-grant source-level cash run rate; FY2025 capex range is disclosed guidance, not a post-expiry forecast",
      annualBeforeTaxCashRunRateBeforeNewInvestment: beforeTaxBeforeInvestment,
      disclosed2025CapexRange: [1300e6, 1500e6],
      preTaxCashAfterDisclosedCapexRange: [1300e6, 1500e6].map(capex =>
        beforeTaxBeforeInvestment - capex - otherInvestingAndFinancing),
      noCreditMaintenancePreTaxBenchmark: beforeTaxBeforeInvestment - o.reinvestment,
      currentGrantReceivable: o.legacyGrant, noncurrentGrantReceivable: o.noncurrentGrantReceivable,
      conditionalCashReserve: { cashAndCurrentSecurities: o.cashAndSecurities, assumedOperatingReserve: o.operatingCashReserve,
        excessDistributionAssumed: o.excessCash, observedExcessCash: null },
      debt: { reportedCurrentAndLongTerm: o.debt, secondNetDebtSubtraction: 0,
        futureRolloverAvailabilityVerified: false },
      terminalAssessment: "WITHHELD: D&A-maintenance zero-growth benchmark does not establish positive 2.5–4% nominal growth or post-45X sustainable funding",
      requiredTerminalGrowthRange: [.025, .04],
      missingSeries: [
        "US-produced AND third-party-sold eligible watts by year, separate from invoicing geography, global production, backlog or nameplate capacity",
        "Geography-specific ASP/cost, unit margin and growth/maintenance capex and WC after 2030 backlog/2032 credit horizon",
        "Visa remaining credit proceeds relative to valuation date, other current credits and six-installment conditional India grant cash timing",
        "Normalized recurring module margin excluding total contract termination payments; filing discloses $115m annual INCREASE, not a certified recurring total",
      ] };
  }
  return { basis: "Reconciled FY2024 operating-only EBIT, affiliate cash once, actual cash tax/net interest, full PP&E/investment/contingent and gross NCI outflows",
    annualSourceLevelCommonCashBeforeGrowth: beforeTaxBeforeInvestment - o.cashTax - o.reinvestment,
    affiliateCashDividends: o.affiliateCash,
    historicalWorkingCapitalIncrease: 6030e6 + o.historicalOtherWcIncrease,
    terminalAssessment: "WITHHELD: positive source-level common cash does not identify CCS tariff, project timing or sustainable 2.5–4% nominal growth funding",
    requiredTerminalGrowthRange: [.025, .04],
    missingSeries: [
      "Third-party CCS transport/storage fee per tonne, annual contracted volume ramp and net operating costs/common ownership allocation: 6.7 Mtpa contracted capacity is not realized revenue",
      "Denbury Note 21 names acquisition valuation tariff/throughput inputs but publishes no tariff value; no rate fabricated",
      "Issuer-wide oil/gas decline replacement, growth reinvestment and operating geography/project cash schedule supporting original nominal terminal range",
    ] };
}

/** Bounded, primary-source operating geography/policy review. These channels
 * cannot be replaced by assigning consolidated revenue to a "climate" bucket. */
export function reviewIssuerActivityPolicy(html: string, identity: Identity) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ");
  const requireTerms = (terms: string[]) => {
    for (const term of terms) if (!text.includes(term))
      throw new Error(`Primary activity/policy disclosure locator missing: ${term}`);
  };
  if (identity.symbol === "FSLR") {
    requireTerms(["17 cents per watt", "68.5 GW", "20.5 billion", "first quarter of 2025",
      "15.5 GW", "14.1 GW", "1.3 billion", "1.5 billion", "six annual installments"]);
    const primary = authenticatePrimaryIssuerCashflow(html, identity);
    const revenue = primary.annual("us-gaap:Revenues");
    const usCustomerSales = primary.read("us-gaap:Revenues", { annual: false, expected: 3904844e3 }).value;
    return { symbol: identity.symbol, sourceFiscalEnd: identity.fiscalEnd,
      channels: [
        { channel: "US manufacturing 45X supply-side", locator: "FY2024 Form 10-K Item 1 incentives; Note 9 Government Grants",
          statutoryAsDisclosed: { expectedCreditUsdPerEligibleWatt: .17, availableThrough: 2032, phaseDownStarts: 2030 },
          eligibility: "Manufactured in the United States AND sold to a third party; eligibility/current-law confirmation remains necessary",
          notProxy: "US customer invoicing, global module sales/production or nameplate capacity do not establish eligible US-produced-and-sold watts" },
        { channel: "Geographic demand and activity", locator: "FY2024 Note 21; Item 7 Overview/Contracted Backlog",
          customerUsRevenueShare: usCustomerSales / revenue, globalProducedGw: 15.5, globalSoldGw: 14.1,
          futureContractedGw: 68.5, futureContractPriceUsd: 20.5e9,
          aggregateContractPriceUsdPerWatt: 20.5e9 / (68.5e9),
          backlogHorizonThrough: 2030, backlogNotCashForecast: true,
          countries: ["United States", "Malaysia", "Vietnam", "India"] },
        { channel: "45X monetization distinct from accrual", locator: "FY2024 Note 9 Visa agreements",
          faceCreditSoldUsd: 857.2e6, agreedCashUsd: 818.6e6, cashReportedReceivedDecember2024Usd: 616e6,
          remainingCashExpectedQ12025Usd: (818.6 - 616) * 1e6,
          historicalTransferCashPerFaceDollar: 818.6 / 857.2,
          noObservedPostReferenceCollection: true,
          noAutomaticAdditionToGrantReceivable: "Receivable classification and actual receipt date must avoid double counting Visa proceeds and balance-sheet grants/other assets" },
        { channel: "India asset grant and PLI are separate policies", locator: "FY2024 Item 7 India PLI; Note 9 Tamil Nadu incentive",
          indiaAssetSubsidy: "24% of eligible capital investments, subject to investment/employment conditions and six annual installments after production; application/audit/approval timing not observed",
          pli: "Separate five-year post-commissioning efficiency/content eligibility; not the US 45X rate, not a universal revenue percentage" },
      ],
      exactOriginalTerminalConstraint: "Annual US eligible watt/sale-location mix, ASP/cost and replacement/growth cash funding are not supplied beyond the backlog/credit horizons; positive 2.5–4% post-expiry growth cannot be inferred from 21 GW nameplate or customer-US revenue share.",
      qualifiedOriginalTerminalCases: 0, qualifiedOriginalMarketPairs: 0 };
  }
  if (identity.symbol === "NEE") {
    requireTerms(["hypothetical liquidation of book value", "targeted return", "2025", "2029",
      "8,205 MW", "2,228 MW", "4,265 MW"]);
    return { symbol: identity.symbol, sourceFiscalEnd: identity.fiscalEnd,
      channels: [
        { channel: "FPL Florida regulated operations", locator: "FY2024 Note 1 regulated electric operations and Note 15 capital commitments",
          caution: "FPL rate agreement and allowed returns are not consolidated NEE/NEER common-equity forecasts" },
        { channel: "NEER project build and policy-linked financing", locator: "FY2024 Note 15 approved project budgets",
          approvedNewSolarMw: 8205, approvedNewWindMw: 2228, approvedBatteryStorageMw: 4265,
          budgetYears: [2025, 2026, 2027, 2028, 2029],
          policyCash: "Renewable tax-credit sales and differential-membership contributions are separate channels; proceeds already in audited cash statements, not free incremental CFO add-ons" },
        { channel: "DMI/NCI cash and tax-attribute waterfall", locator: "FY2024 Note 1 Noncontrolling/Redeemable Noncontrolling Interests",
          mechanism: "LLC agreements allocate earnings, tax attributes and cash; HLBV is an accounting allocation, with targeted-return flip/call economics",
          missing: "Project/annual gross cash waterfalls, call prices and flip dates are not disclosed; $597m other financing is NET and not certified NCI distributions" },
      ],
      exactOriginalTerminalConstraint: "Approved generation/storage MW and gross capex do not publish source-matched annual operating cash returns, NCI cash allocations or post-2029 maintenance/growth and nuclear-fuel funding. No invented return/yield coefficient used.",
      qualifiedOriginalTerminalCases: 0, qualifiedOriginalMarketPairs: 0 };
  }
  requireTerms(["6.7", "900 miles", "Gulf Coast", "pipeline tariff"]);
  return { symbol: identity.symbol, sourceFiscalEnd: identity.fiscalEnd,
    channels: [
      { channel: "US Gulf Coast third-party CO2 transport/storage", locator: "FY2024 annual report CEO letter LCS; Form 10-K strategy discussion",
        contractedCapacityMtPerYear: 6.7, pipelineNetworkMilesLowerBound: 900,
        actualCaptureOrRevenueObservation: false, tariffUsdPerTonne: null,
        caution: "Contracted capacity is not annual realized throughput, capture, revenue, ownership-adjusted FCFE or avoided emissions" },
      { channel: "Denbury valuation assumptions", locator: "FY2024 Note 21 Denbury acquisition valuation",
        sourceNamesTariffAndThroughputInputs: true, sourcePublishesTariffValues: false },
      { channel: "Issuer-wide upstream/downstream/chemical cash", locator: "FY2024 income, cash flow and geographic producing-activity disclosures",
        caution: "Consolidated oil/chemical cash and affiliate dividends cannot be relabelled as CCS revenue or climate-caused growth" },
    ],
    exactOriginalTerminalConstraint: "No disclosed CCS tariff, annual ramp or common cash margin; issuer-wide decline replacement, growth investments, commodity/operating geography and taxes still need explicit positive-growth funding support.",
    qualifiedOriginalTerminalCases: 0, qualifiedOriginalMarketPairs: 0 };
}

