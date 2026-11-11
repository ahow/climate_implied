import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNeeWaterfall, neeCashReturnAnchors, neeHistoricalWaterfall, extractNeeWaterfallFacts,
  type NeeFacts, type NeeFundingInput } from "../server/calculation/neeProjectCashWaterfall";
// Public engineering fixtures are entirely SYNTHETIC; no private files, source exports or network.
const facts: NeeFacts = {
  claims: [],
  nee: { cfo: 100, investing: -80, financing: -4, interest: 10, cashTax: -5,
    wcCurrentAssets: -2, wcNoncurrentAssets: -3, wcCurrentLiabilities: 1, wcNoncurrentLiabilities: 1,
    costRecovery: 6, storm: -4, da: 20, nuclearAmortization: 3, fuel: 4, ppe: 1000,
    ltProceeds: 20, ltRepayments: 12, cp: -2, stProceeds: 3, stRepayments: 4, otherFinancing: -3,
    longDebt: 400, dmiInflow: 8, dmiPayment: -4, swept: -1, commonIssued: 1, commonDividends: 10,
    affiliateCash: 2, policyCash: 7, fx: -1, cashChange: 15 },
  fpl: { cfo: 60, investing: -40, financing: -12, interest: 4, cashTax: 3,
    wcCurrentAssets: -1, wcNoncurrentAssets: -1, wcCurrentLiabilities: 0, wcNoncurrentLiabilities: 0,
    costRecovery: 6, storm: -4, da: 12, nuclearAmortization: 2, fuel: 3, ppe: 600,
    ltProceeds: 10, ltRepayments: 4, cp: -1, stProceeds: 0, stRepayments: 1,
    otherFinancing: -1, parentContribution: 5, parentDividend: 20, cashChange: 8 },
  budgets: { fpl: [40,40,40,40,40], other: [40,30,20,10,10],
    fplAfudc: [1,1,1,1,1], otherAfudc: [1,1,1,1,1] },
  narrative: { dmiOpening: 20, dmiClosing: 23, hlbv: 2, windMw: 1, solarMw: 2, storageMw: 3,
    historicOtherReserve: 3, neerNetMw: 3, neerUSNetMw: 2, neerCanadaNetMw: 1, windOperatedMw: 2, windNetMw: 1 },
};
const input: NeeFundingInput = { debt: 500, netPpe: 1000, inventory: 10, otherCurrentAssets: 5,
  minimumCash: 20, operatingPayables: 8, customerAdvances: 0, maturities2025To2029: [5,6,7,8,9],
  reconciliation: { normalized: { receivables: 12, corporateCapex: 0, fundNet: 1, otherInvesting: 1, annualRollover: 12 } } };
const original = { referenceDate: "2025-01-31", baseFcfe: 1, costOfEquity: .1,
  opening2026WorkingFunding: 40, opening2026Debt: 520,
  stub: { cashFlows: [{ date: "2025-12-31", fcfe: -2 }] } };
