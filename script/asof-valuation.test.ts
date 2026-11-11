import test from "node:test";
import assert from "node:assert/strict";
import { buildAsOfRows } from "../server/financialData/asOfValuation";

const cf = (year: number, filed: string, ocf: number, overrides: Record<string, unknown> = {}) => ({
  date: `${year}-12-31`, filingDate: filed, period: "FY", reportedCurrency: "USD",
  operatingCashFlow: ocf, capitalExpenditure: -10, netDebtIssuance: 0, ...overrides });
const inc = (year: number, filed: string, ni: number) => ({ date: `${year}-12-31`, filingDate: filed, period: "FY", netIncome: ni });
const years = Array.from({ length: 10 }, (_, i) => 2016 + i);
const cashFlows = years.map(y => cf(y, `${y + 1}-02-20`, 100 + (y - 2016) * 10));
const incomes = years.map(y => inc(y, `${y + 1}-02-20`, 80));
const observations = Array.from({ length: 12 }, (_, i) => ({
  date: `${2016 + i}-07-22T00:00:00.000Z`, totalReturnIndex: 100 * 1.1 ** i, marketCap: 1000, netProfit: 80 / 1e6 * 1e6 / 1e6 * 1,
}));
const base = { companyId: "X", profileCurrency: "USD", cashFlows, incomes, observations };

test("uses only statements filed before the July observation and FY t+1→t+4 outcomes", () => {
  const { rows } = buildAsOfRows({ ...base, observations: observations.map(o => ({ ...o, netProfit: null })) });
  const r2017 = rows.find(r => r.origin === "2017-07-31")!;
  assert.equal(r2017.baseFiscalDate, "2016-12-31");
  // FY2017 FCFE 100, FY2020 FCFE 130.
  assert.ok(Math.abs((r2017.actualCashFlowGrowth as number) - ((130 / 100) ** (1 / 3) - 1)) < 1e-12);
  assert.equal(r2017.outcomeAvailableAt, "2021-02-20");
  assert.ok(Math.abs((r2017.gordonCashFlowGrowth as number) - (0.08 - 80 / 1e9)) < 1e-15);
  assert.ok(Math.abs((r2017.validationReturn as number) - 0.1) < 1e-12);
});

test("a statement filed after the observation is not used (no look-ahead)", () => {
  const late = cashFlows.map(s => s.date === "2016-12-31" ? { ...s, filingDate: "2017-08-01" } : s);
  const { rows, exclusions } = buildAsOfRows({ ...base, cashFlows: late, observations: observations.map(o => ({ ...o, netProfit: null })) });
  assert.ok(!rows.some(r => r.origin === "2017-07-31"));
  assert.ok(exclusions.some(e => e.origin === "2017-07-31" && /filed before/.test(e.reason)));
});

test("unit/boundary mismatch, non-USD and non-positive outcome FCFE are excluded, not repaired", () => {
  const mismatch = buildAsOfRows({ ...base, observations: observations.map(o => ({ ...o, netProfit: 1 })) });
  assert.equal(mismatch.rows.length, 0);
  assert.ok(mismatch.exclusions.every(e => /boundary|validation/.test(e.reason)));
  const fx = buildAsOfRows({ ...base, profileCurrency: "EUR", observations: observations.map(o => ({ ...o, netProfit: null })) });
  assert.equal(fx.rows.length, 0);
  const negative = cashFlows.map(s => s.date === "2020-12-31" ? { ...s, operatingCashFlow: 5 } : s);
  const n = buildAsOfRows({ ...base, cashFlows: negative, observations: observations.map(o => ({ ...o, netProfit: null })) });
  assert.equal(n.rows.find(r => r.origin === "2017-07-31")!.actualCashFlowGrowth, null);
});

test("explicit sensitivity rates change only valuations, never outcome or filing selection", () => {
  const input = { ...base, observations: observations.map(o => ({ ...o, netProfit: null })) };
  const original = buildAsOfRows(input);
  const rates = Object.fromEntries([2017, 2018, 2019, 2020, 2021, 2022].map(y => [`${y}-07-31`, .09]));
  const changed = buildAsOfRows({ ...input, costOfEquityByOrigin: rates });
  assert.equal(changed.rows.length, original.rows.length);
  for (let i = 0; i < original.rows.length; i++) {
    const a = original.rows[i], b = changed.rows[i];
    for (const k of ["actualCashFlowGrowth", "outcomeAvailableAt", "validationReturn", "baseFiscalDate", "baseFilingDate"])
      assert.equal(a[k], b[k], k);
    assert.ok(Math.abs(Number(b.gordonCashFlowGrowth) - Number(a.gordonCashFlowGrowth) - .01) < 1e-12);
  }
  const missing = buildAsOfRows({ ...input, costOfEquityByOrigin: {} });
  assert.equal(missing.rows.length, 0);
  assert.ok(missing.exclusions.every(e => /rate/.test(e.reason)));
});
test("S11-040 missing original earnings statement gives a named origin-specific Gordon exclusion, not zero", () => {
  const input = { ...base, incomes: [], observations: observations.map(o => ({ ...o, netProfit: null })) };
  const missing = buildAsOfRows(input);
  assert.deepEqual(missing.rows, []);
  for (const origin of ["2017-07-31", "2018-07-31", "2019-07-31", "2020-07-31", "2021-07-31", "2022-07-31"])
    assert.ok(missing.exclusions.some(e => e.companyId === "X" && e.origin === origin &&
      e.reason === "No matching income statement filed before origin"), origin);
  assert.deepEqual(input.incomes, []);
  assert.equal(input.observations[1].date, "2017-07-22T00:00:00.000Z");
});
for (const [name, earnings] of [["positive", 80], ["negative", -80], ["zero", 0]] as const)
  test(`S11-040 dated ${name} earnings Gordon fixture preserves actual r and native monetary basis`, () => {
    const rate = .095;
    const result = buildAsOfRows({ ...base,
      incomes: incomes.map(i => ({ ...i, netIncome: earnings })),
      observations: observations.map(o => ({ ...o, netProfit: null })),
      costOfEquityByOrigin: Object.fromEntries([2017, 2018, 2019, 2020, 2021, 2022].map(y => [`${y}-07-31`, rate])),
    });
    const row = result.rows.find(r => r.origin === "2017-07-31")!;
    assert.equal(row.informationDate, "2017-07-22");
    assert.equal(row.baseFiscalDate, "2016-12-31");
    assert.equal(row.baseFilingDate, "2017-02-20");
    assert.equal(row.outcomeAvailableAt, "2021-02-20");
    assert.equal(row.currency, "USD");
    if (name === "positive") {
      assert.equal(row.gordonCashFlowGrowth, rate - earnings / (1000 * 1e6));
      assert.equal(row.gordonSignal, row.gordonCashFlowGrowth);
    } else {
      assert.equal(row.gordonCashFlowGrowth, null);
      assert.equal(row.gordonSignal, null);
      assert.ok(result.exclusions.some(e => e.origin === "2017-07-31" && e.reason === "Gordon unavailable: non-positive earnings"));
    }
  });
