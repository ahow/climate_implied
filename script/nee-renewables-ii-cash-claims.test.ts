import { test } from "node:test";
import assert from "node:assert/strict";
import { renewablesIiAvailableCashClaim as allocate } from "../server/calculation/neeRenewablesIiCashClaims";
const base = { availableCashUsd: 100, classBFractionHeldByXplr: .3, section701ExceptionApplies: false,
  legallyDistributable: true, period: "post-flip" as const };
test("synthetic100USDfunded cash independently partitions source40%-diversion/25%-cap", () => {
  const r = allocate(base);
  assert.equal(r.status, "conditional-contractual-branch-executed");
  assert.ok(Math.abs(r.xplrCashUsd! - 18.82) < 1e-10);
  assert.ok(Math.abs(r.externalClassBCashUsd! - 81.18) < 1e-10);
  assert.equal(r.xplrCashUsd! + r.externalClassBCashUsd!, 100);
  const pre = allocate({ ...base, period: "pre-flip-restored-95-percent" });
  assert.ok(Math.abs(pre.xplrCashUsd! - 96.5) < 1e-10);
  const capped = allocate({ ...base, classBFractionHeldByXplr: .9 });
  assert.equal(capped.classBReallocationPerAvailableDollar, .2475);
  const all = allocate({ ...base, classBFractionHeldByXplr: 1 });
  assert.equal(all.xplrCashUsd, 100);
});
test("unknown AvailableCash, legality or exception predicate stays unknown, never gross-CFOproxy", () => {
  assert.equal(allocate({ ...base, availableCashUsd: null }).status, "unresolved-source-inputs");
  assert.equal(allocate({ ...base, section701ExceptionApplies: null }).status, "unresolved-source-inputs");
  assert.equal(allocate({ ...base, legallyDistributable: null }).status, "unresolved-source-inputs");
  assert.equal(allocate({ ...base, section701ExceptionApplies: true }).status, "refused-branch-not-implemented");
  assert.throws(() => allocate({ ...base, classBFractionHeldByXplr: 1.1 }));
  assert.throws(() => allocate({ ...base, availableCashUsd: NaN }));
});