const build = (mode: "opening-capital-yield" | "budget-completion-delay" = "opening-capital-yield",
  policy: "retained-cohort-runoff" | "zero-future-policy-cash" = "retained-cohort-runoff", g = .025) =>
  buildNeeWaterfall(facts, input, { operatingMode: mode, policyMode: policy, terminalGrowth: g }, original);
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test("Synthetic normalization removes signed tax/WC and clause/storm once; never HLBV income", () => {
  const a = neeCashReturnAnchors(facts);
  close(a.consolidated, 100 + 10 - 5 - (-2 - 3 + 1 + 1) - 6 + 4 - 2);
  close(a.fpl, 60 + 4 + 3 - (-1 - 1) - 6 + 4);
  close(a.other, a.consolidated - a.fpl);
  const changed = structuredClone(facts); changed.narrative.hlbv = 1e8;
  assert.deepEqual(neeCashReturnAnchors(changed), a);
});
test("Synthetic gross funding/parent bridge identifies net versus gross cash", () => {
  const w = neeHistoricalWaterfall(facts);
  close(w.neeFinancing, 20 - 12 - 2 + 3 - 4 + 8 - 4 - 1 + 1 - 10 - 3);
  close(w.fplCashBeforeParent, 60 - 40 + 10 - 4 - 1 - 1 - 1);
  close(w.netParentCash, 15);
  assert.equal(w.unknownOtherGrossOutflow, null);
  assert.equal(w.unknownOtherGrossInflow, null);
});
test("Independent synthetic cash rebuild funds nuclear/amortization, reserves and both debt legs", () => {
  const result = build(), a = neeCashReturnAnchors(facts);
  for (const r of result.rows) {
    const gross = r.earningPpe[0] * a.fplCashYield + r.earningPpe[1] * a.otherCashYield;
    const tax = .21 * Math.max(0, gross + 2 * r.priceIndex - r.fixedDa[0] -
      r.fixedDa[1] - 3 * r.priceIndex - r.openingDebt * .02);
    const wc = 39 * (r.closingPpe[0] + r.closingPpe[1]) / 1000 + r.afudcCashClassificationReserve;
    const cash = gross + 2 * r.priceIndex - r.openingDebt * .02 - tax + r.policyCash -
      (wc - r.openingWc) - (r.capitalPpe[0] + r.capitalPpe[1] + 4 * r.priceIndex + 2 * r.priceIndex) +
      r.debtProceeds - r.debtRepayments - 7 * r.priceIndex;
    close(r.fcfe, cash);
    for (let i = 0; i < 2; i++) {
      close(r.closingPpe[i], r.openingPpe[i] + r.capitalPpe[i] + r.componentFuel[i] -
        r.fixedDa[i] - r.componentNuclearAndOtherAmortization[i]);
      assert.ok(r.capitalPpe[i] + r.componentFuel[i] + 1e-10 >=
        r.fixedDa[i] + r.componentNuclearAndOtherAmortization[i] + r.nominalGrowth * r.openingPpe[i]);
    }
    close(r.debtProceeds - r.debtRepayments, r.closingDebt - r.openingDebt);
    close(r.commonCall, Math.max(0, -cash));
  }
  close(result.rows[0].openingWc, 40);
  close(result.rows[0].afudcCashClassificationReserve, 2 * 1.0325 + 2);
  close(result.opening2025Bridge.closingDebt, 520);
  close(result.opening2025Bridge.fuelAmortizationBookCorrectionToOldFixedOnlyProxy, 1.0325);
  assert.deepEqual(result.originalStubUnchanged, original.stub);
});
test("Separate policy and construction-delay channels rebuild cash, not EPS or all-green revenue", () => {
  const yes = build(), no = build("opening-capital-yield", "zero-future-policy-cash"), delay = build("budget-completion-delay");
  yes.rows.forEach((r, i) => {
    close(r.fcfe - no.rows[i].fcfe, r.policyCash);
    assert.deepEqual(r.closingPpe, no.rows[i].closingPpe);
    if (r.year >= 2030) close(r.fcfe, delay.rows[i].fcfe);
    else assert.ok(delay.rows[i].grossOperatingCash <= r.grossOperatingCash);
    if (r.year >= 2039) close(r.policyCash, 0);
  });
});
test("Independent terminal/stub/headroom PV; terminal is fully funded at every original g", () => {
  for (const g of [.025,.0325,.04]) {
    const r = build("opening-capital-yield", "zero-future-policy-cash", g);
    const df = (year: number) => 1.1 ** (-(Date.parse(`${year}-12-31`) - Date.parse("2025-01-31")) / 31557600000);
    const explicit = r.rows.slice(0,15).reduce((s, x) => s + x.fcfe * df(x.year), 0);
    const tail = r.rows[15].fcfe / (.1 - g) * df(2040);
    close(r.formalSignedPlanPv, -2 * df(2025) + explicit + tail);
    close(r.rows[15].fcfe, r.rows[14].fcfe * (1 + g));
    const j = r.fundedPlanExtraGrossClaimHeadroom2024Usd;
    const afterUnknown = -2 * df(2025) + r.rows.slice(0,15).reduce((s,x) =>
      s + (x.fcfe - j * x.priceIndex) * df(x.year), 0) +
      (r.rows[15].fcfe - j * r.rows[15].priceIndex) / (.1 - g) * df(2040);
    close(afterUnknown, 0);
    assert.equal(r.qualifiedOriginalIssuers, 0);
    assert.equal(r.unboundedUnidentifiedGrossNoncommonCash, true);
  }
});
test("Invalid sources/bases are explicit refusals, no fallback or nonpositive CAGR", () => {
  assert.throws(() => extractNeeWaterfallFacts("<html>No private source fixture</html>"), /Missing actual/);
  assert.throws(() => buildNeeWaterfall(facts, input, { terminalGrowth: .025,
    operatingMode: "opening-capital-yield", policyMode: "zero-future-policy-cash" }, { ...original, baseFcfe: -1 }), /positive-base/);
  assert.throws(() => buildNeeWaterfall(facts, input, { terminalGrowth: .025,
    operatingMode: "opening-capital-yield", policyMode: "zero-future-policy-cash" }, { ...original, costOfEquity: NaN }), /discount/);
});
