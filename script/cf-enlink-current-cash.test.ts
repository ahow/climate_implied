import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileCfCurrentEconomics, extractEnlinkClosingContinuity } from "../server/calculation/cfEnlinkCurrentEconomics";
const s = { declaredExhibit: "synthetic.htm", consolidatedCashUsd: 100, bluePointJvCashUsd: 30,
  totalCapexQuarterYtdUsd: [15, 30], existingOperationsCapexQuarterYtdUsd: [6, 12],
  jvCapexQuarterYtdUsd: [4, 8], commonFacilitiesCapexQuarterYtdUsd: [3, 6], capitalizedInterestQuarterYtdUsd: [2, 4],
  quarter45qOperatingIncomeBeforeTaxUsd: 3, yearToDate45qOperatingIncomeBeforeTaxUsd: 8,
  quarter45qOperatingIncomeAfterTaxUsd: 3, yearToDate45qOperatingIncomeAfterTaxUsd: 8,
  cfJvOwnershipPercent: 40, jeraJvOwnershipPercent: 35, mitsuiJvOwnershipPercent: 25,
  actual45qCashCollectionsUsd: null, actualXomCcsFeePaymentUsd: null, actualCreditQualifiedCo2MassTonnes: null };
test("synthetic company/JV cash partition is bookcash, not distributed common excess or XOM cash", () => {
  const r = reconcileCfCurrentEconomics(s);
  assert.equal(r.consolidatedCashOutsideBluePointJvBookUsd, 70);
  assert.equal(r.observedCommonExcessCashFromJvUsd, null);
  assert.equal(r.actualCommonCashFromOutsideJvPoolUsd, null);
  assert.equal(r.xomActualProjectFundingUsd, null);
  assert.equal(r.originalXomCashAddedOrBaselineCostDeductedAgainUsd, 0);
});
test("synthetic project/common/interest capex reconciles without treating capitalized interest as extra cash", () => {
  const r = reconcileCfCurrentEconomics(s);
  assert.deepEqual(r.capexQuarterYtdResidualsUsd, [0, 0]);
  assert.equal(r.capitalizedInterestStandaloneCashPaymentUsd, null);
  assert.throws(() => reconcileCfCurrentEconomics({ ...s, totalCapexQuarterYtdUsd: [16, 30] }));
});
test("synthetic 45Q operating recognition never becomes paid taxcredits, nativeCO2 tonnes or a CCS tariff", () => {
  const r = reconcileCfCurrentEconomics(s);
  assert.equal(r.firstHalf45qOperatingIncomeBeforeTaxUsd, 5);
  assert.equal(r.actual45qCashCollectionsUsd, null);
  assert.equal(r.actualXomCcsFeePaymentUsd, null);
  assert.equal(r.actualCreditQualifiedCo2MassTonnes, null);
});
test("synthetic inconsistent ownership or cash perimeter refuses, rather than allocating missing common cash", () => {
  assert.throws(() => reconcileCfCurrentEconomics({ ...s, bluePointJvCashUsd: 101 }));
  assert.throws(() => reconcileCfCurrentEconomics({ ...s, cfJvOwnershipPercent: 41 }));
});
test("synthetic source impostor cannot certify a CCS settlement or substitute one merger for actual two-step continuity", () => {
  assert.throws(() => extractEnlinkClosingContinuity("<DOCUMENT><TYPE>8-K\n<FILENAME>fixture.htm\nTEXTfake</DOCUMENT>"));
});
