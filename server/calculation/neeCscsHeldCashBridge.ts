import { attachmentPlain, nativeAttachmentReader } from "./issuerAttachmentGrantInputs";
/** Newly inspected retained CSCSnote, separate from frozen parent-crosswalk-1. */
export function extractNeeCscsHeldCash(html: string) {
  const t = attachmentPlain(html), n = nativeAttachmentReader(html, "0001603145");
  const held = t.match(/At December 31, 2025 and 2024 , the cash sweep amounts held in accounts belonging to NEER or its affiliates were approximately \$\s*([\d,.]+) million and \$\s*([\d,.]+) million, respectively/);
  const fees = t.match(/O&M expenses for the years ended December 31, 2025, 2024 and 2023 include approximately \$\s*([\d,.]+) million, \$\s*[\d,.]+ million and \$\s*[\d,.]+ million, respectively, related to the CSCS agreement and for the year ended December 31, 2025 also includes \$\(\s*([\d,.]+)\s*\) million related to true-up of amounts previously charged/);
  const interest = t.match(/During the year ended December 31, 2024, XPLR recorded interest income of approximately \$\s*([\d,.]+) million from NEER for cash sweep amounts held relating to proceeds from the sale of the Texas pipelines/);
  if (!held || !fees || !interest || !t.includes("will not pay interest on the withdrawn funds except as otherwise agreed upon"))
    throw new Error("Actual held-balance/fee-trueup/exception-interest source clauses required");
  const money = (v: string) => Number(v.replace(/,/g, "")) * 1e6;
  return { closingHeldSweep2025Usd: money(held[1]), openingHeldSweep2024Usd: money(held[2]),
    counterpartyNetCscsInvestingCashUsd: n("us-gaap:ProceedsFromPaymentsForLongTermLoansForRelatedParties", "2025-12-31", "2025-01-01"),
    creditSupportFeeExpense2025Usd: money(fees[1]), priorChargeTrueupExpense2025Usd: -money(fees[2]),
    exceptionalPipelineSweepInterestIncome2024Usd: money(interest[1]),
    exceptionalInterestCashReceipt2024Usd: null, actualCreditSupportFeeCash2025Usd: null };
}
export function reconcileNeeCscsHeldCash(s: ReturnType<typeof extractNeeCscsHeldCash>, neeConsolidatedNetCscsCashUsd: number) {
  const release = s.openingHeldSweep2024Usd - s.closingHeldSweep2025Usd;
  const residual = release - s.counterpartyNetCscsInvestingCashUsd;
  if (!Number.isFinite(neeConsolidatedNetCscsCashUsd) || residual !== 0) throw new Error("Retained held-balance/net-release presentation does not reconcile");
  return { openingHeldSweepUsd: s.openingHeldSweep2024Usd, closingHeldSweepUsd: s.closingHeldSweep2025Usd,
    reportedNetHeldBalanceReleaseUsd: release, counterpartyNetCscsInvestingCashUsd: s.counterpartyNetCscsInvestingCashUsd,
    heldBalanceVersusCounterpartyNetCashResidualUsd: residual,
    opposingNeeConsolidatedLegResidualUsd: neeConsolidatedNetCscsCashUsd + s.counterpartyNetCscsInvestingCashUsd,
    creditSupportFeeExpense2025Usd: s.creditSupportFeeExpense2025Usd,
    priorChargeTrueupExpense2025Usd: s.priorChargeTrueupExpense2025Usd,
    netReportedCreditSupportFeeExpense2025Usd: s.creditSupportFeeExpense2025Usd + s.priorChargeTrueupExpense2025Usd,
    exceptionalPipelineSweepInterestIncome2024Usd: s.exceptionalPipelineSweepInterestIncome2024Usd,
    exceptionalInterestCashReceipt2024Usd: null, actualCreditSupportFeeCash2025Usd: null,
    actualGrossSweepWithdrawalsAndReturnsUsd: null, neeCommonFcfeCashAddedUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "127mto11mheldsweep stock decline reconciles XPLR116mNETCSCSinvesting cash at millionUSDpresentation precision, not gross withdrawals/settlements. NEEconsolidated−131m opposite leg still differs15m.10mCSCSexpense plus−11mpriorchargetrueup=−1mnetexpensecredit, NOT cashrefund or zero credit-support fee.36mexceptional2024Texas-pipeline sweepinterest is recognizedincome, cashreceipt not certified; default2025contract no-interest clause must not erase other-agreed exceptions or become a project return."
  };
}
