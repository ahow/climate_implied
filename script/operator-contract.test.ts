import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response, NextFunction } from "express";
import { releaseSafety } from "../server/releaseSafety";
import { operatorContract, operatorLifecyclePreflight } from "../server/operatorContract";

function dispatch(path: string, method: string) {
  let status: number | undefined, body: unknown, nextCalls = 0;
  const response = {
    status(value: number) { status = value; return this; },
    json(value: unknown) { body = value; return this; },
  };
  releaseSafety()({ path, method } as Request, response as Response,
    (() => { nextCalls++; }) as NextFunction);
  return { status, body, nextCalls };
}

for (const path of [
  "/api/cv/upload",
  "/api/data/proposals/test-disposable-only/approve",
  "/api/data/indicator/evSalesSharePct/manual",
  "/api/operator/capture",
]) {
  test(`public mutation remains forbidden: ${path}`, () => {
    const result = dispatch(path, "POST");
    assert.equal(result.status, 403);
    assert.equal(result.nextCalls, 0);
    assert.equal((result.body as { error: string }).error, "operator-cli-required");
  });
}

test("safe reads still pass without granting mutation authority", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"])
    assert.deepEqual(dispatch("/api/operator/capture", method),
      { status: undefined, body: undefined, nextCalls: 1 });
});

test("pure diagnostic permission is not an operator capability", () => {
  assert.equal(dispatch("/api/calculation/evaluate-signal", "POST").nextCalls, 1);
  assert.equal(dispatch("/api/calculation/evaluate-signal", "PUT").status, 403);
});

test("DEV, unset and production never fabricate an HTTP principal", () => {
  for (const environment of ["development", undefined, "production"]) {
    const report = operatorLifecyclePreflight(environment);
    assert.equal(report.privilegedHttpEligible, false);
    assert.equal(report.actualMutationLifecycleExecuted, false);
    assert.equal(report.contract.httpPrincipal, null);
    assert.equal(report.contract.httpRole, null);
    assert.equal(report.developmentExplicit, environment === "development");
  }
});

test("existing commands and exact owner actions are retained without execution", () => {
  assert.equal(operatorContract.authority, "authorized-workspace-shell");
  assert.match(operatorContract.existingCommands.overlayDecision, /overlay-review.ts/);
  const report = operatorLifecyclePreflight("development");
  assert.equal(report.blockers.length, 2);
  assert.ok(report.blockers.every(blocker => blocker.owner && blocker.action && blocker.evidence));
  assert.ok(report.eligibleNow.length > 0);
  assert.ok(report.unproven.some(value => value.includes("full post-mutation restore")));
});
