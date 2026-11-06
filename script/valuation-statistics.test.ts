import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeRates, positivePE } from "../server/climateValuation/valuationStatistics";
import { computePerCompanyImpliedDecarbRates, computeDecarbGapScores } from "../server/climateValuation/decarbGapCalculator";
import type { CvCompany, CvTimeSeries } from "../shared/schema";

test("mean, median and percentiles represent the cross section", () => {
  assert.deepEqual(summarizeRates([10, 1, 2, 3]), { count: 4, mean: 4, median: 2.5, p25: 1.75, p75: 4.75 });
  assert.equal(summarizeRates([]), null);
  assert.equal(summarizeRates([NaN]), null);
});
test("P/E requires finite positive inputs; valid high multiples are not silently capped", () => {
  const base = { priceEarnings: null, marketCap: 100, netProfit: 5 };
  assert.equal(positivePE(base), 20);
  for (const bad of [0, -5, Infinity, NaN]) assert.equal(positivePE({ ...base, netProfit: bad }), null);
  assert.equal(positivePE({ ...base, priceEarnings: 1000 }), 1000);
  assert.equal(positivePE({ ...base, marketCap: -100 }), null);
});
test("common climate and equity-cost changes do not create a new within-peer ranking", () => {
  const companies = [1, 2, 3].map(id => ({ id, sector: "same" } as CvCompany));
  const rows = new Map(companies.map((c, i) => [c.id, {
    companyId: c.id, priceEarnings: [10, 20, 40][i], marketCap: 100, netProfit: 5,
  } as CvTimeSeries]));
  const a = computeDecarbGapScores(companies, rows, 1, "sector_relative", .08);
  const b = computeDecarbGapScores(companies, rows, 9, "sector_relative", .12);
  assert.deepEqual(a, b);
  const rates = computePerCompanyImpliedDecarbRates(companies, rows, "sector_relative");
  assert.equal(rates.length, 3);
  assert.ok(Math.abs(rates[0].impliedDecarbRate + 5) < 1e-12);
  assert.ok(Math.abs(rates[1].impliedDecarbRate) < 1e-12);
});
