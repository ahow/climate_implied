import test from "node:test";
import assert from "node:assert/strict";
import { accountOverlappingSleeves } from "../server/calculation/pairedResearchSleeves";
import { accountResearchEvents } from "../server/calculation/pairedResearchEvents";
import { constrainedLongOnly } from "../server/calculation/pairedResearchLongOnly";
import { assembleOriginalResearchCorpus } from "../server/calculation/pairedResearchCorpus";

// Hand arithmetic fixtures only; no empirical observations or efficacy.
const hash = "a".repeat(64);
const stamp = (m: number) => new Date(Date.UTC(2020, m, 1)).toISOString();
const schedule = { initialCapital: 120, deployments: [
  { id: "A", origin: "2019-12-31T00:00:00Z", executionAt: stamp(0), maturityAt: stamp(12), capital: 10 },
  { id: "B", origin: "2020-01-31T00:00:00Z", executionAt: stamp(1), maturityAt: stamp(13), capital: 10 },
] };
const sleeve = (id: string, value: number, settlement = false) => ({
  id, cash: settlement ? value : 0, restrictedCash: 0, positions: settlement ? {} : { issuer: value },
  settlement, sourceHashes: [hash],
});
const marks = [
  { at: stamp(0), reserveInterest: 0, sleeves: [sleeve("A", 10)] },
  { at: stamp(1), reserveInterest: 0, sleeves: [sleeve("A", 11), sleeve("B", 10)] },
  { at: stamp(12), reserveInterest: 0, sleeves: [sleeve("A", 12, true), sleeve("B", 11)] },
  { at: stamp(13), reserveInterest: 0, sleeves: [sleeve("B", 12, true)] },
];
test("two overlapping 12-month cohorts deploy 20 of 120, settle once, aggregate issuer exposure", () => {
  const r = accountOverlappingSleeves(schedule, marks);
  assert.deepEqual(r.map(x => x.nav), [120, 121, 123, 124]);
  assert.deepEqual(r.map(x => x.cash), [110, 100, 112, 124]);
  assert.equal(r[1].positions.issuer, 21);
  assert.equal(r[3].grossExposure, 0);
  assert.throws(() => accountOverlappingSleeves(schedule, [marks[0], { ...marks[1], sleeves: [sleeve("B", 10)] }, ...marks.slice(2)]), /Incomplete/);
  assert.throws(() => accountOverlappingSleeves({ ...schedule, initialCapital: 15 }, marks), /exceeds/);
});
test("repeated and concurrent sleeve requests have no cross-request state", async () => {
  const before = JSON.stringify({ schedule, marks });
  const r = await Promise.all(Array.from({ length: 12 }, async () => accountOverlappingSleeves(schedule, marks)));
  r.forEach(x => assert.deepEqual(x, r[0]));
  assert.equal(JSON.stringify({ schedule, marks }), before);
});
test("deployment marks cannot invent gains or lose capital, including later cohorts", () => {
  const initial = structuredClone(marks);
  initial[0].sleeves[0].positions = { issuer: 11 };
  assert.throws(() => accountOverlappingSleeves(schedule, initial), /reconcile deployed capital/);
  const later = structuredClone(marks);
  later[1].sleeves[1].positions = { issuer: 9 };
  assert.throws(() => accountOverlappingSleeves(schedule, later), /reconcile deployed capital/);
});
test("reserve interest uses previous reserve and elapsed time, never first-mark or future funding", () => {
  const first = structuredClone(marks); first[0].reserveInterest = 1;
  assert.throws(() => accountOverlappingSleeves(schedule, first), /Initial sleeve mark/);
  const unbound = structuredClone(marks); unbound[1].reserveInterest = 1;
  assert.throws(() => accountOverlappingSleeves(schedule, unbound), /Missing dated/);
  const interest = 110 * .1 * 31 / 365.25;
  const accrual = { fromAt: stamp(0), toAt: stamp(1), openingReserve: 110, annualRate: .1,
    availableAt: stamp(0), sourceHash: hash };
  const dated = marks.map((m, i) => i === 1 ? { ...m, reserveInterest: interest, reserveAccrual: accrual } : m);
  assert.ok(Math.abs(accountOverlappingSleeves(schedule, dated)[1].nav - (121 + interest)) < 1e-9);
  assert.throws(() => accountOverlappingSleeves(schedule,
    dated.map((m, i) => i === 1 ? { ...m, reserveAccrual: { ...accrual, openingReserve: 100 } } : m)), /opening capital/);
  assert.throws(() => accountOverlappingSleeves(schedule,
    dated.map((m, i) => i === 1 ? { ...m, reserveAccrual: { ...accrual, availableAt: stamp(1) } } : m)), /timing/);
  assert.throws(() => accountOverlappingSleeves(schedule, marks, stamp(12)), /cutoff/);
});
const event = (action: unknown) => ({ at: stamp(1), sourceHash: hash, action });
const book = () => ({
  startAt: stamp(0), endAt: stamp(2), cash: 80, restrictedCash: 0, units: { old: 2, short: -1 },
  coverageSourceHash: hash,
  events: [
    event({ kind: "split", companyId: "old", ratio: 2 }),
    event({ kind: "dividend", companyId: "old", perShare: 1, fx: 2 }),
    event({ kind: "dividend", companyId: "short", perShare: 2, fx: 1 }),
    event({ kind: "merger", companyId: "old", successor: "new", ratio: .5, cashPerShare: 3, fx: 1 }),
    event({ kind: "collateral", amount: 20 }),
    event({ kind: "borrow", companyId: "short", available: true, observedFee: 1, hypotheticalFee: null }),
    event({ kind: "financing", expense: 2 }),
  ],
  endMarks: { new: { price: 10, fx: 1 }, short: { price: 5, fx: 1 } },
});
test("dated split/dividend/merger, short liability, collateral and expenses hand-reconcile", () => {
  const r = accountResearchEvents(book());
  // Cash 80+8-2+12-20-1-2=75; restricted 20; positions 20-5=15.
  assert.equal(r.cash, 75); assert.equal(r.restrictedCash, 20); assert.equal(r.nav, 110);
  assert.deepEqual(r.units, { new: 2, short: -1 });
  assert.equal(r.hypothetical, false);
  const b = book();
  b.events.push(event({ kind: "delisting", companyId: "new", cashPerShare: 4, fx: 1 }));
  assert.equal(accountResearchEvents(b).nav, 98);
});
test("missing lifecycle marks, borrow, financing and invalid collateral fail closed", () => {
  const b = book();
  delete (b.endMarks as any).new;
  assert.throws(() => accountResearchEvents(b), /Missing end mark/);
  const noBorrow = book(); noBorrow.events.splice(5, 1);
  assert.throws(() => accountResearchEvents(noBorrow), /Missing borrow/);
  const noFinancing = book(); noFinancing.cash = -100; noFinancing.events.pop();
  assert.throws(() => accountResearchEvents(noFinancing), /Missing financing/);
  const hyp = book(); hyp.events[5] = event({ kind: "borrow", companyId: "short", available: null, observedFee: null, hypotheticalFee: 4 });
  assert.equal(accountResearchEvents(hyp).hypothetical, true);
  const forbidden = book(); forbidden.events[5] = event({ kind: "borrow", companyId: "short", available: false, observedFee: 1, hypotheticalFee: null });
  assert.throws(() => accountResearchEvents(forbidden), /unavailable/);
});
const rows = ["a", "b", "c", "d"].map((companyId, i) => ({
  companyId, sector: i < 2 ? "x" : "y", marketCap: 100, score: i % 2 ? -1 : 1,
  eligible: true, liquidity: 1000, availableAt: stamp(0),
}));
const variant = { sectorNeutral: true, maxActiveWeight: .1, participation: .1, capital: 100, rebalanceMonths: 3 };
test("sector-neutral active-weight overlay and quarterly drift preserve constraints", () => {
  const r = constrainedLongOnly(rows, variant, 1, stamp(1), 0, {});
  for (const [id, expected] of Object.entries({ a: .35, b: .15, c: .35, d: .15 }))
    assert.ok(Math.abs(r.weights[id] - expected) < 1e-12, `${id}: numerical weight tolerance`);
  assert.deepEqual(constrainedLongOnly(rows, variant, 5, stamp(2), 1, r.weights).weights, r.weights);
  assert.throws(() => constrainedLongOnly(rows.map(r => ({ ...r, liquidity: 0 })), variant, 1, stamp(1), 0, {}), /Infeasible/);
  assert.throws(() => constrainedLongOnly(rows, variant, 1, stamp(0), 0, {}), /unavailable/);
});
test("original assembly never converts an empty or unknown-vintage corpus to evidence", () => {
  const r = assembleOriginalResearchCorpus({ mode: "point-in-time", dataEnd: stamp(1), artifacts: [], periods: [] });
  assert.deepEqual(r.accepted, []); assert.equal(r.efficacy, "WITHHELD");
  assert.throws(() => assembleOriginalResearchCorpus({ mode: "point-in-time", dataEnd: stamp(1),
    artifacts: [{ hash, payload: {}, originUri: "retained", availableAt: stamp(0), capturedAt: stamp(0), vintage: "unknown" }], periods: [] }));
});
