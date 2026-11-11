import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileNeeParentEntityCrosswalk } from "../server/calculation/neeParentEntityCrosswalk";
import { reconcileFslrAsc832Quarter } from "../server/calculation/fslrAsc832ProgrammeQuarter";
const parentFixture = {
  parentCik: "0000753308", counterpartyCik: "0001603145", parentStatementScope: "synthetic consolidated",
  xplrAccounting: "equity-method-unconsolidated", neeTotalNoncontrollingXplrOwnershipPercent: 53,
  neeEquityOpCoCommonLpPercent: 51, xplrOpCoCommonLpPercent: 49, legalAlias: "synthetic",
  principalSubsidiariesListIsNotFullEquityLpChain: true, operatingAffiliateEarningsDistributionsUsd: 30,
  consolidatedCfoUsd: 100, consolidatedInvestingCashUsd: -150, consolidatedFinancingCashUsd: 40,
  currencyTranslationCashUsd: 10, reportedCashChangeUsd: 0, parentCscsNetFinancingCashUsd: -17,
  counterpartyCscsNetInvestingCashUsd: 14, serviceAgreementCostsIncurredUsd: 70,
  dueFromXplrCurrent2025Usd: 20, dueFromXplrNoncurrent2025Usd: 10,
  dueFromXplrCurrent2024Usd: 15, dueFromXplrNoncurrent2024Usd: 5, xplrSweepInterestEntitlement: "synthetic"
};
const counterpartyFixture = { renewablesIiBuyoutUsd: 20, pipelinesBuyoutUsd: 5, categoryDistributionsUsd: 7, contributionEquityMovementUsd: 2 };
const quarterFixture = {
  quarterExpenseBenefitsUsd: [100, 2, 3, 4], nineMonthExpenseBenefitsUsd: [300, 5, 9, 4],
  alabamaQuarterAssetRecognitionFromNoteUsd: 10, alabamaNineMonthAssetRecognitionFromNoteUsd: 10,
  nativeAwardInstantTagUsd: 10, awardInstantTagAloneDefinesRecognitionPeriod: false,
  nineMonthGrantCfoEffectUsd: -200, closingAllGrantReceivablesUsd: 500, nineMonthNoncashProceedsToBeReceivedSupplementUsd: 80,
  quarterNineMonthAssetRecognitionCashUsd: null, indiaJulyCashAmountUsd: null
};
const halfFixture = { firstHalfExpenseBenefitsUsd: [200, 3, 6], firstHalfGrantCfoEffectUsd: -130,
  firstHalfClosingAllGrantReceivablesUsd: 350, openingAllGrantReceivablesUsd: 250,
  selectedPriorCreditCashCollectedFirstHalfUsd: 90, indiaFirstReceiptMonth: "2026-07" };
test("synthetic different ownership denominators do not multiply counterparty cash", () => {
  const r = reconcileNeeParentEntityCrosswalk(parentFixture, counterpartyFixture);
  assert.equal(r.consolidatedCashReconciliationResidualUsd, 0);
  assert.equal(r.sourceCounterparty.categoryDistributionsUsd, 7);
  assert.equal(r.counterpartyDistributions61mAreCertifiedSubsetOfNee446m, false);
  assert.equal(r.originalNeeCommonFcfeCashAddedUsd, 0);
  assert.equal(r.actualParentStandaloneXplrCashUsd, null);
});
test("synthetic CSCS imbalance and service-book increase remain unidentified cash, not plugged fees", () => {
  const r = reconcileNeeParentEntityCrosswalk(parentFixture, counterpartyFixture);
  assert.equal(r.opposingCscsReportedLegResidualUsd, -3);
  assert.equal(r.dueFromXplrBookIncreaseUsd, 10);
  assert.equal(r.serviceCostsLessBookIncreaseIsCertifiedCash, false);
  assert.equal(r.actualGrossServiceReimbursementCashUsd, null);
  assert.equal(r.actualCscsPrincipalOrInterestGrossSettlementsUsd, null);
  assert.equal(r.counterparty47mEquityMovementIsCertifiedCash, false);
});
test("synthetic source entity/cash/LP mismatch refuses instead of forcing a common-FCFE bridge", () => {
  for (const bad of [{ ...parentFixture, parentCik: "0000037634" }, { ...parentFixture, reportedCashChangeUsd: 1 },
    { ...parentFixture, neeEquityOpCoCommonLpPercent: 52 }])
    assert.throws(() => reconcileNeeParentEntityCrosswalk(bad, counterpartyFixture));
});
test("synthetic ASC832expense axes reconcile quarter/YTD; first-halfstartup is derived, never defaulted", () => {
  const r = reconcileFslrAsc832Quarter(quarterFixture, halfFixture);
  assert.deepEqual(r.expenseAxisReconciliationResidualsUsd, [0, 0, 0]);
  assert.equal(r.allExpenseAxisReconciliationResidualUsd, 0);
  assert.equal(r.allProgrammeQuarterIncomeBenefitsUsd, 109);
  assert.equal(r.allProgrammeNineMonthIncomeBenefitsUsd, 318);
  assert.equal(r.derivedFirstHalfStartupBenefitsUsd, 0);
  assert.equal(r.firstHalfStartupIsDerivedNotMissingFactZero, true);
  assert.equal(r.alabamaDerivedFirstHalfAssetGrantRecognitionUsd, 0);
});
test("synthetic recognition/award and balance movements never become Alabama/India receipts", () => {
  const r = reconcileFslrAsc832Quarter(quarterFixture, halfFixture);
  assert.equal(r.quarterRecognitionCfoUnallocatedResidualUsd, 39);
  assert.equal(r.nineMonthRecognitionCfoLessOnlyKnownPriorCreditCashResidualUsd, 28);
  assert.equal(r.alabamaAssetGrantObservedCashUsd, null);
  assert.equal(r.indiaJulyCashAmountUsd, null);
  assert.equal(r.indiaFirstReceiptMonthPreserved, "2026-07");
  assert.equal(r.actualEligibleUsComponentWatts, null);
  assert.equal(r.original32CashRowsChanged, false);
});
test("synthetic mismatched expense rows refuse instead of closing with an invented grant", () => {
  assert.throws(() => reconcileFslrAsc832Quarter(quarterFixture, { ...halfFixture, firstHalfExpenseBenefitsUsd: [201, 3, 6] }));
  assert.throws(() => reconcileFslrAsc832Quarter({ ...quarterFixture, quarterExpenseBenefitsUsd: [100, 2, 3] }, halfFixture));
});
