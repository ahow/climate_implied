import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileNeeCscsHeldCash } from "../server/calculation/neeCscsHeldCashBridge";
const fixture = { openingHeldSweep2024Usd: 30, closingHeldSweep2025Usd: 10, counterpartyNetCscsInvestingCashUsd: 20,
  creditSupportFeeExpense2025Usd: 5, priorChargeTrueupExpense2025Usd: -7,
  exceptionalPipelineSweepInterestIncome2024Usd: 4, exceptionalInterestCashReceipt2024Usd: null, actualCreditSupportFeeCash2025Usd: null };
test("synthetic held-cash release is source-net reconciliation, not invented gross cash or common FCFE", () => {
  const r = reconcileNeeCscsHeldCash(fixture, -23);
  assert.equal(r.reportedNetHeldBalanceReleaseUsd, 20);
  assert.equal(r.heldBalanceVersusCounterpartyNetCashResidualUsd, 0);
  assert.equal(r.opposingNeeConsolidatedLegResidualUsd, -3);
  assert.equal(r.actualGrossSweepWithdrawalsAndReturnsUsd, null);
  assert.equal(r.neeCommonFcfeCashAddedUsd, 0);
});
test("synthetic fee-trueup and historical interest income are not paid cash or a zero-fee fact", () => {
  const r = reconcileNeeCscsHeldCash(fixture, -23);
  assert.equal(r.netReportedCreditSupportFeeExpense2025Usd, -2);
  assert.equal(r.actualCreditSupportFeeCash2025Usd, null);
  assert.equal(r.exceptionalPipelineSweepInterestIncome2024Usd, 4);
  assert.equal(r.exceptionalInterestCashReceipt2024Usd, null);
  assert.throws(() => reconcileNeeCscsHeldCash({ ...fixture, counterpartyNetCscsInvestingCashUsd: 19 }, -23));
});
