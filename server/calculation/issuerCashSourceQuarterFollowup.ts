import { attachmentPlain, nativeAttachmentReader } from "./issuerAttachmentGrantInputs";
import { sourceExhibit } from "./issuerSourceExhibits";
export function extractNewNeeCashQuarter(nee: string, xplr: string) {
  const a = nativeAttachmentReader(nee, "0000753308"), b = nativeAttachmentReader(xplr, "0001603145");
  const end = "2025-09-30", start = "2025-01-01";
  const member = "xplr:NoncontrollingOwnershipInterestsinNEPOpCoTexasPipelineandSilverStateMember";
  const text = attachmentPlain(xplr);
  if (!text.includes("NEE Equity's noncontrolling interest in XPLR OpCo and NEER's noncontrolling interests in Silver State, Sunlight Renewables Holdings and Emerald Breeze"))
    throw new Error("Actual aggregate-category legal scope required, not a single NEEEquity recipient");
  return { neeCategoryYtdDistributionsUsd: b("xplr:RelatedPartyDistributions", end, start, member),
    neeCategoryThirdQuarterDistributionsUsd: b("xplr:RelatedPartyDistributions", end, "2025-07-01", member),
    otherCategoryYtdDistributionsUsd: b("xplr:RelatedPartyDistributions", end, start, "xplr:OtherNoncontrollingInterestMember"),
    totalRelatedYtdDistributionFinancingOutflowUsd: b("xplr:RelatedPartyDistributions", end, start),
    xplrYtdNetCscsInvestingCashUsd: b("us-gaap:ProceedsFromPaymentsForLongTermLoansForRelatedParties", end, start),
    neeYtdBroaderRelatedSweepFinancingCashUsd: a("us-gaap:ProceedsFromRepaymentsOfRelatedPartyDebt", end, start),
    neerYtdServiceCostsIncurredUsd: a("nee:ReimbursementsInterestAndFeeIncomeOtherLoans", end, start, "nee:XPLRMember"),
    dueFromXplrBookSep30Usd: a("us-gaap:OtherReceivables", end, undefined, "nee:CashSweepAndCreditSupportAgreementMember") +
      a("us-gaap:OtherAssetsNoncurrent", end, undefined, "nee:CashSweepAndCreditSupportAgreementMember") };
}
export function reconcileNewNeeCashQuarter(q: ReturnType<typeof extractNewNeeCashQuarter>, annual: {
  categoryDistributionsUsd: number; xplrNetCscsInvestingCashUsd: number; neeBroaderRelatedSweepFinancingCashUsd: number;
  neerServiceCostsIncurredUsd: number; dueFromXplrClosingBookUsd: number;
}) {
  const residual = q.neeCategoryYtdDistributionsUsd + q.otherCategoryYtdDistributionsUsd - q.totalRelatedYtdDistributionFinancingOutflowUsd;
  if (residual !== 0 || Object.values(annual).some(v => !Number.isFinite(v))) throw new Error("Actual financing/category cash identity required");
  const xplrFourth = annual.xplrNetCscsInvestingCashUsd - q.xplrYtdNetCscsInvestingCashUsd;
  const neeFourth = annual.neeBroaderRelatedSweepFinancingCashUsd - q.neeYtdBroaderRelatedSweepFinancingCashUsd;
  return { neeAggregateCategoryFourthQuarterDistributionsUsd: annual.categoryDistributionsUsd - q.neeCategoryYtdDistributionsUsd,
    neeAggregateCategoryFirstHalfDistributionsUsd: q.neeCategoryYtdDistributionsUsd - q.neeCategoryThirdQuarterDistributionsUsd,
    categoryFinancingReconciliationResidualUsd: residual,
    xplrFourthQuarterNetCscsInvestingCashUsd: xplrFourth, neeFourthQuarterBroaderRelatedSweepFinancingCashUsd: neeFourth,
    firstNineMonthReportedLegDifferenceUsd: q.neeYtdBroaderRelatedSweepFinancingCashUsd + q.xplrYtdNetCscsInvestingCashUsd,
    fourthQuarterReportedLegDifferenceUsd: neeFourth + xplrFourth,
    annualReportedLegDifferenceUsd: annual.neeBroaderRelatedSweepFinancingCashUsd + annual.xplrNetCscsInvestingCashUsd,
    fourthQuarterServiceCostsIncurredUsd: annual.neerServiceCostsIncurredUsd - q.neerYtdServiceCostsIncurredUsd,
    fourthQuarterDueFromXplrBookIncreaseUsd: annual.dueFromXplrClosingBookUsd - q.dueFromXplrBookSep30Usd,
    actualServiceReimbursementCashUsd: null, neeEquityOnlyPortionOf61mUsd: null,
    actualGrossCscsWithdrawalsOrRepaymentsUsd: null, exactXplrOnlyPortionOfNee131mUsd: null,
    originalNeeCommonFcfeCashAddedUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "NEW2025Q3primary provides actual cash-period partition only, not recipient/projectreturn allocation. NEEcategory is primarilyNEEEquity plusNEERinterests inSilverState/Sunlight/EmeraldBreeze, not singlelegalentity. Parent related-partysweepline is broader than certifiedXPLR-only banksettlement. No cost-minus-receivable cash inference; no division byownership; no gross-settlement inference; no oldcase/stub rewrite. MillionUSDpresentation precision."
  };
}
export function inspectNewFslrRelease(fullSubmission: string) {
  if (!/CENTRAL INDEX KEY:\s*0001274494/.test(fullSubmission) || !/ACCESSION NUMBER:\s*0001274494-26-000211/.test(fullSubmission))
    throw new Error("Actual declared FSLR October29,2026 filing identity required");
  const exhibit = sourceExhibit(fullSubmission, "EX-99.1"), t = attachmentPlain(exhibit.body);
  const guidance = t.match(/module sales to be between ([\d.]+) GW and ([\d.]+) GW, including ([\d.]+) GW to ([\d.]+) GW from our U\.S\. manufacturing operations/);
  if (!guidance) throw new Error("Actual quarter-four USmanufacturing sales GUIDANCE clause required");
  return { declaredExhibit: exhibit.name, expectedFourthQuarterTotalSalesGw: [Number(guidance[1]), Number(guidance[2])],
    expectedFourthQuarterUsManufacturingSalesGw: [Number(guidance[3]), Number(guidance[4])],
    observedEligibleUsComponentWatts: null, indiaJulyReceiptAmountUsd: null, indiaJulyCashStatementClassification: null,
    indiaWordMatchesInEx991: (t.match(/\bIndia\b/gi) ?? []).length,
    actualCompanyCurrent45xEligibilityCertified: false, sourceIsForwardGuidanceNotObservedVolume: true,
    original32CashRowsChanged: false,
    boundary: "NewEx99.1futureQ4salesguidance—not actualproduced/sold eligiblecomponentwatts, not17c/7celigibilitycertification, notcashreceipts. No Indiaamount/classification located in this specific release, not globalnondisclosure. OriginalFeb21,2025reference preserved; later2026information notbackdated." };
}
export function reconcileNewCfCounterpartyCash(s: {
  openingCashUsd: number; operatingCashUsd: number; jeraMitsuiBluePointCashContributionsUsd: number;
  consolidatedCapexUsd: number; cfFundedCapexUsd: number; partnerFundedCapexUsd: number;
  bluePointConsolidatedCapexUsd: number; bluePointCfFundedCapexUsd: number;
  chsDistributionsUsd: number; shareholderReturnsUsd: number; otherCashOutflowUsd: number; closingCashUsd: number;
}) {
  if (Object.values(s).some(v => !Number.isFinite(v))) throw new Error("Actual primary cash components required");
  const cash = s.openingCashUsd + s.operatingCashUsd + s.jeraMitsuiBluePointCashContributionsUsd - s.consolidatedCapexUsd -
    s.chsDistributionsUsd - s.shareholderReturnsUsd - s.otherCashOutflowUsd - s.closingCashUsd;
  const funding = s.consolidatedCapexUsd - s.cfFundedCapexUsd - s.partnerFundedCapexUsd;
  const project = s.bluePointConsolidatedCapexUsd - s.bluePointCfFundedCapexUsd - s.partnerFundedCapexUsd;
  if (cash !== 0 || funding !== 0 || project !== 0) throw new Error("CF source cash/funding presentation did not reconcile");
  return { ...s, consolidatedCashReconciliationResidualUsd: cash, capexFundingResidualUsd: funding, bluePointFundingResidualUsd: project,
    actualXomFeeCashUsd: null, xomOwnProjectFundingUsd: null, directRosePermitCfCrosswalk: null,
    amountInsertedIntoXomOriginalCashflowsUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "NewCFNov4,2026investordeckslide15: actualCFconsolidated9Mcashfunding, NOT XOMcash/projectcost.391mJERA/MitsuiJVcapital contributions differ from139mpartnerfundedcapex; no unusedcash/earmark inferred. BluePointJV is NOT Donaldsonville/Rose and is not a verified eligiblealternativeissuer. No CCSprice/opex/replacement or XOMfee/ownership inferred from CFcorporate/JVbudget." };
}
export function extractHistoricalXomMvcFees(enlinkQ2: string, retainedEnlinkQ3: string) {
  const t = attachmentPlain(enlinkQ2);
  const m = t.match(/contractually committed fees include \$\s*([\d.]+) million in 2025, \$\s*([\d.]+) million in 2026, \$\s*([\d.]+) million in 2027, \$\s*([\d.]+) million in 2028, and \$\s*([\d.]+) million from 2029 through 2050 for MVCs under our transportation services agreement with a subsidiary of ExxonMobil/);
  if (!m || !t.includes("We may not realize the full value of these fees or realize them in different periods under any financial arrangement") ||
    !t.includes("These fees do not represent the shortfall amounts we expect to collect"))
    throw new Error("Actual historical XOM-subsidiary MVC recognition/cash-recovery boundary required");
  const total = (html: string) => {
    const note = attachmentPlain(html).match(/b\. Revenue Recognition([\s\S]*?)c\. Property and Equipment/);
    const n = note?.[1].match(/Total \$\s*([\d,]+\.\d+)/);
    if (!n) throw new Error("Same counterparty Note2 committed-fee aggregate required");
    return Number(n[1].replace(/,/g, "")) * 1e6;
  };
  return { schedule: m.slice(1).map((v, i) => ({ startYear: 2025 + i, endYear: i === 4 ? 2050 : 2025 + i, expectedRecognitionUsd: Number(v) * 1e6 })),
    allContractFeesAtJune30Usd: total(enlinkQ2), allContractFeesAtSeptember30Usd: total(retainedEnlinkQ3),
    xomNamedFootnotePresentInLaterQ3FeeTable: /ExxonMobil/.test(attachmentPlain(retainedEnlinkQ3).match(/b\. Revenue Recognition([\s\S]*?)c\. Property and Equipment/)?.[1] ?? ""),
    actualCashPaidOrCollectedUsd: null, executedPerTonneTariffUsd: null, actualGasOrTransportedVolume: null,
    exactXomContractSubsidiaryLegalName: null, currentSettlementValueUsd: null };
}
export function reconcileHistoricalXomMvcFees(s: ReturnType<typeof extractHistoricalXomMvcFees>) {
  const fee = s.schedule.reduce((sum, r) => sum + r.expectedRecognitionUsd, 0);
  if (s.schedule.length !== 5 || s.schedule.some(r => !Number.isFinite(r.expectedRecognitionUsd) || r.expectedRecognitionUsd < 0) ||
    fee > s.allContractFeesAtJune30Usd) throw new Error("Bounded positive historical recognition schedule required");
  return { ...s, historicalXomSubsidiaryMvcRecognitionScheduleUsd: fee,
    otherContractExpectedFeesAtJune30Usd: s.allContractFeesAtJune30Usd - fee,
    laterAllContractFeeTableChangeUsd: s.allContractFeesAtSeptember30Usd - s.allContractFeesAtJune30Usd,
    laterTableChangeCertifiedAsXomCancellationOrRecovery: false,
    expectedRecognitionIsGuaranteedCashOrCurrentBillings: false, laterPeriods2029To2050AllocatedAnnually: false,
    baselineCarbonOrOperatingCostDeductedAgainUsd: 0, amountInsertedIntoOriginalXomFcfeUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "Genuinely sourced historical MVC FEES, not inventedCCStariff: EnLinkQ2publishedAug7,2024Note2includesXOM-subsidiary expectedrecognition schedule. It expressly warns recoveryvalue/timing under pursuedPecanIslandfinancialarrangement maydiffer. NOT actualcash/minimumbillings, currenttariff, XOMearnedrevenue or permittedCO2mass. LaterQ3table no longer identifiesXOMfootnote, but aggregatechange is NOT provenXOMcancellation/settlement.722.9m2029–2050 staysunallocated; no fabricatedcashdate/discount/annualallocation or baselineexpense duplication."
  };
}
