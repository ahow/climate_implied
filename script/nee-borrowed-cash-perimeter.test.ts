import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileBorrowedCashPerimeter } from "../server/calculation/neeBorrowedCashPerimeter";
const fixture = { opening: { totalUnconsolidatedSweptCashBookUsd: 100, xplrOnlyHeldSweepBookUsd: 50 },
  september: { totalUnconsolidatedSweptCashBookUsd: 60, xplrOnlyHeldSweepBookUsd: 20 },
  closing: { totalUnconsolidatedSweptCashBookUsd: 55, xplrOnlyHeldSweepBookUsd: 15 },
  reportedAnnualBroaderSweepFinancingCashUsd: -45, reportedYtdBroaderSweepFinancingCashUsd: -41,
  reportedXplrAnnualNetInvestingCashUsd: 35 };
test("synthetic total borrowed-cash liability perimeter explains net-line difference, not inferred bank settlements", () => {
  const r = reconcileBorrowedCashPerimeter(fixture);
  assert.equal(r.totalAnnualBookReleaseUsd, 45);
  assert.equal(r.counterpartyReportedAnnualNetInvestingCashUsd, 35);
  assert.equal(r.totalBookReleaseLessCounterpartyNetCashDifferenceUsd, 10);
  assert.equal(r.annualReportedNetFinancingVersusTotalBookChangeResidualUsd, 0);
  assert.equal(r.ytdNetFinancingVersusBookChangeResidualUsd, -1);
  assert.equal(r.fourthQuarterNetFinancingVersusBookChangeResidualUsd, 1);
  assert.equal(r.independentlyCertifiedOtherPartyBankSettlementsUsd, null);
  assert.equal(r.actualServiceReimbursementsUsd, null);
  assert.equal(r.originalNeeCommonFcfeCashAddedUsd, 0);
});
test("synthetic mismatched book/cash perimeter refuses rather than inventing collection or FX", () => {
  assert.throws(() => reconcileBorrowedCashPerimeter({ ...fixture, reportedAnnualBroaderSweepFinancingCashUsd: -44 }));
});
