import test from "node:test";
import assert from "node:assert/strict";
import { rebuildOperatingDriverCash, reverseOperatingDriver, makeFslrVolumeDriver, actualFcfeGrowth,
  type OperatingDriverCase } from "../server/calculation/issuerOperatingDriverReverse";
import type { OriginalIssuerInputs } from "../server/calculation/issuerOriginalOperatingCase";

// Entirely synthetic unit economics; no filesystem, real quote, private source,
// observed issuer claim or private-test skip. Actual source validation is separate.
function fixture(kind: "volume" | "margin", actualBaseFcfe = 8): OperatingDriverCase {
  const normalized = { revenue: 100, operatingProfit: 20, depreciation: 10, interest: 2,
    otherCash: 0, reinvestment: 10, claims: 0, receivables: 10, annualRollover: 4, cashTax: 3.78 };
  const input: OriginalIssuerInputs = { netPpe: 100, debt: 20, inventory: 5, otherCurrentAssets: 3, operatingPayables: 10,
    customerAdvances: 0, minimumCash: 5, additionalClaims: [], maturities2025To2029: [4, 4, 4, 4, 4],
    renewableTaxCreditCash: 0, primaryHash: "a".repeat(64), supplementHash: "b".repeat(64),
    publishedAt: "2025-02-25T21:00:00.000Z",
    reconciliation: { normalized, identity: { symbol: "ENGINEERING", cik: "0000000001",
      security: "Synthetic unit fixture, NOT an issuer source", fiscalEnd: "2024-12-31" },
    rows: [], allocation: [], residuals: {}, capitalBudgets: [], sourceAuthentication: "Synthetic code-only unit fixture",
    historical: { cfo: 0, cfi: 0, cff: 0, fx: 0, cashOpen: 0, cashClose: 0, cashChange: 0,
      unrestrictedCash: 5, operatingReconciliation: [], investingReconciliation: [], financingReconciliation: [] } },
  };
  const rows: any[] = [], funding: any[] = [], activity: any[] = [];
  let ar = 10, wc = 3;
  for (let year = 2025; year <= 2041; year++) {
    const n = year - 2024, index = 1.025 ** n, openingPpe = 100 * 1.025 ** (n - 1);
    const revenue = 100 * index, core = 20 * index, depreciation = openingPpe * .1;
    const cashPpe = depreciation + .025 * openingPpe, closePpe = openingPpe * 1.025;
    const interest = openingPpe * .2 * .1;
    const cashTax = kind === "volume" ? .21 * (core - interest) : 3.78 * index;
    const closingAr = 10 * index, closingWc = 3 * index;
    const fcfe = core + depreciation - interest - cashTax - (closingAr - ar) -
      (closingWc - wc) - cashPpe + .2 * (closePpe - openingPpe);
    rows.push({ year, cashFlowDate: `${year}-12-31`, revenue, operatingProfitBeforeClimate: core,
      operatingMarginBeforeClimateCostsAndCredits: .2, depreciation, capitalSpend: cashPpe, interestPaid: interest,
      cashTax, otherOperatingCash: 0, openingReceivables: ar, closingReceivables: closingAr,
      receivablesIncrease: closingAr - ar, increaseOtherOperatingWorkingCapital: closingWc - wc,
      cashPolicyCredit: 0, recognizedPolicyCredit: 0, nonCommonCashClaims: 0, fcfe });
    funding.push({ openingPpe, closingPpe: closePpe, openingDebt: .2 * openingPpe, closingDebt: .2 * closePpe,
      cashPpe, rollover: .2 * (.2 * openingPpe) });
    activity.push({ nonCausalNominalRevenue: revenue });
    ar = closingAr; wc = closingWc;
  }
  return { symbol: kind === "volume" ? "FSLR" : "XOM", input,
    baseline: { engineInput: { referenceDate: "2025-01-31", discountRate: .10, terminalGrowth: .025,
      baseFcfe: actualBaseFcfe, stub: { cashFlows: [{ date: "2025-12-31", fcfe: 7 }] } },
    ledger: { years: rows.slice(1, 6), continuationYears: rows.slice(6, 16), terminalYear: rows[16] }, funding, activity },
    driver: kind === "volume" ? makeFslrVolumeDriver() :
      { kind: "operating-cost-spread-change", lower: 0, upper: .05 / 9.5 * (1 - 1e-10),
        minimumMargin: .2, maximumMargin: .25, boundBasis: "Synthetic engineering margin envelope, NOT source evidence" } };
}

