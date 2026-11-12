import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMemberMetrics } from "../server/calculation/memberMetrics";
const years = Array.from({ length: 77 }, (_, i) => 2024 + i);
function input() {
  return { memberIds: ["a", "b"], years, baseline: "1850-1900" as const,
    temperature: years.map(() => [2, 3]),
    ghgGtCO2e: years.map(y => [y < 2050 ? 100 : y === 2060 ? 1 : -1, 100]),
    co2Gt: years.map(y => [y < 2040 ? 50 : -1, 50]) };
}
test("coherent member metrics distinguish first crossing, rebound and durable net zero", () => {
  const r = summarizeMemberMetrics(input());
  assert.equal(r.members[0].firstGhgZero, 2050);
  assert.equal(r.members[0].durableGhgZero, 2061);
  assert.equal(r.members[0].durableCo2Zero, 2040);
  assert.equal(r.ghgNetZero.probabilityBy2050, 0);
  assert.equal(r.ghgNetZero.neverReachedShare, .5);
  assert.equal(r.ghgNetZero.p90, null);
  assert.equal(r.temperature.headline.mean, 2.5);
  assert.equal(r.members[0].nearZero5Percent2024, 2050);
  assert.equal(r.members[0].reductionRates[1].annualFraction, null);
});
test("incomplete years and misaligned member arrays cannot yield a headline", () => {
  const e = input();
  assert.throws(() => summarizeMemberMetrics({ ...e, years: e.years.slice(1) }));
  assert.throws(() => summarizeMemberMetrics({ ...e, ghgGtCO2e: [[1]] }));
  assert.throws(() => summarizeMemberMetrics({ ...e, memberIds: ["a", "a"] }));
});
test("member ordering does not change hashes, metrics or saved member pairing", () => {
  const a = input();
  const b = { ...a, memberIds: [...a.memberIds].reverse(),
    temperature: a.temperature.map(r => [...r].reverse()),
    ghgGtCO2e: a.ghgGtCO2e.map(r => [...r].reverse()),
    co2Gt: a.co2Gt.map(r => [...r].reverse()) };
  assert.deepEqual(summarizeMemberMetrics(a), summarizeMemberMetrics(b));
});
test("S07-020 exact supplied-member fixtures: rise, fall, rebound, never crossing", () => {
  const memberIds = ["rise", "fall", "rebound", "never"];
  const paths = years.map(y => [
    y < 2030 ? 100 + 5 * (y - 2024) : y < 2050 ? 100 : -1,
    y < 2040 ? 100 * (2040 - y) / 16 : 0,
    y < 2050 ? 100 : y === 2060 ? 1 : -1,
    100,
  ]);
  const result = summarizeMemberMetrics({
    memberIds, years, baseline: "1850-1900",
    temperature: years.map(() => [2, 2, 2, 2]),
    ghgGtCO2e: paths, co2Gt: paths,
  });
  const expected = {
    rise: [2050, 2050], fall: [2040, 2040], rebound: [2050, 2061], never: [null, null],
  };
  for (const member of result.members) {
    const pair = expected[member.id as keyof typeof expected];
    assert.deepEqual([member.firstGhgZero, member.durableGhgZero], pair);
    assert.deepEqual([member.firstCo2Zero, member.durableCo2Zero], pair);
  }
  assert.equal(result.ghgNetZero.probabilityBy2050, .5);
  assert.equal(result.ghgNetZero.neverReachedShare, .25);
  assert.equal(result.ghgNetZero.p90, null);
  assert.equal(result.physicalValidation, false);
});
