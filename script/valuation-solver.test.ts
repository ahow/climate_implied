import test from "node:test";
import assert from "node:assert/strict";
import { equityValue, reverseEquityGrowth } from "../server/calculation/reverseValuation";

const assumptions = { baseEarnings: 100, discountRate: .1, terminalGrowth: .03,
  returnOnEquity: .2, sharesBasis: "total-equity" as const };
test("constant-growth reinvestment fixture reproduces closed-form equity value", () => {
  // Retained fraction g/ROE; distributed earnings = E*(1-g/ROE).
  const expected = 100 * 1.03 * (1 - .03 / .2) / (.1 - .03);
  assert.ok(Math.abs(equityValue({ ...assumptions, stageOneGrowth: .03 }) - expected) < 1e-8);
});
test("reverse solver recovers known well-posed growth without forcing ambiguous cases", () => {
  const value = equityValue({ ...assumptions, stageOneGrowth: .06 });
  const solved = reverseEquityGrowth({ ...assumptions, marketCap: value, minimumGrowth: -.1, maximumGrowth: .12 });
  assert.equal(solved.status, "solved");
  if (solved.status === "solved") assert.ok(Math.abs(solved.growth - .06) < .0001);
  assert.equal(reverseEquityGrowth({ ...assumptions, marketCap: 1e12,
    minimumGrowth: -.1, maximumGrowth: .12 }).status, "no-defensible-solution");
});
test("invalid financial inputs and terminal assumptions fail explicitly", () => {
  assert.throws(() => equityValue({ ...assumptions, terminalGrowth: .1, stageOneGrowth: .04 }));
  assert.throws(() => equityValue({ ...assumptions, baseEarnings: -1, stageOneGrowth: .04 }));
  assert.throws(() => equityValue({ ...assumptions, returnOnEquity: .02, stageOneGrowth: .04 }));
});
