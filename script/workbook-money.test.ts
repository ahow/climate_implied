import { test } from "node:test";
import assert from "node:assert/strict";
import { checkedWorkbookMoney, monetaryContext, qualifyMonetaryDates, type MonetaryContext, type MoneyCellEvidence } from "../server/financialData/workbookMoney";
import { computeGroupAggregates } from "../server/climateValuation/carbonPriceCalculator";
const sha = "a".repeat(64), reviewId = "b".repeat(64), isin = "US0000000001";
const cell = (field: "marketCap" | "netProfit", value: number, currency: string | null = "USD", date = "2025-02-22T00:00:00.000Z"): MoneyCellEvidence => ({
  companyId: 1, isin, field, sourceId: sha, sheet: field === "marketCap" ? "MV" : "Profit", cell: "B2", observationDate: date,
  nativeValue: value, nativeCurrency: currency, magnitude: "millions", denominationEvidenceHash: sha
});
const context = (cells: MoneyCellEvidence[]): MonetaryContext => ({ cutoff: "2026-01-01T00:00:00.000Z", targetCurrency: "USD",
  identities: [{ companyId: 1, isin, reviewId, status: "approved", reviewedAt: "2025-02-23T00:00:00.000Z" }], cells, fx: [] });
const row = (cells: MoneyCellEvidence[]) => ({
  id: 1, companyId: 1, date: new Date("2025-02-22T00:00:00.000Z"), marketCap: cells[0].nativeValue, netProfit: cells[1].nativeValue,
  priceEarnings: 10, totalReturnIndex: null, scope1Emissions: 1, scope2Emissions: 1, scope3Emissions: 1,
  sourceCells: Object.fromEntries(cells.map(c => [c.field, { ...c, originalValue: c.nativeValue }]))
});
test("unknown denomination/magnitude/provenance and absent accepted identity are withheld, not defaulted", () => {
  const c = cell("marketCap", 100), ctx = context([c]);
  assert.equal(checkedWorkbookMoney(c, ctx).value, 100);
  for (const changed of [{ nativeCurrency: null }, { magnitude: null }, { denominationEvidenceHash: null }])
    assert.equal(checkedWorkbookMoney({ ...c, ...changed }, ctx).value, null);
  assert.equal(checkedWorkbookMoney(c, { ...ctx, identities: [] }).value, null);
  assert.equal(checkedWorkbookMoney(c, { ...ctx, identities: [...ctx.identities, ...ctx.identities] }).value, null);
});
test("explicit minor units normalize once, independently of quote-price conventions", () => {
  for (const [minor, major] of [["GBp", "GBP"], ["ZAc", "ZAR"], ["ILA", "ILS"]]) {
    const c = cell("netProfit", 100, minor), ctx = { ...context([c]), targetCurrency: major };
    assert.equal(checkedWorkbookMoney(c, ctx).value, 1);
    assert.equal(checkedWorkbookMoney(cell("netProfit", 100, major), ctx).value, 100);
  }
});
test("only exact authorized identity/source-day/oriented FX receipt qualifies; no nearest-day/inversion", () => {
  const c = cell("netProfit", 100, "EUR"), ctx = context([c]);
  const fx = { identityReviewId: reviewId, isin, base: "EUR", quote: "USD", date: "2025-02-22", quotePerBase: 1.2,
    sourceHash: sha, sourceUrl: "https://example.test/authorized-source", authorizedAt: "2025-02-23T00:00:00Z" };
  assert.equal(checkedWorkbookMoney(c, ctx).value, null);
  assert.equal(checkedWorkbookMoney(c, { ...ctx, fx: [fx] }).value, 120);
  for (const bad of [{ date: "2025-02-21" }, { isin: "OTHER" }, { identityReviewId: sha }, { base: "USD", quote: "EUR" }, { quotePerBase: 0 }, { authorizedAt: "2027-01-01" }])
    assert.equal(checkedWorkbookMoney(c, { ...ctx, fx: [{ ...fx, ...bad }] }).value, null);
  assert.equal(checkedWorkbookMoney(c, { ...ctx, fx: [fx, fx] }).value, null);
});
test("unique same-month Profit retains actual source day and true zero; cross-month/proxy-date refuses", () => {
  const cells = [cell("marketCap", 100), cell("netProfit", 0, "USD", "2025-02-04T00:00:00.000Z")], ctx = context(cells);
  const r = { ...row(cells), derivations: { netProfit: { method: "unique-same-calendar-month-source-period-alignment; not-source-cell-infill" } } };
  const converted = qualifyMonetaryDates([r], ctx);
  assert.equal(converted.length, 1); assert.equal(converted[0].netProfit, 0);
  assert.equal(converted[0].sourceCells.netProfit.observationDate, "2025-02-04T00:00:00.000Z");
  assert.equal(qualifyMonetaryDates([{ ...r, derivations: {} }], ctx).length, 0);
  assert.equal(qualifyMonetaryDates([{ ...r, date: new Date("2025-03-22") }], ctx).length, 0);
  assert.equal(r.netProfit, 0); assert.equal(r.marketCap, 100);
});
test("FX follows Profit original source day rather than aligned RI day", () => {
  const cells = [cell("marketCap", 100), cell("netProfit", 10, "EUR", "2025-02-04T00:00:00.000Z")], ctx = context(cells);
  const r = { ...row(cells), derivations: { netProfit: { method: "unique-same-calendar-month-source-period-alignment; not-source-cell-infill" } } };
  const fx = { identityReviewId: reviewId, isin, base: "EUR", quote: "USD", date: "2025-02-22", quotePerBase: 2,
    sourceHash: sha, sourceUrl: "https://example.test/source", authorizedAt: "2025-02-23" };
  assert.equal(qualifyMonetaryDates([r], { ...ctx, fx: [fx] }).length, 0);
  assert.equal(qualifyMonetaryDates([r], { ...ctx, fx: [{ ...fx, date: "2025-02-04" }] })[0].netProfit, 20);
});
test("unknown/unconverted member withholds whole timestamp rather than emitting selected converted total", () => {
  const cells = [cell("marketCap", 100), cell("netProfit", 10)], good = row(cells), bad = { ...good, companyId: 2 };
  assert.equal(qualifyMonetaryDates([good, bad], context(cells)).length, 0);
  assert.equal(qualifyMonetaryDates([good]).length, 0);
  assert.equal(qualifyMonetaryDates([{ ...good, monetaryQualification: "explicit-source-cell-USD-millions-1" }]).length, 0);
});
test("ACTUAL group aggregation refuses native money without context; authorized conversion is not applied twice", () => {
  const cells = [cell("marketCap", 100, "GBp"), cell("netProfit", 10, "GBp")], r = row(cells), ctx = context(cells);
  ctx.fx = [{ identityReviewId: reviewId, isin, base: "GBP", quote: "USD", date: "2025-02-22", quotePerBase: 1.2,
    sourceHash: sha, sourceUrl: "https://example.test/source", authorizedAt: "2025-02-23" }];
  assert.equal(computeGroupAggregates([r], false, false, 0).totalMarketCap, null);
  monetaryContext.run(ctx, () => {
    const first = qualifyMonetaryDates([r]);
    assert.equal(first.length, 1);
    const aggregated = computeGroupAggregates(first, false, false, 0);
    assert.equal(aggregated.totalMarketCap, 1.2); assert.equal(aggregated.totalProfit, .12); assert.equal(aggregated.peRatio, 10);
  });
});
