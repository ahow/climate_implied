import { attachmentPlain } from "./issuerAttachmentGrantInputs";
export function extractBorrowedCashPerimeter(html: string) {
  const t = attachmentPlain(html);
  const matches = Array.from(t.matchAll(/Cash swept from unconsolidated entities\s+—\s+\(\s*([\d,]+)\s*\)\s+\(\s*([\d,]+)\s*\)/g));
  if (matches.length !== 1 || matches[0][1] !== matches[0][2]) throw new Error("Unique NEECH/total liquidity borrowed-cash row required");
  return { totalUnconsolidatedSweptCashBookUsd: Number(matches[0][1].replace(/,/g, "")) * 1e6 };
}
export function reconcileBorrowedCashPerimeter(s: {
  opening: ReturnType<typeof extractBorrowedCashPerimeter>; september: ReturnType<typeof extractBorrowedCashPerimeter>;
  closing: ReturnType<typeof extractBorrowedCashPerimeter>; reportedAnnualBroaderSweepFinancingCashUsd: number;
  reportedYtdBroaderSweepFinancingCashUsd: number; reportedXplrAnnualNetInvestingCashUsd: number;
}) {
  const totalStockChange = s.closing.totalUnconsolidatedSweptCashBookUsd - s.opening.totalUnconsolidatedSweptCashBookUsd;
  const annualResidual = s.reportedAnnualBroaderSweepFinancingCashUsd - totalStockChange;
  if (annualResidual !== 0 || Object.values(s).some(v => typeof v === "number" && !Number.isFinite(v)))
    throw new Error("Actual source annual stock/net-flow perimeter does not reconcile");
  return { openingTotalSweptBorrowedCashBookUsd: s.opening.totalUnconsolidatedSweptCashBookUsd,
    septemberTotalSweptBorrowedCashBookUsd: s.september.totalUnconsolidatedSweptCashBookUsd,
    closingTotalSweptBorrowedCashBookUsd: s.closing.totalUnconsolidatedSweptCashBookUsd,
    totalAnnualBookReleaseUsd: -totalStockChange,
    counterpartyReportedAnnualNetInvestingCashUsd: s.reportedXplrAnnualNetInvestingCashUsd,
    totalBookReleaseLessCounterpartyNetCashDifferenceUsd: -totalStockChange - s.reportedXplrAnnualNetInvestingCashUsd,
    annualReportedNetFinancingVersusTotalBookChangeResidualUsd: annualResidual,
    ytdNetFinancingVersusBookChangeResidualUsd: s.reportedYtdBroaderSweepFinancingCashUsd -
      (s.september.totalUnconsolidatedSweptCashBookUsd - s.opening.totalUnconsolidatedSweptCashBookUsd),
    fourthQuarterNetFinancingVersusBookChangeResidualUsd: s.reportedAnnualBroaderSweepFinancingCashUsd -
      s.reportedYtdBroaderSweepFinancingCashUsd - (s.closing.totalUnconsolidatedSweptCashBookUsd - s.september.totalUnconsolidatedSweptCashBookUsd),
    independentlyCertifiedOtherPartyBankSettlementsUsd: null, actualGrossWithdrawalsOrReturnsUsd: null,
    actualServiceReimbursementsUsd: null, originalNeeCommonFcfeCashAddedUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "Actual borrowed-cash LIABILITY/liquidity perimeter, NOT receivable-to-cash inference. Annual parenttotal250mto119m decline131m matches independentlyreported−131mNETfinancing. XPLR116mnetinvestingcash differs15m; broaderpool stock closure does NOT certify other-partybanksettlements or exactXPLR-onlyparentcash. No namedother-party liability movements invented fromcross-source heldcash. Interim−1m/+1m stock-flow residuals remainunallocated; rounding/FX not invented. Grossbankflows and legalrecipient split remainnull; allreportedmillionprecision."
  };
}
