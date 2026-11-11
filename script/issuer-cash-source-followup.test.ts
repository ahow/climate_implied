import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileNewNeeCashQuarter, reconcileNewCfCounterpartyCash, reconcileHistoricalXomMvcFees } from "../server/calculation/issuerCashSourceQuarterFollowup";
import { sourceExhibit, embeddedSecJpegs } from "../server/calculation/issuerSourceExhibits";
test("synthetic source cash quarter partition preserves broader-leg mismatch and recipient/gross unknowns", () => {
  const r = reconcileNewNeeCashQuarter({ neeCategoryYtdDistributionsUsd: 20, neeCategoryThirdQuarterDistributionsUsd: 8,
    otherCategoryYtdDistributionsUsd: 3, totalRelatedYtdDistributionFinancingOutflowUsd: 23,
    xplrYtdNetCscsInvestingCashUsd: 4, neeYtdBroaderRelatedSweepFinancingCashUsd: -7,
    neerYtdServiceCostsIncurredUsd: 18, dueFromXplrBookSep30Usd: 7 },
  { categoryDistributionsUsd: 25, xplrNetCscsInvestingCashUsd: 6, neeBroaderRelatedSweepFinancingCashUsd: -10,
    neerServiceCostsIncurredUsd: 27, dueFromXplrClosingBookUsd: 10 });
  assert.equal(r.neeAggregateCategoryFourthQuarterDistributionsUsd, 5);
  assert.equal(r.neeAggregateCategoryFirstHalfDistributionsUsd, 12);
  assert.equal(r.firstNineMonthReportedLegDifferenceUsd + r.fourthQuarterReportedLegDifferenceUsd, r.annualReportedLegDifferenceUsd);
  assert.equal(r.actualServiceReimbursementCashUsd, null);
  assert.equal(r.neeEquityOnlyPortionOf61mUsd, null);
  assert.equal(r.originalNeeCommonFcfeCashAddedUsd, 0);
});
test("synthetic aggregate distribution/category mismatch refuses, never balances invented service cash", () => {
  assert.throws(() => reconcileNewNeeCashQuarter({ neeCategoryYtdDistributionsUsd: 20, neeCategoryThirdQuarterDistributionsUsd: 8,
    otherCategoryYtdDistributionsUsd: 3, totalRelatedYtdDistributionFinancingOutflowUsd: 24,
    xplrYtdNetCscsInvestingCashUsd: 4, neeYtdBroaderRelatedSweepFinancingCashUsd: -7,
    neerYtdServiceCostsIncurredUsd: 18, dueFromXplrBookSep30Usd: 7 },
  { categoryDistributionsUsd: 25, xplrNetCscsInvestingCashUsd: 6, neeBroaderRelatedSweepFinancingCashUsd: -10,
    neerServiceCostsIncurredUsd: 27, dueFromXplrClosingBookUsd: 10 }));
});
test("synthetic CF bank and funded-capex bridges do not become XOM fees or project funding", () => {
  const r = reconcileNewCfCounterpartyCash({ openingCashUsd: 100, operatingCashUsd: 30, jeraMitsuiBluePointCashContributionsUsd: 5,
    consolidatedCapexUsd: 20, cfFundedCapexUsd: 14, partnerFundedCapexUsd: 6,
    bluePointConsolidatedCapexUsd: 10, bluePointCfFundedCapexUsd: 4, chsDistributionsUsd: 2,
    shareholderReturnsUsd: 3, otherCashOutflowUsd: 1, closingCashUsd: 109 });
  assert.equal(r.consolidatedCashReconciliationResidualUsd, 0);
  assert.equal(r.actualXomFeeCashUsd, null);
  assert.equal(r.xomOwnProjectFundingUsd, null);
  assert.equal(r.directRosePermitCfCrosswalk, null);
  assert.equal(r.amountInsertedIntoXomOriginalCashflowsUsd, 0);
});
test("synthetic declared exhibits refuse missing/ambiguous or unsafe filenames", () => {
  const d = "<DOCUMENT><TYPE>EX-99.1\n<FILENAME>safe.htm\n<TEXT>fixture</TEXT></DOCUMENT>";
  assert.equal(sourceExhibit(d, "EX-99.1").name, "safe.htm");
  assert.throws(() => sourceExhibit(d + d, "EX-99.1"));
  assert.throws(() => sourceExhibit(d.replace("safe.htm", "../unsafe.htm"), "EX-99.1"));
  assert.throws(() => sourceExhibit(d, "EX-99.2"));
});
test("synthetic complete-submission UU JPEG preserves trimmed zero-padding and rejects incomplete bytes", () => {
  const bytes = [255, 216, 255, 217], row: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    row.push(...[a >> 2, ((a & 3) << 4) | (b >> 4), ((b & 15) << 2) | (c >> 6), c & 63].map(v => String.fromCharCode(v + 32)));
  }
  const sgml = `<DOCUMENT><TYPE>GRAPHIC\n<FILENAME>fixture.jpg\n<TEXT>\nbegin 644 fixture.jpg\n$${row.join("").trimEnd()}\n\`\nend\n</TEXT></DOCUMENT>`;
  assert.deepEqual(Array.from(embeddedSecJpegs(sgml)[0].bytes), bytes);
  assert.deepEqual(Array.from(embeddedSecJpegs(sgml.replace("\n`\n", "\n\n"))[0].bytes), bytes);
  assert.throws(() => embeddedSecJpegs(sgml.replace("\nend\n", "\nbroken\n")));
});
test("synthetic MVC recognition schedule never becomes current cash, cancellation, tariff or annualized long-tail fees", () => {
  const r = reconcileHistoricalXomMvcFees({ schedule: [1, 2, 3, 4, 20].map((expectedRecognitionUsd, i) =>
    ({ startYear: 2025 + i, endYear: i === 4 ? 2050 : 2025 + i, expectedRecognitionUsd })),
  allContractFeesAtJune30Usd: 100, allContractFeesAtSeptember30Usd: 80, xomNamedFootnotePresentInLaterQ3FeeTable: false,
  actualCashPaidOrCollectedUsd: null, executedPerTonneTariffUsd: null, actualGasOrTransportedVolume: null,
  exactXomContractSubsidiaryLegalName: null, currentSettlementValueUsd: null });
  assert.equal(r.historicalXomSubsidiaryMvcRecognitionScheduleUsd, 30);
  assert.equal(r.otherContractExpectedFeesAtJune30Usd, 70);
  assert.equal(r.laterAllContractFeeTableChangeUsd, -20);
  assert.equal(r.laterTableChangeCertifiedAsXomCancellationOrRecovery, false);
  assert.equal(r.laterPeriods2029To2050AllocatedAnnually, false);
  assert.equal(r.actualCashPaidOrCollectedUsd, null);
  assert.equal(r.executedPerTonneTariffUsd, null);
  assert.equal(r.amountInsertedIntoOriginalXomFcfeUsd, 0);
});
