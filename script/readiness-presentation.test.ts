import test from "node:test";
import assert from "node:assert/strict";
import { calculationReadiness } from "../server/calculation/readiness";
test("readiness names the published-reference default without promoting candidate diagnostics", () => {
  const r = calculationReadiness();
  assert.equal(r.defaultEngine, "published-scenario-references");
  assert.equal(r.candidateEnabled, false);
  assert.ok(r.checks.some(c => !c.passed));
});
