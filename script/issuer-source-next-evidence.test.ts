import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractXplr2026ReleaseCash, reconcileXplr2026ReleaseCash } from "../server/calculation/issuerCashSourceQuarterFollowup";
import { extractWilliams2026CcsAnnouncement } from "../server/calculation/xomSourceInputQualification";

// Minimal attributed public rows transcribed from the new release; not a full-source republication.
const cashRows: [string, string, string][] = [
  ["Net cash provided by operating activities", "407", "553"],
  ["Net cash provided by (used in) investing activities", "(467)", "897"],
  ["Net cash used in financing activities", "(397)", "(1,003)"],
  ["NET INCREASE (DECREASE) IN CASH, CASH EQUIVALENTS AND RESTRICTED CASH", "(457)", "447"],
  ["CASH, CASH EQUIVALENTS AND RESTRICTED CASH – BEGINNING OF PERIOD", "1,023", "328"],
  ["CASH, CASH EQUIVALENTS AND RESTRICTED CASH – END OF PERIOD", "566", "775"],
  ["Payments from related parties under CSCS agreement – net", "7", "114"],
  ["Partner contributions", "89", "5"], ["Partner distributions", "(85)", "(395)"],
  ["Payments to Class B noncontrolling interest investors", "(67)", "(71)"],
  ["Buyout of Class B noncontrolling interest investors", "(149)", "(1,150)"],
  ["Proceeds from differential membership investors", "261", "178"],
  ["Payments to differential membership investors", "(142)", "(28)"],
  ["Buyout of differential membership investors", "(181)", "(75)"],
  ["Capital expenditures and other investments", "(510)", "(684)"]
];
const nonGaapRows: [string, string, string, string, string][] = [
  ["Adjusted EBITDA", "471", "455", "1,429", "1,482"],
  ["Tax credits(a)", "(112)", "(103)", "(487)", "(517)"],
  ["Cash interest paid", "(147)", "(128)", "(330)", "(218)"],
  ["Payments to Class B noncontrolling investors", "(34)", "(31)", "(67)", "(69)"],
  ["Payments to tax equity investors", "(8)", "(5)", "(20)", "(27)"],
  ["Capital maintenance and other", "(6)", "(9)", "(15)", "(17)"],
  ["Free cash flow before growth", "164", "179", "510", "634"]
];
const table = (rows: string[][]) => rows.map(row => `| ${row.join(" | ")} |`).join("\n");
const fixture = `XPLR Infrastructure, LP reports third-quarter 2026 financial results
Nov. 3, 2026 PRELIMINARY
Reconciliation of Net Income (Loss) to Adjusted EBITDA
(millions)
| 2026 | | 2025 | | 2026 | | 2025 |
${table(nonGaapRows)}
CONDENSED CONSOLIDATED BALANCE SHEETS
CONDENSED CONSOLIDATED STATEMENTS OF CASH FLOWS
(millions)
Nine Months Ended September 30,
| 2026 | | 2025 |
${table(cashRows)}`;

