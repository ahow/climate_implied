import test from "node:test";
import assert from "node:assert/strict";
import { buildPaidCapacityCase, paidCapacityBound, type PaidCapacitySources } from "../server/calculation/fslrPaidSpareCapacityCase";
import type { OriginalIssuerInputs } from "../server/calculation/issuerOriginalOperatingCase";
// Synthetic engineering economics, NOT private issuer observations; no filesystem/network.
const sources: PaidCapacitySources = { existingNameplateWatts: 21e9, plannedAdditionalWatts: 4e9, producedWatts2024: 15.5e9,
  soldWatts2024: 14.1e9, guidedSoldWatts2025: 19e9, guidedProductionRange2025: [18e9, 19e9],
  remainingFacilityInvestment2025: 7, capexRange2025: [13, 15], rawMaterials: 3, workInProcess: 2,
  finishedGoods: 4, currentInventory: 8, noncurrentInventory: 1, cashPaidObservation: false };
function fixture() {
  const o = { revenue: 100, depreciation: 10, operatingProfit: 20, otherCash: -1, interest: 2 };
  const input = { inventory: 8, otherCurrentAssets: 3, minimumCash: 5, operatingPayables: 6, customerAdvances: 4,
    reconciliation: { normalized: o } } as unknown as OriginalIssuerInputs;
  const funding: any[] = [{ openingPpe: 100, cashPpe: 14, fixedDepreciation: 10, closingPpe: 104,
    openingDebt: 20, closingDebt: 20.8 }];
  const rows: any[] = [];
  for (let i = 0; i < 16; i++) {
    const q = 1.025 ** i, open = 104 * q, close = open * 1.025;
    funding.push({ openingPpe: open, closingPpe: close, cashPpe: .125 * open, fixedDepreciation: .1 * open,
      openingDebt: .2 * open, closingDebt: .2 * close });
    rows.push({ year: 2026 + i, cashFlowDate: `${2026 + i}-12-31`, revenue: 100 * q,
      operatingProfitBeforeClimate: 20 * q, depreciation: .1 * open, otherNonCash: 0,
      otherOperatingCash: -q, cashPolicyCredit: i < 8 ? 10 : 0, recognizedPolicyCredit: i < 8 ? 10 : 0,
      openingReceivables: i === 0 ? 10 : 10 * 1.025 ** (i - 1), closingReceivables: 10 * q,
      interestPaid: .02 * open, capitalSpend: .125 * open, debtProceeds: 5 + .2 * (close - open),
      debtRepayments: 5, nonCommonCashClaims: 0 });
  }
  return { input, baseline: { engineInput: { symbol: "FSLR", currency: "USD", terminalGrowth: .025,
    discountRate: .10, referenceDate: "2025-02-21", baseFcfe: -2, stub: { cashFlows: [{ date: "2025-12-31", fcfe: 3 }] } },
    ledger: { years: rows.slice(0, 5), continuationYears: rows.slice(5, 15), terminalYear: rows[15] },
    activity: [{ nonCausalNominalRevenue: 100 }], funding } };
}
test("Independent paid-capacity cash rebuild: marginal contribution, buffers, investment, debt and dated value", () => {
  const { input, baseline } = fixture(), rho = .005;
  const result = buildPaidCapacityCase(input, sources, baseline, { availableWatts: 25e9,
    unitGrowthPerturbation: rho, cashCostMode: "all-cash-cost-variable", creditMode: "inherited-source-law" });
  let m = 1, oldAr = 10, oldWc = 6, oldNc = 1;
  const time = (y: number) => (Date.parse(`${y}-12-31`) - Date.parse("2025-02-21")) / (86400000 * 365.25);
  let pv = 3 / 1.1 ** time(2025);
  result.rows.forEach((r, i) => {
    const n = i + 1, q = 1.025 ** i, w = n <= 5 ? 1 : Math.max(0, (15 - n) / 10);
    m *= 1 + rho * w;
    const da = 10.4 * q, core = (20 * q + da) * m - da;
    const ar = 10 * q * m, wc = 6 * q + (3 + 5 - 6) * q * (m - 1) + 9 * q * (m - 1);
    const nc = q, interest = 2.08 * q, tax = Math.max(0, core - q * m - interest) * .21;
    const cfo = core + da - q * m + (i < 8 ? 10 : 0) - (ar - oldAr) - (wc - oldWc) - interest - tax;
    const fcfe = cfo - 13 * q - (nc - oldNc) + .52 * q;
    assert.ok(Math.abs(r.fcfe - fcfe) < 1e-9);
    assert.ok(Math.abs(r.operatingCashFlow - cfo + nc - oldNc) < 1e-9);
    assert.ok(Math.abs(r.capitalSpend - 13 * q) < 1e-9);
    assert.equal(r.closingPpe, baseline.funding[i + 1].closingPpe);
    assert.ok(Math.abs(r.producedWattsAssumed - r.soldWatts) < 1e-6);
    assert.ok(Math.abs(r.cashPolicyCredit - (i < 8 ? 10 : 0)) < 1e-9);
    pv += i < 15 ? fcfe / 1.1 ** time(2026 + i) : fcfe / .075 / 1.1 ** time(2040);
    oldAr = ar; oldWc = wc; oldNc = nc;
  });
  assert.ok(Math.abs(result.formalSignedCashSum - pv) < 1e-8);
  assert.equal(result.actualFcfeGrowth.status, "rejected-nonpositive-actual-baseline");
});
test("Source D&A wear reserve is real extra cash expense, not new PP&E or invented margin benefit", () => {
  const { input, baseline } = fixture(), common = { availableWatts: 25e9, unitGrowthPerturbation: .005,
    creditMode: "inherited-source-law" as const };
  const upside = buildPaidCapacityCase(input, sources, baseline, { ...common, cashCostMode: "all-cash-cost-variable" });
  const downside = buildPaidCapacityCase(input, sources, baseline, { ...common, cashCostMode: "additional-da-wear-reserve" });
  assert.ok(downside.rows[15].fcfe < upside.rows[15].fcfe);
  downside.rows.forEach((r, i) => {
    assert.ok(Math.abs(r.coreProfit - baseline.ledger.terminalYear.operatingProfitBeforeClimate *
      1.025 ** (i - 15) * r.unitMultiplier) < 1e-9);
    assert.equal(r.closingPpe, upside.rows[i].closingPpe);
  });
});
test("Zero post-stub credit valuation changes cash once; no new US eligibility or terminal asset release", () => {
  const { input, baseline } = fixture(), common = { availableWatts: 25e9, unitGrowthPerturbation: .005,
    cashCostMode: "all-cash-cost-variable" as const };
  const yes = buildPaidCapacityCase(input, sources, baseline, { ...common, creditMode: "inherited-source-law" });
  const no = buildPaidCapacityCase(input, sources, baseline, { ...common, creditMode: "all-post-stub-credit-value-zero" });
  assert.equal(yes.stubPv, no.stubPv);
  no.rows.forEach((r, i) => {
    assert.ok(Math.abs(yes.rows[i].fcfe - r.fcfe - yes.rows[i].cashPolicyCredit) < 1e-9);
    assert.equal(r.cashPolicyCredit, 0); assert.equal(r.recognizedPolicyCredit, 0);
  });
  assert.equal(no.additionalEligibleUsCredit, 0); assert.equal(no.terminalReserveRelease, 0);
  assert.equal(no.legacyForecastCreditReceivableUnreleased, 2.5);
});
test("Capacity and existing funded plant constraints are strict; no sampled-grid/root claim", () => {
  const { input, baseline } = fixture();
  const bound = paidCapacityBound(19e9, 21e9);
  const common = { availableWatts: 21e9, cashCostMode: "all-cash-cost-variable" as const, creditMode: "inherited-source-law" as const };
  const result = buildPaidCapacityCase(input, sources, baseline, { ...common, unitGrowthPerturbation: bound });
  assert.ok(result.rows.every(r => r.producedWattsAssumed <= 21e9));
  assert.throws(() => buildPaidCapacityCase(input, sources, baseline, { ...common, unitGrowthPerturbation: bound + .000001 }), /bound/);
  assert.equal(result.reverseScoringPerformed, false);
});
