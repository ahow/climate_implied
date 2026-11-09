import test from "node:test";
import assert from "node:assert/strict";
import { checkMemberConvergence } from "../server/calculation/memberConvergence";

test("5000/10000 convergence retains censored quantiles and fixed tolerances", () => {
  const members = Array.from({ length: 10000 }, (_, i) => ({
    id: `m${String(i).padStart(5, "0")}`, temperature2100C: 2,
    emissions2050GtCO2e: 30, emissions2100GtCO2e: 10,
    durableGhgZero: i % 2 ? null : 2050, durableCo2Zero: null,
  }));
  const x = { manifestId: "test", emissionsToleranceGtCO2e: .1, members };
  const result = checkMemberConvergence(x);
  assert.equal(result.passed, true);
  assert.equal(result.netZero.ghg.p90.status, "both-right-censored");
  assert.equal(result.netZero.co2.median.absoluteDifferenceYears, null);
  assert.deepEqual(checkMemberConvergence({ ...x, members: [...members].reverse() }), result);
  const shifted = members.map((m, i) => ({ ...m, temperature2100C: i >= 5000 ? 3 : 2 }));
  assert.equal(checkMemberConvergence({ ...x, members: shifted }).passed, false);
  assert.throws(() => checkMemberConvergence({ ...x, members: members.slice(1) }));
  assert.throws(() => checkMemberConvergence({ ...x, emissionsToleranceGtCO2e: 0 }));
  assert.throws(() => checkMemberConvergence({ ...x, members: members.map(m => ({ ...m, id: "duplicate" })) }));
});