test("new actual XPLR rows reconcile consolidated cash and distinct FCFBG, not NEE cash", () => {
  const s = extractXplr2026ReleaseCash(fixture), r = reconcileXplr2026ReleaseCash(s);
  assert.equal(s.classBBuyoutSignedUsd, -149e6);
  assert.equal(s.differentialMembershipBuyoutSignedUsd, -181e6);
  assert.equal(s.netCscsInvestingCashUsd, 7e6);
  assert.equal(r.cashReconciliationResidualUsd, 0);
  assert.equal(r.cashChangeResidualUsd, 0);
  assert.equal(r.nonGaapReconciliationResidualUsd, 0);
  assert.equal(r.consolidatedNetPartnerCashUsd, 4e6);
  assert.equal(r.nonGaapMinusOperatingCashUsd, 103e6);
  assert.equal(r.gaapMinusNonGaapInvestorPaymentMagnitudeUsd, 122e6);
  for (const k of ["grossCscsWithdrawalsUsd", "grossCscsRepaymentsUsd", "neeLegalRecipientDistributionsUsd",
    "neeServiceReimbursementCashUsd", "projectCommissioningMarginalReturns", "contractualAvailableCash"] as const)
    assert.equal(r[k], null);
  assert.equal(r.originalNeeCommonFcfeCashAddedUsd, 0);
});
test("source adapter refuses wrong date, units, column ordering, duplicate or malformed row", () => {
  for (const bad of [
    fixture.replace("Nov. 3, 2026", "Nov. 3, 2025"),
    fixture.replaceAll("(millions)", "(thousands)"),
    fixture.replace("| 2026 | | 2025 |", "| 2025 | | 2026 |"),
    fixture + "\n| Partner contributions | 89 | 5 |",
    fixture.replace("| Partner contributions | 89 | 5 |", "| Partner contributions | unknown | 5 |")
  ]) assert.throws(() => extractXplr2026ReleaseCash(bad));
});
test("no balancing cash, investor or date substitution when reconciliation fails", () => {
  const s = extractXplr2026ReleaseCash(fixture);
  assert.throws(() => reconcileXplr2026ReleaseCash({ ...s, closingCashIncludingRestrictedUsd: 565e6 }));
  assert.throws(() => reconcileXplr2026ReleaseCash({ ...s, freeCashBeforeGrowthUsd: 511e6 }));
  assert.throws(() => reconcileXplr2026ReleaseCash({ ...s, operatingCashUsd: NaN }));
  assert.throws(() => reconcileXplr2026ReleaseCash({ ...s, cashChangeUsd: -456e6 }));
});
test("actual Williams announcement is bounded contract capacity, not an executed fee/novation or cash", () => {
  const minimal = "News releaseJuly 28, 2026 Williams selects ExxonMobil for CO2 transportation and storage " +
    "We’re contracted to transport and store up to 1 MTA of CO2 from " +
    "Williams’ natural gas gathering and processing facility in southwest Louisiana. " +
    "This is our seventh commercial contract, for a total of ~9 MTA";
  const r = extractWilliams2026CcsAnnouncement(minimal);
  assert.equal(r.announcedAnnualCo2UpperTonnes, 1e6);
  assert.equal(r.executedInstrumentAcquired, false);
  for (const key of ["feePerTonneUsd", "minimumBillingsUsd", "enlinkAssignmentOrNovation",
    "actualServicedCo2Tonnes", "invoicedOrCollectedUsd", "operatingExpensesUsd", "fundedProjectCapitalUsd"] as const)
    assert.equal(r[key], null);
  assert.equal(r.amountInsertedIntoXomOriginalCashflowsUsd, 0);
  assert.throws(() => extractWilliams2026CcsAnnouncement(minimal.replace("up to 1 MTA", "1 MTA serviced")));
  assert.throws(() => extractWilliams2026CcsAnnouncement(minimal.replace("2026", "2024")));
});
test("receipt distinguishes new acquisitions, denied source and unresolved FSLR fields; frozen inputs preserved", () => {
  const doc = JSON.parse(readFileSync("docs/issuer-source-next-evidence.json", "utf8"));
  assert.equal(doc.acquisition.directRequests, 4);
  assert.equal(doc.acquisition.directDenied, 1);
  assert.equal(doc.acquisition.searchCalls, 3 + 2);
  assert.equal(doc.acquisition.retriesOrBypasses, 0);
  assert.equal(doc.results.qualifiedOriginalIssuers, 0);
  assert.equal(doc.results.actualSourceAdapterExecutionExitCode, 0);
  assert.equal(doc.sourceRecords.length, 4);
  assert.equal(doc.fieldAssessment.FSLR.currentCompanyEligibilityCertified, false);
  assert.equal(doc.fieldAssessment.FSLR.programmeCashUsd, null);
  for (const [path, expected] of Object.entries(doc.preservedHashes)) {
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), expected, path);
  }
});
