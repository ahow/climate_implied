import { test } from "node:test";
import assert from "node:assert/strict";
import { companyCoverage } from "../server/calculation/companyCoverage";
import { positivePE } from "../server/climateValuation/valuationStatistics";
import { computeMonthlyReturns, computeBenchmarkReturn } from "../server/climateValuation/backtestCalculator";
import { walkForward } from "../server/climateValuation/walkForward";
import { MonetaryUnavailableError, monthlyMoneyUnavailable, qualifiedSourceAmount } from "../server/financialData/workbookMoneyConsumers";
import { monetaryContext } from "../server/financialData/workbookMoney";
import { withVerifiedSyntheticRows, verifiedSyntheticCoverage, verifiedSyntheticWalkForward } from "./fixtures/verifiedSyntheticMoney";
import type { CvTimeSeries } from "../shared/schema";
const raw = (companyId = 1, cap = 100, profit = 10) => ({ id: companyId, companyId, date: new Date("2025-01-31"),
  marketCap: cap, netProfit: profit, totalReturnIndex: 100, priceEarnings: null, scope1Emissions: 0, scope2Emissions: 0, scope3Emissions: null });
const coverage = (observations: any[]) => ({ companies: observations.map(r => ({ id: r.companyId, isin: `SYNTHETIC-IDENTITY-${r.companyId}` })),
  observations, reviews: observations.map(r => ({ companyId: r.companyId, eligible: true, mapping: "operating-geography" as const })),
  observationDate: "2025-01-31", informationCutoff: "2025-02-01T00:00:00.000Z", sourceId: "a".repeat(64) });
test("ACTUAL coverage retains every valid raw amount/count but withholds unknown USD-labelled capital totals and weights", () => {
  const rows = [raw(1, 100), raw(2, 300)], before = JSON.stringify(rows);
  const r = companyCoverage(coverage(rows));
  assert.equal(r.fullWorkbook.metrics.marketCap.availableCount, 2); assert.equal(r.fullWorkbook.metrics.marketCap.states.present, 2);
  assert.equal(r.fullWorkbook.metrics.marketCap.knownTotal, null); assert.equal(r.eligibleKnownValueCoverage.marketCap, null);
  assert.equal(r.fullWorkbook.metrics.marketCap.operatingGeography.knownValue, null);
  assert.equal(r.fullWorkbook.metrics.scope1Emissions.knownTotal, 0); assert.equal(JSON.stringify(rows), before);
  assert.equal(companyCoverage(coverage(rows.map(r => ({ ...r, marketCapCurrency: "USD" })))).fullWorkbook.metrics.marketCap.knownTotal, null);
  assert.match(r.limitations.join(" "), /valid raw amounts unconverted/);
});
test("Verified synthetic coverage retains original arithmetic; any unconverted native member withholds whole known-value total", () => {
  const rows = [raw(1, 100), raw(2, 300)];
  const known = verifiedSyntheticCoverage(coverage(rows));
  assert.equal(known.fullWorkbook.metrics.marketCap.knownTotal, 400); assert.equal(known.eligibleKnownValueCoverage.marketCap, 1);
  const mixed = verifiedSyntheticCoverage(coverage(rows.map(r => ({ ...r, marketCapCurrency: r.companyId === 2 ? "EUR" : "USD" }))));
  assert.equal(mixed.fullWorkbook.metrics.marketCap.availableCount, 2); assert.equal(mixed.fullWorkbook.metrics.marketCap.knownTotal, null);
});
test("Independent reported P/E survives; naked MC/Profit fallback and unknown scale refuse without changing source zero", () => {
  assert.equal(positivePE({ priceEarnings: 20, marketCap: null, netProfit: null }), 20);
  const r = raw(); assert.equal(positivePE(r), null);
  withVerifiedSyntheticRows([r], copies => {
    assert.equal(positivePE(copies[0]), 10);
    const ctx = monetaryContext.getStore()!;
    monetaryContext.run({ ...ctx, cells: ctx.cells.map(c => c.field === "netProfit" ? { ...c, magnitude: null } : c) },
      () => assert.equal(positivePE(copies[0]), null));
  });
  const zero = raw(1, 100, 0); assert.equal(positivePE(zero), null); assert.equal(zero.netProfit, 0);
});
test("Actual monthly-return builder and direct benchmark/walkforward refuse unqualified weights, never return fake zero", () => {
  const rows = [raw(), { ...raw(), date: new Date("2025-02-28"), totalReturnIndex: 110 }], before = JSON.stringify(rows);
  const data = computeMonthlyReturns(new Map([[1, rows as CvTimeSeries[]]]));
  assert.equal(data.size, 0); assert.ok(monthlyMoneyUnavailable(data)); assert.equal(JSON.stringify(rows), before);
  assert.throws(() => computeBenchmarkReturn([{ companyId: 1, monthKey: "2025-02", marketCap: 100, monthlyReturn: .1 }]), MonetaryUnavailableError);
  assert.throws(() => walkForward(new Map([["2025-02", [{ companyId: 1, marketCap: 100, monthlyReturn: .1 }]]]), new Map(), .02), MonetaryUnavailableError);
  assert.throws(() => walkForward(data, new Map(), .02), MonetaryUnavailableError);
});
test("Verified synthetic portfolio arithmetic remains unchanged; actual-source lag is mandatory", () => {
  const monthly = new Map([["2025-02", [{ companyId: 1, marketCap: 100, monthlyReturn: .1 }, { companyId: 2, marketCap: 300, monthlyReturn: -.1 }]]]);
  const r = verifiedSyntheticWalkForward(monthly, new Map(), .02);
  assert.ok(Math.abs(r.series[0].benchmarkReturn + .05) < 1e-12);
  withVerifiedSyntheticRows([raw()], rows => {
    const ctx = monetaryContext.getStore()!, c = ctx.cells.find(c => c.field === "marketCap")!;
    const item = { companyId: 1, marketCap: 100, monthlyReturn: .1, weightSource: c };
    assert.equal(walkForward(new Map([["2025-02", [item]]]), new Map(), .02).series.length, 1);
    assert.throws(() => walkForward(new Map([["2025-01", [item]]]), new Map(), .02), /before/);
    assert.throws(() => walkForward(new Map([["2025-02", [{ ...item, marketCap: 101 }]]]), new Map(), .02), /disagreement/);
    assert.equal(qualifiedSourceAmount(rows[0], "marketCap", "1900-01-01").value, null);
  });
});
