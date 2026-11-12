import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildPublicProducerReserveReport, calculateProducerReservePath, calculateProducerReplacementPath,
  solveProducerReserveDecline, solveProducerReplacementDecline, qualifyProducerReserveCandidates,
  producerReserveDomainHash } from "../server/calculation/producerReserveModel";
import { producerReserveFacts as facts } from "../server/calculation/producerReserveEvidence";
import { producerReserveFreezeEvidence as freeze } from "../server/calculation/producerReserveFreeze";
import type { ProducerReplacementPlan } from "../shared/producerReserveSchema";

test("public freeze evidence contract is portable metadata, not private chronology authentication", () => {
  assert.equal(freeze.domainHash, producerReserveDomainHash);
  assert.equal(freeze.modelSemanticHash, buildPublicProducerReserveReport().hashes.model);
  assert.match(freeze.freezeSha256, /^[a-f0-9]{64}$/);
  assert.match(freeze.postFreezeChange, /Mechanical ES target compatibility/);
});

test("actual consolidated reserve, producing-income and standardized-cash identities reconcile", () => {
  const report = buildPublicProducerReserveReport();
  for (const key of ["reserveRollforwardResidualMillionBoe", "standardizedCashResidualUsdMillion",
    "standardizedDiscountResidualUsdMillion", "producingIncomeResidualUsdMillion",
    "revenueResidualUsdMillion", "costsIncurredResidualUsdMillion"])
    assert.equal(report.reconciliation[key], 0, key);
  assert.equal(report.target.valueUsdMillion, 151494);
  assert.notEqual(report.target.valueUsdMillion, 185664); // Combined affiliate total is incompatible.
});

test("actual sold-volume gas conversion differs explicitly from reserve-withdrawal denominator", () => {
  const h = buildPublicProducerReserveReport().historical;
  assert.ok(Math.abs((h.annualSoldVolumeProxyMillionBoe as number) - (1858 + 423 + 374 + 62 + 5438 / 6) * 366 / 1000) < 1e-10);
  assert.notEqual(h.annualSoldVolumeProxyMillionBoe, 1355);
  assert.notEqual(h.proxyMinusReportedProducingRevenueUsdMillion, 0);
});

test("finite stock path conserves reserves and cash without DD, debt or duplicated reinvestment", () => {
  const path = calculateProducerReservePath(0.08);
  let cumulative = 0;
  for (const row of path.annualRows) {
    assert.ok(row.production >= 0 && row.production <= row.openingReserves);
    assert.ok(Math.abs(row.openingReserves - row.production - row.closingReserves) < 1e-10);
    assert.ok(Math.abs(row.revenue - row.productionCostsIncludingAbandonment - row.developmentCapex -
      row.cashTaxes - row.deltaWorkingCapital - row.unleveredCashFlow) < 1e-9);
    cumulative += row.production;
  }
  assert.ok(Math.abs(cumulative + path.remainingReserves - facts.reserves.closing) < 1e-8);
  assert.ok(path.remainingReserves > 0); // Finite truncation, never assume complete extraction.
});

test("actual diagnostic inverse is finite unique in certified frozen domain, not market/equity", () => {
  assert.ok(facts.reserves.closing > 2 * -facts.reserves.production);
  const r = buildPublicProducerReserveReport();
  assert.equal(r.baseResult.status, "unique-conditional-root");
  assert.ok(Math.abs(r.baseResult.decline! - 0.029773550345562394) < 1e-10);
  assert.ok(Math.abs(r.baseResult.residualUsdMillion!) < 1e-6);
  assert.equal(r.marketImpliedDecline, null);
  assert.equal(r.marketEquityTarget, null);
  assert.equal(r.fcfe, null);
  assert.equal(r.ownerApproved, false);
  assert.equal(r.scienceAccepted, false);
});

test("strict monotonic certificate is consistent with actual path over whole frozen grid", () => {
  let previous = Infinity;
  for (let n = 0; n <= 80; n++) {
    const value = calculateProducerReservePath(n / 1000).value;
    assert.ok(value < previous);
    previous = value;
  }
});

