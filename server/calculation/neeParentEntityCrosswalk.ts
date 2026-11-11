import { attachmentPlain, nativeAttachmentReader } from "./issuerAttachmentGrantInputs";
/** Same-period/entity accounting crosswalk; never imports a valuation engine. */
export function extractNeeParentEntityCrosswalk(parentHtml: string, subsidiariesHtml: string, xplrHtml: string, cscsHtml: string) {
  const p = attachmentPlain(parentHtml), s = attachmentPlain(subsidiariesHtml), x = attachmentPlain(xplrHtml), c = attachmentPlain(cscsHtml);
  for (const clause of [
    "accounts for its ownership interest in XPLR as an equity method investment",
    "which have been or will be reimbursed by XPLR",
    "primarily in connection with wind repowering"
  ]) if (!p.includes(clause)) throw new Error(`Parent source boundary absent: ${clause}`);
  if (!s.includes("principal subsidiaries as of December 31, 2025") ||
    !s.includes("NextEra Energy Resources, LLC") || !s.includes("100%-owned subsidiary of NextEra Energy Capital Holdings, Inc."))
    throw new Error("Actual principal-subsidiary ownership source required");
  if (!x.includes("a Delaware limited partnership and an indirect wholly owned subsidiary of NEE") ||
    !x.includes("because of its controlling interest in the general partner of XPLR OpCo"))
    throw new Error("Counterparty organization/control boundary missing");
  if (!c.includes("3.1.1 US Cash.") || !c.includes("other than Reserved Cash") ||
    !c.includes("no member of the XPLR Group shall be entitled to receive any interest or other fees for the Cash Sweep Withdrawals") ||
    !c.includes("to repay all of such borrowed cash"))
    throw new Error("Executed CSCS principal/earnings/reserved-cash terms required");
  const percent = (text: string, pattern: RegExp) => {
    const m = text.match(pattern); if (!m) throw new Error("Dated legal ownership clause not located"); return Number(m[1]);
  };
  const a = nativeAttachmentReader(parentHtml, "0000753308"), b = nativeAttachmentReader(xplrHtml, "0001603145");
  const yr = (name: string, member?: string) => a(name, "2025-12-31", "2025-01-01", member);
  const ar = (name: string, date: string) => a(name, date, undefined, "nee:CashSweepAndCreditSupportAgreementMember");
  return {
    parentCik: "0000753308", counterpartyCik: "0001603145",
    parentStatementScope: "NEE consolidated, NOT NEE Inc parent-standalone",
    xplrAccounting: "equity-method-unconsolidated",
    neeTotalNoncontrollingXplrOwnershipPercent: percent(p, /NEE has an approximately ([\d.]+) % noncontrolling interest in XPLR/),
    neeEquityOpCoCommonLpPercent: percent(x, /NEE Equity owned a noncontrolling ([\d.]+) % limited partner interest in XPLR OpCo/),
    xplrOpCoCommonLpPercent: percent(x, /XPLR owned an approximately ([\d.]+) % limited partner interest in XPLR OpCo/),
    legalAlias: "NEE Equity = NextEra Energy Equity Partners, LP; Delaware; indirect wholly owned NEE subsidiary, sourced from XPLR organization note",
    principalSubsidiariesListIsNotFullEquityLpChain: true,
    operatingAffiliateEarningsDistributionsUsd: yr("us-gaap:EquityMethodInvestmentDividendsOrDistributions"),
    consolidatedCfoUsd: yr("us-gaap:NetCashProvidedByUsedInOperatingActivities"),
    consolidatedInvestingCashUsd: yr("us-gaap:NetCashProvidedByUsedInInvestingActivities"),
    consolidatedFinancingCashUsd: yr("us-gaap:NetCashProvidedByUsedInFinancingActivities"),
    currencyTranslationCashUsd: yr("us-gaap:EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"),
    reportedCashChangeUsd: yr("us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect"),
    parentCscsNetFinancingCashUsd: yr("us-gaap:ProceedsFromRepaymentsOfRelatedPartyDebt"),
    counterpartyCscsNetInvestingCashUsd: b("us-gaap:ProceedsFromPaymentsForLongTermLoansForRelatedParties", "2025-12-31", "2025-01-01"),
    serviceAgreementCostsIncurredUsd: yr("nee:ReimbursementsInterestAndFeeIncomeOtherLoans", "nee:XPLRMember"),
    dueFromXplrCurrent2025Usd: ar("us-gaap:OtherReceivables", "2025-12-31"),
    dueFromXplrNoncurrent2025Usd: ar("us-gaap:OtherAssetsNoncurrent", "2025-12-31"),
    dueFromXplrCurrent2024Usd: ar("us-gaap:OtherReceivables", "2024-12-31"),
    dueFromXplrNoncurrent2024Usd: ar("us-gaap:OtherAssetsNoncurrent", "2024-12-31"),
    xplrSweepInterestEntitlement: "none under Section3.2; NEER may retain actual earnings, amounts unknown"
  };
}
export function reconcileNeeParentEntityCrosswalk(s: ReturnType<typeof extractNeeParentEntityCrosswalk>,
  counterparty: { renewablesIiBuyoutUsd: number; pipelinesBuyoutUsd: number; categoryDistributionsUsd: number; contributionEquityMovementUsd: number }) {
  if (s.xplrAccounting !== "equity-method-unconsolidated" || s.parentCik !== "0000753308" || s.counterpartyCik !== "0001603145")
    throw new Error("Entity/consolidation identity mismatch");
  const cashResidual = s.consolidatedCfoUsd + s.consolidatedInvestingCashUsd + s.consolidatedFinancingCashUsd +
    s.currencyTranslationCashUsd - s.reportedCashChangeUsd;
  if (cashResidual !== 0 || s.neeEquityOpCoCommonLpPercent + s.xplrOpCoCommonLpPercent !== 100)
    throw new Error("Parent cash or common-LP ownership presentation failed reconciliation");
  const closing = s.dueFromXplrCurrent2025Usd + s.dueFromXplrNoncurrent2025Usd;
  const opening = s.dueFromXplrCurrent2024Usd + s.dueFromXplrNoncurrent2024Usd;
  return {
    neeConsolidatedAffiliateEarningsDistributions2025Usd: s.operatingAffiliateEarningsDistributionsUsd,
    neeConsolidatedServiceCostsIncurred2025Usd: s.serviceAgreementCostsIncurredUsd,
    neeTotalNoncontrollingXplrOwnershipPercent: s.neeTotalNoncontrollingXplrOwnershipPercent,
    neeEquityOpCoCommonLpPercent: s.neeEquityOpCoCommonLpPercent,
    xplrOpCoCommonLpPercent: s.xplrOpCoCommonLpPercent,
    consolidatedCashReconciliationResidualUsd: cashResidual,
    neeConsolidatedCashChangeUsd: s.reportedCashChangeUsd,
    parentCscsNetFinancingCashUsd: s.parentCscsNetFinancingCashUsd,
    counterpartyCscsNetInvestingCashUsd: s.counterpartyCscsNetInvestingCashUsd,
    opposingCscsReportedLegResidualUsd: s.parentCscsNetFinancingCashUsd + s.counterpartyCscsNetInvestingCashUsd,
    cscsReportedLegsCertifiedSameGrossSettlement: false,
    dueFromXplrClosingBookUsd: closing, dueFromXplrOpeningBookUsd: opening, dueFromXplrBookIncreaseUsd: closing - opening,
    serviceCostsLessBookIncreaseIsCertifiedCash: false,
    actualGrossServiceReimbursementCashUsd: null, actualCscsPrincipalOrInterestGrossSettlementsUsd: null,
    actualParentStandaloneXplrCashUsd: null,
    xplr931m219mAreNeeConsolidatedFinancingPayments: false,
    counterpartyDistributions61mAreCertifiedSubsetOfNee446m: false,
    counterparty47mEquityMovementIsCertifiedCash: false,
    sourceCounterparty: counterparty,
    originalNeeCommonFcfeCashAddedUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "Parent means NEE-consolidated source, not a standalone parent bank account. NEE52.5%XPLR economics and NEEEquity51.2%OpCoLP are different denominators; neither multiplies cash. XPLR consolidates OpCo by GPcontrol; NEE accounts for XPLR by equitymethod.446m already sits in NEE CFO;931/219/61/47 must not be inserted or netted into NEE FCFE. Service costs incurred/receivable book changes are not cash collection. CSCS principal is borrowing/repayment with reserved-cash/debt constraints, not project return; no unexplained15m assigned to fees/FX."
  };
}