// Independent plain-number implementation: no interval graph, root evaluator,
// imported fade helper, shared FCFE function or old v3 builder.
function independentCash(c: OperatingDriverCase, parameter: number) {
  const volume = c.driver.kind === "global-module-volume-growth";
  let units = 1, addedMargin = 0, assets = 102.5, debt = 20.5, ar = 10.25, wc = 3.075;
  const output: { year: number; fcfe: number; capex: number; tax: number }[] = [];
  const dates = (year: number) => (Date.parse(`${year}-12-31T00:00:00Z`) - Date.parse("2025-01-31T00:00:00Z")) / (86400000 * 365.25);
  let pv = 7 / 1.1 ** dates(2025);
  for (let t = 1; t <= 16; t++) {
    const index = 1.025 ** (t + 1), weight = t <= 5 ? 1 : Math.max(0, (15 - t) / 10);
    if (volume) units *= 1 + parameter * weight;
    else addedMargin += parameter * weight;
    const sales = 100 * index * (volume ? units : 1);
    const profit = sales * (.2 + (volume ? 0 : addedMargin));
    const da = volume ? assets * .1 : 10 * 1.025 ** t;
    const closeAssets = 100 * index * (volume ? units : 1);
    const capital = closeAssets - assets + da;
    const interest = debt * .1, closeDebt = .2 * closeAssets;
    const closingAr = 10 * index * (volume ? units : 1);
    let closingWc: number, tax: number;
    if (volume) {
      closingWc = 3 * index * units;
      tax = Math.max(0, .21 * (profit - interest));
    } else {
      const costRatio = 1 - (profit - 20 * index) / (70 * index);
      closingWc = 8 * index - 5 * index * costRatio;
      tax = Math.max(0, 3.78 * index + .21 * (profit - 20 * index));
    }
    const fcfe = profit + da - interest - tax - (closingAr - ar) -
      (closingWc - wc) - capital + closeDebt - debt;
    output.push({ year: 2025 + t, fcfe, capex: capital, tax });
    if (t <= 15) pv += fcfe / 1.1 ** dates(2025 + t);
    else pv += fcfe / .075 / 1.1 ** dates(2040);
    assets = closeAssets; debt = closeDebt; ar = closingAr; wc = closingWc;
  }
  return { pv, output };
}
test("Independent physical-volume rebuild agrees in cash, growth reinvestment, financing and forward PV", () => {
  const c = fixture("volume"), manual = independentCash(c, .01), rebuilt = rebuildOperatingDriverCash(c, .01);
  assert.ok(Math.abs(rebuilt.forwardWholeEquity! - manual.pv) < 1e-9);
  rebuilt.rows.forEach((r, i) => {
    assert.ok(Math.abs(r.fcfe - manual.output[i].fcfe) < 1e-10);
    assert.ok(Math.abs(r.capex - manual.output[i].capex) < 1e-10);
    assert.ok(Math.abs(r.cashTax - manual.output[i].tax) < 1e-10);
  });
  assert.notEqual(rebuilt.rows[0].fcfe, c.baseline.ledger.years[0].fcfe * 1.01);
});
test("Independent cost-spread target reverses by rebuilding tax and inventory/payables, not scaling cash", () => {
  const c = fixture("margin"), target = independentCash(c, .001).pv;
  const result = reverseOperatingDriver(c, target);
  assert.equal(result.status, "conditional-operating-driver-target-match");
  assert.ok("impliedOperatingPerturbation" in result && Math.abs(result.impliedOperatingPerturbation! - .001) < 1e-10);
  assert.ok("impliedFcfeGrowth" in result && result.impliedFcfeGrowth?.fiveForecastStepCagr !== .001);
  assert.ok("proof" in result && result.proof.lowerDerivative > 0);
});
test("Capacity bounds and independent volume target have an interval-certified, independently repriced root", () => {
  const c = fixture("volume"), target = independentCash(c, .01).pv, result = reverseOperatingDriver(c, target);
  assert.equal(result.status, "conditional-operating-driver-target-match");
  assert.ok("impliedOperatingPerturbation" in result && Math.abs(result.impliedOperatingPerturbation! - .01) < 1e-9);
  assert.ok("rebuilt" in result && Math.abs(independentCash(c, result.impliedOperatingPerturbation!).pv / target - 1) < 1e-9);
  if (c.driver.kind === "global-module-volume-growth") {
    const outside = c.driver.upper + 1e-6;
    assert.throws(() => rebuildOperatingDriverCash(c, outside), /outside frozen/);
  }
  assert.equal("statutory45xEligibilityVerified" in result && result.statutory45xEligibilityVerified, false);
});
test("Nonpositive actual cash baseline rejects implied FCFE growth even if operating target is matched", () => {
  const c = fixture("margin", -1), result = reverseOperatingDriver(c, independentCash(c, .001).pv);
  assert.equal(result.status, "operating-target-match-rejected-undefined-fcfe-growth");
  assert.ok("impliedFcfeGrowth" in result && result.impliedFcfeGrowth?.fiveForecastStepCagr === null);
  const positiveBase = fixture("margin"), rebuilt = rebuildOperatingDriverCash(positiveBase, .001);
  const zeroEnd = { ...rebuilt, rows: rebuilt.rows.map((r, i) => i === 4 ? { ...r, fcfe: 0 } : r) };
  assert.equal(actualFcfeGrowth(positiveBase, zeroEnd).status, "rejected-nonpositive-year-five");
});
test("No-root interval exclusion and unsupported NEE driver are explicit, not sampled-grid uniqueness", () => {
  const c = fixture("margin");
  const result = reverseOperatingDriver(c, 1e6);
  assert.equal(result.status, "no-root-certified-range");
  assert.ok("proof" in result && result.proof.upperValue < 1e6);
  assert.equal(reverseOperatingDriver({ ...c, driver: { kind: "unsupported", reason: "No consolidated driver" } }, 10).status,
    "unsupported-operating-driver");
});
