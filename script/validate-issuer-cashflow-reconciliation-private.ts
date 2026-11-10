import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractIssuerCashflowReconciliation, calculateIssuerFundingConstraints,
  reviewIssuerActivityPolicy } from "../server/calculation/issuerCashflowReconciliation";

if (process.env.NODE_ENV === "production") throw new Error("Private source reconciliation validation only");
const root = "generated-artifacts/company-operating-corpus/issuer-cashflow-reconciliation-v2";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const latest = read(`${root}/latest.json`), report = read(latest.reportPath), freeze = read(latest.freezePath);
assert.equal(sha(latest.freezePath), report.freezeHash);
assert.ok(Date.parse(freeze.frozenAt) <= Date.parse(report.calculatedAt));
assert.equal(report.results.length, 3);
for (const p of [...freeze.preserved, ...freeze.code]) assert.equal(sha(p.path), p.sha256);
assert.equal(report.olderFslrCases, 10);
assert.equal(report.olderFslrRows, 50);
let lineCount = 0;
for (const result of report.results) {
  assert.equal(result.blocked, undefined, result.error);
  const source = result.source;
  assert.equal(sha(source.path), source.sha256);
  assert.equal(source.identity.fiscalEnd, "2024-12-31");
  const html = readFileSync(source.path, "utf8");
  const replay = extractIssuerCashflowReconciliation(html, source.identity);
  // JSON serialization canonically represents signed zero in historical zero
  // cash outflows as zero; no economic cash amount or source identity differs.
  assert.equal(JSON.stringify(replay), JSON.stringify(result.reconciliation));
  assert.deepEqual(calculateIssuerFundingConstraints(replay), result.fundingConstraints);
  assert.deepEqual(reviewIssuerActivityPolicy(html, source.identity), result.activityPolicy);
  assert.ok(Object.values(replay.residuals).every(value => Math.abs(value) < .01));
  assert.equal(result.activityPolicy.qualifiedOriginalTerminalCases, 0);
  assert.equal(result.activityPolicy.qualifiedOriginalMarketPairs, 0);
  assert.match(result.fundingConstraints.terminalAssessment, /^WITHHELD/);
  lineCount += replay.rows.length;
  const cfoRow = replay.rows.find(r => r.name === "us-gaap:NetCashProvidedByUsedInOperatingActivities")!;
  const corrupt = html.replace(new RegExp(`(<ix:nonFraction[^>]*id="${cfoRow.id}"[^>]*>)([^<]+)`),
    (_match, prefix, value) => `${prefix}${value}1`);
  assert.notEqual(corrupt, html);
  assert.throws(() => extractIssuerCashflowReconciliation(corrupt, source.identity), /reconciliation/);
  if (source.identity.symbol === "NEE") {
    assert.equal(replay.rows.length, 70);
    assert.equal(replay.normalized.nuclearAmortization, 299e6);
    assert.equal(replay.normalized.nuclearFuel, 399e6);
    assert.equal(replay.residuals.cashClassification, 0);
    assert.equal(replay.residuals.commonIncomeAllocation, 0);
    assert.equal(replay.normalized.otherNciBook, 1297e6);
    assert.equal(replay.normalized.hlbvAccountingIncome, 1329e6);
    assert.equal(replay.normalized.observedDmiCashPayments, 740e6);
    assert.deepEqual(replay.capitalBudgets, [19470e6, 18005e6, 13745e6, 11640e6, 11780e6]);
  }
  if (source.identity.symbol === "XOM") {
    assert.equal(replay.normalized.affiliateCash, 6385e6);
    assert.equal(replay.normalized.interest, 624e6);
    assert.equal(replay.residuals.cashInterest, 0);
    assert.equal(result.fundingConstraints.annualSourceLevelCommonCashBeforeGrowth, 24290e6);
    assert.equal(result.activityPolicy.channels[0].tariffUsdPerTonne, null);
  }
  if (source.identity.symbol === "FSLR") {
    assert.equal(replay.normalized.operatingProfit, 379184e3);
    assert.equal(replay.normalized.debt, 609778e3);
    assert.equal(replay.normalized.reinvestment, 444102e3);
    assert.equal(replay.normalized.noncurrentGrantReceivable, 157570e3);
    assert.equal(result.fundingConstraints.currentGrantReceivable, 403759e3);
    assert.equal(result.fundingConstraints.conditionalCashReserve.observedExcessCash, null);
    assert.ok(result.activityPolicy.channels[0].notProxy.includes("US customer"));
  }
}
assert.equal(lineCount, 166);
assert.equal(report.newlyQualifiedOriginalIssuerCases, 0);
assert.equal(report.newlyQualifiedOriginalMarketPairs, 0);
assert.equal(report.newNetworkRequests, 0);
console.log(JSON.stringify({ status: "passed", authenticatedIssuerReconciliations: 3,
  exactPrimaryMonetaryFacts: lineCount, completeHistoricalCfoCfiCffReconciliations: 3,
  cashChangeAndBalanceReconciliations: 3, cashInterestClassificationChecks: 1,
  restrictedCashClassificationChecks: 1, approvedCapitalBudgetYears: 5,
  activityGeographyPolicyReviews: 3, originalTerminalGrowthRange: [.025, .04],
  originalQualifiedIssuerCases: 0, originalQualifiedMarketPairs: 0,
  neitherPriorExperimentReexecuted: true, retainedFslr10Cases50Rows: true, newNetworkRequests: 0 }));
