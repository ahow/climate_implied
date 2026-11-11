import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileNeeRelatedPartnerCash } from "../server/calculation/neeRelatedPartnerCash";
const synthetic = { version: "synthetic", fiscalYear: 2024, currency: "USD",
  totalPartnerCashDistributions: 1000, publicUnitDistributions: 400, allOtherOwnerDistributions: 600,
  neeCategoryDistributions: 500, neeCategoryContributionsEquityMovement: 100, totalPartnerCashContributions: 200,
  neeCategoryOpeningEquity: 1000, neeCategoryClosingEquity: 615, neeCategoryNoteReceivableMovement: 5,
  neeCategoryIncome: 3, neeCategoryOtherEquityMovement: 7 };
test("synthetic counterparty cash partition and independent owner equity rollforward", () => {
  const r = reconcileNeeRelatedPartnerCash(synthetic);
  assert.equal(r.grossDistributionsInNeeIndirectOwnershipCategoryUsd, 500);
  assert.equal(r.otherOwnerCashDistributionsUsd, 100);
  assert.equal(r.cashPartitionResidualUsd, 0);
  assert.equal(r.equityRollforwardResidualUsd, 0);
  assert.equal(r.distributionsLessContributionEquityMovementUsd, 400);
  assert.equal(r.distributionsLessContributionIsCertifiedNetCash, false);
  assert.equal(r.contributionCashInNeeCategoryUsd, null);
  assert.equal(r.exactSubsetOfNee811mOperatingAffiliateCashUsd, null);
  assert.equal(r.futureCommonCashAddedUsd, 0);
});
test("refuses nonclosing/unknown/wrong basis rather than forcing NEE cash reconciliation", () => {
  assert.throws(() => reconcileNeeRelatedPartnerCash({ ...synthetic, totalPartnerCashDistributions: 1001 }));
  assert.throws(() => reconcileNeeRelatedPartnerCash({ ...synthetic, neeCategoryClosingEquity: 616 }));
  assert.throws(() => reconcileNeeRelatedPartnerCash({ ...synthetic, neeCategoryDistributions: NaN }));
  assert.throws(() => reconcileNeeRelatedPartnerCash({ ...synthetic, fiscalYear: 2023 }));
});
