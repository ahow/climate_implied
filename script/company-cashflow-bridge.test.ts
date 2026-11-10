import assert from "node:assert/strict";
import test from "node:test";
import { buildFplCashCases, calculateFplCashBridge, fplCashAssumptions } from "../server/calculation/companyCashflowBridge";
import { buildFplSolarCases } from "../server/calculation/companyConditionalCases";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);
const solar = () => buildFplSolarCases().members[0].inputs;
const cash = () => {
  const { id, ...inputs } = fplCashAssumptions.members[0];
  return inputs;
};

test("all six incremental cash cases reconcile accrual and cash routes and debt balances", () => {
  const result = buildFplCashCases();
  assert.equal(result.members.length, 6);
  assert.equal(result.fullCompanyCaseCount, 0);
  for (const m of result.members) {
    assert.equal(m.years.length, 5);
    for (const [i, y] of m.years.entries()) {
      close(y.fcfe, y.cashRouteFcfe);
      close(y.revenue, y.cashCollections + y.increaseWorkingCapital);
      close(y.openingDebt - y.principalRepayment, y.closingDebt);
      close(y.fcfe, y.netIncome + y.depreciation - y.capex - y.increaseWorkingCapital + y.netBorrowing);
      if (i) close(y.openingReceivables, m.years[i - 1].closingReceivables);
      assert.ok(y.cashTax >= 0);
    }
    assert.equal(m.issuerFcfe, null);
    assert.equal(m.issuerGrowth, null);
    assert.equal(m.probabilityWeights, null);
    assert.equal(m.productionEligible, false);
  }
});

test("full timely recovery realizes allowed accounting return only under explicit cost/tax assumptions", () => {
  const m = calculateFplCashBridge(solar(), cash());
  for (const y of m.years) {
    close(y.netIncome, y.allowedEquityEarnings);
    assert.notEqual(y.fcfe, y.allowedEquityEarnings);
    close(y.cashCollections, y.revenue);
  }
  assert.ok(m.years[0].fcfe < 0);
});

test("collection delay changes cash/working capital, not accounting earnings; no terminal AR release", () => {
  const a = calculateFplCashBridge(solar(), cash());
  const b = calculateFplCashBridge(solar(), { ...cash(), collectionDeferredFraction: 0.25 });
  for (const [i, y] of b.years.entries()) {
    close(y.netIncome, a.years[i].netIncome);
    close(y.fcfe - a.years[i].fcfe, -y.increaseWorkingCapital);
  }
  close(a.cumulativeFcfe - b.cumulativeFcfe, b.years[4].closingReceivables);
  assert.ok(b.years[4].closingReceivables > 0);
  assert.notEqual(a.inputHash, b.inputHash);
});

test("failed recovery still incurs O&M, interest, depreciation, repayment and no tax refund", () => {
  const m = calculateFplCashBridge(buildFplSolarCases().members[2].inputs, cash());
  const y = m.years[3];
  assert.equal(y.revenue, 0);
  assert.equal(y.operatingMargin, null);
  assert.ok(y.cashOm > 0 && y.interest > 0 && y.depreciation > 0 && y.principalRepayment > 0);
  assert.equal(y.cashTax, 0);
  assert.ok(y.fcfe < 0);
});

test("missing, nonfinite, unbounded and extra inputs are refused; deterministic report", () => {
  assert.throws(() => calculateFplCashBridge(solar(), {}));
  for (const override of [{ cashTaxRate: 1 }, { annualDebtRate: -1 }, { annualOmUsdPerKw: Infinity },
    { collectionDeferredFraction: 1.1 }, { productionEligible: true }])
    assert.throws(() => calculateFplCashBridge(solar(), { ...cash(), ...override }));
  assert.deepEqual(buildFplCashCases(), buildFplCashCases());
});