test("actual sensitivity results preserve four no-root outcomes without widening domain", () => {
  const rows = buildPublicProducerReserveReport().sensitivityRows;
  assert.equal(rows.length, 7);
  assert.equal(rows.filter(r => r.result.status === "no-root").length, 4);
  assert.equal(rows.filter(r => r.result.status === "unique-conditional-root").length, 3);
  for (const row of rows) assert.equal(row.result.domainHash, producerReserveDomainHash);
});

test("no target, no-root, multiple roots, uncertified and whole-equity mappings refuse", () => {
  assert.equal(solveProducerReserveDecline(null).status, "nonidentified");
  assert.equal(solveProducerReserveDecline(1e9).status, "no-root");
  assert.equal(solveProducerReserveDecline(151494, undefined, "whole-equity").status, "unsupported-basis");
  assert.equal(solveProducerReserveDecline(151494, { discountRate: 0, revenueMultiplier: 1, costMultiplier: 1 }).status, "nonidentified");
  assert.equal(qualifyProducerReserveCandidates([0.01, 0.02], true).status, "multiple-roots");
  assert.equal(qualifyProducerReserveCandidates([0.01], false).status, "nonidentified");
  assert.equal(solveProducerReplacementDecline().status, "nonidentified");
});

function conditionalTestPlan(): ProducerReplacementPlan {
  return {
    label: "SYNTHETIC CONTRACT TEST ONLY, not an actual issuer replacement scenario",
    basis: "explicit-conditional-not-observed", moneyBasis: "same fixed-dollar USD million as reserve diagnostic",
    annual: Array.from({ length: 100 }, (_, i) => ({ year: 2025 + i, additionsMillionBoe: i === 0 ? 10 : 0,
      requestedIncrementalProductionMillionBoe: i < 2 ? 5 : 0,
      replacementCashCapexUsdMillion: i === 0 ? 20 : 0, revenuePerBoe: 50,
      operatingAndProductionTaxCostPerBoe: 10, cashIncomeTaxPerBoe: 5,
      deltaWorkingCapitalUsdMillion: i === 0 ? 2 : i === 1 ? -2 : 0,
      evidenceOrConditionalJustification: "Synthetic unit-test assumption only; never a production/observed input" })),
  };
}
test("replacement forward contract separates two stocks, old development and new cash capex/WC", () => {
  const base = calculateProducerReservePath(0.03);
  const plan = conditionalTestPlan();
  const replacement = calculateProducerReplacementPath(0.03, plan);
  const first = replacement.annualRows[0], second = replacement.annualRows[1];
  assert.equal(first.closingReplacementReserves, 5);
  assert.equal(second.closingReplacementReserves, 0);
  assert.equal(first.replacementCapex, 20);
  assert.equal(first.developmentCapex, base.annualRows[0].developmentCapex);
  assert.equal(first.replacementFcff, 5 * (50 - 10 - 5) - 20 - 2);
  assert.equal(second.replacementFcff, 5 * (50 - 10 - 5) + 2);
  assert.equal(replacement.remainingReplacementReserves, 0);
  assert.equal(replacement.terminalValue, 0);
  for (const row of replacement.annualRows)
    assert.ok(Math.abs(row.totalOpeningReserves + row.replacementAdditions - row.totalProduction - row.totalClosingReserves) < 1e-9);
});

test("replacement missing years, negative additions and missing source/conditional basis fail explicitly", () => {
  const missing = conditionalTestPlan(); missing.annual.pop();
  assert.throws(() => calculateProducerReplacementPath(0.03, missing), /100 years/);
  const negative = conditionalTestPlan(); negative.annual[0].additionsMillionBoe = -1;
  assert.throws(() => calculateProducerReplacementPath(0.03, negative), /Invalid/);
  const unsupported = conditionalTestPlan(); unsupported.annual[0].evidenceOrConditionalJustification = "";
  assert.throws(() => calculateProducerReplacementPath(0.03, unsupported), /Invalid/);
});

test("public aggregate report is deterministic and source-qualified without private reads", () => {
  assert.deepEqual(buildPublicProducerReserveReport(), buildPublicProducerReserveReport());
  const source = readFileSync("server/calculation/producerReserveModel.ts", "utf8");
  assert.doesNotMatch(source, /readFileSync|process\.env|fetch\(|executeSql/);
  assert.ok(buildPublicProducerReserveReport().sourceGaps.some(g => g.includes("pending independent")));
});
